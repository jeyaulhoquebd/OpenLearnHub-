/**
 * Segmented tabs with proper ARIA roles.
 *
 * items: [{ key, label, icon?: Component, badge?: string|number }]
 */
export default function Tabs({ items = [], value, onChange, ariaLabel, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-sand-200 bg-surface p-1 shadow-soft ${className}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-navy-900 text-white shadow-sm dark:bg-accent-500'
                : 'text-ink-soft hover:bg-sand-100 hover:text-ink'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {item.label}
            {item.badge != null && item.badge !== 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-sand-100 text-ink-muted'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
