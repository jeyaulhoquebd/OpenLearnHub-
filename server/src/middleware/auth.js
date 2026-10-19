import { getFirebaseAuth } from '../firebase.js';
import { apiError } from '../lib/http.js';

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 10 ? token : null;
}

async function verify(req) {
  const token = readBearerToken(req);
  if (!token) return { user: null, reason: 'missing_token' };
  const auth = getFirebaseAuth();
  if (!auth) return { user: null, reason: 'auth_unavailable' };
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return { user: decoded, reason: null };
  } catch (error) {
    console.warn('[auth] Token verification failed:', error?.code || error?.message);
    return { user: null, reason: 'invalid_token' };
  }
}

export async function optionalAuth(req, res, next) {
  const { user } = await verify(req);
  req.user = user;
  next();
}

export async function requireAuth(req, res, next) {
  const { user, reason } = await verify(req);
  if (!user) {
    if (reason === 'auth_unavailable') {
      return apiError(
        res,
        503,
        'auth_unavailable',
        'Sign-in verification is unavailable because the server is missing Firebase Admin credentials.'
      );
    }
    return apiError(res, 401, 'unauthorized', 'Please sign in to continue.');
  }
  req.user = user;
  return next();
}
