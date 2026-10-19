import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  X
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/admin/ui/PageHeader';
import StatCard from '../../components/admin/ui/StatCard';
import Tabs from '../../components/admin/ui/Tabs';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminCounts,
  fetchPendingResources,
  fetchReports,
  markReportResolved,
  updateResourceStatus
} from '../../lib/data';
import { getAdminMe } from '../../lib/api';
import { invalidateResourceCache } from '../../lib/resourceCache';
import { REPORT_REASONS, TYPE_META } from '../../lib/constants';
import { formatDate, localized } from '../../lib/utils';

/**
 * Admin dashboard: headline numbers, the submission queue, the report queue and
 * a card confirming the caller's admin claim (verified by the API, not just the
 * client).
 */
export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({ resources: 0, pending: 0, reports: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      // No session (e.g. the demo/preview build): never leave the UI spinning.
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [pendingItems, reportItems, countItems] = await Promise.all([
        fetchPendingResources(),
        fetchReports(),
        fetchAdminCounts()
      ]);
      setPending(pendingItems);
      setReports(reportItems);
      setCounts(countItems);
    } catch (error) {
      console.warn('[admin-dashboard]', error);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, push, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Server-side confirmation of the admin claim (GET /api/admin/me).
  useEffect(() => {
    let active = true;
    if (!user) return undefined;

    (async () => {
      try {
        const token = await user.getIdToken();
        const payload = await getAdminMe(token);
        if (active) {
          setMe(payload?.admin || null);
          setMeError('');
        }
      } catch (error) {
        console.warn('[admin-dashboard] /api/admin/me unavailable:', error?.message);
        if (active) setMeError(error?.message || t('admin.dashboard.meError'));
      }
    })();

    return () => {
      active = false;
    };
  }, [user, t]);

  const openReports = useMemo(
    () => reports.filter((report) => report.status !== 'resolved'),
    [reports]
  );

  async function handleApprove(resource) {
    setBusyId(resource.id);
    try {
      await updateResourceStatus({ id: resource.id, status: 'published', reviewerUid: user.uid });
      setPending((items) => items.filter((item) => item.id !== resource.id));
      setCounts((current) => ({
        ...current,
        pending: Math.max(0, current.pending - 1),
        resources: current.resources + 1
      }));
      invalidateResourceCache();
      push(t('admin.approveSuccess'));
    } catch (error) {
      console.warn('[admin-approve]', error);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(resource) {
    setBusyId(resource.id);
    try {
      await updateResourceStatus({
        id: resource.id,
        status: 'rejected',
        reviewerUid: user.uid,
        reviewNote: t('admin.rejectSuccess')
      });
      setPending((items) => items.filter((item) => item.id !== resource.id));
      setCounts((current) => ({ ...current, pending: Math.max(0, current.pending - 1) }));
      push(t('admin.rejectSuccess'), { type: 'info' });
    } catch (error) {
      console.warn('[admin-reject]', error);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setBusyId(null);
      setRejectTarget(null);
    }
  }

  async function handleResolve(report) {
    setBusyId(report.id);
    try {
      await markReportResolved({ id: report.id, reviewerUid: user.uid });
      setReports((items) =>
        items.map((item) => (item.id === report.id ? { ...item, status: 'resolved' } : item))
      );
      setCounts((current) => ({ ...current, reports: Math.max(0, current.reports - 1) }));
      push(t('admin.resolveSuccess'));
    } catch (error) {
      console.warn('[admin-resolve]', error);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  function reasonLabel(value) {
    const reason = REPORT_REASONS.find((item) => item.value === value);
    return reason ? t(reason.labelKey) : value;
  }

  const displayName = me?.name || user?.displayName || user?.email || '';

  return (
    <>
      <PageHeader
        eyebrow={t('admin.eyebrow')}
        title={t('admin.dashboard.title')}
        description={t('admin.dashboard.description')}
        actions={
          <>
            <Link to="/admin/ai" className="btn-secondary btn-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t('adminAi.title')}
            </Link>
            <button type="button" onClick={load} disabled={loading} className="btn-primary btn-sm">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('admin.refresh')}
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Star}
          tone="brand"
          label={t('admin.published')}
          value={counts.resources}
          loading={loading}
        />
        <StatCard
          icon={Clock3}
          tone="amber"
          label={t('admin.pending')}
          value={pending.length}
          loading={loading}
        />
        <StatCard
          icon={Flag}
          tone="rose"
          label={t('admin.openReports')}
          value={openReports.length}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs
              ariaLabel={t('admin.dashboard.queueLabel')}
              value={tab}
              onChange={setTab}
              items={[
                { key: 'pending', label: t('admin.pending'), icon: Clock3, badge: pending.length },
                { key: 'reports', label: t('admin.reports'), icon: Flag, badge: openReports.length }
              ]}
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="skeleton h-40 w-full rounded-2xl" />
              ))}
            </div>
          ) : tab === 'pending' ? (
            pending.length ? (
              <div className="space-y-4">
                {pending.map((resource) => {
                  const meta = TYPE_META[resource.type] || TYPE_META.course;
                  return (
                    <article key={resource.id} className="card p-5 sm:p-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`chip ${meta.chip}`}>{t(meta.labelKey)}</span>
                            <span className="chip bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                              <Clock3 className="h-3 w-3" aria-hidden="true" />
                              {t('dashboard.statusPending')}
                            </span>
                          </div>
                          <h2 className="mt-3 font-display text-xl font-semibold text-ink">
                            {localized(resource.title, i18n.language)}
                          </h2>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            {resource.sourceName} · {resource.category} · {resource.level}
                          </p>
                          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                            {localized(resource.description, i18n.language)}
                          </p>

                          <div className="mt-4 grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
                            <p className="flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                              {resource.license}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                              {t('admin.submittedOn')}: {formatDate(resource.createdAt, i18n.language)}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                              {t('admin.submittedBy')}: {resource.creatorEmail || resource.createdBy}
                            </p>
                          </div>

                          {resource.sourceUrl && (
                            <a
                              href={resource.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{resource.sourceUrl}</span>
                            </a>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                          <button
                            type="button"
                            onClick={() => handleApprove(resource)}
                            disabled={busyId === resource.id}
                            className="btn-primary btn-sm justify-center"
                          >
                            {busyId === resource.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Check className="h-4 w-4" aria-hidden="true" />
                            )}
                            {t('admin.approve')}
                          </button>
                          <Link to={`/resource/${resource.id}`} className="btn-secondary btn-sm justify-center">
                            {t('admin.reviewLink')}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(resource)}
                            disabled={busyId === resource.id}
                            className="btn btn-sm justify-center border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            {t('admin.reject')}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={t('admin.noPendingTitle')}
                text={t('admin.noPendingText')}
              />
            )
          ) : reports.length ? (
            <div className="space-y-4">
              {reports.map((report) => (
                <article key={report.id} className="card p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`chip ${
                            report.status === 'resolved'
                              ? 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30'
                              : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
                          }`}
                        >
                          {report.status === 'resolved' ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {report.status === 'resolved' ? t('admin.resolved') : t('admin.open')}
                        </span>
                        <span className="chip bg-sand-100 text-ink-soft ring-sand-200">
                          {reasonLabel(report.reason)}
                        </span>
                      </div>

                      <h2 className="mt-3 font-display text-lg font-semibold text-ink">
                        {report.resourceTitle || report.resourceId}
                      </h2>
                      {report.details && (
                        <p className="mt-2 rounded-2xl bg-sand-50 px-4 py-3 text-sm leading-relaxed text-ink-soft">
                          {report.details}
                        </p>
                      )}
                      <div className="mt-3 grid gap-1.5 text-xs text-ink-muted sm:grid-cols-2">
                        <p>
                          {t('admin.reporter')}:{' '}
                          {report.reporterEmail || report.reporterUid || t('admin.anonymous')}
                        </p>
                        <p>
                          {t('admin.submittedOn')}: {formatDate(report.createdAt, i18n.language)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                      {report.resourceId && (
                        <Link
                          to={`/resource/${report.resourceId}`}
                          className="btn-secondary btn-sm justify-center"
                        >
                          {t('admin.resource')}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      )}
                      {report.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleResolve(report)}
                          disabled={busyId === report.id}
                          className="btn-primary btn-sm justify-center"
                        >
                          {busyId === report.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          )}
                          {t('admin.resolve')}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={Flag} title={t('admin.noReportsTitle')} text={t('admin.noReportsText')} />
          )}
        </section>

        <aside className="rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <BadgeCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
            {t('admin.dashboard.yourAccess')}
          </p>

          <p className="mt-3 truncate font-display text-lg font-semibold text-ink">
            {displayName || '—'}
          </p>
          <p className="truncate text-xs text-ink-muted">{me?.email || user?.email}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {t('admin.dashboard.claimActive')}
            </span>
            {me?.providers?.map((provider) => (
              <span key={provider} className="chip bg-sand-100 text-ink-soft ring-sand-200">
                {provider}
              </span>
            ))}
          </div>

          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-muted">{t('admin.dashboard.lastSignIn')}</dt>
              <dd className="text-ink-soft">{me?.lastSignInAt ? formatDate(me.lastSignInAt, i18n.language) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-muted">{t('admin.dashboard.accountId')}</dt>
              <dd className="max-w-[10rem] truncate font-mono text-[11px] text-ink-soft">{user?.uid}</dd>
            </div>
          </dl>

          {meError && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {t('admin.dashboard.meOffline')}
            </p>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title={t('admin.reject')}
        message={t('admin.confirmReject')}
        confirmLabel={t('admin.reject')}
        loading={busyId === rejectTarget?.id}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && handleReject(rejectTarget)}
      />
    </>
  );
}
