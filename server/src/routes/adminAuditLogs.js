import { Router } from 'express';
import { z } from 'zod';
import { apiError } from '../lib/http.js';
import { listAuditLogs } from '../lib/auditLog.js';

/**
 * Read-only audit trail API. Entries are appended by every privileged route;
 * this endpoint never exposes a way to edit or delete them.
 */

const querySchema = z.object({
  admin: z.string().trim().max(200).optional().default(''),
  action: z.string().trim().max(80).optional().default(''),
  targetType: z.string().trim().max(60).optional().default(''),
  from: z.string().trim().max(40).optional().default(''),
  to: z.string().trim().max(40).optional().default(''),
  cursor: z.string().trim().max(160).optional().default(''),
  limit: z.coerce.number().int().min(10).max(100).optional().default(25)
});

export const adminAuditLogsRouter = Router();

/**
 * GET /api/admin/audit-logs
 * Filters: admin (UID/email/name), action, targetType, from, to.
 * Pagination: limit + opaque cursor.
 */
adminAuditLogsRouter.get('/', async (req, res, next) => {
  try {
    const raw = { ...req.query };
    Object.keys(raw).forEach((key) => {
      if (raw[key] === '') delete raw[key];
    });

    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_query', 'Those audit log filters are not valid.');
    }

    const data = await listAuditLogs(parsed.data);
    return res.json(data);
  } catch (error) {
    if (error.code === 'database_unavailable') {
      return apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    }
    return next(error);
  }
});
