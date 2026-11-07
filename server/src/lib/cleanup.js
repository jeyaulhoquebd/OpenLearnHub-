import { FieldValue } from 'firebase-admin/firestore';

/**
 * Data cleanup helpers shared by account deletion (user-initiated and admin)
 * and resource deletion, so no orphaned documents are left behind.
 */

const BATCH_LIMIT = 400;

async function commitInChunks(db, docs, apply) {
  let count = 0;
  for (let index = 0; index < docs.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    const slice = docs.slice(index, index + BATCH_LIMIT);
    slice.forEach((doc) => apply(batch, doc));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
    count += slice.length;
  }
  return count;
}

export async function deleteWhere(db, collectionName, field, value) {
  const snapshot = await db.collection(collectionName).where(field, '==', value).get();
  if (snapshot.empty) return 0;
  return commitInChunks(db, snapshot.docs, (batch, doc) => batch.delete(doc.ref));
}

/** Lowers `saveCount` on every still-existing resource the user had saved. */
async function releaseSaveCounts(db, resourceIds) {
  const unique = [...new Set(resourceIds.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 300) {
    const chunk = unique.slice(index, index + 300);
    // eslint-disable-next-line no-await-in-loop
    const snapshots = await db.getAll(...chunk.map((id) => db.collection('resources').doc(id)));
    const existing = snapshots.filter((snapshot) => snapshot.exists && Number(snapshot.data().saveCount) > 0);
    // eslint-disable-next-line no-await-in-loop
    await commitInChunks(db, existing, (batch, snapshot) =>
      batch.update(snapshot.ref, { saveCount: FieldValue.increment(-1) })
    );
  }
}

/**
 * Removes everything stored for one account except reviews, which are kept
 * (so ratings stay honest) but anonymised.
 */
export async function deleteUserData(db, uid) {
  const bookmarks = await db.collection('bookmarks').where('userId', '==', uid).get();
  await releaseSaveCounts(
    db,
    bookmarks.docs.map((doc) => doc.data()?.resourceId)
  );
  const deletedBookmarks = await commitInChunks(db, bookmarks.docs, (batch, doc) =>
    batch.delete(doc.ref)
  );

  const deletedProgress = await deleteWhere(db, 'progress', 'userId', uid);

  const reviews = await db.collection('reviews').where('userId', '==', uid).get();
  const anonymizedReviews = await commitInChunks(db, reviews.docs, (batch, doc) =>
    batch.update(doc.ref, {
      userId: 'deleted',
      authorName: null,
      authorEmail: null,
      userPhotoURL: null,
      anonymized: true,
      anonymizedAt: FieldValue.serverTimestamp()
    })
  );

  // Legacy top-level roadmaps and per-user AI quota counters.
  await deleteWhere(db, 'roadmaps', 'userId', uid);
  await deleteWhere(db, 'aiUsage', 'userId', uid);

  // users/{uid} plus every subcollection (roadmaps, courseNotes, bookmarks).
  await db.recursiveDelete(db.collection('users').doc(uid));

  return { deletedBookmarks, deletedProgress, anonymizedReviews };
}

/**
 * Removes the community data that points at a deleted resource and switches
 * off any paid → free alternative that used it.
 */
export async function deleteResourceData(db, resourceId) {
  const [reviews, bookmarks, progress] = await Promise.all([
    deleteWhere(db, 'reviews', 'resourceId', resourceId),
    deleteWhere(db, 'bookmarks', 'resourceId', resourceId),
    deleteWhere(db, 'progress', 'resourceId', resourceId)
  ]);

  const alternatives = await db
    .collection('alternatives')
    .where('freeAlternativeResourceId', '==', resourceId)
    .get();
  await commitInChunks(db, alternatives.docs, (batch, doc) =>
    batch.update(doc.ref, { active: false, updatedAt: FieldValue.serverTimestamp() })
  );

  return { reviews, bookmarks, progress, alternatives: alternatives.size };
}
