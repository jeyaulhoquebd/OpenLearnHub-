import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CATEGORY_ICONS } from '../../config/categoryIcons.js';
import { sanitizeText } from './validation.js';

/**
 * Shared rules and Firestore helpers for the admin catalogue screens
 * (categories and free alternatives).
 *
 * Writes are server-only: the panel talks to `/api/admin/categories` and
 * `/api/admin/alternatives`, and security rules deny client writes to both
 * collections. Keeping slug generation, ordering and resource moves here means
 * the two routers stay small and behave consistently.
 */

export const CATEGORY_TYPES = ['course', 'book', 'software', 'all'];

/** Non-empty trimmed value, or undefined, so empty translations are dropped. */
function cleanLanguageMap(value, { max, multiline = false }) {
  const output = {};
  ['en', 'bn', 'ur'].forEach((code) => {
    const text = sanitizeText(value?.[code] || '', { max, multiline });
    if (text) output[code] = text;
  });
  return output;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalHttpUrl = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .default('')
    .refine((value) => !value || isHttpUrl(value), {
      message: 'Must be a valid http:// or https:// URL.'
    });

const nameMap = z.object({
  en: z.string().trim().min(2).max(60),
  bn: z.string().trim().max(60).optional().default(''),
  ur: z.string().trim().max(60).optional().default('')
});

const noteMap = z.object({
  en: z.string().trim().min(2).max(300),
  bn: z.string().trim().max(300).optional().default(''),
  ur: z.string().trim().max(300).optional().default('')
});

export const categoryInputSchema = z.object({
  name: nameMap,
  slug: z.string().trim().max(70).optional().default(''),
  type: z.enum(CATEGORY_TYPES).optional().default('course'),
  icon: z.enum(CATEGORY_ICONS).optional().default('BookOpen'),
  color: z
    .string()
    .trim()
    .max(7)
    .optional()
    .default('')
    .refine((value) => !value || /^#[0-9a-fA-F]{6}$/.test(value), {
      message: 'Use a six-digit hex colour such as #7C3AED.'
    }),
  order: z.coerce.number().int().min(0).max(9999).optional()
});

export const alternativeInputSchema = z.object({
  paidSoftware: z.string().trim().min(2).max(120),
  paidSoftwareLogoUrl: optionalHttpUrl(800),
  freeAlternativeResourceId: z.string().trim().min(1).max(128),
  note: noteMap,
  active: z.boolean().optional().default(true),
  order: z.coerce.number().int().min(0).max(9999).optional()
});

export function normalizeCategoryInput(input) {
  return {
    name: cleanLanguageMap(input.name, { max: 60 }),
    slug: input.slug ? sanitizeText(input.slug, { max: 70 }) : '',
    type: input.type,
    icon: input.icon,
    color: input.color ? input.color.toUpperCase() : null,
    order: input.order
  };
}

export function normalizeAlternativeInput(input) {
  return {
    paidSoftware: sanitizeText(input.paidSoftware, { max: 120 }),
    paidSoftwareLogoUrl: input.paidSoftwareLogoUrl || null,
    freeAlternativeResourceId: sanitizeText(input.freeAlternativeResourceId, { max: 128 }),
    note: cleanLanguageMap(input.note, { max: 300 }),
    active: input.active !== false,
    order: input.order
  };
}

/** URL-safe ASCII slug; falls back to `<prefix>-<time>` for non-Latin names. */
export function buildSlug(value, prefix = 'category') {
  const base = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

  return base || `${prefix}-${Date.now().toString(36)}`;
}

/** First free slug in a collection (appending -2, -3, …). */
export async function uniqueSlug(db, collectionName, base, excludeId = null) {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const candidate = `${base.slice(0, 70 - suffix.length)}${suffix}`;

    // eslint-disable-next-line no-await-in-loop
    const snapshot = await db
      .collection(collectionName)
      .where('slug', '==', candidate)
      .limit(2)
      .get();

    if (!snapshot.docs.some((doc) => doc.id !== excludeId)) return candidate;
  }

  return `${base.slice(0, 50)}-${Date.now().toString(36)}`;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function byOrder(a, b) {
  const orderA = Number(a.order) || 0;
  const orderB = Number(b.order) || 0;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.name?.en || a.paidSoftware || '').localeCompare(
    String(b.name?.en || b.paidSoftware || '')
  );
}

/** All categories, sorted by `order` (documents without one go last). */
export async function listCategories(db) {
  const snapshot = await db.collection('categories').get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        slug: data.slug || '',
        name: data.name || {},
        type: data.type || 'all',
        icon: data.icon || 'BookOpen',
        color: data.color || null,
        order: Number(data.order) || 0,
        updatedAt: toIso(data.updatedAt)
      };
    })
    .sort(byOrder);
}

export function serializeCategory(doc, resourceCount = 0) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    slug: data.slug || '',
    name: data.name || {},
    type: data.type || 'all',
    icon: data.icon || 'BookOpen',
    color: data.color || null,
    order: Number(data.order) || 0,
    resourceCount: Number(resourceCount) || 0,
    updatedAt: toIso(data.updatedAt)
  };
}

/** All alternatives, sorted by `order`. */
export async function listAlternatives(db) {
  const snapshot = await db.collection('alternatives').get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        paidSoftware: data.paidSoftware || '',
        paidSoftwareLogoUrl: data.paidSoftwareLogoUrl || null,
        freeAlternativeResourceId: data.freeAlternativeResourceId || '',
        note: data.note || {},
        order: Number(data.order) || 0,
        active: data.active !== false,
        updatedAt: toIso(data.updatedAt)
      };
    })
    .sort(byOrder);
}

export function serializeAlternative(alternative, freeResource = null) {
  return {
    ...alternative,
    freeResource: freeResource
      ? {
          id: freeResource.id,
          title: freeResource.title || {},
          status: freeResource.status || '',
          slug: freeResource.slug || '',
          thumbnailUrl: freeResource.thumbnailUrl || null
        }
      : null
  };
}

/** Highest `order` + 1, used when a new row is appended to the list. */
export async function nextOrder(db, collectionName) {
  const snapshot = await db.collection(collectionName).orderBy('order', 'desc').limit(1).get();
  if (snapshot.empty) return 1;
  return (Number(snapshot.docs[0].data().order) || 0) + 1;
}

function chunk(list, size) {
  const output = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

/** Firestore batches are capped at 500 writes; stay well below it. */
async function commitInChunks(db, operations, size = 400) {
  for (const group of chunk(operations, size)) {
    // eslint-disable-next-line no-await-in-loop
    const batch = db.batch();
    group.forEach((operation) => operation(batch));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

/**
 * Applies a new order for `ids`, leaving unlisted documents in place.
 *
 * The requested ids are moved together to the position of the earliest one,
 * then every document in the collection is renumbered 1…N. This keeps `order`
 * unique even when the admin reorders a filtered tab (e.g. only courses).
 */
export async function reorderCollection(db, collectionName, ids) {
  const requested = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (!requested.length) return 0;

  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return 0;

  const docs = snapshot.docs.slice().sort((a, b) => {
    const orderA = Number(a.data().order) || 0;
    const orderB = Number(b.data().order) || 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });

  const docIds = new Set(docs.map((doc) => doc.id));
  const requestedSet = new Set(requested.filter((id) => docIds.has(id)));
  if (!requestedSet.size) return 0;

  const firstIndex = docs.findIndex((doc) => requestedSet.has(doc.id));
  const before = docs.slice(0, firstIndex).map((doc) => doc.id);
  const after = docs
    .slice(firstIndex)
    .filter((doc) => !requestedSet.has(doc.id))
    .map((doc) => doc.id);

  const finalIds = [...before, ...requested.filter((id) => requestedSet.has(id)), ...after];

  const operations = finalIds.map((id, index) => (batch) =>
    batch.update(db.collection(collectionName).doc(id), {
      order: index + 1,
      updatedAt: FieldValue.serverTimestamp()
    })
  );

  await commitInChunks(db, operations);
  return finalIds.length;
}

/** Number of resources that currently use a category name. */
export async function countResourcesInCategory(db, name) {
  if (!name) return 0;
  const snapshot = await db.collection('resources').where('category', '==', name).count().get();
  return Number(snapshot.data().count) || 0;
}

/**
 * Re-points every resource from one category name to another.
 *
 * Resources store the English category name (not the document id), so both
 * renames and explicit "move resources" actions use this helper.
 */
export async function moveResources(db, fromName, toName) {
  if (!fromName || !toName || fromName === toName) return 0;

  const snapshot = await db.collection('resources').where('category', '==', fromName).get();
  if (snapshot.empty) return 0;

  const operations = snapshot.docs.map((doc) => (batch) =>
    batch.update(doc.ref, {
      category: toName,
      updatedAt: FieldValue.serverTimestamp()
    })
  );

  await commitInChunks(db, operations);
  return snapshot.size;
}
