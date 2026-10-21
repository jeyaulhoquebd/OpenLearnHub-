import { Router } from 'express';
import { config } from '../config.js';
import { isFirebaseReady } from '../firebase.js';
import { getAiConfigSnapshot } from '../lib/settings.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  // Never expose the key: only whether a credential exists and whether AI is
  // switched on. This is synchronous on purpose so health checks stay fast even
  // when Firestore is unreachable.
  const ai = getAiConfigSnapshot();

  res.json({
    status: 'ok',
    service: 'openlearn-hub-api',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    services: {
      firebaseAdmin: isFirebaseReady(),
      groqConfigured: ai.hasKey,
      aiEnabled: ai.enabled
    }
  });
});
