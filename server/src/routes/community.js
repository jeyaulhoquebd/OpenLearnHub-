import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getDb, getFirebaseAuth } from '../firebase.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { apiError } from '../lib/http.js';
import { sanitizeText } from '../lib/validation.js';
import { summarizeRatings } from '../lib/reviewAdmin.js';
import { deleteUserData } from '../lib/cleanup.js';
import { countAdmins } from '../lib/userAdmin.js';

/**
 * Signed-in community actions that touch shared counters.
 *
 * Reviews and bookmarks are written here with the Admin SDK (the Firestore
 * rules deny direct client writes) so `ratingAvg`/`ratingCount` and
 * `saveCount` always change in the same transaction as the document itself,
 * and moderation state can never be bypassed from the browser.
 */

const RESOURCE_ID = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const RECENT_LOGIN_SECONDS = 10 * 60;
const VIEW_DEDUPE_MS = 6 * 60 * 60 * 1000;
const VIEW_DEDUPE_MAX = 50_000;

const reviewSchema = z.object({
  resourceId: RESOURCE_ID,
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000)
});

export const communityRouter = Router();

function requireDb(res) {
  const db = getDb();
  if (!db) {
    apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    return null;
  }
  return db;
}

function requireVerified(req, res, next) {
  if (req.user?.email_verified !== true) {
    return apiError(res, 403, 'email_not_verified', 'Please verify your email address first.');
  }
  return next();
}

function codedError(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

function sendCoded(res, error, next) {
  if (error?.code && error?.status) return apiError(res, error.status, error.code, error.message);
  return next(error);
}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: { code: 'rate_limited', message: 'Too many changes. Please slow down.' } }
});

/** Recomputes the resource rating inside a transaction after a review change. */
async function writeReviewWithRating(db, { resourceId, uid, mutate }) {
  const resourceRef = db.collection('resources').doc(resourceId);
  const reviewRef = db.collection('reviews').doc(`${resourceId}_${uid}`);

  return db.runTransaction(async (transaction) => {
    const [resourceSnap, reviewSnap, reviewsSnap] = await Promise.all([
      transaction.get(resourceRef),
      transaction.get(reviewRef),
      transaction.get(db.collection('reviews').where('resourceId', '==', resourceId))
    ]);

    const result = mutate({ resourceSnap, reviewSnap, transaction, reviewRef });

    const others = reviewsSnap.docs
      .filter((doc) => doc.id !== reviewRef.id)
      .map((doc) => doc.data());
    const next = result.review ? [...others, result.review] : others;
    const { ratingAvg, ratingCount } = summarizeRatings(next);

    if (resourceSnap.exists) {
      transaction.update(resourceRef, {
        ratingAvg,
        ratingCount,
        ratingsUpdatedAt: FieldValue.serverTimestamp()
      });
    }
    return { ratingAvg, ratingCount };
  });
}

async function authorNameFor(db, user) {
  try {
    const profile = await db.collection('users').doc(user.uid).get();
    const name = profile.exists ? profile.data()?.displayName : '';
    return sanitizeText(name || user.name || '', { max: 80 }) || null;
  } catch {
    return sanitizeText(user.name || '', { max: 80 }) || null;
  }
}

/** POST /api/reviews — create or edit the caller's review. */
communityRouter.post('/reviews', requireAuth, requireVerified, writeLimiter, async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = reviewSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_review', 'Please add a rating and a short review.', parsed.error.flatten());
    }

    const { resourceId, rating } = parsed.data;
    const body = sanitizeText(parsed.data.body, { max: 2000, multiline: true });
    if (!body) return apiError(res, 400, 'invalid_review', 'Please write a short review.');

    const authorName = await authorNameFor(db, req.user);
    const uid = req.user.uid;

    const totals = await writeReviewWithRating(db, {
      resourceId,
      uid,
      mutate: ({ resourceSnap, reviewSnap, transaction, reviewRef }) => {
        if (!resourceSnap.exists || resourceSnap.data()?.status !== 'published') {
          throw codedError('resource_not_found', 404, 'That resource is not available for reviews.');
        }
        const existing = reviewSnap.exists ? reviewSnap.data() : null;
        const review = {
          id: reviewRef.id,
          resourceId,
          userId: uid,
          authorName,
          rating,
          body,
          comment: body,
          // Moderation state is owned by the admin API.
          hidden: existing?.hidden === true,
          createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        transaction.set(reviewRef, review);
        return { review };
      }
    });

    return res.json({ ok: true, ...totals });
  } catch (error) {
    return sendCoded(res, error, next);
  }
});

/** DELETE /api/reviews/:resourceId — remove the caller's own review. */
communityRouter.delete('/reviews/:resourceId', requireAuth, writeLimiter, async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsedId = RESOURCE_ID.safeParse(req.params.resourceId);
    if (!parsedId.success) return apiError(res, 400, 'invalid_id', 'That resource id is not valid.');

    const totals = await writeReviewWithRating(db, {
      resourceId: parsedId.data,
      uid: req.user.uid,
      mutate: ({ reviewSnap, transaction, reviewRef }) => {
        if (!reviewSnap.exists) {
          throw codedError('review_not_found', 404, 'You have not reviewed this resource.');
        }
        // A hidden review cannot be deleted and re-posted to dodge moderation.
        if (reviewSnap.data()?.hidden === true) {
          throw codedError(
            'review_moderated',
            403,
            'This review was hidden by a moderator and cannot be removed or re-posted.'
          );
        }
        transaction.delete(reviewRef);
        return { review: null };
      }
    });

    return res.json({ ok: true, ...totals });
  } catch (error) {
    return sendCoded(res, error, next);
  }
});

async function toggleBookmark(db, uid, resourceId, shouldSave) {
  const resourceRef = db.collection('resources').doc(resourceId);
  const bookmarkRef = db.collection('bookmarks').doc(`${uid}_${resourceId}`);
  const legacyRef = db.collection('users').doc(uid).collection('bookmarks').doc(resourceId);

  return db.runTransaction(async (transaction) => {
    const [resourceSnap, bookmarkSnap, legacySnap] = await Promise.all([
      transaction.get(resourceRef),
      transaction.get(bookmarkRef),
      transaction.get(legacyRef)
    ]);
    const wasSaved = bookmarkSnap.exists || legacySnap.exists;

    if (shouldSave) {
      if (!resourceSnap.exists || resourceSnap.data()?.status !== 'published') {
        throw codedError('resource_not_found', 404, 'That resource is not available.');
      }
      if (!bookmarkSnap.exists) {
        transaction.set(bookmarkRef, {
          id: bookmarkRef.id,
          userId: uid,
          resourceId,
          savedAt: FieldValue.serverTimestamp()
        });
      }
      if (!wasSaved) transaction.update(resourceRef, { saveCount: FieldValue.increment(1) });
      return { saved: true };
    }

    if (bookmarkSnap.exists) transaction.delete(bookmarkRef);
    if (legacySnap.exists) transaction.delete(legacyRef);
    if (wasSaved && resourceSnap.exists && Number(resourceSnap.data()?.saveCount) > 0) {
      transaction.update(resourceRef, { saveCount: FieldValue.increment(-1) });
    }
    return { saved: false };
  });
}

function bookmarkHandler(shouldSave) {
  return async (req, res, next) => {
    try {
      const db = requireDb(res);
      if (!db) return undefined;
      const parsedId = RESOURCE_ID.safeParse(req.params.resourceId);
      if (!parsedId.success) return apiError(res, 400, 'invalid_id', 'That resource id is not valid.');
      const result = await toggleBookmark(db, req.user.uid, parsedId.data, shouldSave);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendCoded(res, error, next);
    }
  };
}

communityRouter.post('/bookmarks/:resourceId', requireAuth, writeLimiter, bookmarkHandler(true));
communityRouter.delete('/bookmarks/:resourceId', requireAuth, writeLimiter, bookmarkHandler(false));

// One view per visitor and resource every few hours, kept in memory.
const recentViews = new Map();

function seenRecently(key) {
  const now = Date.now();
  const last = recentViews.get(key);
  if (last && now - last < VIEW_DEDUPE_MS) return true;
  if (recentViews.size >= VIEW_DEDUPE_MAX) {
    for (const [entryKey, time] of recentViews) {
      if (now - time >= VIEW_DEDUPE_MS) recentViews.delete(entryKey);
    }
    if (recentViews.size >= VIEW_DEDUPE_MAX) recentViews.clear();
  }
  recentViews.set(key, now);
  return false;
}

const viewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests.' } }
});

/** POST /api/resources/:resourceId/view — counts a detail-page view. */
communityRouter.post('/resources/:resourceId/view', viewLimiter, optionalAuth, async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;
    const parsedId = RESOURCE_ID.safeParse(req.params.resourceId);
    if (!parsedId.success) return apiError(res, 400, 'invalid_id', 'That resource id is not valid.');

    const visitor = req.user?.uid || req.ip;
    if (seenRecently(`${visitor}:${parsedId.data}`)) return res.json({ ok: true, counted: false });

    const ref = db.collection('resources').doc(parsedId.data);
    const counted = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.status !== 'published') return false;
      transaction.update(ref, { viewCount: FieldValue.increment(1) });
      return true;
    });
    return res.json({ ok: true, counted });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/me — deletes the caller's account and personal data.
 * Requires a sign-in within the last few minutes, like Firebase's own
 * client-side `deleteUser`.
 */
communityRouter.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const db = requireDb(res);
    const auth = getFirebaseAuth();
    if (!db || !auth) return db ? apiError(res, 503, 'auth_unavailable', 'Auth is not configured.') : undefined;

    const authTime = Number(req.user.auth_time) || 0;
    if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
      return apiError(
        res,
        401,
        'requires_recent_login',
        'Please sign out and sign in again, then delete your account.'
      );
    }

    if (req.user.admin === true) {
      const remaining = await countAdmins(auth, { excludeUid: req.user.uid });
      if (remaining < 1) {
        return apiError(res, 409, 'last_admin', 'The last administrator cannot delete their account.');
      }
    }

    const result = await deleteUserData(db, req.user.uid);
    await auth.deleteUser(req.user.uid);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
});
