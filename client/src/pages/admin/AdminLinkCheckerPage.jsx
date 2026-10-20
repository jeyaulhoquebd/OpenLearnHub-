import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  X
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import SearchInput from '../../components/admin/ui/SearchInput';
import DataTable from '../../components/admin/ui/DataTable';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import LinkStatusBadge from '../../components/admin/linkChecker/LinkStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { refreshAdminCounts } from '../../hooks/useAdminCounts';
import {
  bulkAdminResources,
  getAdminLinkCheckJob,
  getAdminLinkCheckResults,
  recheckAdminResourceLink,
  startAdminLinkCheck
} from '../../lib/api';
import { formatDateTime, localized } from '../../lib/utils';
import { TYPE_META } from '../../lib/constants';

const STATUS_FILTERS = ['ok', 'redirected', 'broken', 'timeout', 'never'];
const COUNT_KEYS = ['ok', 'redirected', 'broken', 'timeout', 'skipped'];
const COUNT_STYLES = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  redirected:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  broken:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  timeout:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  skipped: 'bg-sand-100 text-ink-muted ring-sand-300',
  never: 'bg-sand-100 text-ink-muted ring-sand-300'
};
const STATUS_ORDER = { broken: 0, timeout: 1, redirected: 2, never: 3, ok: 4 };

/**
 * Link checker.
 *
 * A check runs as a server-side background job (one at a time). The page starts
 * it, polls progress, then reloads the saved per-resource results. "Check
 * selected" sends ids; "Re-check" runs synchronously for one row. Broken or
 * timed-out rows can be bulk-flagged, which reuses the resource bulk endpoint.
 */
export default function AdminLinkCheckerPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [lastFullCheckAt, setLastFullCheckAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [starting, setStarting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [confirmFlag, setConfirmFlag] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const notifiedRef = useRef(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const data = await getAdminLinkCheckResults(token);
      setItems(Array.isArray(data.items) ? data.items : []);
      setCounts(data.counts || null);
      setLastFullCheckAt(data.lastFullCheckAt || null);
      setTruncated(Boolean(data.truncated));

      // Resume polling after a page reload while a job is still running.
      if (data.activeJob) {
        setJob(data.activeJob);
        setJobId(data.activeJob.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  // Poll the active job until it finishes, then refresh the saved results.
  useEffect(() => {
    if (!jobId || !user) return undefined;

    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        const token = await user.getIdToken();
        const data = await getAdminLinkCheckJob(jobId, token);
        if (cancelled) return;

        const next = data.job;
        setJob(next);

        if (next.status === 'running') {
          // Long checks poll for many minutes; 4 s keeps the global API rate
          // limit comfortable while still feeling live.
          timer = window.setTimeout(tick, 4000);
          return;
        }

        setJobId(null);

        if (notifiedRef.current !== next.id) {
          notifiedRef.current = next.id;
          const broken = (next.counts?.broken || 0) + (next.counts?.timeout || 0);
          push(t('admin.linkChecker.jobDone'), { type: broken ? 'error' : 'success' });
        }

        setReloadToken((value) => value + 1);
      } catch (err) {
        if (cancelled) return;
        // A full check can outlive a rate-limit window; back off instead of
        // abandoning a job that is still running on the server.
        if (err?.status === 429) {
          timer = window.setTimeout(tick, 10_000);
          return;
        }
        push(err.message || t('admin.linkChecker.pollError'), { type: 'error' });
        setJobId(null);
        setReloadToken((value) => value + 1);
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId, user, push, t]);

  const running = job?.status === 'running';

  const selectedRows = useMemo(
    () => items.filter((item) => selected.includes(item.id)),
    [items, selected]
  );

  const brokenSelected = useMemo(
    () =>
      selectedRows.filter(
        (item) => item.linkStatus === 'broken' || item.linkStatus === 'timeout'
      ),
    [selectedRows]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter && item.linkStatus !== statusFilter) return false;
      if (!needle) return true;

      const title = localized(item.title, i18n.language).toLowerCase();
      return (
        title.includes(needle) ||
        String(item.slug || '').toLowerCase().includes(needle) ||
        String(item.sourceUrl || '').toLowerCase().includes(needle)
      );
    });
  }, [items, statusFilter, search, i18n.language]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const direction = sort.dir === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sort.key === 'title') {
        return (
          localized(a.title, i18n.language).localeCompare(localized(b.title, i18n.language)) *
          direction
        );
      }
      if (sort.key === 'status') {
        return ((STATUS_ORDER[a.linkStatus] ?? 9) - (STATUS_ORDER[b.linkStatus] ?? 9)) * direction;
      }
      if (sort.key === 'checkedAt') {
        const at = new Date(a.linkCheck?.checkedAt || 0).getTime();
        const bt = new Date(b.linkCheck?.checkedAt || 0).getTime();
        return (at - bt) * direction;
      }
      return 0;
    });
  }, [filtered, sort, i18n.language]);

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [search, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedRows = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize]
  );

  async function startCheck(ids = null) {
    if (!user) return;
    setStarting(ids?.length ? 'selected' : 'full');

    try {
      const token = await user.getIdToken();
      const data = await startAdminLinkCheck(ids, token);
      setJob(data.job);
      setJobId(data.job.id);
      if (ids?.length) setSelected([]);
      push(t('admin.linkChecker.started'), { type: 'success' });
    } catch (err) {
      push(
        err.code === 'job_running'
          ? t('admin.linkChecker.jobRunning')
          : err.message || t('admin.linkChecker.startError'),
        { type: 'error' }
      );
      if (err.code === 'job_running') setReloadToken((value) => value + 1);
    } finally {
      setStarting(null);
    }
  }

  async function recheck(row) {
    if (!user) return;
    setBusyId(row.id);

    try {
      const token = await user.getIdToken();
      const data = await recheckAdminResourceLink(row.id, token);
      const result = data.item;

      setItems((list) =>
        list.map((item) =>
          item.id === row.id
            ? {
                ...item,
                sourceUrl: result.sourceUrl || item.sourceUrl,
                linkStatus: result.status,
                linkCheck: {
                  ok: result.ok,
                  statusCode: result.statusCode,
                  finalUrl: result.finalUrl,
                  checkedAt: result.checkedAt,
                  error: result.error,
                  redirected: result.redirected,
                  redirectCount: result.redirectCount
                }
              }
            : item
        )
      );

      push(t('admin.linkChecker.recheckSuccess'), { type: result.ok ? 'success' : 'error' });
      // Refresh the summary counts and any server-side classification changes.
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.linkChecker.recheckError'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function flagBroken() {
    if (!user || !brokenSelected.length) return;
    const ids = brokenSelected.map((item) => item.id);
    setFlagging(true);

    try {
      const token = await user.getIdToken();
      // The resource bulk endpoint accepts at most 100 ids per request.
      for (let index = 0; index < ids.length; index += 100) {
        // eslint-disable-next-line no-await-in-loop
        await bulkAdminResources({ ids: ids.slice(index, index + 100), action: 'flag' }, token);
      }
      push(t('admin.linkChecker.confirm.flagSuccess', { count: ids.length }), { type: 'success' });
      setSelected([]);
      setConfirmFlag(false);
      refreshAdminCounts();
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.linkChecker.confirm.flagError'), { type: 'error' });
    } finally {
      setFlagging(false);
    }
  }

  function openLink(url) {
    if (!/^https?:\/\//i.test(String(url || ''))) return null;
    return url;
  }

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: t('admin.linkChecker.columns.resource'),
        sortable: true,
        render: (row) => {
          const title =
            localized(row.title, i18n.language) ||
            row.slug ||
            t('admin.linkChecker.unknownResource');

          return (
            <div className="min-w-[190px] max-w-[280px]">
              <p className="line-clamp-2 font-semibold text-ink" dir="auto">
                {title}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {row.type ? t(TYPE_META[row.type]?.labelKey || 'type.course') : '—'}
                {row.slug ? ` · ${row.slug}` : ''}
              </p>
            </div>
          );
        }
      },
      {
        key: 'status',
        header: t('admin.linkChecker.columns.status'),
        sortable: true,
        render: (row) => (
          <div>
            <LinkStatusBadge status={row.linkStatus} />
            {row.linkCheck?.error ? (
              <p className="mt-1 max-w-[140px] truncate font-mono text-[10px] text-ink-muted">
                {row.linkCheck.error}
              </p>
            ) : null}
          </div>
        )
      },
      {
        key: 'code',
        header: t('admin.linkChecker.columns.code'),
        render: (row) => (
          <span className="font-mono text-xs tabular-nums text-ink-soft">
            {row.linkCheck?.statusCode || '—'}
          </span>
        )
      },
      {
        key: 'finalUrl',
        header: t('admin.linkChecker.columns.finalUrl'),
        className: 'hidden xl:table-cell',
        headerClassName: 'hidden xl:table-cell',
        render: (row) => {
          const finalUrl = row.linkCheck?.finalUrl;
          const changed = finalUrl && finalUrl !== row.sourceUrl;
          if (!changed) {
            return (
              <span className="text-xs text-ink-muted">
                {row.linkCheck?.redirected ? t('admin.linkChecker.redirected') : '—'}
              </span>
            );
          }
          return (
            <a
              href={openLink(finalUrl) || undefined}
              target="_blank"
              rel="noreferrer"
              className="block max-w-[200px] truncate text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              dir="ltr"
              title={finalUrl}
            >
              {finalUrl}
            </a>
          );
        }
      },
      {
        key: 'checkedAt',
        header: t('admin.linkChecker.columns.checkedAt'),
        sortable: true,
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-xs text-ink-muted">
            {row.linkCheck?.checkedAt
              ? formatDateTime(row.linkCheck.checkedAt, i18n.language)
              : t('admin.linkChecker.never')}
          </span>
        )
      },
      {
        key: 'actions',
        header: t('admin.linkChecker.columns.actions'),
        align: 'end',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => recheck(row)}
              disabled={running || busyId === row.id || !row.sourceUrl}
              className="btn-secondary h-8 gap-1 px-2 text-xs"
              aria-label={t('admin.linkChecker.actions.recheck')}
              title={t('admin.linkChecker.actions.recheck')}
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${busyId === row.id ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
            <Link
              to={`/admin/resources/${row.id}/edit`}
              className="btn-secondary h-8 px-2 text-xs"
              aria-label={t('admin.linkChecker.actions.edit')}
              title={t('admin.linkChecker.actions.edit')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            {openLink(row.sourceUrl) ? (
              <a
                href={row.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary h-8 px-2 text-xs"
                aria-label={t('admin.linkChecker.actions.open')}
                title={t('admin.linkChecker.actions.open')}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        )
      }
    ],
    [t, i18n.language, running, busyId]
  );

  const progress = job
    ? job.total > 0
      ? Math.round((job.completed / job.total) * 100)
      : 100
    : 0;

  return (
    <div>
      <PageHeader
        title={t('admin.linkChecker.title')}
        description={t('admin.linkChecker.subtitle')}
        actions={
          <>
            <button
              type="button"
              onClick={() => startCheck(null)}
              disabled={running || Boolean(starting)}
              className="btn-primary"
            >
              {starting === 'full' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {running ? t('admin.linkChecker.running') : t('admin.linkChecker.runFull')}
            </button>
            <button
              type="button"
              onClick={() => startCheck(selected)}
              disabled={running || Boolean(starting) || selected.length === 0}
              className="btn-secondary"
            >
              {starting === 'selected' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              )}
              {t('admin.linkChecker.checkSelected', { count: selected.length })}
            </button>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading}
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('admin.linkChecker.refresh')}
            </button>
          </>
        }
      >
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('admin.linkChecker.lastFullCheck')}:{' '}
          <span className="font-semibold text-ink-soft">
            {lastFullCheckAt ? formatDateTime(lastFullCheckAt, i18n.language) : t('admin.linkChecker.never')}
          </span>
        </p>
      </PageHeader>

      {job && (
        <section className="mb-4 rounded-2xl border border-sand-200 bg-surface p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
              ) : job.status === 'failed' ? (
                <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              )}
              <h2 className="font-display text-sm font-semibold text-ink">
                {t('admin.linkChecker.progress.title')}
              </h2>
              <span className="chip bg-sand-100 text-ink-muted ring-sand-300">
                {job.scope === 'selected'
                  ? t('admin.linkChecker.progress.scopeSelected')
                  : t('admin.linkChecker.progress.scopeFull')}
              </span>
            </div>

            {!running && (
              <button
                type="button"
                onClick={() => setJob(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
                aria-label={t('admin.linkChecker.progress.dismiss')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200 dark:bg-sand-700"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  job.status === 'failed' ? 'bg-rose-500' : 'bg-brand-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-ink-soft">
              {job.completed}/{job.total}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {COUNT_KEYS.map((key) => (
              <span key={key} className={`chip ${COUNT_STYLES[key]}`}>
                {t(`admin.linkChecker.progress.${key}`)}: {job.counts?.[key] || 0}
              </span>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-ink-muted">
            {t('admin.linkChecker.progress.startedAt')}:{' '}
            {formatDateTime(job.startedAt, i18n.language)}
            {job.finishedAt
              ? ` · ${t('admin.linkChecker.progress.finishedAt')}: ${formatDateTime(
                  job.finishedAt,
                  i18n.language
                )}`
              : ''}
          </p>

          {job.status === 'failed' && job.error ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {job.error}
            </p>
          ) : null}
        </section>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            id="admin-link-checker-search"
            value={search}
            onChange={setSearch}
            placeholder={t('admin.linkChecker.filters.searchPlaceholder')}
            label={t('admin.linkChecker.filters.searchLabel')}
            className="w-full sm:max-w-md"
          />

          <label className="text-xs font-semibold text-ink-muted">
            <span className="mb-1 block">{t('admin.linkChecker.filters.status')}</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input h-10 py-0 text-xs"
            >
              <option value="">{t('admin.linkChecker.filters.all')}</option>
              {STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.linkChecker.status.${value}`)}
                </option>
              ))}
            </select>
          </label>

          {(search || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
              className="btn-secondary h-10 gap-1.5 self-end px-3 text-xs"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.linkChecker.filters.clear')}
            </button>
          )}
        </div>

        {counts && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-ink-muted">
              {t('admin.linkChecker.summary.total', { count: counts.all })}
            </span>
            {STATUS_FILTERS.map((key) => (
              <span key={key} className={`chip ${COUNT_STYLES[key]}`}>
                {t(`admin.linkChecker.status.${key}`)}: {counts[key] || 0}
              </span>
            ))}
          </div>
        )}

        {truncated && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('admin.linkChecker.truncated', { limit: 2000 })}
          </p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent-200 bg-accent-50/70 px-3 py-2 dark:border-accent-500/30 dark:bg-accent-500/10">
          <p className="text-xs font-semibold text-ink">
            {t('admin.linkChecker.bulk.selected', { count: selected.length })}
          </p>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmFlag(true)}
              disabled={!brokenSelected.length || running}
              className="btn h-8 gap-1 border border-red-200 bg-red-600 px-2.5 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/40"
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.linkChecker.bulk.flagBroken', { count: brokenSelected.length })}
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
              aria-label={t('admin.linkChecker.bulk.clear')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {!brokenSelected.length ? (
            <p className="w-full text-[11px] text-ink-muted">
              {t('admin.linkChecker.bulk.hint')}
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.linkChecker.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.linkChecker.errorText')}
          </p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.linkChecker.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={pagedRows}
          rowKey={(row) => row.id}
          loading={loading}
          skeletonRows={8}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          sort={sort}
          onSortChange={setSort}
          emptyIcon={Link2}
          emptyTitle={
            search || statusFilter
              ? t('admin.linkChecker.emptyFilteredTitle')
              : t('admin.linkChecker.emptyTitle')
          }
          emptyText={
            search || statusFilter
              ? t('admin.linkChecker.emptyFilteredText')
              : t('admin.linkChecker.emptyText')
          }
          caption={t('admin.linkChecker.tableCaption')}
          pagination={{
            page,
            pageSize,
            total: sorted.length,
            pageSizeOptions: [10, 20, 50],
            onPageChange: (next) => {
              if (next < 1 || next > pageCount) return;
              setPage(next);
            },
            onPageSizeChange: (size) => {
              setPage(1);
              setPageSize(size);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={confirmFlag}
        loading={flagging}
        title={t('admin.linkChecker.confirm.flagTitle')}
        message={t('admin.linkChecker.confirm.flagMessage', { count: brokenSelected.length })}
        confirmLabel={t('admin.linkChecker.confirm.flagConfirm')}
        onCancel={() => setConfirmFlag(false)}
        onConfirm={flagBroken}
      />
    </div>
  );
}
