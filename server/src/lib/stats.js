import { Timestamp } from 'firebase-admin/firestore';
import { getDb, getFirebaseAuth } from '../firebase.js';

/**
 * Aggregate numbers for the admin dashboard.
 *
 * Everything here runs with the Admin SDK, so it is not limited by Firestore
 * security rules, and the whole response is cached in memory for 60 seconds —
 * the dashboard polls nothing, and several admins opening the page at once
 * share one set of queries.
 *
 * Cost profile: ~14 `count()` aggregations, one 30-day read for the series
 * (newest window only, `select`ed fields), six small `limit(5)` reads, and up
 * to five `listUsers` pages for the provider breakdown.
 */

const CACHE_TTL_MS = 60 * 1000;
const SERIES_DAYS = 30;
const TREND_DAYS = 7;
const USER_SCAN_CAP = 5000;
const USER_PAGE_SIZE = 1000;
const TOP_LIMIT = 5;

const PROVIDERS = ['password', 'google.com', 'github.com', 'apple.com'];
const RESOURCE_TYPES = ['course', 'book', 'software'];
const RESOURCE_STATUSES = ['published', 'pending', 'draft', 'rejected', 'flagged'];

const DAY_MS = 24 * 60 * 60 * 1000;

let cache = null; // { expiresAt, payload }

// ---------------------------------------------------------------------------
// date helpers (all buckets are UTC so the series is stable across servers)
// ---------------------------------------------------------------------------

/** Midnight UTC for the day containing `value`, as epoch milliseconds. */
function utcStartOfDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A zero-filled list of the last `days` days, oldest first. */
function buildDayBuckets(days) {
  const today = utcStartOfDay(Date.now());
  const buckets = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = today - offset * DAY_MS;
    buckets.push({ date: dayKey(start), start, count: 0 });
  }
  return buckets;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function addToBucket(buckets, value, amount = 1) {
  const date = toDate(value);
  if (!date) return;
  const key = dayKey(utcStartOfDay(date));
  const bucket = buckets.find((entry) => entry.date === key);
  if (bucket) bucket.count += amount;
}

// ---------------------------------------------------------------------------
// small Firestore wrappers
// ---------------------------------------------------------------------------

/** `count()` aggregation with a soft failure mode (missing index, etc.). */
async function countOf(query) {
  try {
    const snapshot = await query.count().get();
    return snapshot.data().count || 0;
  } catch (error) {
    console.warn('[stats] count() failed:', error?.message || error);
    return 0;
  }
}

function emptyCounts(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

// ---------------------------------------------------------------------------
// auth scan: providers + sign-up series
// ---------------------------------------------------------------------------

async function scanUsers(auth) {
  const providers = emptyCounts([...PROVIDERS, 'other']);
  const daily = buildDayBuckets(SERIES_DAYS);

  if (!auth) {
    return { usersScanned: 0, usersApproximate: true, providers, daily };
  }

  let scanned = 0;
  let pageToken;
  let hasMore = false;

  try {
    do {
      const remaining = USER_SCAN_CAP - scanned;
      if (remaining <= 0) break;

      const page = await auth.listUsers(Math.min(USER_PAGE_SIZE, remaining), pageToken);
      page.users.forEach((record) => {
        scanned += 1;

        const providerId = record.providerData?.[0]?.providerId || 'password';
        const key = PROVIDERS.includes(providerId) ? providerId : 'other';
        providers[key] += 1;

        if (record.metadata?.creationTime) {
          addToBucket(daily, record.metadata.creationTime);
        }
      });

      pageToken = page.pageToken;
      hasMore = Boolean(pageToken);
    } while (hasMore);
  } catch (error) {
    console.warn('[stats] Could not list auth users:', error?.message || error);
    return { usersScanned: scanned, usersApproximate: true, providers, daily };
  }

  return {
    usersScanned: scanned,
    // The list is paginated and capped, so treat it as approximate once we hit
    // the cap or stop with a page token still in hand.
    usersApproximate: hasMore || scanned >= USER_SCAN_CAP,
    providers,
    daily
  };
}

// ---------------------------------------------------------------------------
// documents
// ---------------------------------------------------------------------------

function pickResource(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    title: data.title || '',
    type: data.type || 'course',
    thumbnailUrl: data.thumbnailUrl || null,
    sourceName: data.sourceName || data.provider || '',
    status: data.status || 'published',
    viewCount: Number(data.viewCount) || 0,
    saveCount: Number(data.saveCount) || 0
  };
}

function pickReport(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    resourceId: data.resourceId || null,
    resourceTitle: data.resourceTitle || null,
    reason: data.reason || 'other',
    details: data.details || '',
    status: data.status || 'open',
    reporterEmail: data.reporterEmail || null,
    verifiedReporter: data.verifiedReporter === true,
    createdAt: toDate(data.createdAt)?.toISOString() || null
  };
}

function pickReview(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    resourceId: data.resourceId || null,
    resourceTitle: null,
    rating: Number(data.rating) || 0,
    body: data.body || data.comment || '',
    authorName: data.authorName || data.userName || null,
    createdAt: toDate(data.createdAt)?.toISOString() || null
  };
}

/** Adds `resourceTitle` to the latest reviews (they only store the id). */
async function attachReviewTitles(db, reviews) {
  const ids = [...new Set(reviews.map((review) => review.resourceId).filter(Boolean))];
  if (ids.length === 0) return reviews;

  try {
    const snapshots = await db.getAll(...ids.map((id) => db.collection('resources').doc(id)));
    const titles = new Map();
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) {
        const data = snapshot.data() || {};
        titles.set(snapshot.id, data.title || '');
      }
    });
    return reviews.map((review) => ({
      ...review,
      resourceTitle: titles.get(review.resourceId) || null
    }));
  } catch (error) {
    console.warn('[stats] Could not load review resource titles:', error?.message || error);
    return reviews;
  }
}

// ---------------------------------------------------------------------------
// main entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} [options]
 * @param {boolean} [options.force] Bypass the 60-second cache (Refresh button).
 * @returns {Promise<object>} Dashboard payload.
 */
export async function getAdminStats({ force = false } = {}) {
  const now = Date.now();

  if (!force && cache && cache.expiresAt > now) {
    return { ...cache.payload, cached: true };
  }

  const db = getDb();
  if (!db) {
    const error = new Error('Statistics storage is unavailable.');
    error.code = 'stats_unavailable';
    throw error;
  }

  const auth = getFirebaseAuth();

  // 30-day window aligned to midnight UTC.
  const windowStart = utcStartOfDay(now) - (SERIES_DAYS - 1) * DAY_MS;
  const weekStart = utcStartOfDay(now) - (TREND_DAYS - 1) * DAY_MS;
  const windowStartTimestamp = Timestamp.fromDate(new Date(windowStart));
  const weekStartTimestamp = Timestamp.fromDate(new Date(weekStart));

  const resources = db.collection('resources');
  const reports = db.collection('reports');

  // Aggregations and small reads in parallel; each group is independent.
  const [
    resourceTotal,
    typeCounts,
    statusCounts,
    usersTotal,
    reviewsTotal,
    bookmarksTotal,
    openReports,
    reportsThisWeek,
    windowSnapshot,
    topViewedSnapshot,
    topSavedSnapshot,
    latestReportSnapshot,
    latestReviewSnapshot,
    userScan
  ] = await Promise.all([
    countOf(resources),
    Promise.all(RESOURCE_TYPES.map((type) => countOf(resources.where('type', '==', type)))),
    Promise.all(RESOURCE_STATUSES.map((status) => countOf(resources.where('status', '==', status)))),
    countOf(db.collection('users')),
    countOf(db.collection('reviews')),
    countOf(db.collection('bookmarks')),
    countOf(reports.where('status', '==', 'open')),
    countOf(reports.where('createdAt', '>=', weekStartTimestamp)),
    resources
      .where('createdAt', '>=', windowStartTimestamp)
      .select('type', 'createdAt')
      .get()
      .catch((error) => {
        console.warn('[stats] Resource series query failed:', error?.message || error);
        return null;
      }),
    resources.orderBy('viewCount', 'desc').limit(TOP_LIMIT * 2).get().catch(() => null),
    resources.orderBy('saveCount', 'desc').limit(TOP_LIMIT * 2).get().catch(() => null),
    reports.orderBy('createdAt', 'desc').limit(TOP_LIMIT).get().catch(() => null),
    db.collection('reviews').orderBy('createdAt', 'desc').limit(TOP_LIMIT).get().catch(() => null),
    scanUsers(auth)
  ]);

  const resourcesByType = Object.fromEntries(
    RESOURCE_TYPES.map((type, index) => [type, typeCounts[index]])
  );
  const resourcesByStatus = Object.fromEntries(
    RESOURCE_STATUSES.map((status, index) => [status, statusCounts[index]])
  );

  // 30-day resource series + per-type counts inside the trend window.
  const resourceDaily = buildDayBuckets(SERIES_DAYS);
  const typeTrends = emptyCounts(RESOURCE_TYPES);
  let resourcesThisWeek = 0;

  if (windowSnapshot) {
    windowSnapshot.forEach((snapshot) => {
      const data = snapshot.data() || {};
      addToBucket(resourceDaily, data.createdAt);
      const created = toDate(data.createdAt);
      if (created && created.getTime() >= weekStart) {
        resourcesThisWeek += 1;
        if (RESOURCE_TYPES.includes(data.type)) typeTrends[data.type] += 1;
      }
    });
  }

  // Users trend comes from the auth scan (last 7 days of the 30-day series).
  const usersThisWeek = userScan.daily
    .filter((bucket) => bucket.start >= weekStart)
    .reduce((sum, bucket) => sum + bucket.count, 0);

  const latestReviews = await attachReviewTitles(
    db,
    (latestReviewSnapshot?.docs || []).map(pickReview)
  );

  const publishedOnly = (snapshot) =>
    (snapshot?.docs || [])
      .map(pickResource)
      .filter((resource) => resource.status === 'published')
      .slice(0, TOP_LIMIT);

  const payload = {
    generatedAt: new Date(now).toISOString(),
    totals: {
      resources: resourceTotal,
      resourcesByType,
      resourcesByStatus,
      users: usersTotal,
      reviews: reviewsTotal,
      bookmarks: bookmarksTotal,
      pendingReports: openReports,
      flaggedResources: resourcesByStatus.flagged || 0
    },
    trends: {
      windowDays: TREND_DAYS,
      resources: resourcesThisWeek,
      courses: typeTrends.course,
      books: typeTrends.book,
      software: typeTrends.software,
      users: usersThisWeek,
      reports: reportsThisWeek
    },
    newUsersLast30Days: userScan.daily,
    newResourcesLast30Days: resourceDaily,
    topViewedResources: publishedOnly(topViewedSnapshot),
    topSavedResources: publishedOnly(topSavedSnapshot),
    latestReports: (latestReportSnapshot?.docs || []).map(pickReport),
    latestReviews,
    providers: userScan.providers,
    usersScanned: userScan.usersScanned,
    usersApproximate: userScan.usersApproximate
  };

  cache = { expiresAt: now + CACHE_TTL_MS, payload };

  return { ...payload, cached: false };
}

/** Test helper / future use: drop the in-memory cache. */
export function clearStatsCache() {
  cache = null;
}
