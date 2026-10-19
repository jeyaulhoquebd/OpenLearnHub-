import 'dotenv/config';

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
  // Google Gemini — server-side only. The key must never reach the browser.
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: parseNumber(process.env.GEMINI_TIMEOUT_MS, 30000),
    maxOutputTokens: parseNumber(process.env.GEMINI_MAX_OUTPUT_TOKENS, 1024)
  },
  limits: {
    reportsPerHour: parseNumber(process.env.REPORT_RATE_LIMIT_PER_HOUR, 12),
    aiPerHour: parseNumber(process.env.AI_RATE_LIMIT_PER_HOUR, 25),
    globalPer15Min: parseNumber(process.env.GLOBAL_RATE_LIMIT_PER_15_MIN, 400)
  }
};

export function assertProductionConfig() {
  const warnings = [];
  const { firebase } = config;

  if (config.isProduction && !config.gemini.apiKey) {
    warnings.push('GEMINI_API_KEY is not set — the AI assistant will return 503 until configured.');
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
