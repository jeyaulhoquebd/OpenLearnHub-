import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import { decodeCursor, encodeCursor } from '../lib/resourceAdmin.js';
import {
  REVIEW_SCAN_LIMIT,
  applyReviewModeration,
  reviewSearchText,
  serializeReview
} from '../lib/reviewAdmin.js';

/**
 * Admin reviews API.
 *
 * Moderation is intentionally small: hide, show and delete. Each action runs in
 * a transaction that also recomputes the resource's `ratingAvg` and
 * `ratingCount`, so cards, filters and the detail page stay in sync.
 *
 * Listing uses a bounded scan (search across reviewer, comment and resource
 * title cannot be expressed as a Firestore query) with an opaque offset cursor.
 */

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  resourceId: z.string().trim().max(128).optional().default(''),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  cursor: z.string().max(500).optional().default(''),
  limit: z.coerce.number().int().min(5).max(50).optional().default(20)
});

const bulkSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
  action: z.enum(['hide', 'show', 'delete'])
});

function requireDb(res) {
  const db = getDb();
  if (!db) {
    apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    return null;
  }
  return db;
}

function parseBody(res, schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    apiError(res, 400, 'invalid_review_action', 'That moderation action is not valid.');
    return null;
  }
  return parsed.data;
}

/** Batch-loads resource summaries for the rows currently on screen. */
async function loadResources(db, ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  const byId = new Map();

  for (let index = 0; index < unique.length; index += 300) {
    const chunk = unique.slice(index, index + 300);
    // eslint-disable-next-line no-await-in-loop
    const snapshots = await db.getAll(
      ...chunk.map((id) => db.collection('resources').doc(id))
    );
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) byId.set(snapshot.id, { id: snapshot.id, ...snapshot.data() });
    });
  }

  return byId;
}

function time(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const adminReviewsRouter = Router();

/**
 * GET /api/admin/reviews
 * Filters: q, resourceId, rating. Pagination: limit + opaque cursor.
 * Hidden reviews are included (this is the moderation queue).
 */
adminReviewsRouter.get('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const raw = { ...req.query };
    Object.keys(raw).forEach((key) => {
      if (raw[key] === '') delete raw[key];
    });

    const parsed = listQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_query', 'Those filters are not valid.');
    }
    const { q, resourceId, rating, cursor, limit } = parsed.data;

    let query = db.collection('reviews');
    if (resourceId) query = query.where('resourceId', '==', resourceId);

    const snapshot = await query.limit(REVIEW_SCAN_LIMIT).get();
    const resources = await loadResources(
      db,
      snapshot.docs.map((doc) => doc.data()?.resourceId)
    );

    const needle = q.toLowerCase();
    let rows = snapshot.docs
      .map((doc) => serializeReview(doc, resources.get(doc.data()?.resourceId) || null))
      .filter((review) => (rating ? review.rating === rating : true))
      .filter((review) => (needle ? reviewSearchText(review).includes(needle) : true))
      .sort((a, b) => time(b.createdAt) - time(a.createdAt));

    const total = rows.length;
    const offset = decodeCursor(cursor);
    const items = rows.slice(offset, offset + limit);
    const nextOffset = offset + items.length;

    return res.json({
      items,
      total,
      limit,
      nextCursor: nextOffset < total ? encodeCursor(nextOffset) : null,
      scanned: snapshot.size,
      scanLimit: REVIEW_SCAN_LIMIT,
      truncated: snapshot.size >= REVIEW_SCAN_LIMIT
    });
  } catch (error) {
    return next(error);
  }
});

/** Shared handler for hide / show / delete on a single review. */
function moderate(mode) {
  return async (req, res, next) => {
    try {
      const db = requireDb(res);
      if (!db) return undefined;

      const { id } = req.params;
      if (!id || id.length > 300) {
        return apiError(res, 400, 'invalid_id', 'That review id is not valid.');
      }

      let result;
      try {
        result = await applyReviewModeration(db, {
          reviewId: id,
          mode,
          adminUid: req.user.uid
        });
      } catch (error) {
        if (error?.code === 'review_not_found') {
          return apiError(res, 404, 'review_not_found', 'That review no longer exists.');
        }
        throw error;
      }

      await writeAuditLogForRequest(req, {
        action: `review.${mode}`,
        targetType: 'review',
        targetId: id,
        details: {
          resourceId: result.resourceId,
          ratingAvg: result.ratingAvg,
          ratingCount: result.ratingCount
        }
      });

      return res.json({ ok: true, ...result });
    } catch (error) {
      return next(error);
    }
  };
}

adminReviewsRouter.post('/:id/hide', moderate('hide'));
adminReviewsRouter.post('/:id/show', moderate('show'));
adminReviewsRouter.delete('/:id', moderate('delete'));

/**
 * POST /api/admin/reviews/bulk { ids, action: hide|show|delete }
 * Runs each moderation in its own transaction, so one bad id cannot block the
 * rest. The response reports both counts.
 */
adminReviewsRouter.post('/bulk', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, bulkSchema, req.body);
    if (!parsed) return undefined;

    const ids = [...new Set(parsed.ids)];
    const failed = [];
    let updated = 0;

    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await applyReviewModeration(db, {
          reviewId: id,
          mode: parsed.action,
          adminUid: req.user.uid
        });
        updated += 1;
      } catch (error) {
        if (error?.code !== 'review_not_found') {
          console.warn('[admin-reviews] Bulk item failed:', id, error?.message || error);
        }
        failed.push(id);
      }
    }

    await writeAuditLogForRequest(req, {
      action: 'review.bulk',
      targetType: 'review',
      targetId: null,
      details: {
        action: parsed.action,
        requested: ids.length,
        updated,
        failed: failed.length
      }
    });

    return res.json({ ok: true, action: parsed.action, updated, failed });
  } catch (error) {
    return next(error);
  }
});
