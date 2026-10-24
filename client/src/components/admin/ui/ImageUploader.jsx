import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DEFAULT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Thumbnail picker with drag-and-drop and a live preview.
 *
 * Uploading is intentionally not handled here: the component validates the
 * file and hands it to the caller (`onFile`), which is where the Cloudinary
 * upload lives. `value` is the currently saved preview URL.
 */
export default function ImageUploader({
  value = '',
  onFile,
  onRemove,
  accept = DEFAULT_TYPES.join(','),
  maxSizeMB = 2,
  allowedTypes = DEFAULT_TYPES,
  loading = false,
  disabled = false,
  hint,
  className = ''
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const shown = preview || value;

  function validate(file) {
    if (!file) return false;
    if (allowedTypes.length && !allowedTypes.includes(file.type)) {
      setError(t('admin.ui.imageTypeError'));
      return false;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(t('admin.ui.imageSizeError', { size: maxSizeMB }));
      return false;
    }
    setError('');
    return true;
  }

  function pick(file) {
    if (!file || disabled) return;
    if (!validate(file)) return;
    setPreview(URL.createObjectURL(file));
    onFile?.(file);
  }

  function handleInput(event) {
    pick(event.target.files?.[0]);
    // Allow re-selecting the same file after an error.
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0]);
  }

  function handleRemove() {
    setPreview('');
    setError('');
    onRemove?.();
  }

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex min-h-[9.5rem] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging
            ? 'border-accent-500 bg-accent-50/60 dark:bg-accent-500/10'
            : 'border-sand-300 bg-sand-50'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {shown ? (
          <>
            <img
              src={shown}
              alt={t('admin.ui.imagePreview')}
              className="max-h-36 w-auto rounded-xl object-cover shadow-soft"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-navy-950/70 to-transparent p-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || loading}
                className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-white"
              >
                {t('admin.ui.change')}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || loading}
                className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-white"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.ui.remove')}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-ink-muted shadow-sm">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-sand-300 bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-brand-300"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              {loading ? t('admin.ui.uploading') : t('admin.ui.upload')}
            </button>
            <p className="text-[11px] leading-relaxed text-ink-muted">{t('admin.ui.dropHint')}</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInput}
          disabled={disabled || loading}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          {hint || t('admin.ui.imageHint', { size: maxSizeMB })}
        </p>
      )}
    </div>
  );
}
