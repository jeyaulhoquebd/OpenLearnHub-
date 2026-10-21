import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

function adcFileExists() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json'),
    process.env.APPDATA
      ? path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json')
      : ''
  ].filter(Boolean);

  return candidates.some((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

/**
 * True when the server has enough information to authenticate with Firebase
 * Admin. This is stricter than `Boolean(db && auth)` because the Admin SDK
 * creates objects even when Application Default Credentials are missing; in
 * that state every real request would fail or hang.
 */
export function hasFirebaseAdminCredentials() {
  const { serviceAccountJson, projectId, clientEmail, privateKey } = config.firebase;
  if (serviceAccountJson) return true;
  if (projectId && clientEmail && privateKey) return true;
  if (adcFileExists()) return true;

  // Managed Google runtimes inject credentials through the metadata server.
  if (process.env.K_SERVICE || process.env.GAE_ENV || process.env.FUNCTION_TARGET) {
    return true;
  }

  return false;
}

export function isFirebaseReady() {
  return Boolean(db && auth && hasFirebaseAdminCredentials());
}

export function getFirebaseInitError() {
  return initError;
}

// Administrator status is read from the `admin` custom claim only (see
// server/scripts/set-admin.js and middleware/requireAdmin.js). There is
// deliberately no email-based shortcut here.
