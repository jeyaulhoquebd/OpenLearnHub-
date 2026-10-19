import { useTranslation } from 'react-i18next';

const STYLES = {
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  draft: 'bg-sand-100 text-ink-soft ring-sand-300',
  pending: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  flagged: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  resolved: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30',
  open: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  suspended: 'bg-sand-100 text-ink-muted ring-sand-300',
  unknown: 'bg-sand-100 text-ink-muted ring-sand-300'
};

/**
 * Small pill for resource/report/user statuses. The label is looked up under
 * `admin.status.*`, falling back to the raw value for unexpected statuses.
 */
export default function StatusBadge({ status, className = '', showDot = true }) {
  const { t } = useTranslation();
  const key = String(status || 'unknown').toLowerCase();
  const style = STYLES[key] || STYLES.unknown;

  return (
    <span className={`chip ${style} ${className}`}>
      {showDot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {t(`admin.status.${key}`, { defaultValue: status || '—' })}
    </span>
  );
}
