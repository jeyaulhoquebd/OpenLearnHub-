/**
 * Shared server-side text sanitisation and validation helpers.
 *
 * The zod schemas in each route enforce shape and length; these helpers
 * normalise the text that actually reaches Firestore so control characters,
 * excessive whitespace, and runaway lengths never get stored.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value, { max = 2000, multiline = false } = {}) {
  if (value == null) return '';
  let text = String(value).replace(CONTROL_CHARS, '');
  text = multiline ? text.replace(/\r\n?/g, '\n') : text.replace(/[\r\n\t]+/g, ' ');
  text = multiline ? text.replace(/[ \t]{2,}/g, ' ') : text.replace(/ {2,}/g, ' ');
  if (multiline) text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim().slice(0, max);
}

/** Normalises a user-supplied email address for storage. */
export function sanitizeEmail(value, max = 200) {
  return sanitizeText(value, { max }).toLowerCase();
}

/** Normalises a user-supplied URL for storage (no trailing whitespace).
 * Only public HTTP(S) destinations are accepted to reduce phishing and unsafe
 * payloads from being stored in the database.
 */
export function sanitizeUrl(value, max = 600) {
  const text = sanitizeText(value, { max });
  if (!text) return '';

  try {
    const parsed = new URL(text);
    const protocol = parsed.protocol.toLowerCase();
    if (!['http:', 'https:'].includes(protocol)) return '';
    if (!parsed.hostname) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

/** True when the verified-email requirement applies and the user fails it. */
export function needsVerifiedEmail(user) {
  return Boolean(user) && user.email_verified !== true;
}
