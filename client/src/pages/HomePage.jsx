import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookMarked,
  BookOpen,
  Briefcase,
  Check,
  Code2,
  GraduationCap,
  Globe2,
  Palette,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles
} from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import ResourceVisual from '../components/ResourceVisual';
import { ResourceGridSkeleton } from '../components/LoadingStates';
import { useResources } from '../hooks/useResources';
import { usePageMeta } from '../hooks/usePageMeta';
import { COUNTRY_FLAGS, TYPE_META } from '../lib/constants';
import { getRelatedResources } from '../lib/data';

const CATEGORY_CARDS = [
  { name: 'Computer Science', icon: Code2, color: 'bg-brand-50 text-brand-700 ring-brand-100' },
  { name: 'Web Development', icon: Globe2, color: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25' },
  { name: 'Data Science', icon: BarChart3, color: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25' },
  { name: 'Design & Creative', icon: Palette, color: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25' },
  { name: 'Business & Career', icon: Briefcase, color: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25' },
  { name: 'School & College', icon: GraduationCap, color: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25' },
  { name: 'Digital Skills', icon: Smartphone, color: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25' },
  { name: 'Literature', icon: BookMarked, color: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25' }
];

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resources, loading } = useResources();
  const [search, setSearch] = useState('');
  usePageMeta(null, t('home.description'));

  const featured = useMemo(() => resources.filter((resource) => resource.featured).slice(0, 6), [resources]);
  const heroCourses = useMemo(() => resources.filter((item) => item.type === 'course').slice(0, 1), [resources]);
  const heroBook = useMemo(() => resources.filter((item) => item.type === 'book').slice(0, 1), [resources]);
  const heroSoftware = useMemo(() => resources.filter((item) => item.type === 'software').slice(0, 1), [resources]);
  const featuredCourse = heroCourses[0] || featured[0];
  const featuredBook = heroBook[0];
  const featuredSoftware = heroSoftware[0];

  const categoryCounts = useMemo(() => {
    return resources.reduce((acc, resource) => {
      acc[resource.category] = (acc[resource.category] || 0) + 1;
      return acc;
    }, {});
  }, [resources]);

  const related = useMemo(() => getRelatedResources(resources, featuredCourse, 4), [resources, featuredCourse]);

  function handleSearch(event) {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/explore?q=${encodeURIComponent(term)}` : '/explore');
  }

  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-10 sm:pb-16 sm:pt-16">
        <div className="pointer-events-none absolute -end-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -start-40 top-64 h-[28rem] w-[28rem] rounded-full bg-accent-100/50 blur-3xl dark:bg-accent-500/10" />
        <div className="container-page relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-brand-800 shadow-sm backdrop-blur animate-fade-up dark:bg-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-navy-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-navy-600" />
                </span>
                {t('home.badge')}
              </div>

              <h1 className="mt-6 font-display text-[2.85rem] font-semibold leading-[0.98] tracking-[-0.03em] text-ink sm:text-6xl lg:text-[4.5rem] animate-fade-up animation-delay-150">
                {t('home.title')}{' '}
                <span className="relative inline-block italic text-brand-700">
                  {t('home.titleAccent')}
                  <svg
                    viewBox="0 0 220 12"
                    className="absolute -bottom-2 start-0 h-2.5 w-[92%] text-accent-400/70"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M2 9C45 3 148 2 218 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg animate-fade-up animation-delay-300">
                {t('home.description')}
              </p>

              <form
                onSubmit={handleSearch}
                className="mt-7 flex flex-col gap-2 rounded-[1.4rem] border border-sand-200 bg-surface p-2 shadow-soft sm:flex-row sm:items-center animate-fade-up animation-delay-450"
                role="search"
              >
                <div className="flex flex-1 items-center gap-2.5 px-3">
                  <Search className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('home.searchPlaceholder')}
                    className="w-full border-0 bg-transparent py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
                    aria-label={t('home.searchPlaceholder')}
                  />
                </div>
                <button type="submit" className="btn-primary shrink-0 justify-center px-6 py-3.5">
                  {t('home.searchButton')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="font-semibold">{t('home.popular')}</span>
                {['Python', 'Data Science', 'Design', 'Mathematics'].map((term) => (
                  <Link
                    key={term}
                    to={`/explore?q=${encodeURIComponent(term)}`}
                    className="rounded-full border border-sand-200 bg-white/70 px-3 py-1 font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-800 dark:bg-white/10"
                  >
                    {term}
                  </Link>
                ))}
              </div>

              <p className="mt-7 flex items-start gap-2 text-xs font-medium leading-relaxed text-brand-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {t('home.trust')}
              </p>
            </div>

            <div className="relative mx-auto hidden min-h-[470px] w-full max-w-md lg:block">
              <div className="absolute inset-x-4 inset-y-4 overflow-hidden rounded-[2.75rem] bg-gradient-to-br from-navy-950 via-navy-800 to-navy-600 p-9 shadow-float">
                <div className="absolute inset-0 bg-grid opacity-20" />
                <div className="absolute -end-16 -top-12 h-56 w-56 rounded-full bg-navy-400/25 blur-2xl" />
                <div className="absolute -bottom-20 -start-16 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl" />
                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <span className="chip bg-white/10 text-white ring-white/20">
                      <Sparkles className="h-3 w-3" />
                      {t('home.badge')}
                    </span>
                    <p className="mt-8 max-w-[15rem] font-display text-4xl font-semibold leading-[1.08] text-white">
                      Learn without limits.
                    </p>
                    <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-navy-100/85">
                      Courses, books, and tools that respect your budget and the people who made them.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      {['BD', 'IN', 'PK'].map((code, index) => (
                        <span
                          key={code}
                          className={`grid h-9 w-9 place-items-center rounded-full border-2 border-navy-800 text-[10px] font-bold text-white ${
                            index === 0 ? 'bg-accent-500' : index === 1 ? 'bg-amber-500 text-navy-950' : 'bg-navy-400 text-navy-950'
                          }`}
                        >
                          {code}
                        </span>
                      ))}
                      <span className="ms-1 text-[11px] font-medium text-navy-100/80">
                        Built for South Asia
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-200">
                        Zero piracy
                      </p>
                      <ShieldCheck className="h-4 w-4 text-navy-300" />
                    </div>
                  </div>
                </div>
              </div>

              {featuredCourse && (
                <Link
                  to={`/resource/${featuredCourse.id}`}
                  className="absolute -start-6 top-14 w-60 -rotate-3 overflow-hidden rounded-2xl border border-sand-200 bg-surface p-2 shadow-float transition duration-300 hover:rotate-0"
                >
                  <ResourceVisual resource={featuredCourse} className="h-20 rounded-xl" showIcon={false} />
                  <div className="px-2 pb-1 pt-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand-700">
                      {t(TYPE_META[featuredCourse.type].labelKey)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-ink">
                      {featuredCourse.title}
                    </p>
                  </div>
                </Link>
              )}

              {featuredBook && (
                <Link
                  to={`/resource/${featuredBook.id}`}
                  className="absolute -end-5 top-52 w-56 rotate-3 overflow-hidden rounded-2xl border border-sand-200 bg-surface p-3.5 shadow-float transition duration-300 hover:rotate-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                        {t('type.book')}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-ink">
                        {featuredBook.title}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2.5 flex items-center gap-1 border-t border-sand-100 pt-2 text-[10px] font-semibold text-brand-700">
                    <Check className="h-3 w-3" /> {featuredBook.license}
                  </p>
                </Link>
              )}

              {featuredSoftware && (
                <Link
                  to={`/resource/${featuredSoftware.id}`}
                  className="absolute -start-4 bottom-7 flex w-56 -rotate-1 items-center gap-3 rounded-2xl border border-sand-200 bg-surface p-3.5 shadow-float transition duration-300 hover:rotate-0"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-accent-700 dark:text-accent-300">
                      {t('type.software')}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs font-bold text-ink">{featuredSoftware.title}</p>
                    <p className="mt-0.5 text-[10px] text-ink-muted">{t('resource.officialDownload')}</p>
                  </div>
                </Link>
              )}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-sand-200 bg-sand-200 shadow-sm sm:grid-cols-4">
            {[
              { value: `${resources.length || '35'}`, label: t('home.statResources') },
              { value: '3', label: t('home.statCountries') },
              { value: '4', label: t('home.statLanguages') },
              { value: '0', label: t('home.statPiracy') }
            ].map((stat) => (
              <div key={stat.label} className="bg-surface px-5 py-5 text-center sm:px-6">
                <p className="font-display text-3xl font-semibold text-brand-800">{stat.value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-sand-200 bg-white/60 dark:bg-white/5">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">{t('home.sourcesTitle')}</p>
          {['Harvard', 'MIT OCW', 'Khan Academy', 'freeCodeCamp', 'OpenStax', 'NPTEL', 'Blender'].map((name) => (
            <span key={name} className="font-display text-sm font-semibold text-ink-soft/80">
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">
                <span className="h-px w-7 bg-navy-500" />
                {t('home.categoriesEyebrow')}
              </p>
              <h2 className="display-title mt-3">{t('home.categoriesTitle')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">{t('home.categoriesSubtitle')}</p>
            </div>
            <Link to="/explore" className="btn-secondary shrink-0">
              {t('common.browseAll')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_CARDS.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.name}
                  to={`/explore?category=${encodeURIComponent(category.name)}`}
                  className="group flex items-center gap-4 rounded-2xl border border-sand-200 bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ring-inset ${category.color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{category.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t('common.results', { count: categoryCounts[category.name] || 0 })}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-brand-700" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">
                <span className="h-px w-7 bg-accent-400" />
                {t('home.featuredEyebrow')}
              </p>
              <h2 className="display-title mt-3">{t('home.featuredTitle')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">{t('home.featuredSubtitle')}</p>
            </div>
            <Link to="/explore" className="btn-secondary shrink-0">
              {t('common.viewAll')}
              <span className="sr-only">: {t('home.featuredTitle')}</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-9">
            {loading ? (
              <ResourceGridSkeleton count={6} />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {(featured.length ? featured : resources.slice(0, 6)).map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            )}
          </div>

          {related.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-sand-200 bg-sand-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('home.moreToExplore')}</p>
              {related.map((resource) => (
                <Link
                  key={resource.id}
                  to={`/resource/${resource.id}`}
                  className="rounded-full border border-sand-200 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-800"
                >
                  {resource.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-navy-950 p-7 text-white sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-grid opacity-10" />
            <div className="absolute -end-24 -top-24 h-80 w-80 rounded-full bg-navy-500/20 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.35fr] lg:items-center">
              <div>
                <p className="eyebrow text-navy-300">
                  <span className="h-px w-7 bg-navy-400" />
                  {t('home.regionalEyebrow')}
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  {t('home.regionalTitle')}
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-navy-100/75 sm:text-base">
                  {t('home.regionalSubtitle')}
                </p>
                <Link to="/about" className="btn mt-7 border border-white/20 bg-white/10 text-white hover:bg-white/15">
                  {t('home.readPolicy')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { country: 'Bangladesh', text: t('home.bangladeshText'), color: 'from-emerald-500/20 to-transparent' },
                  { country: 'India', text: t('home.indiaText'), color: 'from-amber-500/20 to-transparent' },
                  { country: 'Pakistan', text: t('home.pakistanText'), color: 'from-navy-400/20 to-transparent' }
                ].map((item) => (
                  <Link
                    key={item.country}
                    to={`/explore?country=${item.country}`}
                    className={`group rounded-2xl border border-white/15 bg-gradient-to-br ${item.color} p-5 transition hover:border-white/30 hover:bg-white/10`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {COUNTRY_FLAGS[item.country]}
                    </span>
                    <p className="mt-3 font-display text-lg font-semibold text-white">
                      {t(`home.${item.country.toLowerCase()}`)}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/65">{item.text}</p>
                    <p className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-navy-200">
                      {t('home.browseCountry', { country: t(`home.${item.country.toLowerCase()}`) })}
                      <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container-page grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow">
              <span className="h-px w-7 bg-navy-500" />
              {t('home.legalEyebrow')}
            </p>
            <h2 className="display-title mt-3">{t('home.legalTitle')}</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
              {t('home.legalDescription')}
            </p>
            <Link to="/legal/copyright" className="btn-secondary mt-7">
              <ShieldCheck className="h-4 w-4" />
              {t('home.readPolicy')}
            </Link>

            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-navy-800 text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-900">DMCA-ready</p>
                <p className="mt-0.5 text-xs leading-relaxed text-brand-900/80">
                  Clear takedown process, public reporting, and human review.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: t('home.legalPoint1Title'), text: t('home.legalPoint1Text'), icon: BookOpen },
              { title: t('home.legalPoint2Title'), text: t('home.legalPoint2Text'), icon: Code2 },
              { title: t('home.legalPoint3Title'), text: t('home.legalPoint3Text'), icon: ShieldCheck },
              { title: t('home.legalPoint4Title'), text: t('home.legalPoint4Text'), icon: Sparkles }
            ].map((point) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="rounded-2xl border border-sand-200 bg-sand-50/60 p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-brand-700 shadow-sm ring-1 ring-sand-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-ink">{point.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{point.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-amber-50 p-8 sm:p-12 dark:via-transparent dark:to-accent-500/10">
            <div className="absolute -end-16 -top-20 h-64 w-64 rounded-full bg-accent-400/15 blur-3xl" />
            <div className="relative grid gap-7 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div>
                <span className="badge-legal">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('submit.eyebrow')}
                </span>
                <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">{t('home.ctaTitle')}</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{t('home.ctaText')}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link to="/submit" className="btn-primary btn-lg justify-center">
                  {t('home.ctaButton')}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link to="/explore" className="btn-secondary btn-lg justify-center">
                  {t('home.browseLibrary')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
