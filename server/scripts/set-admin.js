import { FieldValue } from 'firebase-admin/firestore';
import { config } from '../src/config.js';
import { getDb, getFirebaseAuth, initFirebase } from '../src/firebase.js';

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

async function resolveUser(auth, email, uid) {
  if (uid) return auth.getUser(uid);
  if (email) return auth.getUserByEmail(email);
  return null;
}

async function main() {
  initFirebase();
  const auth = getFirebaseAuth();
  const db = getDb();

  if (!auth || !db) {
    console.error('[set-admin] Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }

  const email = readArg('email') || config.firebase.adminEmails[0] || '';
  const uid = readArg('uid');

  if (!email && !uid) {
    console.error('[set-admin] Usage: npm run set-admin -- --email=you@example.com');
    process.exit(1);
  }

  const user = await resolveUser(auth, email, uid);
  if (!user) {
    console.error(`[set-admin] No user found for ${email || uid}. Sign up in the app first.`);
    process.exit(1);
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  await db
    .collection('users')
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email || email || null,
        displayName: user.displayName || null,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  console.log(`[set-admin] ${user.email || user.uid} is now an admin (custom claim: admin=true).`);
  console.log('[set-admin] The client reads this from getIdTokenResult(). Ask them to sign out and');
  console.log('[set-admin] sign in again (or refresh their token) so the new claim is applied.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[set-admin] Failed:', error?.message || error);
  process.exit(1);
});
