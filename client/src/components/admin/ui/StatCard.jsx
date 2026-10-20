import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

const TONES = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-200',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  slate: 'bg-sand-100 text-ink-soft'
};

const TRENDS = {
  up: {
    icon: TrendingUp,
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
  },
  down: {
    icon: TrendingDown,
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
  },
  warning: {
    icon: TrendingUp,
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
  },
  neutral: { icon: Minus, className: 'bg-sand-100 text-ink-muted' }
};

/**
 * Compact metric card used on the admin dashboard and summary rows.
 *
 * `trend` is optional and rendered as a small pill under the number:
 *   { label: '+12 in 7 days', direction: 'up' | 'down' | 'warning' | 'neutral' }
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'brand',
  trend = null,
  loading = false,
  className = ''
}) {
  const trendStyle = trend ? TRENDS[trend.direction] || TRENDS.neutral : null;
  const TrendIcon = trendStyle?.icon;

  return (
    <div className={`rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold leading-none text-ink">
            {loading ? <span className="skeleton inline-block h-7 w-14 align-middle" /> : value}
          </p>

          {loading && trend ? (
            <span className="skeleton mt-2.5 inline-block h-4 w-24 rounded-full" />
          ) : trend?.label ? (
            <p
              className={`mt-2.5 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trendStyle.className}`}
            >
              {TrendIcon && <TrendIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{trend.label}</span>
            </p>
          ) : null}

          {hint && <p className="mt-2 text-xs leading-relaxed text-ink-muted">{hint}</p>}
        </div>

        {Icon && (
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              TONES[tone] || TONES.brand
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
