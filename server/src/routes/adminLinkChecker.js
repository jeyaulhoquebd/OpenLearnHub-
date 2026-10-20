import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import {
  checkResourceLink,
  getActiveLinkCheckJob,
  getLinkCheckJob,
  startLinkCheck
} from '../lib/linkCheckerJob.js';

/**
 * Admin link checker.
 *
 * A full or selected check runs as an in-memory background job (one at a time)
 * and writes each result to `resources/{id}.linkCheck`. The client starts a
 * job, polls its progress, and can re-check one row synchronously.
 */

const RESULT_SCAN_LIMIT = 2000;

const startSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(300)).max(2000).optional()
});

const recheckSchema = z.object({
  id: z.string().trim().min(1).max(300)
});

function requireDb(res) {
  const db = getDb();
  if (!db) {
    apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    return null;
  }
  return db;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return null;
}

function serializeLinkCheck(linkCheck) {
  if (!linkCheck || !linkCheck.checkedAt) return null;
  return {
    ok: linkCheck.ok === true,
    statusCode: Number(linkCheck.statusCode) || 0,
    finalUrl: linkCheck.finalUrl || '',
    checkedAt: toIso(linkCheck.checkedAt),
    error: linkCheck.error || null,
    redirected: linkCheck.redirected === true,
    redirectCount: Number(linkCheck.redirectCount) || 0
  };
}

/** Stored-result bucket: ok | redirected | broken | timeout | never. */
function classifyStored(linkCheck) {
  if (!linkCheck?.checkedAt) return 'never';
  if (linkCheck.error === 'timeout') return 'timeout';
  if (linkCheck.ok === true) return linkCheck.redirected === true ? 'redirected' : 'ok';
  return 'broken';
}

function jobSummary(job) {
  if (!job) return null;
  const { items, ...summary } = job; // eslint-disable-line no-unused-vars
  return summary;
}

export const adminLinkCheckerRouter = Router();

/**
 * GET /api/admin/check-links/results
 * Every resource with its last saved `linkCheck`, summary counts, the time of
 * the last full check, and any running job (so a reload can resume polling).
 */
adminLinkCheckerRouter.get('/results', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const snapshot = await db
      .collection('resources')
      .select('title', 'slug', 'type', 'status', 'sourceUrl', 'linkCheck')
      .limit(RESULT_SCAN_LIMIT)
      .get();

    const counts = {
      all: snapshot.size,
      ok: 0,
      redirected: 0,
      broken: 0,
      timeout: 0,
      never: 0
    };

    let latestCheckedAt = null;
    let latestCheckedTime = 0;

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const linkCheck = serializeLinkCheck(data.linkCheck);
      const status = classifyStored(linkCheck);
      counts[status] += 1;

      if (linkCheck?.checkedAt) {
        const checkedTime = new Date(linkCheck.checkedAt).getTime();
        if (Number.isFinite(checkedTime) && checkedTime > latestCheckedTime) {
          latestCheckedTime = checkedTime;
          latestCheckedAt = linkCheck.checkedAt;
        }
      }

      return {
        id: doc.id,
        title: data.title || {},
        slug: data.slug || '',
        type: data.type || null,
        status: data.status || 'draft',
        sourceUrl: data.sourceUrl || '',
        linkCheck,
        linkStatus: status
      };
    });

    let lastFullCheckAt = null;
    try {
      const settings = await db.collection('settings').doc('linkChecker').get();
      lastFullCheckAt = toIso(settings.data()?.lastFullCheckAt);
    } catch (error) {
      console.warn('[link-checker] Could not read the last-check summary:', error?.message || error);
    }

    return res.json({
      items,
      counts,
      lastFullCheckAt,
      latestCheckedAt,
      activeJob: jobSummary(getActiveLinkCheckJob()),
      scanLimit: RESULT_SCAN_LIMIT,
      truncated: snapshot.size >= RESULT_SCAN_LIMIT
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/check-links { ids?: string[] }
 * Starts a background job. Omit `ids` (or send an empty array) to check the
 * whole library. Returns 409 when another job is still running.
 */
adminLinkCheckerRouter.post('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = startSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_link_check', 'Those resources cannot be checked.');
    }

    const ids = parsed.data.ids?.length ? parsed.data.ids : null;

    let job;
    try {
      job = await startLinkCheck(db, { ids, adminUid: req.user.uid });
    } catch (error) {
      if (error?.code === 'job_running') {
        return apiError(res, 409, 'job_running', error.message);
      }
      throw error;
    }

    await writeAuditLogForRequest(req, {
      action: 'linkcheck.start',
      targetType: 'linkcheck',
      targetId: job.id,
      details: {
        scope: job.scope,
        total: job.total,
        requested: ids?.length || null
      }
    });

    return res.status(202).json({ ok: true, job });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/check-links/recheck { id }
 * Synchronous single-resource check used by the results table's row action.
 */
adminLinkCheckerRouter.post('/recheck', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = recheckSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_link_check', 'That resource cannot be checked.');
    }

    let item;
    try {
      item = await checkResourceLink(db, parsed.data.id);
    } catch (error) {
      if (error?.code === 'resource_not_found') {
        return apiError(res, 404, 'resource_not_found', 'That resource no longer exists.');
      }
      throw error;
    }

    await writeAuditLogForRequest(req, {
      action: 'linkcheck.recheck',
      targetType: 'resource',
      targetId: parsed.data.id,
      details: {
        status: item.status,
        statusCode: item.statusCode,
        error: item.error
      }
    });

    return res.json({ ok: true, item });
  } catch (error) {
    return next(error);
  }
});

/** GET /api/admin/check-links/:jobId — live progress and completed rows. */
adminLinkCheckerRouter.get('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!jobId || jobId.length > 120) {
      return apiError(res, 400, 'invalid_job_id', 'That job id is not valid.');
    }

    const job = getLinkCheckJob(jobId);
    if (!job) {
      return apiError(
        res,
        404,
        'job_not_found',
        'That check is no longer available. Run a new check to refresh the results.'
      );
    }

    // Progress polling does not need the completed rows (they are reloaded from
    // Firestore when the job finishes), so keep the payload small.
    return res.json({ job: jobSummary(job) });
  } catch (error) {
    return next(error);
  }
});
