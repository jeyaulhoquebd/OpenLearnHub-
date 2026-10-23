import { getDb, getFirebaseAuth } from '../firebase.js';
import { decodeCursor, encodeCursor } from './resourceAdmin.js';

/**
 * Read model for the admin audit log screen.
 *
 * Entries are written by lib/audit.js and are never readable from the browser.
 * Firestore cannot combine several optional equality filters with a date range
 * without composite indexes, so this module scans a bounded, newest-first page
 * and filters in memory. The cursor is an opaque offset into the filtered set.
 */

export const AUDIT_SCAN_LIMIT = 1000;

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return null;
}

function time(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Parses a date input; a date-only `to` value covers the whole day. */
export function parseAuditDate(value, { endOfDay = false } = {}) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesAdmin(row, needle) {
  const query = String(needle || '').trim().toLowerCase();
  if (!query) return true;
  return [row.adminUid, row.adminEmail, row.adminName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

async function enrichAdmins(rows) {
  const missing = Array.from(
    new Set(
      rows
        .filter((row) => !row.adminEmail || !row.adminName)
        .map((row) => row.adminUid)
        .filter(Boolean)
    )
  ).slice(0, 300);

  if (!missing.length) return rows;

  const auth = getFirebaseAuth();
  if (!auth) return rows;

  const byUid = new Map();
  for (let index = 0; index < missing.length; index += 100) {
    const group = missing.slice(index, index + 100);
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await auth.getUsers(group.map((uid) => ({ uid })));
      (result.users || []).forEach((record) => byUid.set(record.uid, record));
    } catch (error) {
      console.warn('[audit-log] Could not enrich admin profiles:', error?.message || error);
      break;
    }
  }

  return rows.map((row) => {
    const record = byUid.get(row.adminUid);
    if (!record) return row;
    return {
      ...row,
      adminEmail: row.adminEmail || record.email || null,
      adminName: row.adminName || record.displayName || null
    };
  });
}

/**
 * @param {object} options
 * @param {string} [options.admin] UID/email/name substring.
 * @param {string} [options.action] Exact action, e.g. "resource.update".
 * @param {string} [options.targetType] Exact target type, e.g. "resource".
 * @param {string} [options.from] ISO/date string.
 * @param {string} [options.to] ISO/date string.
 * @param {string} [options.cursor] Opaque offset cursor.
 * @param {number} [options.limit] 10–100.
 */
export async function listAuditLogs({
  admin = '',
  action = '',
  targetType = '',
  from = '',
  to = '',
  cursor = '',
  limit = 25
} = {}) {
  const db = getDb();
  if (!db) {
    const error = new Error('The database is not configured.');
    error.code = 'database_unavailable';
    throw error;
  }

  const snapshot = await db
    .collection('auditLogs')
    .orderBy('createdAt', 'desc')
    .limit(AUDIT_SCAN_LIMIT)
    .get();

  const fromDate = parseAuditDate(from);
  const toDate = parseAuditDate(to, { endOfDay: true });

  const actions = new Set();
  const targetTypes = new Set();
  const admins = new Map();

  let rows = snapshot.docs.map((entry) => {
    const data = entry.data() || {};
    const row = {
      id: entry.id,
      adminUid: data.adminUid || 'unknown',
      adminEmail: data.adminEmail || null,
      adminName: data.adminName || null,
      action: data.action || 'unknown',
      targetType: data.targetType || null,
      targetId: data.targetId || null,
      details: data.details && typeof data.details === 'object' ? data.details : {},
      createdAt: toIso(data.createdAt)
    };

    actions.add(row.action);
    if (row.targetType) targetTypes.add(row.targetType);
    const current = admins.get(row.adminUid) || {
      uid: row.adminUid,
      email: row.adminEmail,
      name: row.adminName,
      count: 0
    };
    current.count += 1;
    current.email = current.email || row.adminEmail;
    current.name = current.name || row.adminName;
    admins.set(row.adminUid, current);
    return row;
  });

  // Enrich before filtering so an admin filter can match the email/name of
  // older entries that only stored a UID. Older logs may have neither field.
  rows = await enrichAdmins(rows);
  rows.forEach((row) => {
    const entry = admins.get(row.adminUid);
    if (!entry) return;
    entry.email = entry.email || row.adminEmail;
    entry.name = entry.name || row.adminName;
  });

  rows = rows.filter((row) => {
    if (action && row.action !== action) return false;
    if (targetType && row.targetType !== targetType) return false;
    if (!matchesAdmin(row, admin)) return false;
    const created = time(row.createdAt);
    if (fromDate && created < fromDate.getTime()) return false;
    if (toDate && created > toDate.getTime()) return false;
    return true;
  });

  const total = rows.length;
  const offset = decodeCursor(cursor);
  const items = rows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;

  const adminOptions = Array.from(admins.values()).sort((a, b) => {
    const left = a.name || a.email || a.uid;
    const right = b.name || b.email || b.uid;
    return String(left).localeCompare(String(right));
  });

  return {
    items,
    total,
    limit,
    nextCursor: nextOffset < total ? encodeCursor(nextOffset) : null,
    scanned: snapshot.size,
    scanLimit: AUDIT_SCAN_LIMIT,
    truncated: snapshot.size >= AUDIT_SCAN_LIMIT,
    facets: {
      actions: Array.from(actions).sort(),
      targetTypes: Array.from(targetTypes).sort(),
      admins: adminOptions
    }
  };
}
