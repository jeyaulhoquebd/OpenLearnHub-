import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  Check,
  ExternalLink,
  Flag,
  Globe2,
  Languages,
  Layers3,
  Monitor,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound
} from 'lucide-react';
import ResourceVisual from '../components/ResourceVisual';
import BookmarkButton from '../components/BookmarkButton';
import ReportModal from '../components/ReportModal';
import ResourceCard from '../components/ResourceCard';
import { PageLoader } from '../components/LoadingStates';
import EmptyState from '../components/EmptyState';
import { useResources } from '../hooks/useResources';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { fetchResourceById, getRelatedResources } from '../lib/data';
import { COUNTRY_FLAGS, TYPE_META } from '../lib/constants';
import { formatDate } from '../lib/utils';

export default function ResourceDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { push } = useToast();
  const { isAdmin, user } = useAuth();
  const { resources } = useResources();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  usePageMeta(resource?.title || t('common.loading'), resource?.description);

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
        console.warn('[resource]', error);
        if (active) {
          setResource(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const related = useMemo(() => getRelatedResources(resources, resource, 3), [resources, resource]);

  if (loading) {
    return <PageLoader label={t('resource.loading')} />;
  }

  if (!resource) {
    return (
      <div className="container-page section">
        <EmptyState
          title={t('resource.notFoundTitle')}
          text={t('resource.notFoundText')}
          action={
            <Link to="/explore" className="btn-primary">
              {t('resource.back')}
            </Link>
          }
        />
      </div>
    );
  }

  const meta = TYPE_META[resource.type] || TYPE_META.course;
  const isPending = resource.status && resource.status !== 'published';
  const canPreview = isAdmin || (user?.uid && resource.createdBy === user.uid);
  if (isPending && !canPreview) {
    return (
      <div className="container-page section">
        <EmptyState
          title={t('resource.notFoundTitle')}
          text={t('resource.notFoundText')}
          action={
            <Link to="/explore" className="btn-primary">
              {t('resource.back')}
            </Link>
          }
        />
      </div>
    );
  }

  const actionLabel = {
    course: t('resource.visitCourse'),
    book: t('resource.readBook'),
    software: t('resource.downloadSoftware')
  }[resource.type];

  const typeNote = {
    course: t('resource.courseNote'),
    book: t('resource.bookNote'),
    software: t('resource.softwareNote')
  }[resource.type];

  async function handleShare() {
    const shareUrl = `${window.location.origin}/resource/${resource.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: resource.title, text: resource.description, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        push(t('common.copied'));
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        push(t('common.error'), { type: 'error' });
      }
    }
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-surface pb-10 pt-8 sm:pb-14">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
        <div className="pointer-events-none absolute -end-32 -top-32 h-96 w-96 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="container-page relative">
          <Link
            to={resource.type === 'course' ? '/courses' : resource.type === 'book' ? '/books' : '/software'}
            className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted transition hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('resource.back')}
          </Link>

          <div className="mt-7 grid gap-9 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${meta.chip}`}>{t(meta.labelKey)}</span>
                <span className="badge-legal">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('common.legal')}
                </span>
                {resource.featured && (
                  <span className="chip bg-accent-500/10 text-accent-700 ring-accent-400/30 dark:text-accent-200">
                    <Sparkles className="h-3 w-3" />
                    {t('common.verified')}
                  </span>
                )}
                {isPending && (
                  <span className="chip bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">{t('resource.underReview')}</span>
                )}
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
                {resource.provider}
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                {resource.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
                {resource.description}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  {actionLabel}
                </a>
                <BookmarkButton resource={resource} labelPosition="full" className="px-4 py-3" />
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-surface px-4 py-3 text-sm font-semibold text-ink-soft shadow-sm transition hover:border-brand-300 hover:text-brand-800"
                >
                  <Share2 className="h-4 w-4" />
                  {t('resource.share')}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-surface px-4 py-3 text-sm font-semibold text-ink-muted shadow-sm transition hover:border-amber-300 hover:text-amber-700"
                >
                  <Flag className="h-4 w-4" />
                  {t('common.report')}
                </button>
              </div>

              <p className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-muted">
                <BadgeCheck className="h-4 w-4 text-brand-600" />
                {t('resource.officialSource')} · {t('resource.lastVerified')}{' '}
                {formatDate(resource.lastVerified, 'en')}
              </p>
            </div>

            <ResourceVisual resource={resource} className="aspect-[16/11] w-full rounded-[2rem] shadow-float" />
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <div className="card p-6 sm:p-8">
              <h2 className="font-display text-2xl font-semibold text-ink">{t('resource.aboutTitle')}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-ink-soft">
                {(resource.longDescription || resource.description).split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {resource.tags?.length > 0 && (
                <div className="mt-7 border-t border-sand-100 pt-5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
                    <Tag className="h-3.5 w-3.5" />
                    {t('resource.tags')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
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
                </div>
              )}
            </div>

            <div className="mt-5 rounded-3xl border border-brand-200 bg-brand-50/60 p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm ring-1 ring-brand-100">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-brand-950">{t('resource.legalOfficial')}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-900/75">{typeNote}</p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <Link to="/legal/copyright" className="text-xs font-semibold text-brand-700 underline underline-offset-2">
                      {t('footer.copyright')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="text-xs font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-300"
                    >
                      {t('resource.copyrightConcern')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <h2 className="text-sm font-bold text-ink">{t('resource.detailsTitle')}</h2>
              <dl className="mt-4 divide-y divide-sand-100 text-sm">
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.provider')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.provider}</dd>
                </div>
                {resource.author && (
                  <div className="py-3">
                    <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('resource.author')}
                    </dt>
                    <dd className="mt-1 ps-7 font-medium text-ink">{resource.author}</dd>
                  </div>
                )}
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
                    {resource.languages?.map((language) => (
                      <span key={language} className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        {language}
                      </span>
                    ))}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.regions')}
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5 ps-7">
                    {resource.countries?.map((country) => (
                      <span key={country} className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        <span aria-hidden="true">{COUNTRY_FLAGS[country]}</span>
                        {country}
                      </span>
                    ))}
                  </dd>
                </div>
                {resource.platform?.length > 0 && (
                  <div className="py-3">
                    <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('resource.platforms')}
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5 ps-7">
                      {resource.platform.map((platform) => (
                        <span key={platform} className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                          {platform}
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
                  <dd className="mt-1 ps-7 font-medium text-ink">
                    {resource.license}
                    {resource.licenseUrl && (
                      <a
                        href={resource.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-700 underline underline-offset-2"
                      >
                        {t('resource.viewLicense')}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </dd>
                </div>
              </dl>

              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full justify-center"
              >
                {actionLabel}
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                {t('resource.officialSource')}
              </p>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t('resource.related')}</h2>
              <Link to="/explore" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                {t('common.viewAll')}
                <span className="sr-only">: {t('resource.related')}</span>
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

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} resource={resource} />
    </>
  );
}
