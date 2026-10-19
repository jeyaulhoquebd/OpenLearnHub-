import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import seedData from '../../../firebase/seed/resources.json';
import { db, storage } from './firebase';
import { normalizeTimestamp, safeFileName, slugify } from './utils';

const demoResources = seedData.map((resource) => ({
  ...resource,
  status: resource.status || 'published',
  thumbnailUrl: resource.thumbnailUrl || null
}));

export const isDemoMode = !db;

function mapResource(snapshot) {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    createdAt: normalizeTimestamp(data.createdAt),
    publishedAt: normalizeTimestamp(data.publishedAt),
    reviewedAt: normalizeTimestamp(data.reviewedAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

function recommendedSort(a, b) {
  if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

export async function fetchPublishedResources() {
  if (!db) {
    return demoResources.filter((item) => item.status === 'published').sort(recommendedSort);
  }

  const snap = await getDocs(
    query(
      collection(db, 'resources'),
      where('status', '==', 'published'),
      limit(500)
    )
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

export async function fetchBookmarks(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(collection(db, 'users', uid, 'bookmarks'));
  const ids = snap.docs.map((bookmark) => bookmark.data().resourceId || bookmark.id).filter(Boolean);
  const resources = await Promise.all(ids.map((id) => fetchResourceById(id).catch(() => null)));
  return resources.filter(Boolean);
}

export async function isBookmarked(uid, resourceId) {
  if (!db || !uid || !resourceId) return false;
  const snap = await getDoc(doc(db, 'users', uid, 'bookmarks', resourceId));
  return snap.exists();
}

export async function saveBookmark(uid, resourceId) {
  if (!db || !uid) throw new Error('Sign in to save resources.');
  await setDoc(doc(db, 'users', uid, 'bookmarks', resourceId), {
    resourceId,
    savedAt: serverTimestamp()
  });
}

export async function removeBookmark(uid, resourceId) {
  if (!db || !uid) throw new Error('Sign in to save resources.');
  await deleteDoc(doc(db, 'users', uid, 'bookmarks', resourceId));
}

export async function fetchUserSubmissions(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(
    query(collection(db, 'resources'), where('createdBy', '==', uid))
  );
  return snap.docs.map(mapResource).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

export async function fetchPendingResources() {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, 'resources'), where('status', '==', 'pending'))
  );
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
    title: values.title.trim(),
    slug: slugify(values.title),
    provider: values.provider.trim(),
    description: values.description.trim(),
    longDescription: values.longDescription?.trim() || values.description.trim(),
    url: values.url.trim(),
    category: values.category,
    level: values.level,
    languages: values.languages,
    countries: values.countries,
    tags: values.tags,
    license: values.licenseNote.trim(),
    licenseUrl: values.licenseUrl?.trim() || null,
    author: values.author?.trim() || null,
    platform: values.platform || [],
    featured: false,
    thumbnailUrl,
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

export function filterResources(resources, filters = {}) {
  const {
    query: search = '',
    type = 'all',
    category = 'all',
    level = 'all',
    language = 'all',
    country = 'all',
    platform = 'all',
    sort = 'recommended'
  } = filters;

  const needle = search.trim().toLowerCase();

  const filtered = resources.filter((resource) => {
    if (resource.status && resource.status !== 'published') return false;
    if (type !== 'all' && resource.type !== type) return false;
    if (category !== 'all' && resource.category !== category) return false;
    if (level !== 'all' && resource.level !== level) return false;
    if (language !== 'all' && !resource.languages?.includes(language)) return false;
    if (country !== 'all' && !resource.countries?.includes(country)) return false;
    if (platform !== 'all' && !resource.platform?.includes(platform)) return false;
    if (!needle) return true;

    const haystack = [
      resource.title,
      resource.provider,
      resource.description,
      resource.longDescription,
      resource.category,
      resource.author,
      ...(resource.tags || []),
      ...(resource.languages || []),
      ...(resource.countries || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });

  if (sort === 'az') {
    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === 'newest') {
    return filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
  return filtered.sort(recommendedSort);
}

export function getRelatedResources(resources, resource, count = 3) {
  if (!resource) return [];
  const sameCategory = resources.filter(
    (item) =>
      item.id !== resource.id &&
      item.status === 'published' &&
      item.category === resource.category
  );
  const sameType = resources.filter(
    (item) =>
      item.id !== resource.id &&
      item.status === 'published' &&
      item.type === resource.type
  );
  return [...sameCategory, ...sameType]
    .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
    .slice(0, count);
}

export { demoResources };
