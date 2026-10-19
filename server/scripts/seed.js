import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initFirebase, getDb } from '../src/firebase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(__dirname, '../../firebase/seed');

function toTimestamp(value) {
  if (!value) return FieldValue.serverTimestamp();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FieldValue.serverTimestamp();
  return Timestamp.fromDate(date);
}

async function readJson(name) {
  const raw = await readFile(path.join(seedDir, name), 'utf8');
  return JSON.parse(raw);
}

/**
 * The curated seed data is authored with plain English strings. Firestore
 * stores the refined per-language shape (section 9), so we wrap strings into
 * `{ en }` maps here. When a translation file exists it is merged in over the
 * English text.
 */
function toLocalizedMap(value, translations = {}) {
  const map = { en: typeof value === 'string' ? value : value?.en || '' };
  for (const [lang, text] of Object.entries(translations)) {
    if (typeof text === 'string' && text.trim()) map[lang] = text.trim();
  }
  return map;
}

function normalizeResource(resource, translations = {}) {
  const {
    provider,
    url,
    languages,
    title,
    description,
    longDescription,
    createdAt,
    ...rest
  } = resource;

  return {
    ...rest,
    title: toLocalizedMap(title, translations.title),
    description: toLocalizedMap(description, translations.description),
    longDescription: toLocalizedMap(longDescription || description, translations.longDescription),
    sourceName: provider || '',
    sourceUrl: url || '',
    language: Array.isArray(languages) ? languages : [],
    ratingAvg: Number(resource.ratingAvg) || 0,
    ratingCount: Number(resource.ratingCount) || 0,
    viewCount: Number(resource.viewCount) || 0,
    saveCount: Number(resource.saveCount) || 0,
    status: resource.status === 'pending' || resource.status === 'rejected' ? resource.status : 'published',
    featured: Boolean(resource.featured),
    thumbnailUrl: resource.thumbnailUrl || null,
    createdAt: toTimestamp(createdAt),
    publishedAt: toTimestamp(createdAt),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function seedCollection(db, name, items) {
  if (!items.length) return 0;
  for (let start = 0; start < items.length; start += 400) {
    const batch = db.batch();
    for (const item of items.slice(start, start + 400)) {
      const { id, ...data } = item;
      batch.set(db.collection(name).doc(id), data, { merge: true });
    }
    await batch.commit();
  }
  return items.length;
}

async function main() {
  initFirebase();
  const db = getDb();
  if (!db) {
    console.error('[seed] Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }

  const resources = await readJson('resources.json');
  const categories = await readJson('categories.json');
  const alternatives = await readJson('alternatives.json');

  // Optional per-resource translations: { "<id>": { title: {bn,ur}, ... } }
  let translations = {};
  try {
    translations = await readJson('translations.json');
  } catch {
    console.log('[seed] No translations.json found — English-only content for now.');
  }

  console.log(`[seed] Loading ${resources.length} curated resources…`);

  let written = 0;
  for (let start = 0; start < resources.length; start += 400) {
    const batch = db.batch();
    const slice = resources.slice(start, start + 400);
    for (const resource of slice) {
      const ref = db.collection('resources').doc(resource.id);
      batch.set(ref, normalizeResource(resource, translations[resource.id] || {}), { merge: true });
      written += 1;
    }
    await batch.commit();
    console.log(`[seed] Committed ${written}/${resources.length}`);
  }

  const categoryCount = await seedCollection(db, 'categories', categories);
  console.log(`[seed] Committed ${categoryCount} categories.`);

  const alternativeCount = await seedCollection(
    db,
    'alternatives',
    alternatives.map(({ id, ...rest }) => ({ id, ...rest }))
  );
  console.log(`[seed] Committed ${alternativeCount} free-software alternatives.`);

  console.log('[seed] Done. Open Firestore → resources to review the library.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[seed] Failed:', error?.message || error);
  process.exit(1);
});
