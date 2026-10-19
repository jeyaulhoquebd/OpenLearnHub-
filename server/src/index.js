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
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
  })
);

app.use(express.json({ limit: '64kb' }));
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
    routes: ['/api/health', '/api/reports', '/api/ai/chat']
  });
});

app.use('/api', globalLimiter);
app.use('/api/health', healthRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/ai', aiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(
    `[server] OpenLearn Hub API listening on port ${config.port} (${config.nodeEnv}) · Firebase Admin: ${
      isFirebaseReady() ? 'ready' : 'not configured'
    } · LearnMate: ${config.gemini.apiKey ? 'configured' : 'not configured'}`
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
