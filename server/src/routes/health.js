import { Router } from 'express';
import { config } from '../config.js';
import { isFirebaseReady } from '../firebase.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'openlearn-hub-api',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    services: {
      firebaseAdmin: isFirebaseReady(),
      geminiConfigured: Boolean(config.gemini.apiKey)
    }
  });
});
