import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initFirebase, getDb } from '../src/firebase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, '../../firebase/seed/resources.json');

function toTimestamp(value) {
  if (!value) return FieldValue.serverTimestamp();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FieldValue.serverTimestamp();
  return Timestamp.fromDate(date);
}

async function main() {
  initFirebase();
  const db = getDb();
  if (!db) {
    console.error('[seed] Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }

  const raw = await readFile(seedPath, 'utf8');
  const resources = JSON.parse(raw);
  console.log(`[seed] Loading ${resources.length} curated resources…`);

  let written = 0;
  for (let start = 0; start < resources.length; start += 400) {
    const batch = db.batch();
    const slice = resources.slice(start, start + 400);
    for (const resource of slice) {
      const { createdAt, ...rest } = resource;
      const ref = db.collection('resources').doc(resource.id);
      batch.set(
        ref,
        {
          ...rest,
          status: resource.status || 'published',
          featured: Boolean(resource.featured),
          thumbnailUrl: resource.thumbnailUrl || null,
          createdAt: toTimestamp(createdAt),
          publishedAt: toTimestamp(createdAt),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      written += 1;
    }
    await batch.commit();
    console.log(`[seed] Committed ${written}/${resources.length}`);
  }

  console.log('[seed] Done. Open Firestore → resources to review the library.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[seed] Failed:', error?.message || error);
  process.exit(1);
});
