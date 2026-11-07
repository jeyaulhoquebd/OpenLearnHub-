import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config, assertProductionConfig } from './config.js';
import { initFirebase, isFirebaseReady } from './firebase.js';
import { healthRouter } from './routes/health.js';
import { reportsRouter } from './routes/reports.js';
import { aiRouter } from './routes/ai.js';
import { adminRouter } from './routes/admin.js';
import { communityRouter } from './routes/community.js';
import { blockDuringMaintenance } from './middleware/maintenance.js';
import { errorHandler, notFoundHandler } from './lib/http.js';

initFirebase();
assertProductionConfig();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes(origin)) return callback(null, true);
      if (!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return callback(null, true);
      }
      // Answer without CORS headers (the browser blocks it) instead of a 500.
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Retry-After', 'Content-Disposition'],
    maxAge: 86400
  })
);

// Import batches can carry up to 400 resources; the file itself is capped at
// 2 MB in the browser, JSON escaping adds overhead, and every field is bounded
// again by zod on the server.
app.use(express.json({ limit: '4mb' }));
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.limits.globalPer15Min,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many requests. Please slow down and try again later.'
    }
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'OpenLearn Hub API',
    tagline: 'Knowledge for Everyone',
    documentation: '/api/health',
    routes: [
      '/api/health',
      '/api/reports',
      '/api/ai/chat',
      '/api/ai/roadmap',
      '/api/reviews',
      '/api/bookmarks/:resourceId',
      '/api/resources/:resourceId/view',
      '/api/me',
      '/api/admin/me',
      '/api/admin/stats',
      '/api/admin/resources',
      '/api/admin/categories',
      '/api/admin/alternatives',
      '/api/admin/users',
      '/api/admin/reviews',
      '/api/admin/reports',
      '/api/admin/check-links',
      '/api/admin/import',
      '/api/admin/import-export/export/resources',
      '/api/admin/audit-logs',
      '/api/admin/settings/ai',
      '/api/admin/settings/ai/status',
      '/api/admin/settings/ai/test',
      '/api/admin/settings/ai/models',
      '/api/admin/settings/ai/usage',
      '/api/admin/settings/ai/key',
      '/api/admin/settings/site'
    ]
  });
});

app.use('/api', globalLimiter);
app.use('/api/health', healthRouter);
// Reports stay open during maintenance so copyright notices still reach us.
app.use('/api/reports', reportsRouter);
app.use('/api/ai', blockDuringMaintenance, aiRouter);
app.use('/api/admin', adminRouter);
app.use('/api', blockDuringMaintenance, communityRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(
    `[server] OpenLearn Hub API listening on port ${config.port} (${config.nodeEnv}) · Firebase Admin: ${
      isFirebaseReady() ? 'ready' : 'not configured'
    } · LearnMate (Groq): ${
      config.groq.apiKey ? 'configured via GROQ_API_KEY' : 'configure in Admin → AI Settings'
    }`
  );
});

function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
