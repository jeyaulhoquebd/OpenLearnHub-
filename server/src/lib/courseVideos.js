import { FieldValue } from 'firebase-admin/firestore';

/**
 * Lesson metadata lives in `resources/{resourceId}/videos/{lessonId}`.
 *
 * Keeping lessons in a subcollection avoids Firestore's 1 MiB document limit
 * for long playlists, while the parent resource stays small enough to list and
 * cache normally. Only the Admin SDK writes these documents; public reads are
 * gated by the parent resource's publication state in firestore.rules.
 */

const BATCH_LIMIT = 400;

function chunk(list, size) {
  const output = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

function videoData(video, index) {
  return {
    id: video.id,
    videoId: video.videoId,
    position: Number.isInteger(video.position) ? video.position : index,
    title: video.title,
    description: video.description || '',
    thumbnailUrl: video.thumbnailUrl || '',
    durationSeconds: Number(video.durationSeconds) || 0,
    durationText: video.durationText || '',
    publishedAt: video.publishedAt || '',
    channelTitle: video.channelTitle || '',
    available: video.available !== false,
    embeddable: video.embeddable !== false,
    privacyStatus: video.privacyStatus || '',
    sourceUrl: video.sourceUrl || '',
    embedUrl: video.embedUrl || ''
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function comparable(data) {
  const {
    updatedAt: _updatedAt,
    createdAt: _createdAt,
    ...rest
  } = data || {};
  return stableStringify(rest);
}

async function commitOperations(db, operations) {
  for (const group of chunk(operations, BATCH_LIMIT)) {
    // eslint-disable-next-line no-await-in-loop
    const batch = db.batch();
    group.forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else {
        batch.set(
          operation.ref,
          {
            ...operation.data,
            updatedAt: FieldValue.serverTimestamp(),
            ...(operation.isNew ? { createdAt: FieldValue.serverTimestamp() } : {})
          },
          { merge: true }
        );
      }
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

/**
 * Reconciles the stored lesson list with a freshly imported playlist.
 *
 * Unchanged lessons are not rewritten, so editing the course description does
 * not burn thousands of writes. Removed lessons are deleted, new ones created,
 * and changed metadata updated.
 */
export async function syncCourseVideos(db, resourceId, videos = []) {
  const ref = db.collection('resources').doc(resourceId).collection('videos');
  const snapshot = await ref.get();
  const existing = new Map(snapshot.docs.map((entry) => [entry.id, entry]));

  const seen = new Set();
  const desired = new Map();

  (Array.isArray(videos) ? videos : []).forEach((video, index) => {
    let id = String(video.id || '').trim() || `${video.videoId || 'video'}-${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    desired.set(id, { ...video, id });
  });

  const operations = [];

  desired.forEach((video, id) => {
    const data = videoData(video, video.position ?? 0);
    const current = existing.get(id);
    if (!current) {
      operations.push({ type: 'set', ref: ref.doc(id), data, isNew: true });
      return;
    }
    if (comparable(data) !== comparable(current.data())) {
      operations.push({ type: 'set', ref: ref.doc(id), data, isNew: false });
    }
  });

  existing.forEach((entry, id) => {
    if (!desired.has(id)) operations.push({ type: 'delete', ref: entry.ref });
  });

  if (operations.length) {
    await commitOperations(db, operations);
  }

  return {
    count: desired.size,
    deleted: operations.filter((operation) => operation.type === 'delete').length,
    written: operations.filter((operation) => operation.type === 'set').length
  };
}

export async function deleteCourseVideos(db, resourceId) {
  return syncCourseVideos(db, resourceId, []);
}
