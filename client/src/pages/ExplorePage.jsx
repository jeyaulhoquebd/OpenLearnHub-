import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  FilterX,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import { ResourceGridSkeleton } from '../components/LoadingStates';
import EmptyState from '../components/EmptyState';
import { useResources } from '../hooks/useResources';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  CATEGORIES,
  COUNTRIES,
  LANGUAGES,
  LEVELS,
  PLATFORMS,
  SORT_OPTIONS,
  TYPE_META
} from '../lib/constants';
import { filterResources } from '../lib/data';

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input appearance-none py-2.5 pe-9 text-sm"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      </div>
    </label>
  );
}

export default function ExplorePage({ fixedType = null }) {
  const { t } = useTranslation();
  const { resources, loading, error, reload } = useResources();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = {
    query: params.get('q') || '',
    type: fixedType || params.get('type') || 'all',
    category: params.get('category') || 'all',
    level: params.get('level') || 'all',
    language: params.get('language') || 'all',
    country: params.get('country') || 'all',
    platform: params.get('platform') || 'all',
    sort: params.get('sort') || 'recommended'
  };

  const meta = fixedType ? TYPE_META[fixedType] : null;
  const title = fixedType
    ? {
        course: t('explore.coursesTitle'),
        book: t('explore.booksTitle'),
        software: t('explore.softwareTitle')
      }[fixedType]
    : t('explore.title');
  const subtitle = fixedType
    ? {
        course: t('explore.coursesSubtitle'),
        book: t('explore.booksSubtitle'),
        software: t('explore.softwareSubtitle')
      }[fixedType]
    : t('explore.subtitle');

  usePageMeta(title, subtitle);

  const filtered = useMemo(() => filterResources(resources, filters), [resources, params, fixedType]);

  const activeFilterCount = ['category', 'level', 'language', 'country', 'platform'].filter(
    (key) => params.get(key) && params.get(key) !== 'all'
  ).length;

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || (key === 'q' && !value.trim())) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (fixedType) next.set('type', fixedType);
    if (params.get('q')) next.set('q', params.get('q'));
    setParams(next, { replace: true });
  }

  const tabClass = (active) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
      active ? 'bg-navy-900 text-white shadow-sm' : 'bg-surface text-ink-soft ring-1 ring-inset ring-sand-300 hover:text-brand-800'
    }`;

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-sand-50 to-amber-50/60 pb-10 pt-10 sm:pb-12 sm:pt-14 dark:to-accent-500/10">
        <div className="pointer-events-none absolute -end-24 -top-28 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.28]" />
        <div className="container-page relative">
          <nav className="flex items-center gap-2 text-xs font-medium text-ink-muted" aria-label={t('explore.breadcrumb')}>
            <Link to="/" className="hover:text-brand-800">
              {t('common.home')}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink">{meta ? t(meta.labelKey) : t('nav.explore')}</span>
          </nav>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <span className="eyebrow">
                <span className="h-px w-7 bg-navy-500" />
                {t('explore.eyebrow')}
              </span>
              <h1 className="display-title mt-3">{title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{subtitle}</p>
            </div>
            <div className="hidden items-center gap-2 rounded-2xl border border-brand-200 bg-white/80 px-4 py-3 text-xs font-semibold text-brand-800 shadow-sm backdrop-blur lg:flex dark:bg-white/10">
              <Sparkles className="h-4 w-4" />
              {loading ? t('common.loading') : t('common.results', { count: filtered.length })}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Link to="/explore" className={tabClass(!fixedType)}>
              {t('common.all')}
            </Link>
            {Object.entries(TYPE_META).map(([type, typeMeta]) => (
              <Link key={type} to={`/${type === 'course' ? 'courses' : type === 'book' ? 'books' : 'software'}`} className={tabClass(fixedType === type)}>
                {t(typeMeta.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr] xl:grid-cols-[17rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                className="btn-secondary"
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {filtersOpen ? t('explore.hideFilters') : t('explore.filters')}
                {activeFilterCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-navy-800 px-1 text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="text-xs font-semibold text-brand-700">
                  {t('explore.clearAll')}
                </button>
              )}
            </div>

            <div
              className={`mt-4 rounded-3xl border border-sand-200 bg-surface p-5 shadow-sm lg:mt-0 lg:block ${
                filtersOpen ? 'block' : 'hidden'
              }`}
            >
              <div className="hidden items-center justify-between lg:flex">
                <h2 className="text-sm font-bold text-ink">{t('explore.filters')}</h2>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('explore.clearAll')}
                </button>
              </div>

              <div className="mt-4 space-y-4 lg:mt-5">
                {!fixedType && (
                  <FilterSelect label={t('submit.typeLabel')} value={filters.type} onChange={(value) => setFilter('type', value)}>
                    <option value="all">{t('common.all')}</option>
                    {Object.entries(TYPE_META).map(([type, typeMeta]) => (
                      <option key={type} value={type}>
                        {t(typeMeta.labelKey)}
                      </option>
                    ))}
                  </FilterSelect>
                )}

                <FilterSelect label={t('explore.category')} value={filters.category} onChange={(value) => setFilter('category', value)}>
                  <option value="all">{t('filters.allCategories')}</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect label={t('explore.level')} value={filters.level} onChange={(value) => setFilter('level', value)}>
                  <option value="all">{t('filters.allLevels')}</option>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect label={t('explore.language')} value={filters.language} onChange={(value) => setFilter('language', value)}>
                  <option value="all">{t('filters.allLanguages')}</option>
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect label={t('explore.country')} value={filters.country} onChange={(value) => setFilter('country', value)}>
                  <option value="all">{t('filters.allCountries')}</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </FilterSelect>

                {(!fixedType || fixedType === 'software') && (
                  <FilterSelect label={t('explore.platform')} value={filters.platform} onChange={(value) => setFilter('platform', value)}>
                    <option value="all">{t('filters.allPlatforms')}</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </FilterSelect>
                )}

                <div className="hidden border-t border-sand-100 pt-4 lg:block">
                  <div className="rounded-2xl bg-brand-50/70 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('home.legalEyebrow')}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-brand-900/80">
                      {t('home.trust')}
                    </p>
                    <Link to="/legal/copyright" className="mt-2 inline-block text-[11px] font-semibold text-brand-700 underline underline-offset-2">
                      {t('home.readPolicy')}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 lg:hidden">
                <button type="button" onClick={clearFilters} className="btn-secondary btn-sm">
                  <FilterX className="h-4 w-4" />
                  {t('explore.clearAll')}
                </button>
                <button type="button" onClick={() => setFiltersOpen(false)} className="btn-primary btn-sm">
                  {t('common.close')}
                </button>
              </div>
            </div>
          </aside>

          <div>
            <h2 className="sr-only">{t('explore.resultsTitle')}</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(event) => setFilter('q', event.target.value)}
                  placeholder={t('explore.searchPlaceholder')}
                  className="input py-3 ps-11"
                  aria-label={t('explore.searchPlaceholder')}
                />
                {filters.query && (
                  <button
                    type="button"
                    onClick={() => setFilter('q', '')}
                    className="absolute end-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
                    aria-label={t('common.close')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="relative shrink-0">
                <select
                  value={filters.sort}
                  onChange={(event) => setFilter('sort', event.target.value)}
                  className="input appearance-none py-3 pe-9 text-sm"
                  aria-label={t('explore.sort')}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">
                  {loading ? '—' : t('common.results', { count: filtered.length })}
                </span>
              </p>
              {filters.query && !loading && (
                <p className="truncate text-xs text-ink-muted">
                  “{filters.query}”
                </p>
              )}
            </div>

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
                  title={t('explore.emptyTitle')}
                  text={t('explore.emptyText')}
                  action={
                    <button type="button" onClick={clearFilters} className="btn-primary">
                      {t('explore.clearAll')}
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
