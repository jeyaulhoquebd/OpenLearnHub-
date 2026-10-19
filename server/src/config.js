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
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    adminEmails: parseList(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase())
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    apiUrl: process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    timeoutMs: parseNumber(process.env.LLM_TIMEOUT_MS, 30000),
    maxOutputTokens: parseNumber(process.env.LLM_MAX_OUTPUT_TOKENS, 700)
  },
  limits: {
    reportsPerHour: parseNumber(process.env.REPORT_RATE_LIMIT_PER_HOUR, 12),
    aiPerHour: parseNumber(process.env.AI_RATE_LIMIT_PER_HOUR, 25),
    globalPer15Min: parseNumber(process.env.GLOBAL_RATE_LIMIT_PER_15_MIN, 400)
  }
};

export function assertProductionConfig() {
  const warnings = [];
  if (config.isProduction && !config.llm.apiKey) {
    warnings.push('LLM_API_KEY is not set — LearnMate will return 503 until configured.');
  }
  if (!config.firebase.serviceAccountJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !config.firebase.projectId) {
    warnings.push(
      'No Firebase credentials detected. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS so reports and AI auth work.'
    );
  }
  if (config.isProduction && config.clientOrigins.includes('*')) {
    warnings.push('CLIENT_ORIGIN must not be "*" in production.');
  }
  warnings.forEach((warning) => console.warn(`[config] ${warning}`));
}
