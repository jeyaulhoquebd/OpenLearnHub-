import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MailCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  XCircle
} from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import EmptyState from '../components/EmptyState';
import { ResourceGridSkeleton } from '../components/LoadingStates';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { fetchBookmarks, fetchUserSubmissions } from '../lib/data';
import { formatDate, initials } from '../lib/utils';

const STATUS_META = {
  pending: { icon: Clock3, className: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30', key: 'dashboard.statusPending' },
  published: { icon: CheckCircle2, className: 'bg-brand-50 text-brand-800 ring-brand-200', key: 'dashboard.statusPublished' },
  rejected: { icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30', key: 'dashboard.statusRejected' }
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, profile, isAdmin, resendVerification, reloadUser } = useAuth();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'saved';
  const [bookmarks, setBookmarks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  usePageMeta(t('dashboard.title', { name: profile?.displayName || user?.displayName || '' }));

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Learner';

  useEffect(() => {
    let active = true;
    if (!user) return undefined;
    setLoading(true);
    Promise.all([fetchBookmarks(user.uid), fetchUserSubmissions(user.uid)])
      .then(([saved, submitted]) => {
        if (!active) return;
        setBookmarks(saved);
        setSubmissions(submitted);
      })
      .catch((error) => {
        console.warn('[dashboard]', error);
        if (active) {
          setBookmarks([]);
          setSubmissions([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const stats = useMemo(
    () => [
      { label: t('dashboard.saved'), value: bookmarks.length, icon: Bookmark, tab: 'saved' },
      { label: t('dashboard.submissions'), value: submissions.length, icon: UploadCloud, tab: 'submissions' },
      { label: t('dashboard.profile'), value: user?.emailVerified ? t('common.verified') : '—', icon: UserRound, tab: 'profile' }
    ],
    [bookmarks.length, submissions.length, t, user?.emailVerified]
  );

  function setTab(tab) {
    const next = new URLSearchParams(params);
    if (tab === 'saved') next.delete('tab');
    else next.set('tab', tab);
    setParams(next, { replace: true });
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendVerification();
      await reloadUser();
      push(t('dashboard.resent'));
    } catch {
      push(t('auth.genericError'), { type: 'error' });
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-white to-amber-50/50 pb-10 pt-10 dark:via-transparent dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="container-page relative">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-navy-900 font-display text-xl font-semibold text-white shadow-soft">
                {initials(displayName)}
              </span>
              <div>
                <p className="eyebrow">
                  <span className="h-px w-7 bg-navy-500" />
                  {t('dashboard.eyebrow')}
                </p>
                <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  {t('dashboard.title', { name: displayName.split(' ')[0] })}
                </h1>
                <p className="mt-1.5 text-sm text-ink-soft">{t('dashboard.subtitle')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/explore" className="btn-secondary">
                <LayoutDashboard className="h-4 w-4" />
                {t('dashboard.browse')}
              </Link>
              <Link to="/submit" className="btn-primary">
                <Plus className="h-4 w-4" />
                {t('dashboard.submit')}
              </Link>
            </div>
          </div>

          {user && !user.emailVerified && (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-2.5">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t('dashboard.verifyTitle')}</p>
                  <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-200">
                    {t('dashboard.verifyText', { email: user.email })}
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleResend} disabled={resending} className="btn-secondary btn-sm shrink-0">
                {t('dashboard.resend')}
              </button>
            </div>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <button
                  type="button"
                  key={stat.label}
                  onClick={() => setTab(stat.tab)}
                  className={`flex items-center gap-4 rounded-2xl border bg-white/90 p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-card dark:bg-white/5 ${
                    activeTab === stat.tab ? 'border-brand-300 ring-1 ring-brand-200' : 'border-sand-200'
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold text-ink">{stat.value}</p>
                    <p className="text-xs font-medium text-ink-muted">{stat.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-9">
        <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 pb-1">
          {[
            { key: 'saved', label: t('dashboard.saved'), count: bookmarks.length },
            { key: 'submissions', label: t('dashboard.submissions'), count: submissions.length },
            { key: 'profile', label: t('dashboard.profile') }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTab(tab.key)}
              className={`relative rounded-t-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.key ? 'text-brand-800' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="ms-1.5 rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] text-ink-muted">{tab.count}</span>
              )}
              {activeTab === tab.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-navy-700" />}
            </button>
          ))}
        </div>

        <div className="mt-7">
          {activeTab === 'saved' && (
            loading ? (
              <ResourceGridSkeleton count={3} />
            ) : bookmarks.length ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {bookmarks.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} compact />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Bookmark}
                title={t('dashboard.emptySavedTitle')}
                text={t('dashboard.emptySavedText')}
                action={
                  <Link to="/explore" className="btn-primary">
                    {t('dashboard.browse')}
                  </Link>
                }
              />
            )
          )}

          {activeTab === 'submissions' && (
            loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="skeleton h-24 w-full" />
                ))}
              </div>
            ) : submissions.length ? (
              <div className="space-y-3">
                {submissions.map((resource) => {
                  const status = STATUS_META[resource.status] || STATUS_META.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div key={resource.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`chip ${status.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {t(status.key)}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                            {resource.type}
                          </span>
                        </div>
                        <h2 className="mt-2 truncate font-display text-lg font-semibold text-ink">{resource.title}</h2>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {t('dashboard.submittedOn', { date: formatDate(resource.createdAt, i18n.language) })}
                          {resource.provider ? ` · ${resource.provider}` : ''}
                        </p>
                        {resource.reviewNote && (
                          <p className="mt-2 text-xs text-ink-soft">{resource.reviewNote}</p>
                        )}
                      </div>
                      <Link to={`/resource/${resource.id}`} className="btn-secondary btn-sm shrink-0">
                        {t('dashboard.viewResource')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={UploadCloud}
                title={t('dashboard.emptySubmissionsTitle')}
                text={t('dashboard.emptySubmissionsText')}
                action={
                  <Link to="/submit" className="btn-primary">
                    {t('dashboard.submit')}
                  </Link>
                }
              />
            )
          )}

          {activeTab === 'profile' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink">{t('dashboard.profile')}</h2>
                    <p className="text-xs text-ink-muted">{t('common.legal')}</p>
                  </div>
                </div>
                <dl className="mt-6 divide-y divide-sand-100 text-sm">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink-muted">{t('auth.displayName')}</dt>
                    <dd className="font-semibold text-ink">{displayName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink-muted">{t('auth.email')}</dt>
                    <dd className="truncate font-semibold text-ink">{user?.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink-muted">{t('common.verified')}</dt>
                    <dd className="flex items-center gap-1.5 font-semibold text-ink">
                      {user?.emailVerified ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-brand-600" />
                          {t('common.verified')}
                        </>
                      ) : (
                        <>
                          <Clock3 className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                          {t('dashboard.statusPending')}
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink-muted">Role</dt>
                    <dd className="font-semibold capitalize text-ink">{isAdmin ? 'Administrator' : 'Learner'}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4">
                {isAdmin && (
                  <div className="rounded-3xl border border-brand-200 bg-brand-50/70 p-6">
                    <ShieldCheck className="h-6 w-6 text-brand-700" />
                    <h2 className="mt-3 font-display text-xl font-semibold text-brand-950">{t('dashboard.adminTitle')}</h2>
                    <p className="mt-1.5 text-sm text-brand-900/70">{t('dashboard.adminText')}</p>
                    <Link to="/admin" className="btn-primary mt-4">
                      {t('dashboard.openAdmin')}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}

                <div className="rounded-3xl border border-sand-200 bg-surface p-6 shadow-sm">
                  <Sparkles className="h-6 w-6 text-accent-500" />
                  <h2 className="mt-3 font-display text-xl font-semibold text-ink">{t('assistant.title')}</h2>
                  <p className="mt-1.5 text-sm text-ink-soft">{t('assistant.pageText')}</p>
                  <Link to="/assistant" className="btn-secondary mt-4">
                    {t('assistant.name')}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
