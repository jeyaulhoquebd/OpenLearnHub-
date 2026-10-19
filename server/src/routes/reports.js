import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../firebase.js';
import { optionalAuth } from '../middleware/auth.js';
import { apiError } from '../lib/http.js';

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

reportsRouter.post('/', optionalAuth, reportLimiter, async (req, res, next) => {
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
    const doc = await db.collection('reports').add({
      resourceId: payload.resourceId,
      resourceTitle: payload.resourceTitle,
      resourceType: payload.resourceType,
      resourceUrl: payload.resourceUrl,
      reason: payload.reason,
      details: payload.details,
      reporterUid: req.user?.uid || null,
      reporterEmail: req.user?.email || payload.email || null,
      locale: payload.locale,
      status: 'open',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 220),
      createdAt: FieldValue.serverTimestamp()
    });

    return res.status(201).json({ ok: true, id: doc.id });
  } catch (error) {
    return next(error);
  }
});
