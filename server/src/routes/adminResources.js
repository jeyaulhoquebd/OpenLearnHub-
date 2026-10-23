import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import { findBlockedSource } from '../../config/blocklist.js';
import { checkUrl } from '../lib/linkCheck.js';
import {
  LIST_SORTS,
  RESOURCE_LANGUAGES,
  RESOURCE_LIST_FIELDS,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  buildResourceSlug,
  decodeCursor,
  encodeCursor,
  matchesSearch,
  normalizeResourceInput,
  resourceInputSchema,
  serializeResource,
  sortResources,
  uniqueResourceSlug
} from '../lib/resourceAdmin.js';

/**
 * Admin resources API.
 *
 * Mounted under `/api/admin/resources` behind `requireAdmin`, so every handler
 * can trust `req.user.uid` and the `admin` custom claim. All writes go through
 * the Admin SDK (client writes to `resources` stay limited to community
 * submissions) and are recorded in the audit log.
 *
 * Listing uses a bounded scan: Firestore cannot do substring search across
 * three language fields, so equality filters run in Firestore and search /
 * language / sorting run in memory over at most `SCAN_LIMIT` documents. The
 * cursor is an opaque offset into that filtered set. This keeps the panel
 * index-free and correct for a curated library; swap in Algolia/Typesense if
 * the catalogue ever grows past a few thousand entries.
 */

const SCAN_LIMIT = 500;

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  type: z.enum(RESOURCE_TYPES).optional(),
  status: z.enum(RESOURCE_STATUSES).optional(),
  category: z.string().trim().max(60).optional(),
  language: z.enum(RESOURCE_LANGUAGES).optional(),
  sort: z.enum(LIST_SORTS).optional().default('updated_desc'),
  cursor: z.string().trim().max(120).optional().default(''),
  limit: z.coerce.number().int().min(5).max(50).optional().default(20)
});

const bulkSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(128)).min(1).max(100),
  action: z.enum(['publish', 'draft', 'flag', 'delete'])
});

const testLinkSchema = z.object({
  url: z.string().trim().min(4).max(600)
});

const BULK_STATUS = {
  publish: 'published',
  draft: 'draft',
  flag: 'flagged'
};

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
    apiError(res, 400, 'invalid_resource', 'Please fix the highlighted fields.', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

/** Rejects pirated / unofficial sources before anything is written. */
function blockedResponse(res, hit) {
  if (!hit) return false;
  apiError(res, 422, hit.code, hit.message, { match: hit.match });
  return true;
}

function auditResource(req, action, targetId, details) {
  return writeAuditLogForRequest(req, {
    action,
    targetType: 'resource',
    targetId,
    details
  });
}

export const adminResourcesRouter = Router();

/**
 * GET /api/admin/resources
 * Filters: q, type, status, category, language.
 * Sort: updated_desc (default), created_desc, title_asc, views_desc, rating_desc…
 * Pagination: limit (5–50) + opaque `cursor`.
 */
adminResourcesRouter.get('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    // Empty query strings (`?type=`) should behave like "no filter".
    const raw = { ...req.query };
    Object.keys(raw).forEach((key) => {
      if (raw[key] === '') delete raw[key];
    });

    const parsed = listQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_query', 'Those filters are not valid.');
    }
    const { q, type, status, category, language, sort, cursor, limit } = parsed.data;

    let query = db.collection('resources');
    if (status) query = query.where('status', '==', status);
    if (type) query = query.where('type', '==', type);
    if (category) query = query.where('category', '==', category);

    const snapshot = await query.select(...RESOURCE_LIST_FIELDS).limit(SCAN_LIMIT).get();

    let rows = snapshot.docs.map(serializeResource);
    if (language) rows = rows.filter((row) => row.language.includes(language));
    if (q) rows = rows.filter((row) => matchesSearch(row, q));
    rows = sortResources(rows, sort);

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
      scanLimit: SCAN_LIMIT,
      truncated: snapshot.size >= SCAN_LIMIT
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/resources/test-link
 * Server-side reachability check for the "Test link" button. SSRF-safe: only
 * public http/https hosts, validated on every redirect hop (see lib/linkCheck).
 */
adminResourcesRouter.post('/test-link', async (req, res, next) => {
  try {
    const parsed = parseBody(res, testLinkSchema, req.body);
    if (!parsed) return undefined;

    const result = await checkUrl(parsed.url);
    return res.json(result);
  } catch (error) {
    if (error.code === 'dns_error') {
      return res.json({
        ok: false,
        status: 0,
        finalUrl: '',
        contentType: '',
        error: 'dns_error'
      });
    }
    if (error.status === 400) {
      return apiError(res, 400, error.code || 'invalid_url', error.message);
    }
    return next(error);
  }
});

/**
 * POST /api/admin/resources/bulk
 * Publish / unpublish / flag / delete up to 100 resources in one batch.
 */
adminResourcesRouter.post('/bulk', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, bulkSchema, req.body);
    if (!parsed) return undefined;

    const ids = [...new Set(parsed.ids)];
    const refs = ids.map((id) => db.collection('resources').doc(id));
    const snapshots = await db.getAll(...refs);
    const existing = snapshots.filter((snapshot) => snapshot.exists);

    if (!existing.length) {
      return res.json({ ok: true, action: parsed.action, requested: ids.length, affected: 0 });
    }

    const batch = db.batch();

    if (parsed.action === 'delete') {
      existing.forEach((snapshot) => batch.delete(snapshot.ref));
    } else {
      const patch = {
        status: BULK_STATUS[parsed.action],
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: req.user.uid
      };
      if (parsed.action === 'publish') {
        patch.publishedAt = FieldValue.serverTimestamp();
      }
      existing.forEach((snapshot) => batch.update(snapshot.ref, patch));
    }

    await batch.commit();

    await auditResource(req, 'resource.bulk', null, {
      bulkAction: parsed.action,
      requested: ids.length,
      affected: existing.length,
      ids: existing.slice(0, 20).map((snapshot) => snapshot.id)
    });

    return res.json({
      ok: true,
      action: parsed.action,
      requested: ids.length,
      affected: existing.length
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/resources
 * Creates a resource. The slug is generated from the English title and kept
 * unique; new listings start with zeroed counters.
 */
adminResourcesRouter.post('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, resourceInputSchema, req.body);
    if (!parsed) return undefined;

    const payload = normalizeResourceInput(parsed);
    const hit = findBlockedSource(payload);
    if (blockedResponse(res, hit)) return undefined;

    const slug = await uniqueResourceSlug(db, buildResourceSlug(payload.title.en));
    const ref = db.collection('resources').doc();
    const now = FieldValue.serverTimestamp();

    await ref.set({
      ...payload,
      id: ref.id,
      slug,
      viewCount: 0,
      saveCount: 0,
      ratingAvg: 0,
      ratingCount: 0,
      createdBy: req.user.uid,
      creatorEmail: req.user.email || null,
      createdAt: now,
      updatedAt: now,
      publishedAt: payload.status === 'published' ? now : null,
      lastVerified: new Date().toISOString()
    });

    await auditResource(req, 'resource.create', ref.id, {
      title: payload.title.en,
      type: payload.type,
      status: payload.status,
      slug
    });

    return res.status(201).json({ id: ref.id, slug });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/admin/resources/:id
 * Replaces the editable fields. Fields outside the schema (long descriptions,
 * counters, original creator) are preserved. The slug is regenerated only when
 * the English title changes.
 */
adminResourcesRouter.put('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 128) {
      return apiError(res, 400, 'invalid_id', 'That resource id is not valid.');
    }

    const parsed = parseBody(res, resourceInputSchema, req.body);
    if (!parsed) return undefined;

    const ref = db.collection('resources').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'resource_not_found', 'That resource no longer exists.');
    }

    const existing = snapshot.data() || {};
    const payload = normalizeResourceInput(parsed);
    const hit = findBlockedSource(payload);
    if (blockedResponse(res, hit)) return undefined;

    const titleChanged = payload.title.en !== existing.title?.en;
    const slug = titleChanged
      ? await uniqueResourceSlug(db, buildResourceSlug(payload.title.en), id)
      : existing.slug || (await uniqueResourceSlug(db, buildResourceSlug(payload.title.en), id));

    const update = {
      ...payload,
      slug,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    };

    // Stamp the first publication date, but leave it alone afterwards.
    if (payload.status === 'published' && !existing.publishedAt) {
      update.publishedAt = FieldValue.serverTimestamp();
    }

    await ref.update(update);

    await auditResource(req, 'resource.update', id, {
      title: payload.title.en,
      type: payload.type,
      status: payload.status,
      slug,
      titleChanged,
      before: {
        title: existing.title?.en || '',
        type: existing.type || '',
        status: existing.status || '',
        category: existing.category || '',
        sourceUrl: existing.sourceUrl || '',
        featured: existing.featured === true
      },
      after: {
        title: payload.title.en,
        type: payload.type,
        status: payload.status,
        category: payload.category,
        sourceUrl: payload.sourceUrl,
        featured: payload.featured === true
      }
    });

    return res.json({ id, slug });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/admin/resources/:id
 * Hard delete. The audit entry keeps the title so the action stays traceable.
 */
adminResourcesRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 128) {
      return apiError(res, 400, 'invalid_id', 'That resource id is not valid.');
    }

    const ref = db.collection('resources').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'resource_not_found', 'That resource no longer exists.');
    }

    const data = snapshot.data() || {};
    await ref.delete();

    await auditResource(req, 'resource.delete', id, {
      title: data.title?.en || '',
      type: data.type || '',
      slug: data.slug || ''
    });

    return res.json({ ok: true, id });
  } catch (error) {
    return next(error);
  }
});
