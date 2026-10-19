import { useTranslation } from 'react-i18next';

/**
 * Labelled form control wrapper used by admin forms.
 *
 * The child input keeps its own styling (`className="input"`); this component
 * adds the label, the optional marker, a hint, and an error message that is
 * announced to screen readers via `aria-live`.
 */
export default function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children
}) {
  const { t } = useTranslation();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}
          {required && (
            <span className="ms-1 text-rose-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {!required && (
          <span className="text-[11px] font-medium text-ink-muted">{t('admin.ui.optional')}</span>
        )}
      </div>

      <div className="mt-1.5">{children}</div>

      {error ? (
        <p
          id={describedBy}
          role="alert"
          className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
