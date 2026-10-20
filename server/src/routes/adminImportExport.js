import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import {
  buildExport,
  buildResourceCsv,
  buildTemplate
} from '../lib/importExport.js';

/**
 * Admin data exports and import templates.
 *
 * Files are generated on the server (admin claim required) so drafts, counters
 * and internal fields are never exposed through public Firestore reads.
 */

const kindSchema = z.enum(['resources', 'categories', 'alternatives']);
const formatSchema = z.enum(['json', 'csv']);

function requireDb(res) {
  const db = getDb();
  if (!db) {
    apiError(res, 503, 'database_unavailable', 'The database is not configured.');
    return null;
  }
  return db;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export const adminImportExportRouter = Router();

/**
 * GET /api/admin/import-export/export/:kind?format=json|csv
 * `kind` is resources, categories or alternatives. CSV is resources-only.
 */
adminImportExportRouter.get('/export/:kind', async (req, res, next) => {
  try {
    const parsedKind = kindSchema.safeParse(req.params.kind);
    const parsedFormat = formatSchema.safeParse(req.query.format || 'json');
    if (!parsedKind.success || !parsedFormat.success) {
      return apiError(res, 400, 'invalid_export', 'Choose a supported export format.');
    }

    const db = requireDb(res);
    if (!db) return undefined;

    const kind = parsedKind.data;
    const format = parsedFormat.data;

    if (format === 'csv' && kind !== 'resources') {
      return apiError(res, 400, 'invalid_export', 'CSV export is only available for resources.');
    }

    if (format === 'csv') {
      const csv = await buildResourceCsv(db);
      await writeAuditLogForRequest(req, {
        action: 'data.export',
        targetType: 'import',
        targetId: null,
        details: { kind, format }
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="openlearn-${kind}-${stamp()}.csv"`
      );
      return res.send(csv);
    }

    const payload = await buildExport(db, kind);
    await writeAuditLogForRequest(req, {
      action: 'data.export',
      targetType: 'import',
      targetId: null,
      details: { kind, format, count: payload.count }
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="openlearn-${kind}-${stamp()}.json"`
    );
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/admin/import-export/template?format=json|csv
 * Downloadable sample with English, Bangla and Urdu fields.
 */
adminImportExportRouter.get('/template', async (req, res, next) => {
  try {
    const parsed = formatSchema.safeParse(req.query.format || 'json');
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_format', 'Choose JSON or CSV.');
    }

    const format = parsed.data;
    const body = buildTemplate(format);

    res.setHeader(
      'Content-Type',
      format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="openlearn-resources-template.${format}"`
    );
    return res.send(body);
  } catch (error) {
    return next(error);
  }
});
