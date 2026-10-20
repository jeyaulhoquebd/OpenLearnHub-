import { getDb } from '../firebase.js';

/**
 * Shared helpers for the admin users screen.
 *
 * Firebase Auth is the source of truth for identity (email, providers,
 * disabled flag, metadata, custom claims); Firestore `users/{uid}` adds profile
 * fields and is merged in for display. Custom claims are the only source of
 * admin access — a Firestore `role` field is never trusted.
 */

export const USER_PAGE_MAX = 1000;
export const USER_SCAN_LIMIT = 1000;
export const USER_RESULT_LIMIT = 200;
export const PROVIDERS = ['password', 'google', 'github', 'apple', 'other'];

const PROVIDER_MAP = {
  password: 'password',
  'google.com': 'google',
  'github.com': 'github',
  'apple.com': 'apple'
};

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
}

/** Normalised provider keys for icons/badges (deduped, in a stable order). */
export function providerKeys(record) {
  const list = (record?.providerData || [])
    .map((entry) => PROVIDER_MAP[entry.providerId] || 'other')
    .filter(Boolean);
  const unique = [...new Set(list)];
  return unique.length ? unique : ['password'];
}

export function isAdminRecord(record) {
  return record?.customClaims?.admin === true;
}

/** Serialises an Auth record plus the matching Firestore profile (if any). */
export function serializeAuthUser(record, profile = null) {
  return {
    uid: record.uid,
    displayName: record.displayName || profile?.displayName || '',
    email: record.email || profile?.email || '',
    emailVerified: record.emailVerified === true,
    providers: providerKeys(record),
    disabled: record.disabled === true,
    isAdmin: isAdminRecord(record),
    photoURL: record.photoURL || profile?.photoURL || null,
    preferredLanguage: profile?.preferredLanguage || null,
    createdAt: toIso(record.metadata?.creationTime) || toIso(profile?.createdAt),
    lastSignInAt: toIso(record.metadata?.lastSignInTime) || toIso(profile?.lastLoginAt)
  };
}

/** Loads Firestore profiles for a page of users in one batched read. */
export async function loadProfiles(uids = []) {
  const db = getDb();
  const unique = [...new Set(uids.filter(Boolean))];
  if (!db || !unique.length) return new Map();

  const profiles = new Map();
  for (let index = 0; index < unique.length; index += 300) {
    const chunk = unique.slice(index, index + 300);
    try {
      // eslint-disable-next-line no-await-in-loop
      const snapshots = await db.getAll(...chunk.map((uid) => db.collection('users').doc(uid)));
      snapshots.forEach((snapshot) => {
        if (snapshot.exists) profiles.set(snapshot.id, snapshot.data() || {});
      });
    } catch (error) {
      console.warn('[admin-users] Could not load profiles:', error?.message || error);
      break;
    }
  }
  return profiles;
}

/** Case-insensitive match across uid, email and display name. */
export function matchesUser(record, needle) {
  if (!needle) return true;
  const haystack = [record.uid, record.email, record.displayName, record.phoneNumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * Filters used when the admin searches or narrows the list.
 * Values arrive as strings from the query string ("true" / "false").
 */
export function userMatchesFilters(record, { verified, provider, admin, disabled }) {
  if (verified != null && record.emailVerified !== verified) return false;
  if (disabled != null && record.disabled !== disabled) return false;
  if (admin != null && isAdminRecord(record) !== admin) return false;
  if (provider && !providerKeys(record).includes(provider)) return false;
  return true;
}

/**
 * Scans (at most `USER_SCAN_LIMIT`) Auth users and applies search + filters in
 * memory. Used for every filtered view; the unfiltered view keeps native
 * pageToken pagination so large projects stay fast.
 */
export async function scanAuthUsers(auth, filters = {}) {
  const needle = String(filters.search || '').trim().toLowerCase();
  const users = [];
  let scanned = 0;
  let pageToken;
  let truncated = false;

  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await auth.listUsers(USER_PAGE_MAX, pageToken);
    for (const record of page.users) {
      scanned += 1;
      if (!userMatchesFilters(record, filters)) continue;
      if (!matchesUser(record, needle)) continue;
      users.push(record);
      if (users.length >= USER_RESULT_LIMIT) {
        truncated = true;
        break;
      }
    }
    pageToken = page.pageToken;
    if (truncated) break;
    if (scanned >= USER_SCAN_LIMIT) {
      truncated = Boolean(pageToken);
      break;
    }
  } while (pageToken);

  return { users, scanned, truncated };
}

/** Number of admin-claimed accounts, optionally ignoring one uid. */
export async function countAdmins(auth, { excludeUid = null } = {}) {
  let count = 0;
  let pageToken;
  let scanned = 0;

  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await auth.listUsers(USER_PAGE_MAX, pageToken);
    page.users.forEach((record) => {
      scanned += 1;
      if (record.uid !== excludeUid && isAdminRecord(record)) count += 1;
    });
    pageToken = page.pageToken;
  } while (pageToken && scanned < USER_SCAN_LIMIT);

  return count;
}

/** `count()` with a soft failure so one missing index cannot break the drawer. */
export async function countQuery(query) {
  try {
    const snapshot = await query.count().get();
    return Number(snapshot.data().count) || 0;
  } catch (error) {
    console.warn('[admin-users] count() failed:', error?.message || error);
    return 0;
  }
}

export { toIso };
