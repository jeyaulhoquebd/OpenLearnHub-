import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ExternalLink,
  Pencil,
  ShieldAlert,
  Users
} from 'lucide-react';
import ReportReasonBadge from './ReportReasonBadge';
import { isIllegalReason } from './reportMeta';
import { formatDate, localized } from '../../../lib/utils';

/**
 * One report in the Kanban board. The title opens the detail drawer; the
 * footer links jump to the public page or the resource editor. Legal reports
 * get a rose ring + priority pill so they stand out in every column.
 */
export default function ReportCard({ report, onOpen }) {
  const { t, i18n } = useTranslation();
  const illegal = isIllegalReason(report.reason);

  const title =
    localized(report.resource?.title || report.resourceTitle, i18n.language) ||
    report.resourceId ||
    t('admin.reportQueue.drawer.resourceMissing');

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 shadow-soft transition hover:shadow-float ${
        illegal
          ? 'border-rose-300 ring-1 ring-rose-200 dark:border-rose-500/40 dark:ring-rose-500/20'
          : 'border-sand-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <ReportReasonBadge reason={report.reason} />
        {illegal && (
          <span className="chip bg-rose-600 text-white ring-rose-600">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.reportQueue.card.priority')}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(report)}
        className="mt-3 block w-full text-start font-display text-sm font-semibold leading-snug text-ink transition hover:text-brand-700 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:text-brand-300"
        dir="auto"
      >
        {title}
      </button>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-soft" dir="auto">
        {report.details || t('admin.reportQueue.drawer.noMessage')}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {formatDate(report.createdAt, i18n.language)}
        </span>
        {report.similarCount > 1 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {t('admin.reportQueue.card.similar', { count: report.similarCount })}
          </span>
        )}
      </div>

      <p className="mt-1.5 truncate text-[11px] text-ink-muted" dir="ltr">
        {report.reporterEmail || t('admin.reportQueue.card.anonymous')}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-sand-100 pt-2.5">
        <button
          type="button"
          onClick={() => onOpen(report)}
          className="text-xs font-semibold text-brand-700 transition hover:underline dark:text-brand-300"
        >
          {t('admin.reportQueue.card.open')}
        </button>

        {report.resourceId && report.resource && (
          <div className="flex items-center gap-1">
            <Link
              to={`/resource/${report.resourceId}`}
              target="_blank"
              rel="noreferrer"
              className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
              aria-label={t('admin.reportQueue.actions.openResource')}
              title={t('admin.reportQueue.actions.openResource')}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              to={`/admin/resources/${report.resourceId}/edit`}
              className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
              aria-label={t('admin.reportQueue.actions.editResource')}
              title={t('admin.reportQueue.actions.editResource')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
