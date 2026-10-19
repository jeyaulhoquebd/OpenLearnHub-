import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Flag, Sparkles } from 'lucide-react';
import { TYPE_META } from '../lib/constants';
import ResourceVisual from './ResourceVisual';
import BookmarkButton from './BookmarkButton';
import ReportModal from './ReportModal';
import StarRating from './StarRating';
import { localized, truncate } from '../lib/utils';

export default function ResourceCard({ resource, compact = false }) {
  const { t, i18n } = useTranslation();
  const [reportOpen, setReportOpen] = useState(false);
  const meta = TYPE_META[resource.type] || TYPE_META.course;
  const title = localized(resource.title, i18n.language);
  const description = localized(resource.description, i18n.language);

  return (
    <>
      <article className="group card card-hover flex flex-col overflow-hidden">
        <Link
          to={`/resource/${resource.id}`}
          className={`block ${compact ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <ResourceVisual resource={resource} className="h-full w-full" />
        </Link>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${meta.chip}`}>{t(meta.labelKey)}</span>
            {resource.featured && (
              <span className="chip bg-accent-500/10 text-accent-700 ring-accent-400/30 dark:text-accent-200">
                <Sparkles className="h-3 w-3" />
                {t('common.verified')}
              </span>
            )}
            {resource.ratingCount > 0 && (
              <span className="ms-auto">
                <StarRating value={resource.ratingAvg} count={resource.ratingCount} size="sm" />
              </span>
            )}
          </div>

          <p className="mt-3 line-clamp-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {resource.sourceName}
          </p>

          <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink">
            <Link to={`/resource/${resource.id}`} className="transition hover:text-brand-800">
              {title}
            </Link>
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {truncate(description, compact ? 100 : 145)}
          </p>

          {!compact && resource.tags?.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {resource.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-5">
            <Link
              to={`/resource/${resource.id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 transition hover:text-brand-950"
            >
              {t('common.learnMore')}
              <span className="sr-only">: {title}</span>
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <div className="flex items-center gap-1.5">
              <BookmarkButton resource={resource} />
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center rounded-full border border-sand-300 bg-surface px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm transition hover:border-amber-300 hover:text-amber-700"
                aria-label={t('resource.report')}
                title={t('resource.report')}
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </article>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} resource={resource} />
    </>
  );
}
