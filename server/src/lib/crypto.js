/**
 * Symmetric encryption for secrets stored in Firestore (currently the
 * admin-managed Gemini API key in `settings/ai`).
 *
 * AES-256-GCM is used so the ciphertext is authenticated: if the stored value
 * is tampered with, decryption fails loudly instead of returning garbage.
 *
 * The key comes from SETTINGS_ENCRYPTION_KEY. Any of these forms is accepted:
 *   - 64 hex characters (32 bytes)   → used directly  (`openssl rand -hex 32`)
 *   - base64 that decodes to 32 bytes → used directly (`openssl rand -base64 32`)
 *   - any other passphrase           → hashed with SHA-256 to 32 bytes
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard

function deriveKey(secret) {
  const value = String(secret || '').trim();
  if (!value) return null;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }

  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    /* not base64 — fall through to hashing */
  }

  return crypto.createHash('sha256').update(value).digest();
}

/** True when SETTINGS_ENCRYPTION_KEY is configured. */
export function isEncryptionConfigured() {
  return Boolean(deriveKey(config.settings.encryptionKey));
}

/**
 * Encrypts a UTF-8 string. Returns base64 ciphertext/iv/tag parts that can be
 * stored directly in Firestore.
 */
export function encryptSecret(plaintext) {
  const key = deriveKey(config.settings.encryptionKey);
  if (!key) {
    throw Object.assign(new Error('SETTINGS_ENCRYPTION_KEY is not configured.'), {
      code: 'encryption_unavailable'
    });
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

/** Reverses {@link encryptSecret}. Throws when the key or data is wrong. */
export function decryptSecret({ ciphertext, iv, tag }) {
  const key = deriveKey(config.settings.encryptionKey);
  if (!key) {
    throw Object.assign(new Error('SETTINGS_ENCRYPTION_KEY is not configured.'), {
      code: 'encryption_unavailable'
    });
  }
  if (!ciphertext || !iv || !tag) {
    throw Object.assign(new Error('The stored secret is incomplete.'), { code: 'decryption_failed' });
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final()
    ]);
    return plaintext.toString('utf8');
  } catch {
    throw Object.assign(
      new Error('The stored secret could not be decrypted. SETTINGS_ENCRYPTION_KEY may have changed.'),
      { code: 'decryption_failed' }
    );
  }
}

/**
 * Builds a display-only hint such as `AIza••••••••1234`. The full key is never
 * returned to the browser.
 */
export function maskSecret(value) {
  const text = String(value || '');
  if (text.length <= 8) return '••••••••';
  return `${text.slice(0, 4)}${'•'.repeat(8)}${text.slice(-4)}`;
}
