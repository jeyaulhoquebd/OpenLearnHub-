import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl'
};

/**
 * Accessible modal dialog rendered in a portal.
 *
 * - Locks background scrolling while open.
 * - Closes on Escape and on overlay click.
 * - Moves focus into the dialog on open.
 * - Uses `aria-modal` + `aria-labelledby` so screen readers announce the title.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  id = 'admin-modal',
  className = ''
}) {
  const { t } = useTranslation();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);

    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus?.();
    }, 30);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-sand-200 bg-surface shadow-2xl animate-fade-up sm:rounded-3xl ${
          SIZES[size] || SIZES.md
        } ${className}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sand-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="font-display text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={`${id}-description`} className="mt-1 text-sm leading-relaxed text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-sand-100 hover:text-ink"
            aria-label={t('admin.ui.close')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {children ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        ) : null}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sand-200 bg-sand-50 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
