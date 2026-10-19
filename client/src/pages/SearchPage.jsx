import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search as SearchIcon, X } from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import { ResourceGridSkeleton } from '../components/LoadingStates';
import EmptyState from '../components/EmptyState';
import { useResources } from '../hooks/useResources';
import { usePageMeta } from '../hooks/usePageMeta';
import { TYPE_META } from '../lib/constants';
import { filterResources, paginate } from '../lib/data';

const TYPES = ['all', 'course', 'book', 'software'];

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const { resources, loading, error, reload } = useResources();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [draft, setDraft] = useState(query);

  usePageMeta(t('search.title'), t('search.subtitle'));

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const results = useMemo(
    () =>
      query.trim()
        ? filterResources(resources, { query, uiLanguage: i18n.language, sort: 'recommended' })
        : [],
    [resources, query, i18n.language]
  );

  const counts = useMemo(
    () =>
      TYPES.reduce((acc, type) => {
        acc[type] = type === 'all' ? results.length : results.filter((item) => item.type === type).length;
        return acc;
      }, {}),
    [results]
  );

  const activeType = params.get('type') || 'all';
  const filtered = activeType === 'all' ? results : results.filter((item) => item.type === activeType);
  const paged = paginate(filtered, Number(params.get('page')) || 1, 12);

  function submit(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draft.trim()) next.set('q', draft.trim());
    setParams(next, { replace: true });
  }

  function setType(type) {
    const next = new URLSearchParams(params);
    if (type === 'all') next.delete('type');
    else next.set('type', type);
    next.delete('page');
    setParams(next, { replace: true });
  }

  function goToPage(target) {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete('page');
    else next.set('page', String(target));
    setParams(next, { replace: true });
  }

  const tabClass = (active) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
      active ? 'bg-navy-900 text-white shadow-sm' : 'bg-surface text-ink-soft ring-1 ring-inset ring-sand-300 hover:text-brand-800'
    }`;

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-sand-50 to-amber-50/60 pb-10 pt-10 sm:pb-12 dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.28]" />
        <div className="container-page relative">
          <h1 className="display-title max-w-3xl">{t('search.title')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
            {t('search.subtitle')}
          </p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-2 rounded-[1.4rem] border border-sand-200 bg-surface p-2 shadow-soft sm:flex-row sm:items-center" role="search">
            <div className="flex flex-1 items-center gap-2.5 px-3">
              <SearchIcon className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full border-0 bg-transparent py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
                aria-label={t('search.placeholder')}
              />
              {draft && (
                <button
                  type="button"
                  onClick={() => setDraft('')}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
                  aria-label={t('common.close')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button type="submit" className="btn-primary shrink-0 justify-center px-6 py-3.5">
              {t('common.search')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      <section className="container-page py-8 sm:py-10">
        {!query.trim() ? (
          <EmptyState
            icon={SearchIcon}
            title={t('search.emptyPromptTitle')}
            text={t('search.emptyPromptText')}
            action={
              <Link to="/explore" className="btn-primary">
                {t('common.browseAll')}
              </Link>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {TYPES.map((type) => (
                <button key={type} type="button" onClick={() => setType(type)} className={tabClass(activeType === type)}>
                  {type === 'all' ? t('common.all') : t(TYPE_META[type].labelKey)}
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/15">
                    {counts[type] || 0}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-5 text-sm text-ink-muted">
              {t('search.resultsFor', { count: filtered.length, query })}
            </p>

            <div className="mt-5">
              {loading ? (
                <ResourceGridSkeleton count={6} />
              ) : error ? (
                <EmptyState
                  title={t('explore.errorTitle')}
                  text={t('explore.errorText')}
                  action={
                    <button type="button" onClick={reload} className="btn-primary">
                      {t('common.retry')}
                    </button>
                  }
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={SearchIcon}
                  title={t('search.emptyTitle')}
                  text={t('search.emptyText')}
                  action={
                    <Link to="/explore" className="btn-primary">
                      {t('search.browseInstead')}
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {paged.items.map((resource) => (
                      <ResourceCard key={resource.id} resource={resource} />
                    ))}
                  </div>

                  {paged.pageCount > 1 && (
                    <nav className="mt-9 flex items-center justify-center gap-1.5" aria-label={t('explore.pagination')}>
                      <button
                        type="button"
                        onClick={() => goToPage(paged.page - 1)}
                        disabled={paged.page <= 1}
                        className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('explore.previous')}
                      </button>
                      {Array.from({ length: paged.pageCount }, (_, index) => index + 1).map((number) => (
                        <button
                          key={number}
                          type="button"
                          onClick={() => goToPage(number)}
                          aria-current={number === paged.page ? 'page' : undefined}
                          className={`grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm font-semibold transition ${
                            number === paged.page
                              ? 'bg-navy-900 text-white'
                              : 'border border-sand-300 bg-surface text-ink-soft hover:border-brand-300 hover:text-brand-800'
                          }`}
                        >
                          {number}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => goToPage(paged.page + 1)}
                        disabled={paged.page >= paged.pageCount}
                        className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('explore.next')}
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
