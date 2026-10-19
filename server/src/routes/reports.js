import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../firebase.js';
import { optionalAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { apiError } from '../lib/http.js';
import { sanitizeEmail, sanitizeText, sanitizeUrl } from '../lib/validation.js';

const reportSchema = z.object({
  resourceId: z.string().trim().min(1).max(160),
  resourceTitle: z.string().trim().min(1).max(220),
  resourceType: z.enum(['course', 'book', 'software']).optional().default('course'),
  resourceUrl: z.string().trim().max(600).optional().default(''),
  reason: z.enum(['copyright', 'broken-link', 'piracy', 'inaccurate', 'spam', 'other']),
  details: z.string().trim().max(1500).optional().default(''),
  email: z.union([z.string().trim().email().max(200), z.literal('')]).optional().default(''),
  locale: z.string().trim().max(8).optional().default('en')
});

export const reportsRouter = Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.limits.reportsPerHour,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many reports from this address. Please try again later.'
    }
  }
});

reportsRouter.post('/', optionalAuth, requireVerifiedEmail, reportLimiter, async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_report', 'Some report details are missing or invalid.', parsed.error.flatten());
    }

    const db = getDb();
    if (!db) {
      return apiError(
        res,
        503,
        'database_unavailable',
        'Report storage is unavailable because the server has no Firebase Admin credentials.'
      );
    }

    const payload = parsed.data;
    let doc;
    try {
      doc = await db.collection('reports').add({
        resourceId: sanitizeText(payload.resourceId, { max: 160 }),
        resourceTitle: sanitizeText(payload.resourceTitle, { max: 220 }),
        resourceType: payload.resourceType,
        resourceUrl: sanitizeUrl(payload.resourceUrl, 600),
        reason: payload.reason,
        details: sanitizeText(payload.details, { max: 1000, multiline: true }),
        reporterUid: req.user?.uid || null,
        reporterEmail: req.user?.email || sanitizeEmail(payload.email) || null,
        locale: sanitizeText(payload.locale, { max: 8 }),
        status: 'open',
        verifiedReporter: req.user ? req.user.email_verified === true : false,
        userAgent: sanitizeText(req.headers['user-agent'] || '', { max: 220 }),
        createdAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('[reports] Could not store report:', error?.message || error);
      return apiError(
        res,
        503,
        'database_unavailable',
        'Report storage is unavailable right now. Please try again later or email us directly.'
      );
    }

    return res.status(201).json({ ok: true, id: doc.id });
  } catch (error) {
    return next(error);
  }
});
