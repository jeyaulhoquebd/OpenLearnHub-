import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  AppWindow,
  BookOpen,
  Flag,
  GraduationCap,
  Library,
  Loader2,
  RefreshCw,
  Sparkles,
  Users
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import StatCard from '../../components/admin/ui/StatCard';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import {
  BreakdownDonut,
  ChartCard,
  NewResourcesChart,
  NewUsersChart,
  PROVIDER_COLORS,
  TYPE_COLORS
} from '../../components/admin/dashboard/DashboardCharts';
import {
  LatestReportsCard,
  LatestReviewsCard,
  PendingSubmissionsCard,
  QuickActions,
  TopResourcesCard
} from '../../components/admin/dashboard/DashboardLists';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAdminStats, updateAdminReport } from '../../lib/api';
import { refreshAdminCounts } from '../../hooks/useAdminCounts';
import {
  fetchPendingResources,
  fetchPublishedResources,
  updateResourceStatus
} from '../../lib/data';
import { buildDemoStats } from '../../lib/demoStats';
import { isFirebaseConfigured } from '../../lib/firebase';
import { invalidateResourceCache } from '../../lib/resourceCache';
import { formatNumber } from '../../lib/utils';

/**
 * Admin dashboard.
 *
 * All headline numbers, series and activity feeds come from one cached API call
 * (`GET /api/admin/stats`). The submission queue still reads Firestore directly
 * because admins may read pending resources through the security rules.
 */
export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { push } = useToast();

  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const locale = i18n.language || 'en';
  const rtl = i18n.dir() === 'rtl';

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (force) setRefreshing(true);
      else setLoading(true);

      try {
        if (!user) {
          // Offline/preview build: no Firebase config, no API. Build a demo
          // payload. A configured build always has a user here (AdminRoute).
          if (!isFirebaseConfigured) {
            const resources = await fetchPublishedResources();
            setStats(buildDemoStats(resources));
          }
        } else {
          const token = await user.getIdToken();
          const payload = await getAdminStats(token, { refresh: force });
          setStats(payload);
        }
        setError(null);
      } catch (err) {
        console.warn('[admin-dashboard] stats', err);
        setError(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Submission queue — independent of the stats endpoint.
  useEffect(() => {
    let active = true;
    fetchPendingResources()
      .then((items) => {
        if (active) setPending(items);
      })
      .catch((err) => console.warn('[admin-dashboard] pending submissions', err));

    return () => {
      active = false;
    };
  }, []);

  async function handleApprove(resource) {
    if (!user) return;
    setBusyId(resource.id);
    try {
      await updateResourceStatus({ id: resource.id, status: 'published', reviewerUid: user.uid });
      setPending((items) => items.filter((item) => item.id !== resource.id));
      invalidateResourceCache();
      push(t('admin.approveSuccess'));
      load({ force: true });
    } catch (err) {
      console.warn('[admin-approve]', err);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(resource) {
    if (!user) return;
    setBusyId(resource.id);
    try {
      await updateResourceStatus({
        id: resource.id,
        status: 'rejected',
        reviewerUid: user.uid,
        reviewNote: t('admin.rejectSuccess')
      });
      setPending((items) => items.filter((item) => item.id !== resource.id));
      push(t('admin.rejectSuccess'), { type: 'info' });
      load({ force: true });
    } catch (err) {
      console.warn('[admin-reject]', err);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setBusyId(null);
      setRejectTarget(null);
    }
  }

  async function handleResolve(report) {
    if (!user) return;
    setBusyId(report.id);
    try {
      const token = await user.getIdToken();
      await updateAdminReport(report.id, { status: 'resolved' }, token);
      refreshAdminCounts();
      setStats((current) =>
        current
          ? {
              ...current,
              totals: {
                ...current.totals,
                pendingReports: Math.max(0, current.totals.pendingReports - 1)
              },
              latestReports: current.latestReports.map((item) =>
                item.id === report.id ? { ...item, status: 'resolved' } : item
              )
            }
          : current
      );
      push(t('admin.resolveSuccess'));
      load({ force: true });
    } catch (err) {
      console.warn('[admin-resolve]', err);
      push(t('admin.error'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || '';
  const greeting = displayName
    ? t('admin.dashboard.welcome', { name: displayName })
    : t('admin.dashboard.welcomeFallback');

  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const updatedAt = stats?.generatedAt
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(stats.generatedAt)
      )
    : null;

  const totals = stats?.totals;
  const trends = stats?.trends;

  const typeData = [
    {
      key: 'course',
      label: t('type.course'),
      value: totals?.resourcesByType?.course || 0,
      color: TYPE_COLORS.course
    },
    {
      key: 'book',
      label: t('type.book'),
      value: totals?.resourcesByType?.book || 0,
      color: TYPE_COLORS.book
    },
    {
      key: 'software',
      label: t('type.software'),
      value: totals?.resourcesByType?.software || 0,
      color: TYPE_COLORS.software
    }
  ];

  const providerData = [
    {
      key: 'password',
      label: t('admin.dashboard.providers.password'),
      value: stats?.providers?.password || 0,
      color: PROVIDER_COLORS.password
    },
    {
      key: 'google',
      label: t('admin.dashboard.providers.google'),
      value: stats?.providers?.['google.com'] || 0,
      color: PROVIDER_COLORS['google.com']
    },
    {
      key: 'github',
      label: t('admin.dashboard.providers.github'),
      value: stats?.providers?.['github.com'] || 0,
      color: PROVIDER_COLORS['github.com']
    },
    {
      key: 'apple',
      label: t('admin.dashboard.providers.apple'),
      value: stats?.providers?.['apple.com'] || 0,
      color: PROVIDER_COLORS['apple.com']
    },
    {
      key: 'other',
      label: t('admin.dashboard.providers.other'),
      value: stats?.providers?.other || 0,
      color: PROVIDER_COLORS.other
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={greeting}
        description={t('admin.dashboard.subtitle')}
        actions={
          <>
            <Link to="/admin/ai" className="btn-secondary btn-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t('adminAi.title')}
            </Link>
            <button
              type="button"
              onClick={() => load({ force: true })}
              disabled={loading || refreshing}
              className="btn-primary btn-sm"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              {refreshing ? t('admin.dashboard.refreshing') : t('admin.refresh')}
            </button>
          </>
        }
      >
        {updatedAt && (
          <p className="mt-2 text-xs text-ink-muted">
            {t('admin.dashboard.lastUpdated', { time: updatedAt })}
          </p>
        )}
      </PageHeader>

      {error && stats && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{t('admin.dashboard.errorText')}</p>
          <button type="button" onClick={() => load({ force: true })} className="btn-secondary btn-sm">
            {t('admin.dashboard.retry')}
          </button>
        </div>
      )}

      {loading && !stats ? (
        <DashboardSkeleton />
      ) : error && !stats ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">
            {t('admin.dashboard.errorTitle')}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            {t('admin.dashboard.errorText')}
          </p>
          <button type="button" onClick={() => load({ force: true })} className="btn-primary mt-6">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('admin.dashboard.retry')}
          </button>
        </div>
      ) : stats ? (
        <>
          {/* Headline metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={Library}
              tone="brand"
              label={t('admin.dashboard.stats.totalResources')}
              value={formatNumber(totals.resources, locale)}
              trend={{
                label: t('admin.dashboard.trendLast7', {
                  value: formatNumber(trends.resources, locale)
                }),
                direction: trends.resources > 0 ? 'up' : 'neutral'
              }}
            />
            <StatCard
              icon={GraduationCap}
              tone="emerald"
              label={t('admin.dashboard.stats.courses')}
              value={formatNumber(totals.resourcesByType.course, locale)}
              trend={{
                label: t('admin.dashboard.trendLast7', {
                  value: formatNumber(trends.courses, locale)
                }),
                direction: trends.courses > 0 ? 'up' : 'neutral'
              }}
            />
            <StatCard
              icon={BookOpen}
              tone="amber"
              label={t('admin.dashboard.stats.books')}
              value={formatNumber(totals.resourcesByType.book, locale)}
              trend={{
                label: t('admin.dashboard.trendLast7', {
                  value: formatNumber(trends.books, locale)
                }),
                direction: trends.books > 0 ? 'up' : 'neutral'
              }}
            />
            <StatCard
              icon={AppWindow}
              tone="accent"
              label={t('admin.dashboard.stats.software')}
              value={formatNumber(totals.resourcesByType.software, locale)}
              trend={{
                label: t('admin.dashboard.trendLast7', {
                  value: formatNumber(trends.software, locale)
                }),
                direction: trends.software > 0 ? 'up' : 'neutral'
              }}
            />
            <StatCard
              icon={Users}
              tone="slate"
              label={t('admin.dashboard.stats.users')}
              value={formatNumber(totals.users, locale)}
              trend={{
                label: t('admin.dashboard.trendLast7', {
                  value: formatNumber(trends.users, locale)
                }),
                direction: trends.users > 0 ? 'up' : 'neutral'
              }}
            />
            <StatCard
              icon={Flag}
              tone="rose"
              label={t('admin.dashboard.stats.pendingReports')}
              value={formatNumber(totals.pendingReports, locale)}
              trend={{
                label: t('admin.dashboard.trendReports', {
                  value: formatNumber(trends.reports, locale)
                }),
                direction: trends.reports > 0 ? 'warning' : 'neutral'
              }}
            />
          </div>

          {/* 30-day series */}
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              icon={Users}
              title={t('admin.dashboard.charts.newUsersTitle')}
              subtitle={t('admin.dashboard.charts.newUsersSubtitle')}
            >
              <NewUsersChart data={stats.newUsersLast30Days} locale={locale} rtl={rtl} />
            </ChartCard>

            <ChartCard
              icon={BookOpen}
              title={t('admin.dashboard.charts.newResourcesTitle')}
              subtitle={t('admin.dashboard.charts.newResourcesSubtitle')}
            >
              <NewResourcesChart data={stats.newResourcesLast30Days} locale={locale} rtl={rtl} />
            </ChartCard>
          </div>

          {/* Breakdowns + submission queue */}
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <ChartCard
              icon={Library}
              title={t('admin.dashboard.charts.byTypeTitle')}
              subtitle={t('admin.dashboard.charts.byTypeSubtitle')}
            >
              <BreakdownDonut
                data={typeData}
                total={totals.resources}
                centerLabel={t('admin.dashboard.charts.total')}
                locale={locale}
              />
            </ChartCard>

            <ChartCard
              icon={Users}
              title={t('admin.dashboard.charts.providersTitle')}
              subtitle={t('admin.dashboard.charts.providersSubtitle')}
            >
              <BreakdownDonut
                data={providerData}
                total={providerData.reduce((sum, entry) => sum + entry.value, 0)}
                centerLabel={t('admin.dashboard.charts.total')}
                locale={locale}
              />
              {stats.usersApproximate && (
                <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
                  {t('admin.dashboard.usersApprox', {
                    value: formatNumber(stats.usersScanned, locale)
                  })}
                </p>
              )}
            </ChartCard>

            <PendingSubmissionsCard
              items={pending}
              busyId={busyId}
              onApprove={handleApprove}
              onReject={setRejectTarget}
            />
          </div>

          {/* Most viewed / most saved */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TopResourcesCard
              title={t('admin.dashboard.topViewedTitle')}
              subtitle={t('admin.dashboard.topViewedSubtitle')}
              items={stats.topViewedResources}
              metric="views"
            />
            <TopResourcesCard
              title={t('admin.dashboard.topSavedTitle')}
              subtitle={t('admin.dashboard.topSavedSubtitle')}
              items={stats.topSavedResources}
              metric="saves"
            />
          </div>

          {/* Latest activity */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <LatestReportsCard
              reports={stats.latestReports}
              busyId={busyId}
              onResolve={handleResolve}
            />
            <LatestReviewsCard reviews={stats.latestReviews} />
          </div>

          <QuickActions />
        </>
      ) : null}

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

/** Skeleton mirroring the dashboard grid (shown on the very first load). */
function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="skeleton h-80 rounded-2xl xl:col-span-2" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  );
}
