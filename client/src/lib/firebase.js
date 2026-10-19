import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator
} from 'firebase/storage';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Analytics is optional; the core services need the six values above only.
const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

export const missingFirebaseVars = requiredKeys.filter((key) => !firebaseConfig[key]);

export const isFirebaseConfigured = missingFirebaseVars.length === 0;

let app = null;
let auth = null;
let db = null;
let storage = null;
let analytics = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('[firebase] Could not set auth persistence:', error?.code || error);
  });

  const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
  if (useEmulator && !globalThis.__openlearnEmulatorsConnected) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8085);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      globalThis.__openlearnEmulatorsConnected = true;
      console.info('[firebase] Connected to local emulators.');
    } catch (error) {
      console.warn('[firebase] Emulator connection failed:', error?.message || error);
    }
  }

  // Analytics only in production builds, and only where the browser supports it.
  if (import.meta.env.PROD && firebaseConfig.measurementId) {
    isAnalyticsSupported()
      .then((supported) => {
        if (supported) analytics = getAnalytics(app);
      })
      .catch((error) => {
        console.warn('[firebase] Analytics unavailable:', error?.message || error);
      });
  }
} else if (import.meta.env.DEV) {
  console.info(
    `[firebase] Not configured (missing: ${missingFirebaseVars.join(', ') || 'none'}). Running in preview mode.`
  );
}

export { app, auth, db, storage, analytics };
