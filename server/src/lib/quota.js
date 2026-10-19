/**
 * Simple per-user, per-day usage counters backed by Firestore.
 *
 * Used to enforce a daily quota on AI roadmap generation on top of the
 * in-memory hourly rate limit. Documents are keyed `<uid>_<YYYY-MM-DD>` in the
 * `aiUsage` collection, which clients can never read or write (the default
 * Firestore rule denies it; only the Admin SDK touches it).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase.js';

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function usageRef(db, collection, uid, date) {
  return db.collection(collection).doc(`${uid}_${date}`);
}

/**
 * Reads today's usage without consuming it. `allowed` is false once the limit
 * is reached. When Firestore is unavailable the check fails open (the hourly
 * limiter still applies).
 */
export async function readDailyUsage({ uid, dailyLimit, collection = 'aiUsage' }) {
  const date = dayKey();
  const db = getDb();
  if (!db || !uid) return { used: 0, limit: dailyLimit, allowed: true, enforced: false, date };

  try {
    const snap = await usageRef(db, collection, uid, date).get();
    const used = snap.exists ? Number(snap.data().count) || 0 : 0;
    return { used, limit: dailyLimit, allowed: used < dailyLimit, enforced: true, date };
  } catch (error) {
    console.warn('[quota] Could not read daily usage:', error?.message);
    return { used: 0, limit: dailyLimit, allowed: true, enforced: false, date };
  }
}

/** Records one successful use. Failures are logged, never thrown. */
export async function incrementDailyUsage({ uid, action = 'request', collection = 'aiUsage' }) {
  const db = getDb();
  if (!db || !uid) return;

  const date = dayKey();
  try {
    await usageRef(db, collection, uid, date).set(
      {
        userId: uid,
        date,
        count: FieldValue.increment(1),
        lastAction: action,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[quota] Could not record daily usage:', error?.message);
  }
}
