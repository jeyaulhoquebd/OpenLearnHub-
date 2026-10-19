import { requireAuth } from './auth.js';
import { apiError } from '../lib/http.js';

/**
 * Admin guard for the Express API.
 *
 * Verifies the caller's Firebase ID token (through requireAuth, which also
 * checks for revocation), then requires the `admin: true` custom claim.
 * Administrator status is never read from a Firestore field, so a client can
 * never grant itself access.
 *
 * Usage:
 *   router.get('/thing', requireAdmin, handler)
 *   router.use(requireAdmin)   // protect a whole router
 */
export function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user?.admin !== true) {
      return apiError(
        res,
        403,
        'forbidden',
        'Administrator access is required for this action.'
      );
    }
    return next();
  });
}
