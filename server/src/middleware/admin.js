import { apiError } from '../lib/http.js';

/**
 * Guards routes to signed-in users whose ID token carries the `admin: true`
 * custom claim (see server/scripts/set-admin.js). Admin access is never read
 * from a client-writable Firestore field.
 *
 * Must run after requireAuth, which populates req.user.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return apiError(res, 401, 'unauthorized', 'Please sign in to continue.');
  }
  if (req.user.admin !== true) {
    return apiError(res, 403, 'forbidden', 'Administrator access is required for this action.');
  }
  return next();
}
