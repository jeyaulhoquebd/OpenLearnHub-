import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Star,
  X
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  fetchAdminCounts,
  fetchPendingResources,
  fetchReports,
  markReportResolved,
  updateResourceStatus
} from '../lib/data';
import { invalidateResourceCache } from '../lib/resourceCache';
import { REPORT_REASONS, TYPE_META } from '../lib/constants';
import { formatDate, localized } from '../lib/utils';

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({ resources: 0, pending: 0, reports: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  usePageMeta(t('admin.title'));

  const load = useCallback(async () => {
    if (!user) return;
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
      console.warn('[admin]', error);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, push, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openReports = useMemo(() => reports.filter((report) => report.status !== 'resolved'), [reports]);

  async function handleApprove(resource) {
    setBusyId(resource.id);
    try {
      await updateResourceStatus({ id: resource.id, status: 'published', reviewerUid: user.uid });
      setPending((items) => items.filter((item) => item.id !== resource.id));
      setCounts((current) => ({ ...current, pending: Math.max(0, current.pending - 1), resources: current.resources + 1 }));
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
    if (!window.confirm(t('admin.confirmReject'))) return;
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

  const statCards = [
    { label: t('admin.published'), value: counts.resources, icon: Star, color: 'bg-brand-50 text-brand-700' },
    { label: t('admin.pending'), value: pending.length, icon: Clock3, color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    { label: t('admin.openReports'), value: openReports.length, icon: Flag, color: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' }
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-navy-950 pb-10 pt-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
        <div className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full bg-navy-500/20 blur-3xl" />
        <div className="container-page relative">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="chip bg-white/10 text-white ring-white/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('admin.eyebrow')}
              </span>
              <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{t('admin.title')}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy-100/75">{t('admin.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="btn shrink-0 border border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('admin.refresh')}
            </button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold">{loading ? '—' : stat.value}</p>
                    <p className="text-xs text-navy-100/70">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-9">
        <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 pb-1">
          {[
            { key: 'pending', label: t('admin.pending'), count: pending.length },
            { key: 'reports', label: t('admin.reports'), count: openReports.length }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`relative rounded-t-xl px-4 py-3 text-sm font-semibold transition ${
                tab === item.key ? 'text-brand-800' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
              <span className="ms-1.5 rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] text-ink-muted">{item.count}</span>
              {tab === item.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-navy-700" />}
            </button>
          ))}
        </div>

        <div className="mt-7">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="skeleton h-40 w-full" />
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
                              <Clock3 className="h-3 w-3" />
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
                              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                              {resource.license}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              {t('admin.submittedOn')}: {formatDate(resource.createdAt, i18n.language)}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              {t('admin.submittedBy')}: {resource.creatorEmail || resource.createdBy}
                            </p>
                          </div>

                          <a
                            href={resource.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold text-brand-700 underline underline-offset-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{resource.sourceUrl}</span>
                          </a>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                          <button
                            type="button"
                            onClick={() => handleApprove(resource)}
                            disabled={busyId === resource.id}
                            className="btn-primary btn-sm justify-center"
                          >
                            {busyId === resource.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {t('admin.approve')}
                          </button>
                          <Link to={`/resource/${resource.id}`} className="btn-secondary btn-sm justify-center">
                            {t('admin.reviewLink')}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleReject(resource)}
                            disabled={busyId === resource.id}
                            className="btn btn-sm justify-center border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                          >
                            <X className="h-4 w-4" />
                            {t('admin.reject')}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title={t('admin.noPendingTitle')} text={t('admin.noPendingText')} />
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
                              ? 'bg-brand-50 text-brand-800 ring-brand-200'
                              : 'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}
                        >
                          {report.status === 'resolved' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {report.status === 'resolved' ? t('admin.resolved') : t('admin.open')}
                        </span>
                        <span className="chip bg-sand-100 text-ink-soft ring-sand-200">{reasonLabel(report.reason)}</span>
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
                          {t('admin.reporter')}: {report.reporterEmail || report.reporterUid || t('admin.anonymous')}
                        </p>
                        <p>
                          {t('admin.submittedOn')}: {formatDate(report.createdAt, i18n.language)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                      {report.resourceId && (
                        <Link to={`/resource/${report.resourceId}`} className="btn-secondary btn-sm justify-center">
                          {t('admin.resource')}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {report.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleResolve(report)}
                          disabled={busyId === report.id}
                          className="btn-primary btn-sm justify-center"
                        >
                          {busyId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
        </div>
      </section>
    </>
  );
}
