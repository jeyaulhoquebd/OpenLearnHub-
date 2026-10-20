import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { apiError } from '../lib/http.js';
import { sanitizeText } from '../lib/validation.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import { getFirebaseAuth } from '../firebase.js';
import { getAiSettingsStatus, saveAiSettings, resolveAiConfig } from '../lib/settings.js';
import { getSiteSettings, saveSiteSettings, siteSettingsSchema } from '../lib/siteSettings.js';
import { getAdminStats } from '../lib/stats.js';
import { testGeminiKey } from '../lib/ai.js';
import { adminResourcesRouter } from './adminResources.js';
import { adminCategoriesRouter } from './adminCategories.js';
import { adminAlternativesRouter } from './adminAlternatives.js';
import { adminUsersRouter } from './adminUsers.js';
import { adminReviewsRouter } from './adminReviews.js';
import { adminReportsRouter } from './adminReports.js';
import { adminLinkCheckerRouter } from './adminLinkChecker.js';
import { adminImportExportRouter } from './adminImportExport.js';
import { adminImportRouter } from './adminImport.js';
import { adminAuditLogsRouter } from './adminAuditLogs.js';

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
adminRouter.use(requireAdmin);

// Resources management (list, create, update, delete, bulk, link test).
adminRouter.use('/resources', adminResourcesRouter);

// Catalogue management: categories (with reordering and safe delete) and the
// paid → free software alternatives shown on the home page.
adminRouter.use('/categories', adminCategoriesRouter);
adminRouter.use('/alternatives', adminAlternativesRouter);

// People and community content: user accounts (disable, roles, sessions,
// deletion) and review moderation with rating recalculation.
adminRouter.use('/users', adminUsersRouter);
adminRouter.use('/reviews', adminReviewsRouter);

// Community reports queue (status changes, notes, unpublish) and the batch
// link checker (background jobs + saved per-resource results).
adminRouter.use('/reports', adminReportsRouter);
adminRouter.use('/check-links', adminLinkCheckerRouter);

// Data movement and the read-only audit trail.
adminRouter.use('/import-export', adminImportExportRouter);
adminRouter.use('/import', adminImportRouter);
adminRouter.use('/audit-logs', adminAuditLogsRouter);

/**
 * GET /api/admin/me
 * Basic identity of the signed-in administrator, used by the admin shell.
 * Confirms server-side that the caller really holds the admin claim.
 */
adminRouter.get('/me', async (req, res, next) => {
  try {
    const auth = getFirebaseAuth();
    // Extra profile fields are a nice-to-have: never fail the request if the
    // Admin SDK lookup is unavailable.
    const record = auth
      ? await auth.getUser(req.user.uid).catch(() => null)
      : null;

    return res.json({
      admin: {
        uid: req.user.uid,
        email: record?.email || req.user.email || null,
        name: record?.displayName || req.user.name || null,
        photoURL: record?.photoURL || req.user.picture || null,
        emailVerified: req.user.email_verified === true,
        providers: (record?.providerData || []).map((provider) => provider.providerId),
        lastSignInAt: record?.metadata?.lastSignInTime || null,
        isAdmin: req.user.admin === true
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/admin/settings/site
 * Public site settings (site name, tagline, contact, social links, banner and
 * maintenance switch). The same document is publicly readable in Firestore,
 * but the admin form reads through the API so it always sees the normalised
 * shape and current defaults.
 */
adminRouter.get('/settings/site', async (req, res, next) => {
  try {
    const settings = await getSiteSettings();
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/settings/site
 * Validates and saves settings/site with the Admin SDK. Clients can read the
 * document but can never write it (firestore.rules).
 */
adminRouter.post('/settings/site', async (req, res, next) => {
  try {
    const parsed = siteSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(
        res,
        400,
        'invalid_settings',
        'Those site settings are not valid.',
        parsed.error.flatten()
      );
    }

    let settings;
    try {
      settings = await saveSiteSettings(parsed.data, { updatedBy: req.user.uid });
    } catch (error) {
      if (error.code === 'database_unavailable') {
        return apiError(res, 503, 'database_unavailable', 'Settings storage is unavailable right now.');
      }
      throw error;
    }

    await writeAuditLogForRequest(req, {
      action: 'settings.site.save',
      targetType: 'settings',
      targetId: 'site',
      details: {
        siteName: settings.siteName,
        maintenanceMode: settings.maintenanceMode,
        announcementEnabled: settings.announcement.enabled,
        announcementType: settings.announcement.type
      }
    });

    return res.json({ ok: true, settings });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/admin/stats
 * Aggregated dashboard numbers (counts, 30-day series, top resources, latest
 * activity, auth provider split). Cached in memory for 60 seconds; add
 * `?refresh=1` to bypass the cache from the Refresh button.
 */
adminRouter.get('/stats', async (req, res, next) => {
  try {
    const force = req.query.refresh === '1' || req.query.refresh === 'true';
    const stats = await getAdminStats({ force });
    return res.json(stats);
  } catch (error) {
    if (error.code === 'stats_unavailable') {
      return apiError(
        res,
        503,
        'stats_unavailable',
        'Statistics are unavailable because the database is not configured.'
      );
    }
    return next(error);
  }
});

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

    // Never include the key (or its ciphertext) in the audit entry.
    await writeAuditLogForRequest(req, {
      action: 'settings.ai.save',
      targetType: 'settings',
      targetId: 'ai',
      details: {
        keyChanged: Boolean(apiKey),
        keyCleared: !apiKey,
        model: model || null,
        source: status?.source || null
      }
    });

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
