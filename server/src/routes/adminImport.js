import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import {
  findDuplicateSourceUrls,
  importResources,
  MAX_IMPORT_ROWS
} from '../lib/importExport.js';

/**
 * Admin resource import.
 *
 * The client sends at most 400 previewed rows per request. Every row is
 * re-validated with the same server schema as the resource form, checked
 * against the legal-source blocklist, and written via the Admin SDK.
 */

const importRowSchema = z.object({
  index: z.coerce.number().int().min(0).max(100000),
  resource: z.unknown()
});

const importSchema = z.object({
  mode: z.enum(['skip', 'update']).optional().default('skip'),
  rows: z.array(importRowSchema).min(1).max(MAX_IMPORT_ROWS)
});

const duplicateSchema = z.object({
  sourceUrls: z.array(z.string().trim().max(600)).max(MAX_IMPORT_ROWS).optional().default([])
});

function requireDb(res) {
  const db = getDb();
  if (!db) {
    apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    return null;
  }
  return db;
}

function parseBody(res, schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    apiError(res, 400, 'invalid_import', 'Those import rows are not valid.', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export const adminImportRouter = Router();

/**
 * POST /api/admin/import/duplicates
 * Body: { sourceUrls: string[] } — existing resources keyed by source URL.
 * Bounded to the same 400 rows as one import batch.
 */
adminImportRouter.post('/duplicates', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, duplicateSchema, req.body);
    if (!parsed) return undefined;

    const result = await findDuplicateSourceUrls(db, parsed.data.sourceUrls);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/import
 * Body: { mode: 'skip' | 'update', rows: [{ index, resource }] }
 * New rows become drafts. `update` updates the first resource with the same
 * source URL while preserving its publication status and counters.
 */
adminImportRouter.post('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, importSchema, req.body);
    if (!parsed) return undefined;

    const result = await importResources(db, {
      rows: parsed.data.rows,
      mode: parsed.data.mode,
      adminUid: req.user?.uid,
      adminEmail: req.user?.email || null
    });

    await writeAuditLogForRequest(req, {
      action: 'data.import',
      targetType: 'import',
      targetId: null,
      details: {
        mode: parsed.data.mode,
        ...result.summary
      }
    });

    return res.json({ ok: true, mode: parsed.data.mode, ...result });
  } catch (error) {
    return next(error);
  }
});
