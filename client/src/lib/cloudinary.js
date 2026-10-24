/**
 * Cloudinary image upload (unsigned).
 *
 * Only the cloud name and the unsigned upload preset are required in the
 * browser. The Cloudinary API secret must never be added to client code or to
 * a `VITE_*` environment variable.
 *
 * The preset is configured in the Cloudinary console with:
 *   overwrite: false, use filename: false, unique filename: false,
 *   use filename as display name: true, asset folder as public ID prefix: false,
 *   type: upload.
 */

const DEFAULT_CLOUD_NAME = 'y6fui3kz';
const DEFAULT_UPLOAD_PRESET = 'openlearnhub';

export const CLOUDINARY_CLOUD_NAME =
  String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim() || DEFAULT_CLOUD_NAME;
export const CLOUDINARY_UPLOAD_PRESET =
  String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim() || DEFAULT_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET
);

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

/**
 * Uploads one prepared image and returns its secure delivery URL.
 *
 * `folder` is optional. The preset controls overwrite / unique-filename /
 * display-name behaviour, so we do not send conflicting public_id settings.
 */
export async function uploadCloudinaryImage(file, { folder = '' } = {}) {
  if (!file) throw fail('cloudinary_missing', 'Choose an image first.');
  if (!isCloudinaryConfigured) {
    throw fail(
      'cloudinary_unavailable',
      'Image uploads are unavailable. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.'
    );
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (folder) form.append('folder', String(folder).replace(/^\/+|\/+$/g, ''));

  let response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/upload`,
      { method: 'POST', body: form }
    );
  } catch {
    throw fail('cloudinary_network', 'Cloudinary could not be reached. Check your connection.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.secure_url) {
    const message =
      payload?.error?.message ||
      (response.status === 401 || response.status === 403
        ? 'The Cloudinary upload preset rejected this upload.'
        : 'The image could not be uploaded to Cloudinary.');
    throw fail('cloudinary_upload_failed', message);
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id || '',
    format: payload.format || '',
    width: Number(payload.width) || 0,
    height: Number(payload.height) || 0,
    bytes: Number(payload.bytes) || 0,
    createdAt: payload.created_at || ''
  };
}
