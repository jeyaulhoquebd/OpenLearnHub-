const TONES = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-200',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  slate: 'bg-sand-100 text-ink-soft'
};

/**
 * Compact metric card used on the admin dashboard and summary rows.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'brand',
  loading = false,
  className = ''
}) {
  return (
    <div className={`rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold leading-none text-ink">
            {loading ? <span className="skeleton inline-block h-7 w-14 align-middle" /> : value}
          </p>
          {hint && <p className="mt-2 text-xs leading-relaxed text-ink-muted">{hint}</p>}
        </div>
        {Icon && (
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONES[tone] || TONES.brand}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
