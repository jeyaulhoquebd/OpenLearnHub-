import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { config } from './config.js';

let auth = null;
let db = null;
let storage = null;
let initialized = false;
let initError = null;

// `.env` files usually store the private key with literal "\n" escapes.
function normalizePrivateKey(value = '') {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function buildCredential() {
  const { serviceAccountJson, projectId, clientEmail, privateKey } = config.firebase;

  // Option A — full service-account JSON (one line, escaped newlines).
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(normalizePrivateKey(serviceAccountJson.trim()));
      if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
      return cert(parsed);
    } catch (error) {
      console.error('[firebase] FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed:', error.message);
      return null;
    }
  }

  // Option B — discrete project id, client email, and private key.
  if (projectId && clientEmail && privateKey) {
    return cert({
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey)
    });
  }

  // Option C — Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS
  // or the runtime's attached service account).
  return applicationDefault();
}

export function initFirebase() {
  if (initialized) return;
  initialized = true;

  try {
    const credential = buildCredential();
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential,
          projectId: config.firebase.projectId || undefined,
          storageBucket: config.firebase.storageBucket || undefined
        });

    auth = getAuth(app);
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    storage = getStorage(app);
  } catch (error) {
    initError = error;
    console.error('[firebase] Admin SDK initialisation failed:', error.message);
  }
}

export function getFirebaseAuth() {
  return auth;
}

export function getDb() {
  return db;
}

export function getStorageBucket() {
  return storage;
}

export function isFirebaseReady() {
  return Boolean(db && auth);
}

export function getFirebaseInitError() {
  return initError;
}

export function isAdminEmail(email) {
  if (!email) return false;
  return config.firebase.adminEmails.includes(String(email).toLowerCase());
}
