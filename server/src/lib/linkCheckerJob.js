import { FieldValue } from 'firebase-admin/firestore';
import { checkUrl } from './linkCheck.js';

/**
 * In-memory link-check job registry.
 *
 * A full check can take a while (a 10 s timeout per resource at concurrency 5),
 * so the API starts a job and the client polls `GET /api/admin/check-links/:id`.
 * Jobs live only in this process: after a restart the last per-resource results
 * are still in Firestore (`resources/{id}.linkCheck`), but an interrupted job is
 * gone. Only one job may run at a time.
 */

export const LINK_CHECK_CONCURRENCY = 5;
export const LINK_CHECK_TIMEOUT_MS = 10_000;
export const LINK_CHECK_MAX_REDIRECTS = 5;

const RESULT_CAP = 2000;
const JOB_TTL_MS = 60 * 60 * 1000;
const MAX_KEPT_JOBS = 10;

const jobs = new Map();
let activeJobId = null;

function jobError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function emptyCounts() {
  return { ok: 0, redirected: 0, broken: 0, timeout: 0, skipped: 0 };
}

function prune() {
  const cutoff = Date.now() - JOB_TTL_MS;
  const finished = [];

  jobs.forEach((job, id) => {
    if (job.status !== 'running' && new Date(job.finishedAt || job.startedAt).getTime() < cutoff) {
      jobs.delete(id);
      return;
    }
    if (job.status !== 'running') finished.push(id);
  });

  // Keep only the newest finished jobs in memory.
  finished
    .slice(0, Math.max(0, finished.length - MAX_KEPT_JOBS))
    .forEach((id) => jobs.delete(id));
}

function makeJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** `ok | redirected | broken | timeout | skipped` for one resource result. */
function classify(result) {
  if (!result) return 'skipped';
  if (result.error === 'timeout') return 'timeout';
  if (!result.ok) return 'broken';
  return result.redirects > 0 ? 'redirected' : 'ok';
}

function publicJob(job) {
  return {
    id: job.id,
    scope: job.scope,
    status: job.status,
    total: job.total,
    completed: job.completed,
    counts: { ...job.counts },
    items: job.items,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    truncated: job.truncated
  };
}

function serializeItem(resource, result) {
  const sourceUrl = String(resource.sourceUrl || '').trim();
  return {
    resourceId: resource.id,
    title: resource.title || {},
    slug: resource.slug || '',
    resourceStatus: resource.status || '',
    sourceUrl,
    status: result.status,
    ok: result.ok,
    statusCode: result.statusCode,
    finalUrl: result.finalUrl,
    checkedAt: result.checkedAt,
    error: result.error,
    redirected: result.redirected,
    redirectCount: result.redirectCount
  };
}

async function checkOne(db, resource) {
  const sourceUrl = String(resource.sourceUrl || '').trim();

  if (!sourceUrl) {
    return serializeItem(resource, {
      status: 'skipped',
      ok: false,
      statusCode: 0,
      finalUrl: '',
      checkedAt: null,
      error: 'missing_url',
      redirected: false,
      redirectCount: 0
    });
  }

  let result;
  try {
    result = await checkUrl(sourceUrl, {
      maxRedirects: LINK_CHECK_MAX_REDIRECTS,
      timeoutMs: LINK_CHECK_TIMEOUT_MS
    });
  } catch (error) {
    // Invalid or unsafe URLs never leave the server: record why and move on.
    result = {
      ok: false,
      status: 0,
      finalUrl: sourceUrl,
      error: error?.code || 'invalid_url',
      redirects: 0
    };
  }

  const linkCheck = {
    ok: result.ok === true,
    statusCode: Number(result.status) || 0,
    finalUrl: result.finalUrl || sourceUrl,
    checkedAt: new Date().toISOString(),
    error: result.error || null,
    redirected: (result.redirects || 0) > 0,
    redirectCount: Number(result.redirects) || 0
  };

  try {
    await db.collection('resources').doc(resource.id).update({ linkCheck });
  } catch (error) {
    console.warn('[link-checker] Could not save result:', resource.id, error?.message || error);
  }

  return serializeItem(resource, {
    ...linkCheck,
    status: classify(result)
  });
}

async function runJob(db, job, resources, adminUid) {
  const queue = [...resources];

  async function worker() {
    while (queue.length) {
      const resource = queue.shift();
      // eslint-disable-next-line no-await-in-loop
      const item = await checkOne(db, resource);
      job.items.push(item);
      job.completed += 1;
      job.counts[item.status] += 1;
    }
  }

  try {
    const workers = Math.max(1, Math.min(LINK_CHECK_CONCURRENCY, resources.length));
    await Promise.all(Array.from({ length: workers }, () => worker()));
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();

    if (job.scope === 'full') {
      await db
        .collection('settings')
        .doc('linkChecker')
        .set(
          {
            lastFullCheckAt: job.finishedAt,
            lastJobId: job.id,
            total: job.total,
            counts: job.counts,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: adminUid || null
          },
          { merge: true }
        )
        .catch((error) => {
          console.warn('[link-checker] Could not save the last-check summary:', error?.message || error);
        });
    }
  } catch (error) {
    job.status = 'failed';
    job.error = error?.message || 'The link check stopped unexpectedly.';
    job.finishedAt = new Date().toISOString();
    console.error('[link-checker] Job failed:', error);
  } finally {
    if (activeJobId === job.id) activeJobId = null;
  }
}

/**
 * Starts a background check.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ ids?: string[]|null, adminUid: string }} options
 * @returns {Promise<object>} the running job
 */
export async function startLinkCheck(db, { ids = null, adminUid }) {
  prune();

  if (activeJobId) {
    const active = jobs.get(activeJobId);
    // `'starting'` is a short-lived placeholder that closes the race between
    // two simultaneous start requests; neither has created a job yet.
    if (activeJobId === 'starting' || active?.status === 'running') {
      throw jobError('job_running', 'A link check is already running. Wait for it to finish.');
    }
    activeJobId = null;
  }

  // Reserve the slot before the first await so a second request cannot start.
  activeJobId = 'starting';

  const uniqueIds = Array.isArray(ids)
    ? [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, RESULT_CAP)
    : null;

  let snapshots;
  try {
    if (uniqueIds?.length) {
      snapshots = [];
      for (let index = 0; index < uniqueIds.length; index += 300) {
        const chunk = uniqueIds.slice(index, index + 300);
        // eslint-disable-next-line no-await-in-loop
        const loaded = await db.getAll(...chunk.map((id) => db.collection('resources').doc(id)));
        snapshots.push(...loaded.filter((snapshot) => snapshot.exists));
      }
    } else {
      const snapshot = await db
        .collection('resources')
        .select('title', 'sourceUrl', 'slug', 'type', 'status')
        .limit(RESULT_CAP)
        .get();
      snapshots = snapshot.docs;
    }
  } catch (error) {
    activeJobId = null;
    throw error;
  }

  const resources = snapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));

  const job = {
    id: makeJobId(),
    scope: uniqueIds?.length ? 'selected' : 'full',
    status: 'running',
    total: resources.length,
    completed: 0,
    counts: emptyCounts(),
    items: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    truncated: !uniqueIds?.length && resources.length >= RESULT_CAP
  };

  jobs.set(job.id, job);
  activeJobId = job.id;

  // Deliberately not awaited: the HTTP response returns the job id immediately.
  runJob(db, job, resources, adminUid);

  return publicJob(job);
}

export function getLinkCheckJob(jobId) {
  const job = jobs.get(jobId);
  return job ? publicJob(job) : null;
}

export function getActiveLinkCheckJob() {
  if (!activeJobId) return null;
  const job = jobs.get(activeJobId);
  return job ? publicJob(job) : null;
}

/** Checks one resource synchronously (the "Re-check" row action). */
export async function checkResourceLink(db, resourceId) {
  const snapshot = await db.collection('resources').doc(resourceId).get();
  if (!snapshot.exists) {
    throw jobError('resource_not_found', 'That resource no longer exists.');
  }
  return checkOne(db, { id: snapshot.id, ...snapshot.data() });
}
