import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import seedData from '../../../firebase/seed/resources.json';
import seedCategories from '../../../firebase/seed/categories.json';
import seedAlternatives from '../../../firebase/seed/alternatives.json';
import { auth, db } from './firebase';
import {
  deleteReviewApi,
  removeBookmarkApi,
  saveBookmarkApi,
  saveReviewApi
} from './api';
import { localized, normalizeTimestamp, slugify } from './utils';
import { parseYouTubePlaylistId, youtubePlaylistUrl } from './youtube';
import { prepareThumbnail, uploadThumbnail } from './thumbnails';

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
  const rawSourceUrl = raw.sourceUrl || raw.url || '';
  const youtubePlaylistId =
    parseYouTubePlaylistId(raw.youtubePlaylistId) ||
    parseYouTubePlaylistId(rawSourceUrl) ||
    null;
  const sourceUrl = youtubePlaylistId ? youtubePlaylistUrl(youtubePlaylistId) : rawSourceUrl;

  return {
    ...raw,
    id: raw.id,
    sourceName,
    sourceUrl,
    youtubePlaylistId,
    youtubePlaylistTitle: raw.youtubePlaylistTitle || '',
    youtubeChannelTitle: raw.youtubeChannelTitle || '',
    youtubeVideoCount: Number(raw.youtubeVideoCount) || 0,
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

const PUBLISHED_PAGE_SIZE = 500;
const PUBLISHED_MAX = 5000;

/** Every published listing, read in pages (no silent 500-item cut-off). */
export async function fetchPublishedResources() {
  if (!db) {
    return demoResources.filter(isPublished).sort(recommendedSort);
  }

  const docs = [];
  let last = null;
  while (docs.length < PUBLISHED_MAX) {
    const constraints = [
      where('status', '==', 'published'),
      orderBy(documentId()),
      limit(PUBLISHED_PAGE_SIZE)
    ];
    if (last) constraints.push(startAfter(last));
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(query(collection(db, 'resources'), ...constraints));
    docs.push(...snap.docs);
    if (snap.size < PUBLISHED_PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }

  return docs.map(mapResource).sort(recommendedSort);
}

/** Current user's ID token for the community API calls. */
async function currentToken() {
  const current = auth?.currentUser;
  if (!current) throw new Error('Please sign in to continue.');
  return current.getIdToken();
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
    // Sorted in memory: `orderBy('order')` would silently drop categories
    // that have no `order` field.
    const snap = await getDocs(collection(db, 'categories'));
    const items = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    return items.length ? items : demoCategories;
  } catch (error) {
    console.warn('[categories]', error);
    return demoCategories;
  }
}

/**
 * Public list of paid → free pairs for the home page.
 *
 * Rows are curated in the admin panel, so this only returns the ones an admin
 * has left active, sorted by their manual `order`. Legacy rows without an
 * `active` field are treated as active.
 */
export async function fetchAlternatives() {
  const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);

  if (!db) {
    return demoAlternatives
      .map((item) => ({ ...item }))
      .sort(byOrder);
  }

  try {
    const snap = await getDocs(collection(db, 'alternatives'));
    const items = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((item) => item.active !== false)
      .sort(byOrder);
    return items.length ? items : demoAlternatives.slice().sort(byOrder);
  } catch (error) {
    console.warn('[alternatives]', error);
    return demoAlternatives.slice().sort(byOrder);
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
  const ids = [...new Set(await fetchBookmarkIds(uid))];
  if (!db || !ids.length) return [];

  // Batched `in` queries (30 ids each) instead of one read per bookmark. The
  // status filter keeps the query inside the security rules.
  const chunks = [];
  for (let index = 0; index < ids.length; index += 30) chunks.push(ids.slice(index, index + 30));
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query(
          collection(db, 'resources'),
          where(documentId(), 'in', chunk),
          where('status', '==', 'published')
        )
      ).catch(() => null)
    )
  );
  const byId = new Map();
  snaps.forEach((snap) => snap?.docs.forEach((entry) => byId.set(entry.id, mapResource(entry))));
  return ids.map((id) => byId.get(id)).filter(Boolean);
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

// Bookmark writes go through the API so the resource's saveCount stays exact.
export async function saveBookmark(uid, resourceId) {
  if (!db || !uid) throw new Error('Sign in to save resources.');
  await saveBookmarkApi(resourceId, await currentToken());
}

export async function removeBookmark(uid, resourceId) {
  if (!db || !uid) throw new Error('Sign in to save resources.');
  await removeBookmarkApi(resourceId, await currentToken());
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
// Course lessons, per-lesson progress and notes
// ---------------------------------------------------------------------------

/**
 * Lesson metadata is stored in a subcollection so long playlists are not
 * limited by Firestore's per-document size. Read access is granted only while
 * the parent resource is published (see firestore.rules).
 */
export async function fetchCourseVideos(resourceId) {
  if (!db || !resourceId) return [];
  const snap = await getDocs(collection(db, 'resources', resourceId, 'videos'));
  return snap.docs
    .map((entry) => {
      const data = entry.data() || {};
      return {
        ...data,
        id: entry.id,
        position: Number(data.position) || 0,
        durationSeconds: Number(data.durationSeconds) || 0
      };
    })
    .sort((a, b) => a.position - b.position);
}

export async function fetchCourseProgress(uid, resourceId) {
  if (!db || !uid || !resourceId) {
    return { status: 'not_started', completedVideoIds: [], lastVideoId: null };
  }
  const snap = await getDoc(doc(db, 'progress', progressDocId(uid, resourceId)));
  if (!snap.exists()) {
    return { status: 'not_started', completedVideoIds: [], lastVideoId: null };
  }
  const data = snap.data() || {};
  return {
    status: normalizeProgressStatus(data.status),
    completedVideoIds: Array.isArray(data.completedVideoIds)
      ? data.completedVideoIds.filter((id) => typeof id === 'string').slice(0, 5000)
      : [],
    lastVideoId: typeof data.lastVideoId === 'string' ? data.lastVideoId : null
  };
}

export async function saveCourseProgress(
  uid,
  resourceId,
  { status, completedVideoIds, lastVideoId } = {}
) {
  if (!db || !uid) throw new Error('Sign in to track progress.');
  const id = progressDocId(uid, resourceId);
  const payload = {
    id,
    userId: uid,
    resourceId,
    updatedAt: serverTimestamp()
  };

  if (status) payload.status = normalizeProgressStatus(status);
  if (Array.isArray(completedVideoIds)) {
    payload.completedVideoIds = [
      ...new Set(
        completedVideoIds
          .filter((videoId) => typeof videoId === 'string' && videoId)
          .map((videoId) => videoId.slice(0, 128))
      )
    ].slice(0, 5000);
  }
  if (lastVideoId !== undefined) {
    payload.lastVideoId = lastVideoId ? String(lastVideoId).slice(0, 128) : null;
  }

  await setDoc(doc(db, 'progress', id), payload, { merge: true });
}

function courseNoteId(resourceId, videoId) {
  return `${resourceId}_${videoId}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 180);
}

export async function fetchCourseNotes(uid, resourceId) {
  if (!db || !uid || !resourceId) return [];
  const snap = await getDocs(
    query(
      collection(db, 'users', uid, 'courseNotes'),
      where('resourceId', '==', resourceId)
    )
  );
  return snap.docs
    .map((entry) => {
      const data = entry.data() || {};
      return {
        ...data,
        id: entry.id,
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt)
      };
    })
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

export async function saveCourseNote({
  uid,
  resourceId,
  videoId,
  videoTitle = '',
  body = ''
}) {
  if (!db || !uid || !resourceId || !videoId) {
    throw new Error('Sign in to save notes.');
  }
  const text = String(body || '').trim().slice(0, 4000);
  const id = courseNoteId(resourceId, videoId);
  const ref = doc(db, 'users', uid, 'courseNotes', id);

  if (!text) {
    await deleteDoc(ref);
    return null;
  }

  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      id,
      userId: uid,
      resourceId,
      videoId,
      videoTitle: String(videoTitle || '').slice(0, 300),
      body: text,
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { id, videoId, body: text, videoTitle };
}

export async function deleteCourseNote(uid, resourceId, videoId) {
  if (!db || !uid || !resourceId || !videoId) return;
  await deleteDoc(doc(db, 'users', uid, 'courseNotes', courseNoteId(resourceId, videoId)));
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
      // Hidden reviews are only readable by their author (security rules), so
      // the public list has to ask for visible rows explicitly. This composite
      // filter is declared in firebase/firestore.indexes.json.
      where('hidden', '==', false),
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

/**
 * Reviews are written by the API, which verifies the account, sets the author
 * name, keeps moderation state and recomputes the resource rating atomically.
 */
export async function saveReview({ resourceId, uid, rating, body }) {
  if (!db || !uid) throw new Error('Sign in to review resources.');
  return saveReviewApi({ resourceId, rating, body }, await currentToken());
}

export async function deleteReview(resourceId, uid) {
  if (!db || !uid) throw new Error('Sign in to review resources.');
  return deleteReviewApi(resourceId, await currentToken());
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
// Saved AI roadmaps (`users/{uid}/roadmaps`, owner-scoped)
// ---------------------------------------------------------------------------

function toStoredRoadmapResource(resource = {}) {
  return {
    id: String(resource.id || '').slice(0, 160),
    title: String(resource.title || '').slice(0, 200),
    url: String(resource.url || '').slice(0, 600),
    type: String(resource.type || '').slice(0, 20),
    sourceName: String(resource.sourceName || '').slice(0, 160),
    level: String(resource.level || '').slice(0, 40),
    category: String(resource.category || '').slice(0, 80)
  };
}

/** Trims a roadmap step to the plain shape Firestore accepts (no undefined). */
function toStoredRoadmapStep(step = {}, index = 0) {
  const resources = Array.isArray(step.resources)
    ? step.resources.filter((resource) => resource?.id).map(toStoredRoadmapResource)
    : [];
  const ids = Array.isArray(step.resourceIds) && step.resourceIds.length
    ? step.resourceIds
    : resources.map((resource) => resource.id);

  return {
    order: Number(step.order) || index + 1,
    title: String(step.title || '').slice(0, 200),
    explanation: String(step.explanation || step.description || '').slice(0, 1500),
    resourceIds: [...new Set(ids.map((id) => String(id).slice(0, 160)))].slice(0, 6),
    resources: resources.slice(0, 6)
  };
}

export async function saveRoadmap(uid, roadmap) {
  if (!db || !uid) throw new Error('Sign in to save a roadmap.');
  const steps = Array.isArray(roadmap?.steps) ? roadmap.steps.slice(0, 20) : [];
  const ref = await addDoc(collection(db, 'users', uid, 'roadmaps'), {
    userId: uid,
    goal: String(roadmap?.goal || '').slice(0, 300),
    level: String(roadmap?.level || 'beginner').slice(0, 20),
    language: String(roadmap?.language || 'en').slice(0, 8),
    title: String(roadmap?.title || '').slice(0, 200),
    summary: String(roadmap?.summary || '').slice(0, 1200),
    steps: steps.map(toStoredRoadmapStep),
    resourceIds: [
      ...new Set(
        steps
          .flatMap((step) => [
            ...(Array.isArray(step.resourceIds) ? step.resourceIds : []),
            ...(step.resources || []).map((resource) => resource?.id)
          ])
          .filter(Boolean)
          .map((id) => String(id))
      )
    ].slice(0, 60),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function fetchRoadmaps(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(collection(db, 'users', uid, 'roadmaps'));
  return snap.docs
    .map((entry) => ({
      ...entry.data(),
      id: entry.id,
      createdAt: normalizeTimestamp(entry.data().createdAt)
    }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function deleteRoadmap(uid, roadmapId) {
  if (!db || !uid || !roadmapId) throw new Error('Sign in to manage roadmaps.');
  await deleteDoc(doc(db, 'users', uid, 'roadmaps', roadmapId));
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
  if (thumbnailFile) {
    if (!thumbnailFile.type.startsWith('image/')) {
      throw new Error('Thumbnail must be an image file.');
    }
    if (thumbnailFile.size > 5 * 1024 * 1024) {
      throw new Error('Thumbnail must be smaller than 5 MB.');
    }
    const prepared = await prepareThumbnail(thumbnailFile);
    thumbnailUrl = await uploadThumbnail(prepared, uid);
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
    // Counters (ratingAvg, viewCount…) are set by the server on approval;
    // the security rules reject them here.
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

export async function fetchAdminCounts() {
  if (!db) return { resources: demoResources.length, pending: 0, reports: 0 };
  // Server-side aggregation: counts without downloading every document.
  const count = (q) => getCountFromServer(q).then((snap) => snap.data().count);
  const [resources, pending, reports] = await Promise.all([
    count(query(collection(db, 'resources'), where('status', '==', 'published'))),
    count(query(collection(db, 'resources'), where('status', '==', 'pending'))),
    count(query(collection(db, 'reports'), where('status', '==', 'open')))
  ]);
  return { resources, pending, reports };
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
    .filter((alternative) => alternative.active !== false)
    .map((alternative) => ({
      ...alternative,
      freeResource: byId.get(alternative.freeAlternativeResourceId) || null
    }))
    .filter((alternative) => alternative.freeResource);
}

export { demoResources };
