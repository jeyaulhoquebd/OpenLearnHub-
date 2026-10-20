import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import {
  alternativeInputSchema,
  listAlternatives,
  nextOrder,
  normalizeAlternativeInput,
  reorderCollection,
  serializeAlternative
} from '../lib/catalogAdmin.js';

/**
 * Admin "free alternatives" API.
 *
 * An alternative pairs a paid product with a published open-source resource
 * (`freeAlternativeResourceId`). The home page reads the same collection, so
 * `active`, `order` and the note are edited in one place.
 */

const reorderSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(128)).min(1).max(200)
});

const activeSchema = z.object({
  active: z.boolean()
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
    apiError(res, 400, 'invalid_alternative', 'Please fix the highlighted fields.', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

/** Loads the linked resource and enforces "published software". */
async function loadFreeResource(db, resourceId) {
  const snapshot = await db.collection('resources').doc(resourceId).get();
  if (!snapshot.exists) {
    return { error: ['resource_not_found', 'That resource no longer exists.'] };
  }

  const data = snapshot.data() || {};
  if (data.type !== 'software') {
    return {
      error: ['resource_not_software', 'The free alternative must be a software resource.']
    };
  }
  if (data.status !== 'published') {
    return {
      error: ['resource_not_published', 'Publish the software resource before linking it.']
    };
  }

  return { resource: { id: snapshot.id, ...data } };
}

async function findDuplicate(db, { paidSoftware, freeAlternativeResourceId, excludeId = null }) {
  const snapshot = await db
    .collection('alternatives')
    .where('freeAlternativeResourceId', '==', freeAlternativeResourceId)
    .get();

  const wanted = String(paidSoftware || '').trim().toLowerCase();
  return (
    snapshot.docs.find(
      (doc) =>
        doc.id !== excludeId &&
        String(doc.data().paidSoftware || '').trim().toLowerCase() === wanted
    ) || null
  );
}

export const adminAlternativesRouter = Router();

/** GET /api/admin/alternatives — includes inactive rows and linked resources. */
adminAlternativesRouter.get('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const alternatives = await listAlternatives(db);
    const ids = [...new Set(alternatives.map((item) => item.freeAlternativeResourceId).filter(Boolean))];
    const snapshots = ids.length
      ? await db.getAll(...ids.map((id) => db.collection('resources').doc(id)))
      : [];
    const resources = new Map(
      snapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => [snapshot.id, { id: snapshot.id, ...snapshot.data() }])
    );

    return res.json({
      items: alternatives.map((item) =>
        serializeAlternative(item, resources.get(item.freeAlternativeResourceId) || null)
      )
    });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/alternatives */
adminAlternativesRouter.post('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, alternativeInputSchema, req.body);
    if (!parsed) return undefined;

    const payload = normalizeAlternativeInput(parsed);
    const linked = await loadFreeResource(db, payload.freeAlternativeResourceId);
    if (linked.error) return apiError(res, 422, linked.error[0], linked.error[1]);

    const duplicate = await findDuplicate(db, payload);
    if (duplicate) {
      return apiError(
        res,
        409,
        'alternative_duplicate',
        'This paid software is already paired with that resource.'
      );
    }

    const order = payload.order ?? (await nextOrder(db, 'alternatives'));
    const ref = db.collection('alternatives').doc();
    const now = FieldValue.serverTimestamp();

    await ref.set({
      ...payload,
      order,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.uid
    });

    await writeAuditLogForRequest(req, {
      action: 'alternative.create',
      targetType: 'alternative',
      targetId: ref.id,
      details: {
        paidSoftware: payload.paidSoftware,
        freeAlternativeResourceId: payload.freeAlternativeResourceId,
        active: payload.active
      }
    });

    return res.status(201).json({ id: ref.id, order });
  } catch (error) {
    return next(error);
  }
});

/** PUT /api/admin/alternatives/:id */
adminAlternativesRouter.put('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 128) {
      return apiError(res, 400, 'invalid_id', 'That alternative id is not valid.');
    }

    const parsed = parseBody(res, alternativeInputSchema, req.body);
    if (!parsed) return undefined;

    const ref = db.collection('alternatives').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'alternative_not_found', 'That alternative no longer exists.');
    }

    const payload = normalizeAlternativeInput(parsed);
    const linked = await loadFreeResource(db, payload.freeAlternativeResourceId);
    if (linked.error) return apiError(res, 422, linked.error[0], linked.error[1]);

    const duplicate = await findDuplicate(db, { ...payload, excludeId: id });
    if (duplicate) {
      return apiError(
        res,
        409,
        'alternative_duplicate',
        'This paid software is already paired with that resource.'
      );
    }

    const update = {
      ...payload,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    };
    if (payload.order === undefined) delete update.order;

    await ref.update(update);

    await writeAuditLogForRequest(req, {
      action: 'alternative.update',
      targetType: 'alternative',
      targetId: id,
      details: {
        paidSoftware: payload.paidSoftware,
        freeAlternativeResourceId: payload.freeAlternativeResourceId,
        active: payload.active
      }
    });

    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/alternatives/:id/active { active } */
adminAlternativesRouter.post('/:id/active', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    const parsed = parseBody(res, activeSchema, req.body);
    if (!parsed) return undefined;

    const ref = db.collection('alternatives').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'alternative_not_found', 'That alternative no longer exists.');
    }

    await ref.update({
      active: parsed.active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    });

    await writeAuditLogForRequest(req, {
      action: 'alternative.toggle',
      targetType: 'alternative',
      targetId: id,
      details: { active: parsed.active }
    });

    return res.json({ ok: true, active: parsed.active });
  } catch (error) {
    return next(error);
  }
});

/** DELETE /api/admin/alternatives/:id */
adminAlternativesRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 128) {
      return apiError(res, 400, 'invalid_id', 'That alternative id is not valid.');
    }

    const ref = db.collection('alternatives').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'alternative_not_found', 'That alternative no longer exists.');
    }

    const data = snapshot.data() || {};
    await ref.delete();

    await writeAuditLogForRequest(req, {
      action: 'alternative.delete',
      targetType: 'alternative',
      targetId: id,
      details: {
        paidSoftware: data.paidSoftware || '',
        freeAlternativeResourceId: data.freeAlternativeResourceId || ''
      }
    });

    return res.json({ ok: true, id });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/alternatives/reorder { ids: [...] } */
adminAlternativesRouter.post('/reorder', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, reorderSchema, req.body);
    if (!parsed) return undefined;

    const updated = await reorderCollection(db, 'alternatives', parsed.ids);

    await writeAuditLogForRequest(req, {
      action: 'alternative.reorder',
      targetType: 'alternative',
      targetId: null,
      details: { count: updated }
    });

    return res.json({ ok: true, updated });
  } catch (error) {
    return next(error);
  }
});
