import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import { sanitizeText } from '../lib/validation.js';
import {
  REPORT_REASONS,
  REPORT_SCAN_LIMIT,
  REPORT_STATUSES,
  reportSearchText,
  reportSeverity,
  reasonMatchesFilter,
  resourceSummary,
  serializeReport,
  timeOf
} from '../lib/reportAdmin.js';

/**
 * Admin reports queue.
 *
 * Listing is a bounded in-memory scan because the filters (three reason
 * groups plus free text) cannot be expressed as one Firestore query. Every
 * write goes through this API: Firestore rules deny client updates to
 * `reports`, and the public submission endpoint remains the only creator.
 */

const listQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  reason: z.enum([...REPORT_REASONS, 'illegal', 'broken']).optional(),
  resourceId: z.string().trim().max(160).optional().default(''),
  q: z.string().trim().max(120).optional().default('')
});

const patchSchema = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    adminNote: z.string().max(2000).optional()
  })
  .refine((value) => value.status !== undefined || value.adminNote !== undefined, {
    message: 'At least one field is required.'
  });

function requireDb(res) {
  const db = getDb();
  if (!db) {
    apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    return null;
  }
  return db;
}

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
      if (snapshot.exists) byId.set(snapshot.id, resourceSummary(snapshot));
    });
  }

  return byId;
}

function countByStatus(reports) {
  const counts = { all: reports.length, open: 0, in_review: 0, resolved: 0, dismissed: 0 };
  reports.forEach((report) => {
    if (counts[report.status] !== undefined) counts[report.status] += 1;
  });
  return counts;
}

/** Loads one report with its resource summary for a mutation response. */
async function loadReport(db, id) {
  const snapshot = await db.collection('reports').doc(id).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  const resource = data.resourceId
    ? resourceSummary(await db.collection('resources').doc(data.resourceId).get())
    : null;
  return serializeReport(snapshot, { resource });
}

export const adminReportsRouter = Router();

/**
 * GET /api/admin/reports
 * Filters: status, reason (exact or illegal/broken/other), resourceId, q.
 * Illegal reasons (copyright/piracy) are sorted first, then newest.
 */
adminReportsRouter.get('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const raw = { ...req.query };
    Object.keys(raw).forEach((key) => {
      if (raw[key] === '') delete raw[key];
    });

    const parsed = listQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_query', 'Those report filters are not valid.');
    }
    const { status, reason, resourceId, q } = parsed.data;

    const snapshot = await db.collection('reports').limit(REPORT_SCAN_LIMIT).get();
    const resources = await loadResources(
      db,
      snapshot.docs.map((doc) => doc.data()?.resourceId)
    );

    const all = snapshot.docs.map((doc) =>
      serializeReport(doc, {
        resource: resources.get(doc.data()?.resourceId) || null
      })
    );

    // Similar-report counts use the unfiltered set, so switching filters never
    // changes how many reports a resource has.
    const similarByResource = new Map();
    all.forEach((report) => {
      if (!report.resourceId) return;
      similarByResource.set(report.resourceId, (similarByResource.get(report.resourceId) || 0) + 1);
    });
    all.forEach((report) => {
      report.similarCount = report.resourceId
        ? similarByResource.get(report.resourceId) || 1
        : 1;
    });

    const counts = countByStatus(all);
    const needle = q.toLowerCase();

    const items = all
      .filter((report) => (status ? report.status === status : true))
      .filter((report) => reasonMatchesFilter(report.reason, reason))
      .filter((report) => (resourceId ? report.resourceId === resourceId : true))
      .filter((report) => (needle ? reportSearchText(report).includes(needle) : true))
      .sort((a, b) => {
        const severity = reportSeverity(a.reason) - reportSeverity(b.reason);
        if (severity !== 0) return severity;
        return timeOf(b.createdAt) - timeOf(a.createdAt);
      });

    return res.json({
      items,
      total: items.length,
      counts,
      openCount: counts.open,
      scanned: snapshot.size,
      scanLimit: REPORT_SCAN_LIMIT,
      truncated: snapshot.size >= REPORT_SCAN_LIMIT
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/admin/reports/:id { status?, adminNote? }
 * Saves an admin note and/or moves the report between statuses.
 */
adminReportsRouter.patch('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 300) {
      return apiError(res, 400, 'invalid_id', 'That report id is not valid.');
    }

    const parsed = patchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_report_action', 'That report update is not valid.');
    }

    const ref = db.collection('reports').doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return apiError(res, 404, 'report_not_found', 'That report no longer exists.');
    }

    const now = new Date();
    const update = { updatedAt: now };

    if (parsed.data.status) {
      update.status = parsed.data.status;
      update.reviewedAt = now;
      update.reviewedBy = req.user.uid;
      if (parsed.data.status === 'resolved') update.resolvedAt = now;
      if (parsed.data.status === 'dismissed') update.dismissedAt = now;
      if (parsed.data.status === 'open' || parsed.data.status === 'in_review') {
        update.resolution = null;
      }
    }

    if (parsed.data.adminNote !== undefined) {
      update.adminNote = sanitizeText(parsed.data.adminNote, { max: 2000, multiline: true });
    }

    await ref.update(update);

    const report = await loadReport(db, id);

    await writeAuditLogForRequest(req, {
      action: 'report.update',
      targetType: 'report',
      targetId: id,
      details: {
        status: parsed.data.status || null,
        noteChanged: parsed.data.adminNote !== undefined,
        resourceId: existing.data()?.resourceId || null
      }
    });

    return res.json({ ok: true, report });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/reports/:id/unpublish-resource
 * Flags the reported resource and resolves the report in one transaction.
 * The previous resource status is kept on the report for context.
 */
adminReportsRouter.post('/:id/unpublish-resource', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 300) {
      return apiError(res, 400, 'invalid_id', 'That report id is not valid.');
    }

    const reportRef = db.collection('reports').doc(id);
    const now = new Date();
    let previousStatus = null;

    try {
      await db.runTransaction(async (transaction) => {
        const reportSnap = await transaction.get(reportRef);
        if (!reportSnap.exists) {
          const error = new Error('That report no longer exists.');
          error.code = 'report_not_found';
          throw error;
        }

        const reportData = reportSnap.data() || {};
        if (!reportData.resourceId) {
          const error = new Error('This report is not linked to a resource.');
          error.code = 'resource_not_found';
          throw error;
        }

        const resourceRef = db.collection('resources').doc(reportData.resourceId);
        const resourceSnap = await transaction.get(resourceRef);
        if (!resourceSnap.exists) {
          const error = new Error('The reported resource no longer exists.');
          error.code = 'resource_not_found';
          throw error;
        }

        previousStatus = resourceSnap.data()?.status || 'draft';

        transaction.update(resourceRef, {
          status: 'flagged',
          flaggedAt: now,
          flaggedBy: req.user.uid,
          flagReason: 'report',
          updatedAt: now
        });

        transaction.update(reportRef, {
          status: 'resolved',
          resolution: 'resource_unpublished',
          resourcePreviousStatus: previousStatus,
          reviewedAt: now,
          reviewedBy: req.user.uid,
          updatedAt: now
        });
      });
    } catch (error) {
      if (error?.code === 'report_not_found') {
        return apiError(res, 404, 'report_not_found', 'That report no longer exists.');
      }
      if (error?.code === 'resource_not_found') {
        return apiError(res, 404, 'resource_not_found', error.message);
      }
      throw error;
    }

    const report = await loadReport(db, id);

    await writeAuditLogForRequest(req, {
      action: 'report.unpublish_resource',
      targetType: 'report',
      targetId: id,
      details: {
        resourceId: report?.resourceId || null,
        previousResourceStatus: previousStatus,
        newResourceStatus: 'flagged'
      }
    });

    return res.json({ ok: true, resourceStatus: 'flagged', report });
  } catch (error) {
    return next(error);
  }
});
