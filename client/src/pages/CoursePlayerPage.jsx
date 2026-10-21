import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  ExternalLink,
  Globe2,
  Languages,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Youtube
} from 'lucide-react';
import CoursePlayer from '../components/CoursePlayer';
import ProgressControl from '../components/ProgressControl';
import ResourceCard from '../components/ResourceCard';
import ReviewSection from '../components/ReviewSection';
import EmptyState from '../components/EmptyState';
import { PageLoader } from '../components/LoadingStates';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { useResources } from '../hooks/useResources';
import { fetchResourceById, getRelatedResources } from '../lib/data';
import { COUNTRY_FLAGS } from '../lib/constants';
import { localized } from '../lib/utils';

/**
 * Focused on-site course player for admin-created YouTube playlist courses.
 * The same player also appears on the normal resource detail page; this route
 * removes the marketing chrome around it for learners who want to study.
 */
export default function CoursePlayerPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { isAdmin, user } = useAuth();
  const { resources } = useResources();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);

  const localizedTitle = localized(resource?.title, i18n.language);
  const localizedDescription = localized(resource?.description, i18n.language);
  const localizedLongDescription =
    localized(resource?.longDescription, i18n.language) || localizedDescription;

  usePageMeta(
    localizedTitle ? `${localizedTitle} — ${t('youtubeCourse.playerTitle')}` : t('youtubeCourse.loading'),
    localizedDescription
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchResourceById(id)
      .then((item) => {
        if (active) {
          setResource(item);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.warn('[course-player]', error);
        if (active) {
          setResource(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const related = useMemo(
    () =>
      getRelatedResources(resources, resource, 6)
        .filter((item) => item.type === 'course')
        .slice(0, 3),
    [resources, resource]
  );

  if (loading) return <PageLoader label={t('youtubeCourse.loading')} />;

  if (!resource) {
    return (
      <div className="container-page section">
        <EmptyState
          title={t('youtubeCourse.notFoundTitle')}
          text={t('youtubeCourse.notFoundText')}
          action={
            <Link to="/courses" className="btn-primary">
              {t('resource.back')}
            </Link>
          }
        />
      </div>
    );
  }

  const isPending = resource.status && resource.status !== 'published';
  const canPreview = isAdmin || (user?.uid && resource.createdBy === user.uid);
  if (isPending && !canPreview) {
    return (
      <div className="container-page section">
        <EmptyState
          title={t('youtubeCourse.notFoundTitle')}
          text={t('youtubeCourse.notFoundText')}
          action={
            <Link to="/courses" className="btn-primary">
              {t('resource.back')}
            </Link>
          }
        />
      </div>
    );
  }

  // A non-YouTube resource should use the normal detail page instead.
  if (!resource.youtubePlaylistId) {
    return <Navigate to={`/resource/${resource.id}`} replace />;
  }

  const externalUrl = resource.sourceUrl;

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-navy-950 pb-10 pt-8 text-white sm:pb-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
        <div className="pointer-events-none absolute -end-28 -top-28 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="container-page relative">
          <Link
            to={`/resource/${resource.id}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-navy-100/75 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('youtubeCourse.backToCourse')}
          </Link>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-inset ring-white/20">
                  <Youtube className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('youtubeCourse.adminBadge')}
                </span>
                {resource.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-100 ring-1 ring-inset ring-accent-300/30">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t('common.verified')}
                  </span>
                )}
                {resource.level && (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-navy-100/80">
                    {resource.level}
                  </span>
                )}
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-navy-200/70">
                {resource.sourceName}
              </p>
              <h1 className="mt-2 max-w-4xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {localizedTitle}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-navy-100/75 sm:text-base">
                {localizedDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('youtubeCourse.watchOnYouTube')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <CoursePlayer resource={resource} />

            <div className="card p-6 sm:p-8">
              <h2 className="font-display text-2xl font-semibold text-ink">
                {t('youtubeCourse.courseAbout')}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-ink-soft">
                {(localizedLongDescription || '')
                  .split('\n')
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>

              {resource.tags?.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-sand-100 pt-5">
                  {resource.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/explore?q=${encodeURIComponent(tag)}`}
                      className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-800"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-brand-200 bg-brand-50/60 p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm ring-1 ring-brand-100">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-brand-950">{t('youtubeCourse.verifiedNote')}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-900/75">
                    {t('youtubeCourse.playerNote')}
                  </p>
                </div>
              </div>
            </div>

            <ReviewSection resourceId={resource.id} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <h2 className="text-sm font-bold text-ink">{t('youtubeCourse.courseDetails')}</h2>
              <dl className="mt-4 divide-y divide-sand-100 text-sm">
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Youtube className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('youtubeCourse.sourceLabel')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.sourceName}</dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.category')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.category}</dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.level')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.level}</dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.languages')}
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5 ps-7">
                    {(resource.languages || []).map((language) => (
                      <span
                        key={language}
                        className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft"
                      >
                        {language}
                      </span>
                    ))}
                  </dd>
                </div>
                {resource.countries?.length > 0 && (
                  <div className="py-3">
                    <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('resource.regions')}
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5 ps-7">
                      {resource.countries.map((country) => (
                        <span
                          key={country}
                          className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft"
                        >
                          <span aria-hidden="true">{COUNTRY_FLAGS[country]}</span>
                          {country}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.license')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.license}</dd>
                </div>
              </dl>

              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full justify-center"
              >
                {t('youtubeCourse.watchOnYouTube')}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                {t('resource.officialSource')}
              </p>
            </div>

            <ProgressControl resourceId={resource.id} />
            <p className="rounded-2xl border border-sand-200 bg-surface px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
              <PlayCircle className="me-1.5 inline h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              {t('youtubeCourse.progressHint')}
            </p>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                {t('youtubeCourse.relatedCourses')}
              </h2>
              <Link to="/courses" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                {t('common.viewAll')}
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <ResourceCard key={item.id} resource={item} compact />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
