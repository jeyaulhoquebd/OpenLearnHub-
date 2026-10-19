import { usePageMeta } from '../../../hooks/usePageMeta';

/**
 * Standard heading block for every admin page: title, optional description and
 * a slot for page-level actions. Also keeps `document.title` in sync so each
 * admin screen is identifiable in the browser tab.
 */
export default function PageHeader({ eyebrow, title, description, actions, children }) {
  usePageMeta(title);

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
