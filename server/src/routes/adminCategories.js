import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import {
  buildSlug,
  categoryInputSchema,
  countResourcesInCategory,
  listCategories,
  moveResources,
  nextOrder,
  normalizeCategoryInput,
  reorderCollection,
  uniqueSlug
} from '../lib/catalogAdmin.js';

/**
 * Admin categories API.
 *
 * Categories store `order` for the public navigation and the admin list.
 * Reordering is a separate endpoint so drag-and-drop can save one compact
 * request. Deleting a category that resources still reference is refused with
 * `409 category_in_use`; the panel then offers to move those resources first.
 */

const reorderSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(128)).min(1).max(200)
});

const moveSchema = z.object({
  targetCategoryId: z.string().trim().min(1).max(128)
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
    apiError(res, 400, 'invalid_category', 'Please fix the highlighted fields.', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export const adminCategoriesRouter = Router();

/** GET /api/admin/categories — every category with its resource count. */
adminCategoriesRouter.get('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const categories = await listCategories(db);
    const items = await Promise.all(
      categories.map(async (category) => ({
        ...category,
        resourceCount: await countResourcesInCategory(db, category.name?.en || '')
      }))
    );

    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/categories */
adminCategoriesRouter.post('/', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, categoryInputSchema, req.body);
    if (!parsed) return undefined;

    const payload = normalizeCategoryInput(parsed);
    const slug = await uniqueSlug(db, 'categories', payload.slug || buildSlug(payload.name.en));
    const order = payload.order ?? (await nextOrder(db, 'categories'));
    const ref = db.collection('categories').doc();
    const now = FieldValue.serverTimestamp();

    await ref.set({
      ...payload,
      slug,
      order,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.uid
    });

    await writeAuditLogForRequest(req, {
      action: 'category.create',
      targetType: 'category',
      targetId: ref.id,
      details: { name: payload.name.en, type: payload.type, slug }
    });

    return res.status(201).json({ id: ref.id, slug, order });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/admin/categories/:id
 * Renaming the English name also re-points every resource that stored the old
 * name, so the public catalogue never ends up with orphaned categories.
 */
adminCategoriesRouter.put('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 128) {
      return apiError(res, 400, 'invalid_id', 'That category id is not valid.');
    }

    const parsed = parseBody(res, categoryInputSchema, req.body);
    if (!parsed) return undefined;

    const ref = db.collection('categories').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'category_not_found', 'That category no longer exists.');
    }

    const existing = snapshot.data() || {};
    const payload = normalizeCategoryInput(parsed);
    const slug = payload.slug
      ? await uniqueSlug(db, 'categories', payload.slug, id)
      : existing.slug || (await uniqueSlug(db, 'categories', buildSlug(payload.name.en), id));

    const update = {
      ...payload,
      slug,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    };
    if (payload.order === undefined) delete update.order;

    await ref.update(update);

    const oldName = existing.name?.en || '';
    const renamedResources =
      oldName && oldName !== payload.name.en
        ? await moveResources(db, oldName, payload.name.en)
        : 0;

    await writeAuditLogForRequest(req, {
      action: 'category.update',
      targetType: 'category',
      targetId: id,
      details: {
        name: payload.name.en,
        type: payload.type,
        slug,
        renamedResources
      }
    });

    return res.json({ id, slug, renamedResources });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/admin/categories/:id
 * Refused while resources still use the category. The client catches
 * `category_in_use` and offers to move them to another category.
 */
adminCategoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    if (!id || id.length > 128) {
      return apiError(res, 400, 'invalid_id', 'That category id is not valid.');
    }

    const ref = db.collection('categories').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return apiError(res, 404, 'category_not_found', 'That category no longer exists.');
    }

    const data = snapshot.data() || {};
    const count = await countResourcesInCategory(db, data.name?.en || '');
    if (count > 0) {
      return apiError(
        res,
        409,
        'category_in_use',
        `This category still has ${count} resource${count === 1 ? '' : 's'}. Move them to another category before deleting it.`,
        { count }
      );
    }

    await ref.delete();

    await writeAuditLogForRequest(req, {
      action: 'category.delete',
      targetType: 'category',
      targetId: id,
      details: { name: data.name?.en || '', type: data.type || '' }
    });

    return res.json({ ok: true, id });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/categories/:id/move-resources
 * Re-points every resource in this category to another category, so the
 * category can then be deleted.
 */
adminCategoriesRouter.post('/:id/move-resources', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const { id } = req.params;
    const parsed = parseBody(res, moveSchema, req.body);
    if (!parsed) return undefined;

    if (parsed.targetCategoryId === id) {
      return apiError(res, 400, 'same_category', 'Choose a different category.');
    }

    const [sourceSnap, targetSnap] = await Promise.all([
      db.collection('categories').doc(id).get(),
      db.collection('categories').doc(parsed.targetCategoryId).get()
    ]);

    if (!sourceSnap.exists) {
      return apiError(res, 404, 'category_not_found', 'That category no longer exists.');
    }
    if (!targetSnap.exists) {
      return apiError(res, 404, 'target_category_not_found', 'The target category does not exist.');
    }

    const sourceName = sourceSnap.data()?.name?.en || '';
    const targetName = targetSnap.data()?.name?.en || '';
    const moved = await moveResources(db, sourceName, targetName);

    await writeAuditLogForRequest(req, {
      action: 'category.move_resources',
      targetType: 'category',
      targetId: id,
      details: {
        from: sourceName,
        to: targetName,
        targetId: parsed.targetCategoryId,
        moved
      }
    });

    return res.json({ ok: true, moved });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/categories/reorder { ids: [...] } */
adminCategoriesRouter.post('/reorder', async (req, res, next) => {
  try {
    const db = requireDb(res);
    if (!db) return undefined;

    const parsed = parseBody(res, reorderSchema, req.body);
    if (!parsed) return undefined;

    const updated = await reorderCollection(db, 'categories', parsed.ids);

    await writeAuditLogForRequest(req, {
      action: 'category.reorder',
      targetType: 'category',
      targetId: null,
      details: { count: updated }
    });

    return res.json({ ok: true, updated });
  } catch (error) {
    return next(error);
  }
});
