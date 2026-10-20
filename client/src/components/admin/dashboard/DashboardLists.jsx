import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Clock3,
  Eye,
  Flag,
  FolderPlus,
  Inbox,
  Link2,
  Loader2,
  Plus,
  Star,
  Upload
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { REPORT_REASONS, TYPE_META } from '../../../lib/constants';
import { formatDate, formatNumber, localized, monogram } from '../../../lib/utils';

/**
 * Presentational blocks for the admin dashboard: top-resource lists, the latest
 * reports/reviews, the submission queue and the quick-actions row.
 *
 * Every block is a self-contained card so the page only has to arrange them in
 * a grid. All copy goes through i18next and all dates/numbers use the active
 * locale, so the cards mirror correctly in Urdu (RTL).
 */

function Panel({ icon: Icon, title, subtitle, action, children, className = '' }) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function Thumbnail({ resource, size = 'h-12 w-12' }) {
  const meta = TYPE_META[resource.type] || TYPE_META.course;

  return (
    <span
      className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br ${meta.gradient} text-[11px] font-bold tracking-wide text-white`}
    >
      <span aria-hidden="true">{monogram(resource.title)}</span>
      {resource.thumbnailUrl && (
        <img
          src={resource.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
}

function EmptyRow({ icon: Icon = Inbox, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sand-200 px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-ink-muted" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}

/**
 * "Most viewed" / "Most saved" ranked list.
 *
 * @param {'views'|'saves'} metric – which counter to show on the right.
 */
export function TopResourcesCard({ title, subtitle, items = [], metric = 'views' }) {
  const { t, i18n } = useTranslation();
  const Icon = metric === 'saves' ? Bookmark : Eye;
  const MetricIcon = Icon;

  return (
    <Panel icon={Icon} title={title} subtitle={subtitle}>
      {items.length ? (
        <ol className="space-y-1">
          {items.map((resource, index) => {
            const count = metric === 'saves' ? resource.saveCount : resource.viewCount;
            return (
              <li key={resource.id}>
                <Link
                  to={`/resource/${resource.id}`}
                  className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-sand-50 dark:hover:bg-white/5"
                >
                  <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-ink-muted">
                    {index + 1}
                  </span>
                  <Thumbnail resource={resource} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink transition group-hover:text-brand-700 dark:group-hover:text-brand-300">
                      {localized(resource.title, i18n.language) || resource.id}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-muted">
                      <span className="truncate">{resource.sourceName || '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">
                        {t(TYPE_META[resource.type]?.labelKey || 'type.course')}
                      </span>
                    </span>
                  </span>
                  <span className="chip shrink-0 bg-sand-100 text-ink-soft ring-sand-200">
                    <MetricIcon className="h-3 w-3" aria-hidden="true" />
                    {formatNumber(count, i18n.language)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyRow icon={Icon} text={t('admin.dashboard.noTopText')} />
      )}
    </Panel>
  );
}

function reasonLabel(value, t) {
  const reason = REPORT_REASONS.find((item) => item.value === value);
  return reason ? t(reason.labelKey) : value;
}

/** Newest community reports with Review / Resolve quick actions. */
export function LatestReportsCard({ reports = [], busyId, onResolve }) {
  const { t, i18n } = useTranslation();

  return (
    <Panel
      icon={Flag}
      title={t('admin.dashboard.latestReportsTitle')}
      subtitle={t('admin.dashboard.latestReportsSubtitle')}
      action={
        <Link to="/admin/reports" className="btn-ghost btn-sm shrink-0">
          {t('admin.dashboard.viewAll')}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {reports.length ? (
        <ul className="space-y-2.5">
          {reports.map((report) => {
            const resolved = report.status === 'resolved';
            return (
              <li key={report.id} className="rounded-xl border border-sand-200 p-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      resolved
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}
                  >
                    <Flag className="h-4 w-4" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {localized(report.resourceTitle, i18n.language) || report.resourceId}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
                      <span className="truncate">{reasonLabel(report.reason, t)}</span>
                      {report.createdAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">{formatDate(report.createdAt, i18n.language)}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <StatusBadge status={report.status} showDot={false} className="shrink-0" />
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {report.resourceId && (
                    <Link to={`/resource/${report.resourceId}`} className="btn-secondary btn-sm">
                      {t('admin.dashboard.review')}
                    </Link>
                  )}
                  {!resolved && (
                    <button
                      type="button"
                      onClick={() => onResolve?.(report)}
                      disabled={busyId === report.id}
                      className="btn-primary btn-sm"
                    >
                      {busyId === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t('admin.dashboard.resolve')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyRow icon={Flag} text={t('admin.dashboard.noReports')} />
      )}
    </Panel>
  );
}

function Stars({ rating }) {
  const rounded = Math.round(Number(rating) || 0);

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rounded}/5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-3 w-3 ${
            value <= rounded ? 'fill-amber-400 text-amber-400' : 'text-sand-300 dark:text-sand-300'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** Newest reviews across the whole library. */
export function LatestReviewsCard({ reviews = [] }) {
  const { t, i18n } = useTranslation();

  return (
    <Panel
      icon={Star}
      title={t('admin.dashboard.latestReviewsTitle')}
      subtitle={t('admin.dashboard.latestReviewsSubtitle')}
      action={
        <Link to="/admin/reviews" className="btn-ghost btn-sm shrink-0">
          {t('admin.dashboard.viewAll')}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {reviews.length ? (
        <ul className="space-y-2.5">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-sand-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {review.authorName || t('admin.dashboard.anonymousReviewer')}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {review.createdAt ? formatDate(review.createdAt, i18n.language) : '—'}
                  </p>
                </div>
                <Stars rating={review.rating} />
              </div>

              {review.body && (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-soft">{review.body}</p>
              )}

              {review.resourceId && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Link to={`/resource/${review.resourceId}`} className="btn-secondary btn-sm">
                    {t('admin.dashboard.review')}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                    {localized(review.resourceTitle, i18n.language) || review.resourceId}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyRow icon={Star} text={t('admin.dashboard.noReviews')} />
      )}
    </Panel>
  );
}

/** Compact community-submission queue kept from the first dashboard version. */
export function PendingSubmissionsCard({ items = [], busyId, onApprove, onReject }) {
  const { t, i18n } = useTranslation();

  return (
    <Panel
      icon={Clock3}
      title={t('admin.dashboard.pendingTitle')}
      subtitle={t('admin.dashboard.pendingSubtitle')}
      action={
        items.length > 0 && (
          <span className="chip shrink-0 bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            {formatNumber(items.length, i18n.language)}
          </span>
        )
      }
    >
      {items.length ? (
        <ul className="space-y-2.5">
          {items.slice(0, 4).map((resource) => (
            <li key={resource.id} className="rounded-xl border border-sand-200 p-3">
              <div className="flex items-start gap-2.5">
                <Thumbnail resource={resource} size="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {localized(resource.title, i18n.language) || resource.id}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {resource.sourceName || resource.creatorEmail || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onApprove?.(resource)}
                  disabled={busyId === resource.id}
                  className="btn-primary btn-sm"
                >
                  {busyId === resource.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {t('admin.dashboard.approve')}
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(resource)}
                  disabled={busyId === resource.id}
                  className="btn btn-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                >
                  {t('admin.reject')}
                </button>
                <Link to={`/resource/${resource.id}`} className="btn-ghost btn-sm">
                  {t('admin.dashboard.review')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyRow icon={Inbox} text={t('admin.dashboard.pendingEmpty')} />
      )}
    </Panel>
  );
}

const QUICK_ACTIONS = [
  {
    to: '/admin/resources',
    icon: Plus,
    labelKey: 'admin.dashboard.actions.addResource',
    hintKey: 'admin.dashboard.actions.addResourceHint'
  },
  {
    to: '/admin/categories',
    icon: FolderPlus,
    labelKey: 'admin.dashboard.actions.addCategory',
    hintKey: 'admin.dashboard.actions.addCategoryHint'
  },
  {
    to: '/admin/link-checker',
    icon: Link2,
    labelKey: 'admin.dashboard.actions.linkChecker',
    hintKey: 'admin.dashboard.actions.linkCheckerHint'
  },
  {
    to: '/admin/import-export',
    icon: Upload,
    labelKey: 'admin.dashboard.actions.import',
    hintKey: 'admin.dashboard.actions.importHint'
  }
];

/** Four shortcut tiles to the tools admins reach for most. */
export function QuickActions({ actions = QUICK_ACTIONS }) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="admin-quick-actions" className="mt-6">
      <div className="mb-3">
        <h2 id="admin-quick-actions" className="font-display text-base font-semibold text-ink">
          {t('admin.dashboard.quickActions')}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{t('admin.dashboard.quickActionsSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-start gap-3 rounded-2xl border border-sand-200 bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-float"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{t(action.labelKey)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  {t(action.hintKey)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
