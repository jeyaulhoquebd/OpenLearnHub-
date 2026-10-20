import { FieldValue } from 'firebase-admin/firestore';
import { findBlockedSource } from '../../config/blocklist.js';
import {
  buildResourceSlug,
  normalizeResourceInput,
  resourceInputSchema,
  uniqueResourceSlug
} from './resourceAdmin.js';

/**
 * Admin import/export helpers.
 *
 * Exports are generated on the server so the browser never needs broad read
 * access to drafts, counters or internal fields. Imports are validated again
 * here (never trust the client preview), checked against the same legal-source
 * blocklist as the resource form, and written through the Admin SDK.
 */

const PAGE_SIZE = 500;
const MAX_EXPORT_DOCS = 10000;
const MAX_IMPORT_ROWS = 400;
const FIRESTORE_IN_LIMIT = 10;

/** CSV columns for a resource export / import template. */
export const RESOURCE_CSV_COLUMNS = [
  'id',
  'slug',
  'type',
  'category',
  'level',
  'language',
  'countries',
  'platform',
  'tags',
  'title_en',
  'title_bn',
  'title_ur',
  'description_en',
  'description_bn',
  'description_ur',
  'sourceName',
  'sourceUrl',
  'license',
  'licenseUrl',
  'author',
  'thumbnailUrl',
  'status',
  'featured',
  'viewCount',
  'saveCount',
  'ratingAvg',
  'ratingCount',
  'createdAt',
  'updatedAt',
  'publishedAt'
];

const SAMPLE_RESOURCE = {
  type: 'course',
  category: 'Computer Science',
  level: 'Beginner',
  language: ['English', 'Bangla'],
  countries: ['Bangladesh', 'India', 'Pakistan'],
  platform: [],
  tags: ['programming', 'beginners'],
  title: {
    en: 'Introduction to Programming',
    bn: 'প্রোগ্রামিং পরিচিতি',
    ur: 'پروگرامنگ کا تعارف'
  },
  description: {
    en: 'A free, beginner-friendly introduction to programming concepts, logic and your first small projects.',
    bn: 'প্রোগ্রামিংয়ের মূল ধারণা, লজিক এবং প্রথম ছোট প্রকল্পের একটি বিনামূল্যে, শিক্ষানবিশ-বান্ধব পরিচিতি।',
    ur: 'پروگرامنگ کے بنیادی تصورات، منطق اور پہلے چھوٹے منصوبوں کا ایک مفت، ابتدائیوں کے لیے موزوں تعارف۔'
  },
  sourceName: 'freeCodeCamp',
  sourceUrl: 'https://www.freecodecamp.org/learn/',
  license: 'Free to access',
  licenseUrl: '',
  author: 'freeCodeCamp',
  thumbnailUrl: '',
  status: 'draft',
  featured: false
};

function chunk(list, size) {
  const output = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return null;
}

/** Recursively converts Firestore timestamps into ISO strings for export. */
export function serializeForExport(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return toIso(value);
  if (Array.isArray(value)) return value.map(serializeForExport);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, serializeForExport(entry)])
    );
  }
  return value;
}

/** Reads every document in a collection, bounded so an export cannot run away. */
export async function fetchAllDocs(db, collectionName, { max = MAX_EXPORT_DOCS } = {}) {
  const docs = [];
  let last = null;

  while (docs.length < max) {
    let query = db.collection(collectionName).limit(Math.min(PAGE_SIZE, max - docs.length));
    if (last) query = query.startAfter(last);
    // eslint-disable-next-line no-await-in-loop
    const snapshot = await query.get();
    docs.push(...snapshot.docs);
    if (snapshot.size < PAGE_SIZE) break;
    last = snapshot.docs[snapshot.size - 1];
  }

  return docs;
}

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.en || '';
  return String(value);
}

function listOf(value) {
  return Array.isArray(value) ? value.join('|') : value || '';
}

function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Builds a UTF-8 CSV with a BOM so Excel opens Bangla/Urdu correctly. */
export function toCsv(headers, rows) {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function resourceCsvRecord(id, data = {}) {
  const title = data.title || {};
  const description = data.description || {};
  return {
    id,
    slug: data.slug || '',
    type: data.type || '',
    category: data.category || '',
    level: data.level || '',
    language: listOf(data.language),
    countries: listOf(data.countries),
    platform: listOf(data.platform),
    tags: listOf(data.tags),
    title_en: textOf(title.en || title),
    title_bn: textOf(title.bn),
    title_ur: textOf(title.ur),
    description_en: textOf(description.en || description),
    description_bn: textOf(description.bn),
    description_ur: textOf(description.ur),
    sourceName: data.sourceName || data.provider || '',
    sourceUrl: data.sourceUrl || data.url || '',
    license: data.license || '',
    licenseUrl: data.licenseUrl || '',
    author: data.author || '',
    thumbnailUrl: data.thumbnailUrl || '',
    status: data.status || 'draft',
    featured: data.featured === true ? 'true' : 'false',
    viewCount: Number(data.viewCount) || 0,
    saveCount: Number(data.saveCount) || 0,
    ratingAvg: Number(data.ratingAvg) || 0,
    ratingCount: Number(data.ratingCount) || 0,
    createdAt: toIso(data.createdAt) || '',
    updatedAt: toIso(data.updatedAt) || '',
    publishedAt: toIso(data.publishedAt) || ''
  };
}

/** Export payloads for the three catalogue collections. */
export async function buildExport(db, kind) {
  const collectionName = kind === 'resources' ? 'resources' : kind;
  const docs = await fetchAllDocs(db, collectionName);
  const items = docs.map((entry) =>
    serializeForExport({ id: entry.id, ...(entry.data() || {}) })
  );

  if (kind === 'resources') {
    return { kind, exportedAt: new Date().toISOString(), count: items.length, resources: items };
  }
  return { kind, exportedAt: new Date().toISOString(), count: items.length, items };
}

export async function buildResourceCsv(db) {
  const docs = await fetchAllDocs(db, 'resources');
  const rows = docs.map((entry) => resourceCsvRecord(entry.id, entry.data() || {}));
  return toCsv(RESOURCE_CSV_COLUMNS, rows);
}

export function buildTemplate(format = 'json') {
  if (format === 'csv') {
    const record = resourceCsvRecord('', {
      ...SAMPLE_RESOURCE,
      description: SAMPLE_RESOURCE.description,
      title: SAMPLE_RESOURCE.title,
      language: SAMPLE_RESOURCE.language,
      countries: SAMPLE_RESOURCE.countries,
      platform: SAMPLE_RESOURCE.platform,
      tags: SAMPLE_RESOURCE.tags
    });
    return toCsv(RESOURCE_CSV_COLUMNS, [record]);
  }

  return JSON.stringify(
    {
      kind: 'resources',
      sample: true,
      exportedAt: new Date().toISOString(),
      count: 1,
      resources: [SAMPLE_RESOURCE]
    },
    null,
    2
  );
}

function normalizeMatchTitle(title) {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.en || title.bn || title.ur || '';
}

/**
 * Finds existing resources with the same source URL. The client uses this to
 * preview "skip duplicate" / "update existing" decisions before importing.
 */
export async function findDuplicateSourceUrls(db, sourceUrls = []) {
  const unique = Array.from(
    new Set(
      sourceUrls
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, MAX_IMPORT_ROWS)
    )
  );
  const matches = {};

  for (const group of chunk(unique, FIRESTORE_IN_LIMIT)) {
    // eslint-disable-next-line no-await-in-loop
    const snapshot = await db.collection('resources').where('sourceUrl', 'in', group).get();
    snapshot.docs.forEach((entry) => {
      const data = entry.data() || {};
      const url = String(data.sourceUrl || '').trim();
      if (!url) return;
      const current = matches[url];
      if (current && current.id <= entry.id) return;
      matches[url] = {
        id: entry.id,
        title: normalizeMatchTitle(data.title),
        status: data.status || 'draft',
        slug: data.slug || ''
      };
    });
  }

  return { checked: unique.length, matches };
}

function baseSlugFor(payload) {
  return buildResourceSlug(payload.title?.en || '');
}

/**
 * Fetches the slugs already used by the candidates' base values. Only the base
 * is queried; on a collision we fall back to `uniqueResourceSlug`, which is
 * slower but rare. This keeps a 400-row import to a handful of reads.
 */
async function loadSlugOwners(db, payloads) {
  const bases = Array.from(new Set(payloads.map(baseSlugFor).filter(Boolean)));
  const owners = new Map();

  for (const group of chunk(bases, FIRESTORE_IN_LIMIT)) {
    // eslint-disable-next-line no-await-in-loop
    const snapshot = await db.collection('resources').where('slug', 'in', group).get();
    snapshot.docs.forEach((entry) => {
      const slug = entry.data()?.slug;
      if (slug && !owners.has(slug)) owners.set(slug, entry.id);
    });
  }

  return owners;
}

function pickSlug(base, ownId, owners) {
  const owner = owners.get(base);
  if (!owner || owner === ownId) return base;
  return null;
}

/**
 * Imports up to 400 validated resource payloads.
 *
 * New rows are always saved as drafts. `mode: 'update'` updates the first
 * existing resource with the same `sourceUrl`; its publication status and
 * counters are preserved. `mode: 'skip'` leaves duplicates untouched.
 */
export async function importResources(db, { rows = [], mode = 'skip', adminUid, adminEmail } = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    return { results: [], summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 } };
  }

  const results = [];
  const plans = [];

  rows.slice(0, MAX_IMPORT_ROWS).forEach((row) => {
    const index = Number.isInteger(row?.index) ? row.index : plans.length + results.length;
    const parsed = resourceInputSchema.safeParse(row?.resource);
    if (!parsed.success) {
      results.push({
        index,
        status: 'failed',
        code: 'invalid_resource',
        message: parsed.error.issues[0]?.message || 'Invalid resource.'
      });
      return;
    }

    const payload = normalizeResourceInput(parsed.data);
    const blocked = findBlockedSource(payload);
    if (blocked) {
      results.push({
        index,
        status: 'failed',
        code: blocked.code || 'blocked_source',
        message: blocked.message || 'This source is not allowed.'
      });
      return;
    }

    plans.push({ index, payload, sourceUrl: payload.sourceUrl });
  });

  const sourceUrls = Array.from(new Set(plans.map((plan) => plan.sourceUrl).filter(Boolean)));
  const matches = new Map();
  for (const group of chunk(sourceUrls, FIRESTORE_IN_LIMIT)) {
    // eslint-disable-next-line no-await-in-loop
    const snapshot = await db.collection('resources').where('sourceUrl', 'in', group).get();
    snapshot.docs.forEach((entry) => {
      const url = String(entry.data()?.sourceUrl || '').trim();
      if (!url) return;
      const current = matches.get(url);
      if (current && current.id <= entry.id) return;
      matches.set(url, { id: entry.id, ref: entry.ref, data: entry.data() || {} });
    });
  }

  const owners = await loadSlugOwners(
    db,
    plans.map((plan) => plan.payload)
  );
  const seenSourceUrls = new Set();
  const batch = db.batch();
  const writes = [];

  for (const plan of plans) {
    const match = matches.get(plan.sourceUrl);

    if (seenSourceUrls.has(plan.sourceUrl)) {
      results.push({
        index: plan.index,
        status: 'skipped',
        code: 'duplicate_in_file',
        message: 'Another row in this file uses the same source URL.'
      });
      continue;
    }
    seenSourceUrls.add(plan.sourceUrl);

    if (match && mode === 'skip') {
      results.push({
        index: plan.index,
        status: 'skipped',
        code: 'existing_source_url',
        message: 'A resource with this source URL already exists.',
        id: match.id
      });
      continue;
    }

    const isUpdate = Boolean(match) && mode === 'update';
    const existing = isUpdate ? match.data : null;
    const titleChanged = isUpdate
      ? plan.payload.title?.en !== existing?.title?.en
      : false;
    const base = baseSlugFor(plan.payload);
    let slug =
      isUpdate && !titleChanged && existing?.slug
        ? existing.slug
        : pickSlug(base, isUpdate ? match.id : null, owners);

    if (!slug) {
      // A colliding base slug; ask the dedicated helper for the next free
      // suffix. The extra in-batch check catches rows that are not committed
      // yet, which the database query cannot see.
      // eslint-disable-next-line no-await-in-loop
      slug = await uniqueResourceSlug(db, base, isUpdate ? match.id : null);
      if (owners.has(slug) && owners.get(slug) !== (isUpdate ? match.id : null)) {
        slug = `${base.slice(0, 48)}-${Date.now().toString(36)}-${plan.index}`;
      }
    }
    owners.set(slug, isUpdate ? match.id : `new-${plan.index}`);

    const importedAt = new Date().toISOString();
    if (isUpdate) {
      const ref = match.ref;
      const data = {
        ...plan.payload,
        slug,
        // Imports never publish or unpublish an existing listing.
        status: existing?.status || 'draft',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminUid || null,
        importedAt,
        importedBy: adminUid || null
      };
      batch.update(ref, data);
      writes.push({ index: plan.index, status: 'updated', id: match.id, ref });
    } else {
      const ref = db.collection('resources').doc();
      const now = FieldValue.serverTimestamp();
      const data = {
        ...plan.payload,
        id: ref.id,
        slug,
        // New imported rows are drafts until a human reviews them.
        status: 'draft',
        viewCount: 0,
        saveCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        createdBy: adminUid || null,
        creatorEmail: adminEmail || null,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        lastVerified: importedAt,
        importedAt,
        importedBy: adminUid || null
      };
      batch.set(ref, data);
      writes.push({ index: plan.index, status: 'created', id: ref.id, ref });
    }
  }

  if (writes.length) {
    await batch.commit();
  }

  results.push(...writes);
  results.sort((a, b) => a.index - b.index);

  const summary = results.reduce(
    (totals, item) => {
      totals.total += 1;
      if (item.status === 'created') totals.created += 1;
      else if (item.status === 'updated') totals.updated += 1;
      else if (item.status === 'skipped') totals.skipped += 1;
      else totals.failed += 1;
      return totals;
    },
    { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 }
  );

  return { results, summary };
}

export { MAX_IMPORT_ROWS };
