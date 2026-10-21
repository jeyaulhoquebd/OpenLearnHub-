/**
 * Admin-managed AI settings (Groq).
 *
 * The API key can come from two places, checked in this order:
 *   1. Firestore `settings/ai` — written by an admin through the admin API,
 *      stored AES-256-GCM encrypted (see lib/crypto.js).
 *   2. The server environment (`GROQ_API_KEY`), for deployments that prefer
 *      to keep the key out of the database.
 *
 * `settings/ai` is completely unreadable from the browser (see
 * firebase/firestore.rules) and the decrypted key never leaves this module.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { getDb } from '../firebase.js';
import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  maskSecret
} from './crypto.js';

const COLLECTION = 'settings';
const DOC_ID = 'ai';
const CACHE_TTL_MS = 30 * 1000;
const READ_TIMEOUT_MS = 4 * 1000;
const MAX_DAILY_LIMIT = 200;

let resolvedCache = { value: null, fetchedAt: 0 };

/** Drops the cached resolution so an edit takes effect immediately. */
export function invalidateAiSettingsCache() {
  resolvedCache = { value: null, fetchedAt: 0 };
}

function withCode(code, message) {
  return Object.assign(new Error(message), { code });
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return null;
}

function normalizeDailyLimit(value, fallback = config.groq.dailyLimitPerUser) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(Math.round(number), MAX_DAILY_LIMIT);
}

async function readAiDoc() {
  const db = getDb();
  if (!db) return null;

  // Never let an unreachable/misconfigured Firestore stall an AI request or an
  // admin status check. On timeout resolveAiConfig falls back to GROQ_API_KEY.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error('Timed out while reading settings/ai.'), {
            code: 'settings_timeout'
          })
        ),
      READ_TIMEOUT_MS
    );
  });

  try {
    const snap = await Promise.race([
      db.collection(COLLECTION).doc(DOC_ID).get(),
      timeout
    ]);
    return snap.exists ? snap.data() : null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves the API key + model actually used for AI calls.
 * Returns `{ apiKey, model, enabled, dailyLimitPerUser, source, updatedAt }`
 * where source is 'admin' | 'env' | 'none'. Never expose `apiKey` to a client.
 */
export async function resolveAiConfig({ force = false } = {}) {
  const fresh =
    !force && resolvedCache.value && Date.now() - resolvedCache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return resolvedCache.value;

  let doc = null;
  try {
    doc = await readAiDoc();
  } catch (error) {
    console.warn('[settings] Could not read settings/ai:', error?.message);
  }

  let apiKey = '';
  let source = 'none';
  const model = String(doc?.model || '').trim() || config.groq.model;
  const enabled = doc?.enabled !== false;
  const dailyLimitPerUser = normalizeDailyLimit(
    doc?.dailyLimitPerUser,
    config.groq.dailyLimitPerUser
  );

  if (doc?.apiKeyCiphertext) {
    if (!isEncryptionConfigured()) {
      console.warn(
        '[settings] settings/ai holds an encrypted key but SETTINGS_ENCRYPTION_KEY is missing.'
      );
    } else {
      try {
        apiKey = decryptSecret({
          ciphertext: doc.apiKeyCiphertext,
          iv: doc.apiKeyIv,
          tag: doc.apiKeyTag
        });
        if (apiKey) source = 'admin';
      } catch (error) {
        console.warn('[settings] Could not decrypt settings/ai key:', error?.message);
      }
    }
  }

  if (!apiKey && config.groq.apiKey) {
    apiKey = config.groq.apiKey;
    source = 'env';
  }

  const resolved = {
    apiKey,
    model,
    enabled,
    dailyLimitPerUser,
    source,
    updatedAt: toIsoString(doc?.updatedAt)
  };

  resolvedCache = { value: resolved, fetchedAt: Date.now() };
  return resolved;
}

/**
 * Cheap, synchronous health snapshot for `/api/health`.
 *
 * It deliberately never touches Firestore: health checks must stay fast even
 * when Firebase credentials are missing. Once any request has resolved the
 * admin-managed settings, the cached values are used; otherwise this falls back
 * to the environment key.
 */
export function getAiConfigSnapshot() {
  const cached = resolvedCache.value;
  if (cached) {
    return {
      hasKey: Boolean(cached.apiKey),
      enabled: Boolean(cached.apiKey && cached.enabled)
    };
  }
  return {
    hasKey: Boolean(config.groq.apiKey),
    enabled: Boolean(config.groq.apiKey)
  };
}

/**
 * A browser-safe snapshot of the AI configuration. The API key is reduced to a
 * masked hint; the ciphertext is never returned.
 */
export async function getAiSettingsStatus() {
  const resolved = await resolveAiConfig({ force: true });

  return {
    hasKey: Boolean(resolved.apiKey),
    source: resolved.source,
    maskedKey: resolved.apiKey ? maskSecret(resolved.apiKey) : '',
    model: resolved.model,
    enabled: resolved.enabled,
    dailyLimitPerUser: resolved.dailyLimitPerUser,
    updatedAt: resolved.updatedAt
  };
}

/**
 * Saves the stored AI settings. Omitted fields are left untouched; passing a
 * non-empty apiKey replaces the encrypted key. Removal uses deleteStoredAiKey.
 */
export async function saveAiSettings({
  apiKey = '',
  model,
  enabled,
  dailyLimitPerUser,
  updatedBy = null
} = {}) {
  const db = getDb();
  if (!db) {
    throw withCode(
      'database_unavailable',
      'Settings storage is unavailable (no Firebase Admin credentials).'
    );
  }

  const trimmedKey = String(apiKey || '').trim();
  if (trimmedKey && !trimmedKey.startsWith('gsk_')) {
    throw withCode('invalid_key', 'Groq API keys start with "gsk_".');
  }
  if (trimmedKey && !isEncryptionConfigured()) {
    throw withCode(
      'encryption_unavailable',
      'SETTINGS_ENCRYPTION_KEY is not configured on the server, so the key cannot be stored securely.'
    );
  }

  const payload = {
    provider: 'groq',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: updatedBy || null
  };

  if (model !== undefined) {
    payload.model = String(model || '').trim() || config.groq.model;
  }
  if (enabled !== undefined) {
    payload.enabled = enabled !== false;
  }
  if (dailyLimitPerUser !== undefined) {
    payload.dailyLimitPerUser = normalizeDailyLimit(dailyLimitPerUser);
  }

  if (trimmedKey) {
    const { ciphertext, iv, tag } = encryptSecret(trimmedKey);
    payload.apiKeyCiphertext = ciphertext;
    payload.apiKeyIv = iv;
    payload.apiKeyTag = tag;
    payload.apiKeyPrefix = trimmedKey.slice(0, 4);
    payload.apiKeySuffix = trimmedKey.slice(-4);
  }

  await db.collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true });

  invalidateAiSettingsCache();
  return getAiSettingsStatus();
}

/** Removes the encrypted admin key while keeping the model/limit preferences. */
export async function deleteStoredAiKey({ updatedBy = null } = {}) {
  const db = getDb();
  if (!db) {
    throw withCode('database_unavailable', 'Settings storage is unavailable.');
  }

  await db.collection(COLLECTION).doc(DOC_ID).set(
    {
      provider: 'groq',
      apiKeyCiphertext: FieldValue.delete(),
      apiKeyIv: FieldValue.delete(),
      apiKeyTag: FieldValue.delete(),
      apiKeyPrefix: FieldValue.delete(),
      apiKeySuffix: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: updatedBy || null
    },
    { merge: true }
  );

  invalidateAiSettingsCache();
  return getAiSettingsStatus();
}

export { normalizeDailyLimit, MAX_DAILY_LIMIT };
