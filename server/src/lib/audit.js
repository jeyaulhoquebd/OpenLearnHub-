import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase.js';
import { sanitizeText } from './validation.js';

/**
 * Server-only audit trail.
 *
 * Every privileged action performed from the admin panel or the admin API is
 * recorded in the top-level `auditLogs` collection. Firestore rules deny all
 * client access to that collection: entries are written exclusively here with
 * the Admin SDK.
 *
 * Logging must never break the action it describes, so failures are swallowed
 * after a warning.
 */

const MAX_STRING = 200;
const MAX_DETAIL_STRING = 500;
const MAX_DETAIL_KEYS = 25;

function clean(value, max = MAX_STRING) {
  if (value == null) return null;
  const text = sanitizeText(String(value), { max });
  return text || null;
}

/** Flattens `details` into Firestore-safe scalar values (nested objects are stringified). */
function cleanDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};

  const output = {};
  Object.entries(details)
    .slice(0, MAX_DETAIL_KEYS)
    .forEach(([rawKey, rawValue]) => {
      const key = clean(rawKey, 60);
      if (!key) return;

      if (rawValue == null) {
        output[key] = null;
        return;
      }

      if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        output[key] = rawValue;
        return;
      }

      if (Array.isArray(rawValue)) {
        output[key] = rawValue.slice(0, 20).map((entry) => clean(entry, 120));
        return;
      }

      const text =
        typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
      output[key] = clean(text, MAX_DETAIL_STRING);
    });

  return output;
}

/**
 * Writes one audit entry.
 *
 * The email/name are denormalised into the entry so the audit log screen can
 * show "who" even if the Auth account is later deleted. Older entries only have
 * a UID; the audit-log API enriches those with a best-effort Auth lookup.
 *
 * @param {object} entry
 * @param {string} entry.adminUid  UID of the administrator who acted.
 * @param {string} [entry.adminEmail] Email captured at action time.
 * @param {string} [entry.adminName] Display name captured at action time.
 * @param {string} entry.action    Dotted action name, e.g. "resource.publish".
 * @param {string} [entry.targetType] Collection or domain, e.g. "resource".
 * @param {string} [entry.targetId]   Document id or other identifier.
 * @param {object} [entry.details]    Extra context (already safe to store).
 * @returns {Promise<string|null>} The new document id, or null when logging failed.
 */
export async function writeAuditLog({
  adminUid,
  adminEmail = null,
  adminName = null,
  action,
  targetType = null,
  targetId = null,
  details = {}
} = {}) {
  const db = getDb();
  if (!db) {
    console.warn('[audit] Skipped entry because Firebase Admin is not configured.');
    return null;
  }

  try {
    const ref = await db.collection('auditLogs').add({
      adminUid: clean(adminUid, 128) || 'unknown',
      adminEmail: clean(adminEmail, 200),
      adminName: clean(adminName, 120),
      action: clean(action, 80) || 'unknown',
      targetType: clean(targetType, 60),
      targetId: clean(targetId, MAX_STRING),
      details: cleanDetails(details),
      createdAt: FieldValue.serverTimestamp()
    });
    return ref.id;
  } catch (error) {
    console.warn('[audit] Could not write audit log:', error?.message || error);
    return null;
  }
}

/**
 * Convenience wrapper for Express handlers: the acting admin is always the
 * verified `req.user` populated by requireAdmin.
 */
export function writeAuditLogForRequest(req, entry = {}) {
  return writeAuditLog({
    ...entry,
    adminUid: entry.adminUid || req.user?.uid,
    adminEmail: entry.adminEmail || req.user?.email || null,
    adminName: entry.adminName || req.user?.name || null
  });
}
