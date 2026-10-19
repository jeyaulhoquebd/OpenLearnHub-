import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Side panel for contextual forms (filters, details, previews). Slides in from
 * the inline-end edge, so it mirrors automatically in Urdu (RTL).
 */
export default function Drawer({ open, onClose, title, description, children, footer, width = 'md' }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl' };

  return createPortal(
    <div className="fixed inset-0 z-[130]">
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
        className={`absolute inset-y-0 end-0 flex w-full flex-col border-s border-sand-200 bg-surface shadow-2xl animate-fade-up ${
          widths[width] || widths.md
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sand-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="admin-drawer-title" className="font-display text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
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

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sand-200 bg-sand-50 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
