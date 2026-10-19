import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import seedData from '../../../firebase/seed/resources.json';
import seedCategories from '../../../firebase/seed/categories.json';
import seedAlternatives from '../../../firebase/seed/alternatives.json';
import { db, storage } from './firebase';
import { localized, normalizeTimestamp, safeFileName, slugify } from './utils';

export const isDemoMode = !db;

export const PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'];

/**
 * Resources may be stored in one of two shapes:
 *  - the refined model (section 9): title/description maps, sourceName,
 *    sourceUrl, language[], ratingAvg, ratingCount, viewCount, saveCount and
 *    status "published" | "draft" | "flagged";
 *  - the legacy shape still present in older seed data and community
 *    submissions: title/description strings, provider, url, languages[] and
 *    status "published" | "pending" | "rejected".
 *
 * `normalizeResource` gives the rest of the app a single, predictable shape.
 */
export function normalizeResource(raw) {
  if (!raw) return null;
  const language = Array.isArray(raw.language)
    ? raw.language
    : Array.isArray(raw.languages)
      ? raw.languages
      : [];
  const sourceName = raw.sourceName || raw.provider || '';
  const sourceUrl = raw.sourceUrl || raw.url || '';

  return {
    ...raw,
    id: raw.id,
    sourceName,
    sourceUrl,
    // Legacy aliases kept so older components keep working.
    provider: sourceName,
    url: sourceUrl,
    language,
    languages: language,
    ratingAvg: Number(raw.ratingAvg) || 0,
    ratingCount: Number(raw.ratingCount) || 0,
    viewCount: Number(raw.viewCount) || 0,
    saveCount: Number(raw.saveCount) || 0,
    status: raw.status || 'published'
  };
}

const demoResources = seedData.map((resource, index) => ({
  ...normalizeResource(resource),
  // Deterministic pseudo-stats so the demo library looks alive offline.
  ratingAvg: Number((4.2 + ((index % 5) * 0.15)).toFixed(1)),
  ratingCount: 12 + ((index * 7) % 180),
  viewCount: 400 + ((index * 143) % 9000),
  saveCount: 40 + ((index * 29) % 900)
}));

export const demoCategories = seedCategories.map((category) => ({ ...category }));
export const demoAlternatives = seedAlternatives.map((item) => ({ ...item }));

function mapResource(snapshot) {
  const data = snapshot.data();
  return normalizeResource({
    ...data,
    id: snapshot.id,
    createdAt: normalizeTimestamp(data.createdAt),
    publishedAt: normalizeTimestamp(data.publishedAt),
    reviewedAt: normalizeTimestamp(data.reviewedAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  });
}

function recommendedSort(a, b) {
  if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function isPublished(resource) {
  return !resource.status || resource.status === 'published';
}

export async function fetchPublishedResources() {
  if (!db) {
    return demoResources.filter(isPublished).sort(recommendedSort);
  }

  const snap = await getDocs(
    query(collection(db, 'resources'), where('status', '==', 'published'), limit(500))
  );

  return snap.docs.map(mapResource).sort(recommendedSort);
}

export async function fetchResourceById(id) {
  if (!id) return null;
  if (!db) {
    return demoResources.find((resource) => resource.id === id) || null;
  }
  const snap = await getDoc(doc(db, 'resources', id));
  if (!snap.exists()) return null;
  return mapResource(snap);
}

// ---------------------------------------------------------------------------
// Categories & free alternatives (section 8/9)
// ---------------------------------------------------------------------------

export function categoryName(category, language = 'en') {
  if (!category) return '';
  if (typeof category.name === 'string') return category.name;
  return category.name?.[language] || category.name?.en || category.name?.bn || '';
}

export async function fetchCategories() {
  if (!db) {
    return [...demoCategories].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
    const items = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    return items.length ? items : demoCategories;
  } catch (error) {
    console.warn('[categories]', error);
    return demoCategories;
  }
}

export async function fetchAlternatives() {
  if (!db) {
    return demoAlternatives.map((item) => ({ ...item }));
  }
  try {
    const snap = await getDocs(collection(db, 'alternatives'));
    const items = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    return items.length ? items : demoAlternatives;
  } catch (error) {
    console.warn('[alternatives]', error);
    return demoAlternatives;
  }
}

// ---------------------------------------------------------------------------
// Bookmarks (top-level collection, id "<uid>_<resourceId>")
// ---------------------------------------------------------------------------

export const bookmarkDocId = (uid, resourceId) => `${uid}_${resourceId}`;

export async function fetchBookmarkIds(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(
    query(collection(db, 'bookmarks'), where('userId', '==', uid))
  );
  if (snap.size) {
    return snap.docs.map((entry) => entry.data().resourceId || entry.id).filter(Boolean);
  }

  // Fall back to the legacy per-user subcollection for accounts created before
  // the data-model migration.
  try {
    const legacy = await getDocs(collection(db, 'users', uid, 'bookmarks'));
    return legacy.docs.map((entry) => entry.data().resourceId || entry.id).filter(Boolean);
  } catch {
    return [];
  }
}

export async function fetchBookmarks(uid) {
  const ids = await fetchBookmarkIds(uid);
  const resources = await Promise.all(ids.map((id) => fetchResourceById(id).catch(() => null)));
  return resources.filter(Boolean);
}

export async function isBookmarked(uid, resourceId) {
  if (!db || !uid || !resourceId) return false;
  const snap = await getDoc(doc(db, 'bookmarks', bookmarkDocId(uid, resourceId)));
  if (snap.exists()) return true;
  try {
    const legacy = await getDoc(doc(db, 'users', uid, 'bookmarks', resourceId));
    return legacy.exists();
  } catch {
    return false;
  }
}

export async function saveBookmark(uid, resourceId) {
  if (!db || !uid) throw new Error('Sign in to save resources.');
  const id = bookmarkDocId(uid, resourceId);
  await setDoc(doc(db, 'bookmarks', id), {
    id,
    userId: uid,
    resourceId,
    savedAt: serverTimestamp()
  });
}

export async function removeBookmark(uid, resourceId) {
  if (!db || !uid) throw new Error('Sign in to save resources.');
  await deleteDoc(doc(db, 'bookmarks', bookmarkDocId(uid, resourceId)));
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', resourceId));
  } catch {
    /* legacy doc may not exist */
  }
}

// ---------------------------------------------------------------------------
// Progress (top-level collection, id "<uid>_<resourceId>")
// ---------------------------------------------------------------------------

export const progressDocId = (uid, resourceId) => `${uid}_${resourceId}`;

export function normalizeProgressStatus(value) {
  if (PROGRESS_STATUSES.includes(value)) return value;
  if (value === 'started') return 'in_progress';
  if (value === 'done') return 'completed';
  return 'not_started';
}

export async function fetchProgress(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, 'progress'), where('userId', '==', uid)));
  return snap.docs.map((entry) => ({
    id: entry.id,
    resourceId: entry.data().resourceId || entry.id,
    status: normalizeProgressStatus(entry.data().status),
    updatedAt: normalizeTimestamp(entry.data().updatedAt)
  }));
}

export async function fetchProgressFor(uid, resourceId) {
  if (!db || !uid || !resourceId) return null;
  const snap = await getDoc(doc(db, 'progress', progressDocId(uid, resourceId)));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    resourceId,
    status: normalizeProgressStatus(snap.data().status),
    updatedAt: normalizeTimestamp(snap.data().updatedAt)
  };
}

export async function setProgress(uid, resourceId, status) {
  if (!db || !uid) throw new Error('Sign in to track progress.');
  const id = progressDocId(uid, resourceId);
  await setDoc(
    doc(db, 'progress', id),
    {
      id,
      userId: uid,
      resourceId,
      status: normalizeProgressStatus(status),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Reviews (top-level collection, id "<resourceId>_<uid>")
// ---------------------------------------------------------------------------

export const reviewDocId = (resourceId, uid) => `${resourceId}_${uid}`;

function mapReview(snapshot) {
  const data = snapshot.data() || {};
  return {
    ...data,
    id: snapshot.id,
    text: data.body || data.comment || '',
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

export async function fetchReviews(resourceId) {
  if (!db || !resourceId) return [];
  const snap = await getDocs(
    query(
      collection(db, 'reviews'),
      where('resourceId', '==', resourceId),
      limit(100)
    )
  );
  return snap.docs
    .map(mapReview)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function fetchUserReviews(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(
    query(collection(db, 'reviews'), where('userId', '==', uid), limit(100))
  );
  return snap.docs
    .map(mapReview)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function fetchUserReview(resourceId, uid) {
  if (!db || !resourceId || !uid) return null;
  const snap = await getDoc(doc(db, 'reviews', reviewDocId(resourceId, uid)));
  return snap.exists() ? mapReview(snap) : null;
}

export async function saveReview({ resourceId, uid, authorName, rating, body }) {
  if (!db || !uid) throw new Error('Sign in to review resources.');
  const id = reviewDocId(resourceId, uid);
  const existing = await getDoc(doc(db, 'reviews', id));
  const text = body;
  await setDoc(
    doc(db, 'reviews', id),
    {
      id,
      resourceId,
      userId: uid,
      authorName: authorName || null,
      rating,
      // `body` is the canonical field (validated by the security rules);
      // `comment` is kept in sync for the documented data model.
      body: text,
      comment: text,
      createdAt: existing.exists() ? existing.data().createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function deleteReview(resourceId, uid) {
  if (!db || !uid) throw new Error('Sign in to review resources.');
  await deleteDoc(doc(db, 'reviews', reviewDocId(resourceId, uid)));
}

/** Aggregate rating from a list of review documents. */
export function summarizeReviews(reviews = []) {
  if (!reviews.length) return { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
  const distribution = [0, 0, 0, 0, 0];
  let total = 0;
  reviews.forEach((review) => {
    const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 0)));
    total += rating;
    distribution[rating - 1] += 1;
  });
  return {
    average: Number((total / reviews.length).toFixed(1)),
    count: reviews.length,
    distribution
  };
}

// ---------------------------------------------------------------------------
// Submissions (legacy community flow)
// ---------------------------------------------------------------------------

export async function fetchUserSubmissions(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, 'resources'), where('createdBy', '==', uid)));
  return snap.docs.map(mapResource).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

export async function fetchPendingResources() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'resources'), where('status', '==', 'pending')));
  return snap.docs.map(mapResource).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

export async function fetchReports() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'reports'));
  return snap.docs
    .map((report) => ({
      ...report.data(),
      id: report.id,
      createdAt: normalizeTimestamp(report.data().createdAt),
      resolvedAt: normalizeTimestamp(report.data().resolvedAt)
    }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function submitResource({ uid, email, values, thumbnailFile }) {
  if (!db) throw new Error('Firebase is not configured. Resource submission is unavailable in preview mode.');

  let thumbnailUrl = null;
  if (thumbnailFile && storage) {
    if (!thumbnailFile.type.startsWith('image/')) {
      throw new Error('Thumbnail must be an image file.');
    }
    if (thumbnailFile.size > 2 * 1024 * 1024) {
      throw new Error('Thumbnail must be smaller than 2 MB.');
    }
    const thumbnailRef = ref(
      storage,
      `thumbnails/${uid}/${Date.now()}-${safeFileName(thumbnailFile.name)}`
    );
    await uploadBytes(thumbnailRef, thumbnailFile, {
      contentType: thumbnailFile.type,
      cacheControl: 'public,max-age=31536000,immutable'
    });
    thumbnailUrl = await getDownloadURL(thumbnailRef);
  }

  const resourceRef = doc(collection(db, 'resources'));
  const now = new Date().toISOString();

  await setDoc(resourceRef, {
    id: resourceRef.id,
    type: values.type,
    // Refined model: bilingual-ready maps (English only until translated).
    title: { en: values.title.trim() },
    slug: slugify(values.title),
    sourceName: values.provider.trim(),
    description: { en: values.description.trim() },
    longDescription: { en: (values.longDescription?.trim() || values.description.trim()) },
    sourceUrl: values.url.trim(),
    category: values.category,
    level: values.level,
    language: values.languages,
    countries: values.countries,
    tags: values.tags,
    license: values.licenseNote.trim(),
    licenseUrl: values.licenseUrl?.trim() || null,
    author: values.author?.trim() || null,
    platform: values.platform || [],
    featured: false,
    thumbnailUrl,
    ratingAvg: 0,
    ratingCount: 0,
    viewCount: 0,
    saveCount: 0,
    // Community submissions stay in the legacy review queue.
    status: 'pending',
    createdBy: uid,
    creatorEmail: email || null,
    lastVerified: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return resourceRef.id;
}

export async function updateResourceStatus({ id, status, reviewerUid, reviewNote = '' }) {
  if (!db) throw new Error('Firebase is not configured.');
  const payload = {
    status,
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewNote
  };
  if (status === 'published') payload.publishedAt = serverTimestamp();
  await updateDoc(doc(db, 'resources', id), payload);
}

export async function markReportResolved({ id, reviewerUid }) {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'reports', id), {
    status: 'resolved',
    resolvedBy: reviewerUid,
    resolvedAt: serverTimestamp()
  });
}

export async function fetchAdminCounts() {
  if (!db) return { resources: demoResources.length, pending: 0, reports: 0 };
  const [publishedSnap, pendingSnap, reportsSnap] = await Promise.all([
    getDocs(query(collection(db, 'resources'), where('status', '==', 'published'))),
    getDocs(query(collection(db, 'resources'), where('status', '==', 'pending'))),
    getDocs(query(collection(db, 'reports'), where('status', '==', 'open')))
  ]);
  return {
    resources: publishedSnap.size,
    pending: pendingSnap.size,
    reports: reportsSnap.size
  };
}

// ---------------------------------------------------------------------------
// Filtering, search and pagination (section 8)
// ---------------------------------------------------------------------------

/**
 * Filter + sort the published library. `language` accepts a language name
 * ("English") and matches either the refined `language[]` or legacy
 * `languages[]` field. `rating` keeps resources whose average rating is at or
 * above the given value.
 */
export function filterResources(resources, filters = {}) {
  const {
    query: search = '',
    type = 'all',
    category = 'all',
    level = 'all',
    language = 'all',
    country = 'all',
    platform = 'all',
    rating = 'all',
    sort = 'recommended',
    uiLanguage = 'en'
  } = filters;

  const needle = String(search || '').trim().toLowerCase();
  const minRating = rating && rating !== 'all' ? Number(rating) : 0;

  const filtered = resources.filter((resource) => {
    if (!isPublished(resource)) return false;
    if (type !== 'all' && resource.type !== type) return false;
    if (category !== 'all' && resource.category !== category) return false;
    if (level !== 'all' && resource.level !== level) return false;
    if (language !== 'all' && !(resource.language || resource.languages || []).includes(language)) {
      return false;
    }
    if (country !== 'all' && !resource.countries?.includes(country)) return false;
    if (platform !== 'all' && !resource.platform?.includes(platform)) return false;
    if (minRating && (Number(resource.ratingAvg) || 0) < minRating) return false;
    if (!needle) return true;

    const haystack = [
      localizedField(resource.title, uiLanguage),
      resource.sourceName,
      localizedField(resource.description, uiLanguage),
      localizedField(resource.longDescription, uiLanguage),
      resource.category,
      resource.author,
      ...(resource.tags || []),
      ...(resource.language || resource.languages || []),
      ...(resource.countries || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });

  const titleOf = (resource) => localizedField(resource.title, uiLanguage);

  if (sort === 'az') {
    return filtered.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  }
  if (sort === 'newest') {
    return filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
  if (sort === 'rating') {
    return filtered.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
  }
  if (sort === 'popular') {
    return filtered.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  }
  return filtered.sort(recommendedSort);
}

/**
 * Resolve any title/description field (plain string or `{en,bn,ur}` map) for
 * the active UI language. Re-exported here so components can pull the resource
 * helpers from a single module.
 */
export const localizedField = localized;

export function paginate(items = [], page = 1, pageSize = 12) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageCount,
    pageSize
  };
}

export function getRelatedResources(resources, resource, count = 3) {
  if (!resource) return [];
  const sameCategory = resources.filter(
    (item) => item.id !== resource.id && isPublished(item) && item.category === resource.category
  );
  const sameType = resources.filter(
    (item) => item.id !== resource.id && isPublished(item) && item.type === resource.type
  );
  return [...sameCategory, ...sameType]
    .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
    .slice(0, count);
}

export function getAlternativesWithResources(alternatives, resources) {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return alternatives
    .map((alternative) => ({
      ...alternative,
      freeResource: byId.get(alternative.freeAlternativeResourceId) || null
    }))
    .filter((alternative) => alternative.freeResource);
}

export { demoResources };
