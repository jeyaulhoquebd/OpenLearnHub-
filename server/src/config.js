import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load `server/.env` explicitly instead of relying on the current working
// directory. This keeps `npm run dev`, `npm start`, `node server/src/index.js`,
// and the seed/admin scripts consistent. Existing environment variables still
// win because dotenv does not override them by default.
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverDir, '.env') });

function parseList(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const defaultOrigins = ['http://localhost:5173', 'http://localhost:4173'];
const clientOrigins = parseList(process.env.CLIENT_ORIGIN);
if (!clientOrigins.length) clientOrigins.push(...defaultOrigins);

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parseNumber(process.env.PORT, 8080),
  clientOrigins,
  firebase: {
    // Credential option A: full service-account JSON on one line.
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    // Credential option B: three discrete values.
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    adminEmails: parseList(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase())
  },
  // Groq — server-side only. The key must never reach the browser or a log.
  // This is the fallback credential; an admin-supplied key stored in
  // Firestore `settings/ai` (encrypted) takes priority at request time.
  // Groq retires model names over time: check
  // https://console.groq.com/docs/models for the current list.
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    timeoutMs: parseNumber(process.env.GROQ_TIMEOUT_MS, 15000),
    maxOutputTokens: parseNumber(process.env.GROQ_MAX_OUTPUT_TOKENS, 1024),
    roadmapMaxOutputTokens: parseNumber(process.env.GROQ_ROADMAP_MAX_OUTPUT_TOKENS, 2048),
    dailyLimitPerUser: parseNumber(process.env.AI_DAILY_LIMIT_PER_USER, 10)
  },
  // YouTube Data API — server-side only. The public site uses YouTube's
  // official IFrame player, so the key is never sent to the browser.
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    timeoutMs: parseNumber(process.env.YOUTUBE_TIMEOUT_MS, 20000),
    maxPlaylistItems: parseNumber(process.env.YOUTUBE_MAX_PLAYLIST_ITEMS, 5000)
  },
  // Secret used to encrypt the admin-managed Groq key at rest.
  // Recommended value: `openssl rand -hex 32` (64 hex chars = 32 bytes).
  settings: {
    encryptionKey: process.env.SETTINGS_ENCRYPTION_KEY || ''
  },
  limits: {
    reportsPerHour: parseNumber(process.env.REPORT_RATE_LIMIT_PER_HOUR, 12),
    aiPerHour: parseNumber(process.env.AI_RATE_LIMIT_PER_HOUR, 25),
    roadmapPerHour: parseNumber(process.env.ROADMAP_RATE_LIMIT_PER_HOUR, 10),
    globalPer15Min: parseNumber(process.env.GLOBAL_RATE_LIMIT_PER_15_MIN, 400)
  }
};

export function assertProductionConfig() {
  const warnings = [];
  const { firebase } = config;

  if (config.isProduction && !config.groq.apiKey && !config.settings.encryptionKey) {
    warnings.push(
      'Neither GROQ_API_KEY nor SETTINGS_ENCRYPTION_KEY is set — the AI assistant will return 503 until an administrator configures a key.'
    );
  }

  if (config.isProduction && !config.settings.encryptionKey) {
    warnings.push(
      'SETTINGS_ENCRYPTION_KEY is not set — saving a Groq key from the admin AI Settings page is disabled (use GROQ_API_KEY instead).'
    );
  }

  const hasCredential =
    firebase.serviceAccountJson ||
    (firebase.projectId && firebase.clientEmail && firebase.privateKey) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!hasCredential) {
    warnings.push(
      'No Firebase credentials detected. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  if (config.isProduction && config.clientOrigins.includes('*')) {
    warnings.push('CLIENT_ORIGIN must not be "*" in production.');
  }

  warnings.forEach((warning) => console.warn(`[config] ${warning}`));
}
