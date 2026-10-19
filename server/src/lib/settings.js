/**
 * Admin-managed AI settings.
 *
 * The Gemini API key can come from two places, checked in this order:
 *   1. Firestore `settings/ai` — written by an admin through the admin API,
 *      stored AES-256-GCM encrypted (see lib/crypto.js).
 *   2. The server environment (`GEMINI_API_KEY`), for deployments that prefer
 *      to keep the key out of the database.
 *
 * `settings/ai` is completely unreadable from the browser (see
 * firebase/firestore.rules) and the decrypted key never leaves this module.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { getDb } from '../firebase.js';
import { decryptSecret, encryptSecret, isEncryptionConfigured } from './crypto.js';

const COLLECTION = 'settings';
const DOC_ID = 'ai';
const CACHE_TTL_MS = 30 * 1000;

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

async function readAiDoc() {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Resolves the API key + model actually used for AI calls.
 * Returns `{ apiKey, model, source }` where source is
 * 'settings' | 'env' | 'none'. Never expose the returned apiKey to a client.
 */
export async function resolveAiConfig({ force = false } = {}) {
  const fresh =
    !force && resolvedCache.value && Date.now() - resolvedCache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return resolvedCache.value;

  let resolved = {
    apiKey: '',
    model: config.gemini.model,
    source: 'none'
  };

  try {
    const data = await readAiDoc();
    if (data?.apiKeyCiphertext) {
      let apiKey = '';
      if (isEncryptionConfigured()) {
        try {
          apiKey = decryptSecret({
            ciphertext: data.apiKeyCiphertext,
            iv: data.apiKeyIv,
            tag: data.apiKeyTag
          });
        } catch (error) {
          console.warn('[settings] Could not decrypt settings/ai key:', error?.message);
        }
      } else {
        console.warn(
          '[settings] settings/ai holds an encrypted key but SETTINGS_ENCRYPTION_KEY is missing.'
        );
      }
      if (apiKey) {
        resolved = {
          apiKey,
          model: data.model || config.gemini.model,
          source: 'settings'
        };
      }
    } else if (data?.model) {
      // A model override with no stored key (env key still in use).
      resolved = { apiKey: '', model: data.model, source: 'none' };
    }
  } catch (error) {
    console.warn('[settings] Could not read settings/ai:', error?.message);
  }

  if (!resolved.apiKey && config.gemini.apiKey) {
    resolved = {
      apiKey: config.gemini.apiKey,
      model: resolved.model || config.gemini.model,
      source: 'env'
    };
  }

  resolvedCache = { value: resolved, fetchedAt: Date.now() };
  return resolved;
}

/**
 * A browser-safe snapshot of the AI configuration. The API key is reduced to a
 * masked hint; the ciphertext is never returned.
 */
export async function getAiSettingsStatus() {
  const resolved = await resolveAiConfig({ force: true });

  let doc = null;
  try {
    doc = await readAiDoc();
  } catch (error) {
    console.warn('[settings] Could not read settings/ai status:', error?.message);
  }

  const hasStoredKey = Boolean(doc?.apiKeyCiphertext);
  let keyHint = '';
  if (hasStoredKey) {
    keyHint =
      doc?.apiKeyPrefix && doc?.apiKeySuffix
        ? `${doc.apiKeyPrefix}${'•'.repeat(8)}${doc.apiKeySuffix}`
        : '••••••••';
  }

  return {
    configured: Boolean(resolved.apiKey),
    source: resolved.source, // 'settings' | 'env' | 'none'
    model: resolved.model,
    hasStoredKey,
    keyHint,
    encryptionAvailable: isEncryptionConfigured(),
    updatedAt: toIsoString(doc?.updatedAt),
    updatedBy: doc?.updatedBy || null
  };
}

/**
 * Saves (or clears) the stored AI settings.
 * Passing an empty apiKey removes the stored key, leaving any env fallback.
 */
export async function saveAiSettings({ apiKey = '', model = '', updatedBy = null } = {}) {
  const db = getDb();
  if (!db) {
    throw withCode('database_unavailable', 'Settings storage is unavailable (no Firebase Admin credentials).');
  }

  const trimmedKey = String(apiKey || '').trim();
  const nextModel = String(model || '').trim() || config.gemini.model;

  if (!trimmedKey) {
    // Remove the stored key but keep the model preference.
    await db.collection(COLLECTION).doc(DOC_ID).set(
      {
        provider: 'gemini',
        model: nextModel,
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

  if (!isEncryptionConfigured()) {
    throw withCode(
      'encryption_unavailable',
      'SETTINGS_ENCRYPTION_KEY is not configured on the server, so the key cannot be stored securely.'
    );
  }

  const { ciphertext, iv, tag } = encryptSecret(trimmedKey);

  await db.collection(COLLECTION).doc(DOC_ID).set(
    {
      provider: 'gemini',
      model: nextModel,
      apiKeyCiphertext: ciphertext,
      apiKeyIv: iv,
      apiKeyTag: tag,
      apiKeyPrefix: trimmedKey.slice(0, 4),
      apiKeySuffix: trimmedKey.slice(-4),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: updatedBy || null
    },
    { merge: true }
  );

  invalidateAiSettingsCache();
  return getAiSettingsStatus();
}
