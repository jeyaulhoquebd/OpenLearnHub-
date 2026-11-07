import { FieldValue } from 'firebase-admin/firestore';
import { config } from '../src/config.js';
import { getDb, getFirebaseAuth, initFirebase, isFirebaseReady } from '../src/firebase.js';
import { writeAuditLog } from '../src/lib/audit.js';

/**
 * Grants or revokes the `admin: true` custom claim.
 *
 *   node scripts/set-admin.js <uid-or-email>
 *   node scripts/set-admin.js <uid-or-email> --remove
 *
 * The target may be a Firebase UID or an email address — anything containing
 * "@" is treated as an email. When no target is given, the first entry of
 * ADMIN_EMAILS is used; with neither, the script stops instead of guessing.
 *
 * Administrator access is granted exclusively through this custom claim. No
 * Firestore field is ever read to decide whether someone is an admin, so a
 * user can never promote themselves from the client.
 */

function readFlag(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const remove = args.includes('--remove');
  const positional = args.find((arg) => !arg.startsWith('-'));

  // `--email=` / `--uid=` are still supported for older notes and tooling.
  const explicitUid = readFlag('uid');
  const explicitEmail = readFlag('email');
  const target = (positional || explicitUid || explicitEmail || '').trim();

  return { remove, target };
}

function isEmail(value) {
  return value.includes('@');
}

async function resolveUser(auth, target) {
  try {
    if (isEmail(target)) {
      return await auth.getUserByEmail(target.toLowerCase());
    }
    return await auth.getUser(target);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function main() {
  initFirebase();

  const auth = getFirebaseAuth();
  const db = getDb();

  if (!auth || !db || !isFirebaseReady()) {
    console.error(
      '[set-admin] Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, ' +
        'or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, then try again.'
    );
    process.exit(1);
  }

  const { remove, target: rawTarget } = parseArgs();

  // Target resolution: CLI argument, then ADMIN_EMAILS (first entry). There is
  // deliberately no built-in default account.
  const envEmail = config.firebase.adminEmails?.[0] || '';
  const target = rawTarget || envEmail;

  if (!target) {
    console.error(
      '[set-admin] Pass a UID or email: npm run set-admin -- you@example.com (or set ADMIN_EMAILS).'
    );
    process.exit(1);
  }

  if (!rawTarget) {
    console.log(`[set-admin] No UID or email supplied — using ADMIN_EMAILS (${envEmail}).`);
  }

  const user = await resolveUser(auth, target);
  if (!user) {
    console.error(`[set-admin] No user found for "${target}". Sign in to the app once, then try again.`);
    process.exit(1);
  }

  const currentClaims = user.customClaims || {};
  const nextClaims = { ...currentClaims };

  if (remove) {
    delete nextClaims.admin;
  } else {
    nextClaims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);

  // Make sure the profile document exists so the account shows up nicely in
  // the app. This is a convenience only — it carries no privileges.
  if (db) {
    await db
      .collection('users')
      .doc(user.uid)
      .set(
        {
          uid: user.uid,
          email: user.email || (isEmail(target) ? target : null),
          displayName: user.displayName || null,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
  }

  await writeAuditLog({
    adminUid: 'cli:set-admin',
    action: remove ? 'admin.revoke' : 'admin.grant',
    targetType: 'user',
    targetId: user.uid,
    details: { email: user.email || null, via: 'scripts/set-admin.js' }
  });

  const label = user.email || user.uid;

  if (remove) {
    console.log(`[set-admin] Admin access removed for ${label}.`);
    console.log('[set-admin] Sign out and sign in again (or refresh the ID token) so the claim is dropped.');
  } else {
    console.log(`[set-admin] ${label} is now an administrator (custom claim: admin=true).`);
    console.log('[set-admin] The client reads this from getIdTokenResult().');
    console.log('[set-admin] Sign out and sign in again (or refresh the ID token) so the new claim applies.');
    console.log('[set-admin] Then open /admin.');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[set-admin] Failed:', error?.message || error);
  process.exit(1);
});
