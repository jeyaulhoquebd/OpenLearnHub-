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

function buildCredential() {
  if (config.firebase.serviceAccountJson) {
    try {
      const raw = config.firebase.serviceAccountJson.trim();
      const parsed = JSON.parse(raw.replace(/\\n/g, '\n'));
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      return cert(parsed);
    } catch (error) {
      console.error('[firebase] FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed:', error.message);
      return null;
    }
  }
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
