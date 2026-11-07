/**
 * Per-user daily quota + aggregate usage counters backed by Firestore.
 *
 * Documents in `aiUsage`:
 *   - `aiUsage/{uid}_{YYYY-MM-DD}` keeps the per-user count used to enforce the
 *     daily roadmap limit.
 *   - `aiUsage/{YYYY-MM-DD}` keeps global request/failure counters for the
 *     admin AI Settings usage card.
 *
 * Clients can never read or write this collection (the default Firestore rule
 * denies it); only the Admin SDK touches it.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase.js';

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function lastDays(count = 7, date = new Date()) {
  const days = [];
  for (let index = 0; index < count; index += 1) {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() - index);
    days.push(dayKey(value));
  }
  return days;
}

function usageRef(db, collection, uid, date) {
  return db.collection(collection).doc(`${uid}_${date}`);
}

function globalRef(db, collection, date) {
  return db.collection(collection).doc(date);
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

/**
 * Atomically reserves one unit of today's quota before the AI call runs, so
 * parallel requests cannot all pass a read-then-increment check. `field` is
 * `count` (roadmaps) or `chatCount` (chat). Call `releaseDailyUsage` when the
 * request fails so a provider error does not cost the user quota. When
 * Firestore is unavailable this fails open (the hourly limiter still applies).
 */
export async function reserveDailyUsage({
  uid,
  dailyLimit,
  field = 'count',
  action = 'request',
  collection = 'aiUsage'
}) {
  const date = dayKey();
  const db = getDb();
  if (!db || !uid) return { used: 0, limit: dailyLimit, allowed: true, reserved: false, date };

  const ref = usageRef(db, collection, uid, date);
  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const used = snap.exists ? Number(snap.data()?.[field]) || 0 : 0;
      if (used >= dailyLimit) {
        return { used, limit: dailyLimit, allowed: false, reserved: false, date };
      }
      transaction.set(
        ref,
        {
          userId: uid,
          date,
          [field]: used + 1,
          lastAction: action,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return { used: used + 1, limit: dailyLimit, allowed: true, reserved: true, date };
    });
  } catch (error) {
    console.warn('[quota] Could not reserve daily usage:', error?.message);
    return { used: 0, limit: dailyLimit, allowed: true, reserved: false, date };
  }
}

/** Gives back a reservation made by `reserveDailyUsage`. */
export async function releaseDailyUsage({ uid, field = 'count', reservation, collection = 'aiUsage' }) {
  const db = getDb();
  if (!db || !uid || !reservation?.reserved) return;
  try {
    await usageRef(db, collection, uid, reservation.date).set(
      { [field]: FieldValue.increment(-1) },
      { merge: true }
    );
  } catch (error) {
    console.warn('[quota] Could not release daily usage:', error?.message);
  }
}

/**
 * Records one successful AI request against the user's daily quota and the
 * global usage counter. Failures are logged, never thrown.
 */
export async function incrementDailyUsage({
  uid,
  action = 'request',
  collection = 'aiUsage',
  countUser = true
}) {
  const db = getDb();
  if (!db) return;

  const date = dayKey();
  try {
    const batch = db.batch();
    if (uid && countUser) {
      batch.set(
        usageRef(db, collection, uid, date),
        {
          userId: uid,
          date,
          count: FieldValue.increment(1),
          lastAction: action,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
    batch.set(
      globalRef(db, collection, date),
      {
        date,
        requests: FieldValue.increment(1),
        lastAction: action,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    await batch.commit();
  } catch (error) {
    console.warn('[quota] Could not record daily usage:', error?.message);
  }
}

/** Records a failed AI call in the global counters for the admin usage card. */
export async function recordAiFailure({ action = 'request', collection = 'aiUsage' } = {}) {
  const db = getDb();
  if (!db) return;

  const date = dayKey();
  try {
    await globalRef(db, collection, date).set(
      {
        date,
        failures: FieldValue.increment(1),
        lastFailureAction: action,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[quota] Could not record AI failure:', error?.message);
  }
}

/**
 * Aggregates today's counters plus the last seven days for the admin card.
 * Missing days count as zero; an unavailable database returns zeros.
 */
export async function getAiUsageStats({ collection = 'aiUsage', days = 7 } = {}) {
  const today = dayKey();
  const weekDays = lastDays(days);
  const empty = {
    today: { date: today, requests: 0, failures: 0 },
    week: { requests: 0, failures: 0, days: weekDays },
    daily: [],
    enforced: false
  };

  const db = getDb();
  if (!db) return empty;

  try {
    const snapshots = await Promise.all(
      weekDays.map((date) => globalRef(db, collection, date).get())
    );

    const daily = snapshots.map((snapshot, index) => {
      const data = snapshot.exists ? snapshot.data() : {};
      return {
        date: weekDays[index],
        requests: Number(data.requests) || 0,
        failures: Number(data.failures) || 0
      };
    });

    return {
      today: daily[0],
      week: {
        requests: daily.reduce((total, entry) => total + entry.requests, 0),
        failures: daily.reduce((total, entry) => total + entry.failures, 0),
        days: weekDays
      },
      daily,
      enforced: true
    };
  } catch (error) {
    console.warn('[quota] Could not load AI usage stats:', error?.message);
    return empty;
  }
}
