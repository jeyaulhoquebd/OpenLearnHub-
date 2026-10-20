import { FieldValue } from 'firebase-admin/firestore';

/**
 * Shared helpers for review moderation.
 *
 * A review document id is `<resourceId>_<uid>` and its rating feeds the
 * resource's `ratingAvg` / `ratingCount`. Hiding or deleting a review therefore
 * has to update the review and the resource together — see
 * `applyReviewModeration`, which does both inside a single transaction.
 */

export const REVIEW_SCAN_LIMIT = 500;

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

/** Extracts the resource id from `<resourceId>_<uid>` when the field is absent. */
export function resourceIdOf(reviewId, data = {}) {
  if (data.resourceId) return String(data.resourceId);
  const underscore = String(reviewId).lastIndexOf('_');
  return underscore > 0 ? String(reviewId).slice(0, underscore) : '';
}

export function serializeReview(snapshot, resource = null) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    resourceId: resourceIdOf(snapshot.id, data),
    userId: data.userId || '',
    authorName: data.authorName || data.userName || '',
    rating: Number(data.rating) || 0,
    body: data.body || data.comment || '',
    hidden: data.hidden === true,
    anonymized: data.anonymized === true,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    resource: resource
      ? {
          id: resource.id,
          title: resource.title || {},
          slug: resource.slug || '',
          type: resource.type || ''
        }
      : null
  };
}

/** Case-insensitive haystack for the admin search box. */
export function reviewSearchText(review) {
  const title = review.resource?.title;
  const titles = typeof title === 'string' ? [title] : [title?.en, title?.bn, title?.ur];

  return [
    review.authorName,
    review.userId,
    review.body,
    ...titles,
    review.resource?.slug
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Average/count over visible reviews, rounded like the public cards. */
export function summarizeRatings(reviews = []) {
  const ratings = reviews
    .filter((review) => review.hidden !== true)
    .map((review) => Math.min(5, Math.max(1, Math.round(Number(review.rating) || 0))))
    .filter((rating) => rating > 0);

  if (!ratings.length) return { ratingAvg: 0, ratingCount: 0 };
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return {
    ratingAvg: Number((total / ratings.length).toFixed(2)),
    ratingCount: ratings.length
  };
}

/**
 * Applies `hide`, `show` or `delete` to one review and recomputes the resource
 * rating in the same transaction.
 *
 * All reads happen before any write (a Firestore transaction requirement). The
 * reviews query runs inside the transaction, so a concurrent moderation action
 * causes the transaction to retry with fresh numbers.
 */
export async function applyReviewModeration(db, { reviewId, mode, adminUid }) {
  const reviewRef = db.collection('reviews').doc(reviewId);

  return db.runTransaction(async (transaction) => {
    const reviewSnap = await transaction.get(reviewRef);
    if (!reviewSnap.exists) {
      const error = new Error('Review not found');
      error.code = 'review_not_found';
      throw error;
    }

    const data = reviewSnap.data() || {};
    const resourceId = resourceIdOf(reviewId, data);
    const resourceRef = resourceId ? db.collection('resources').doc(resourceId) : null;
    const resourceSnap = resourceRef ? await transaction.get(resourceRef) : null;
    const reviewsSnap = resourceId
      ? await transaction.get(db.collection('reviews').where('resourceId', '==', resourceId))
      : null;

    const deleted = mode === 'delete';
    const hidden = mode === 'hide' ? true : mode === 'show' ? false : data.hidden === true;

    const nextReviews = [];
    (reviewsSnap?.docs || []).forEach((doc) => {
      if (doc.id === reviewId) {
        if (!deleted) nextReviews.push({ ...doc.data(), hidden });
        return;
      }
      nextReviews.push(doc.data());
    });

    // A review that is not in the query (legacy doc without resourceId) still
    // needs its own rating reflected when shown again.
    if (!reviewsSnap && !deleted) nextReviews.push({ ...data, hidden });

    const { ratingAvg, ratingCount } = summarizeRatings(nextReviews);

    if (deleted) {
      transaction.delete(reviewRef);
    } else {
      transaction.update(reviewRef, {
        hidden,
        moderatedBy: adminUid,
        moderatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    if (resourceRef && resourceSnap?.exists) {
      transaction.update(resourceRef, {
        ratingAvg,
        ratingCount,
        ratingsUpdatedAt: FieldValue.serverTimestamp()
      });
    }

    return {
      reviewId,
      resourceId,
      deleted,
      hidden,
      ratingAvg,
      ratingCount,
      resourceExists: Boolean(resourceSnap?.exists)
    };
  });
}
