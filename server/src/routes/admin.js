import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { apiError } from '../lib/http.js';
import { sanitizeText } from '../lib/validation.js';
import { getAiSettingsStatus, saveAiSettings, resolveAiConfig } from '../lib/settings.js';
import { testGeminiKey } from '../lib/ai.js';

const aiSettingsSchema = z.object({
  // Empty string clears the stored key and falls back to the env key.
  apiKey: z.string().trim().max(300).optional().default(''),
  model: z
    .string()
    .trim()
    .max(80)
    .optional()
    .default('')
    .transform((value) => sanitizeText(value, { max: 80 }))
});

const testSchema = z.object({
  apiKey: z.string().trim().max(300).optional().default(''),
  model: z.string().trim().max(80).optional().default('')
});

export const adminRouter = Router();

// Every admin route requires a verified Firebase ID token with the `admin`
// custom claim. Admin access is never read from a Firestore field.
adminRouter.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/settings/ai/status
 * Reports whether AI is configured, from where, and a masked key hint.
 * The API key itself is never returned.
 */
adminRouter.get('/settings/ai/status', async (req, res, next) => {
  try {
    const status = await getAiSettingsStatus();
    return res.json(status);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/settings/ai
 * Stores (or clears) the Gemini API key and model. The key is encrypted with
 * AES-256-GCM before it reaches Firestore.
 */
adminRouter.post('/settings/ai', async (req, res, next) => {
  try {
    const parsed = aiSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_settings', 'Those AI settings are not valid.', parsed.error.flatten());
    }

    const { apiKey, model } = parsed.data;

    // Gemini keys are long; a short non-empty value is almost certainly a typo.
    if (apiKey && apiKey.length < 20) {
      return apiError(res, 400, 'invalid_key', 'That does not look like a valid Gemini API key.');
    }

    let status;
    try {
      status = await saveAiSettings({ apiKey, model, updatedBy: req.user.uid });
    } catch (error) {
      if (error.code === 'encryption_unavailable') {
        return apiError(
          res,
          503,
          'encryption_unavailable',
          'The server is missing SETTINGS_ENCRYPTION_KEY, so a new key cannot be stored securely. Use GEMINI_API_KEY instead.'
        );
      }
      if (error.code === 'database_unavailable') {
        return apiError(res, 503, 'database_unavailable', 'Settings storage is unavailable right now.');
      }
      throw error;
    }

    return res.json({ ok: true, status });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/settings/ai/test
 * Verifies a candidate key (or the currently stored/env key) with a tiny call,
 * so the admin can confirm it works before relying on it.
 */
adminRouter.post('/settings/ai/test', async (req, res, next) => {
  try {
    const parsed = testSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_settings', 'Those test settings are not valid.');
    }

    const candidateKey = parsed.data.apiKey.trim();
    const candidateModel = parsed.data.model.trim();

    let apiKey = candidateKey;
    let model = candidateModel;

    if (!apiKey) {
      const resolved = await resolveAiConfig({ force: true });
      apiKey = resolved.apiKey;
      model = model || resolved.model;
    }

    if (!apiKey) {
      return apiError(
        res,
        400,
        'llm_unavailable',
        'There is no API key to test yet. Add a Gemini API key first.'
      );
    }

    let result;
    try {
      result = await testGeminiKey({ apiKey, model });
    } catch (error) {
      if (error.code === 'llm_timeout') {
        return apiError(res, 504, 'llm_timeout', 'The provider did not respond in time. Check your connection and the key.');
      }
      if (error.code === 'llm_unauthorized') {
        return apiError(res, 400, 'llm_unauthorized', 'That API key was rejected by Gemini. Please check it and try again.');
      }
      if (error.code === 'llm_rate_limited') {
        return apiError(res, 429, 'llm_rate_limited', 'Gemini is rate-limiting this key right now. Try again shortly.');
      }
      return apiError(res, 502, 'llm_error', 'The key could not be verified right now. Please try again.');
    }

    return res.json({ ok: true, tested: candidateKey ? 'candidate' : 'active', ...result });
  } catch (error) {
    return next(error);
  }
});
