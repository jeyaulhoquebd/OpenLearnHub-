import { uploadCloudinaryImage } from './cloudinary';
import { safeFileName } from './utils';

/**
 * Thumbnail pipeline.
 *
 * The browser always produces a WebP image no larger than 800 px on its longest
 * side and 1 MB on disk before it reaches Cloudinary. That keeps public pages
 * fast on mobile data and keeps the unsigned upload preset's limits predictable.
 */

export const MAX_THUMBNAIL_DIMENSION = 800;
export const MAX_THUMBNAIL_BYTES = 1024 * 1024;

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> decoder (older Safari, exotic formats).
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(fail('image_decode_failed', 'The image could not be read.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });
}

/**
 * Resizes and re-encodes an image as WebP.
 *
 * @param {File} file
 * @returns {Promise<File>} a new `.webp` file ≤ 1 MB
 */
export async function prepareThumbnail(file) {
  if (!file) throw fail('image_missing', 'Choose an image first.');
  if (!String(file.type || '').startsWith('image/')) {
    throw fail('image_type', 'Only image files are allowed.');
  }

  const bitmap = await loadBitmap(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth || 0;
  const sourceHeight = bitmap.height || bitmap.naturalHeight || 0;
  if (!sourceWidth || !sourceHeight) {
    throw fail('image_decode_failed', 'The image could not be read.');
  }

  let scale = Math.min(1, MAX_THUMBNAIL_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let quality = 0.86;
  let blob = null;

  // Two knobs: shrink dimensions if the file is still too big at low quality.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    // eslint-disable-next-line no-await-in-loop
    blob = await canvasToBlob(canvas, quality);
    if (!blob) throw fail('image_encode_failed', 'The image could not be converted.');

    if (blob.size <= MAX_THUMBNAIL_BYTES) break;

    if (quality > 0.55) {
      quality -= 0.12;
    } else {
      scale *= 0.75;
      quality = 0.78;
    }
  }

  if (bitmap.close) bitmap.close();

  if (!blob || blob.size > MAX_THUMBNAIL_BYTES) {
    throw fail('image_too_large', 'The image is still larger than 1 MB after resizing.');
  }

  const baseName = String(file.name || 'thumbnail').replace(/\.[^.]+$/, '');
  return new File([blob], `${safeFileName(baseName)}.webp`, {
    type: 'image/webp',
    lastModified: Date.now()
  });
}

/**
 * Uploads an already-prepared thumbnail to Cloudinary and returns its URL.
 *
 * `uid` is optional and only used for a readable folder hint. The unsigned
 * preset decides the final public id and delivery format.
 */
export async function uploadThumbnail(file, uid = '') {
  if (!file) throw fail('image_missing', 'Choose an image first.');
  const folder = uid ? `openlearnhub/thumbnails/${String(uid).slice(0, 120)}` : '';
  const result = await uploadCloudinaryImage(file, { folder });
  return result.url;
}
