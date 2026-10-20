import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ExternalLink,
  Flag,
  LayoutGrid,
  List,
  MessageSquare,
  Pencil,
  RefreshCw,
  X
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import SearchInput from '../../components/admin/ui/SearchInput';
import DataTable from '../../components/admin/ui/DataTable';
import StatusBadge from '../../components/admin/ui/StatusBadge';
import ReportReasonBadge from '../../components/admin/reports/ReportReasonBadge';
import ReportCard from '../../components/admin/reports/ReportCard';
import ReportDetailDrawer from '../../components/admin/reports/ReportDetailDrawer';
import {
  REASON_FILTERS,
  REPORT_STATUSES,
  STATUS_ACCENTS,
  isIllegalReason
} from '../../components/admin/reports/reportMeta';
import { useAuth } from '../../context/AuthContext';
import { listAdminReports } from '../../lib/api';
import { formatDate, localized } from '../../lib/utils';
import { TYPE_META } from '../../lib/constants';

const VIEW_KEY = 'openlearn.admin.reports.view';

function getInitialView() {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'board';
  } catch {
    return 'board';
  }
}

/**
 * Reports queue.
 *
 * Board view groups reports into the four moderation statuses (illegal reports
 * always first inside each column); table view adds tabs for one status at a
 * time. A detail drawer handles the note, status change and quick actions.
 * Every write goes through the admin API and updates the shell badges.
 */
export default function AdminReportsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [view, setView] = useState(getInitialView);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reason, setReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState(null);

  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Preference storage is optional.
    }
  }, [view]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, reason, statusFilter, view]);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const data = await listAdminReports(token, {
        q: debouncedSearch,
        reason,
        status: view === 'table' ? statusFilter : ''
      });
      if (requestId !== requestRef.current) return;
      setRows(Array.isArray(data.items) ? data.items : []);
      setTruncated(Boolean(data.truncated));
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [user, debouncedSearch, reason, statusFilter, view]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const board = useMemo(() => {
    const groups = Object.fromEntries(REPORT_STATUSES.map((status) => [status, []]));
    rows.forEach((report) => {
      if (groups[report.status]) groups[report.status].push(report);
    });
    return groups;
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  );

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setReason('');
    setStatusFilter('');
  }

  function switchView(next) {
    setView(next);
    // The status filter only exists in table view; clear it when returning to
    // the board so the columns are not quietly filtered behind the scenes.
    if (next === 'board') setStatusFilter('');
  }

  const hasFilters = Boolean(debouncedSearch || reason || statusFilter);

  const columns = useMemo(
    () => [
      {
        key: 'resource',
        header: t('admin.reportQueue.columns.resource'),
        render: (row) => {
          const title =
            localized(row.resource?.title || row.resourceTitle, i18n.language) ||
            row.resourceId ||
            t('admin.reportQueue.drawer.resourceMissing');

          return (
            <div className="min-w-[180px] max-w-[260px]">
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="line-clamp-2 text-start font-semibold text-ink transition hover:text-brand-700 dark:hover:text-brand-300"
                dir="auto"
              >
                {title}
              </button>
              {row.resource?.type ? (
                <span className="mt-1 inline-block text-[11px] text-ink-muted">
                  {t(TYPE_META[row.resource.type]?.labelKey || 'type.course')}
                </span>
              ) : null}
            </div>
          );
        }
      },
      {
        key: 'reason',
        header: t('admin.reportQueue.columns.reason'),
        render: (row) => <ReportReasonBadge reason={row.reason} />
      },
      {
        key: 'reporter',
        header: t('admin.reportQueue.columns.reporter'),
        render: (row) => (
          <div className="min-w-[140px] max-w-[200px]">
            <p className="truncate text-xs text-ink" dir="ltr">
              {row.reporterEmail || t('admin.reportQueue.card.anonymous')}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {row.verifiedReporter
                ? t('admin.reportQueue.drawer.verified')
                : t('admin.reportQueue.drawer.unverified')}
            </p>
          </div>
        )
      },
      {
        key: 'message',
        header: t('admin.reportQueue.columns.message'),
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        render: (row) => (
          <p className="line-clamp-2 max-w-[280px] text-xs leading-relaxed text-ink-soft" dir="auto">
            {row.details || t('admin.reportQueue.drawer.noMessage')}
          </p>
        )
      },
      {
        key: 'status',
        header: t('admin.reportQueue.columns.status'),
        render: (row) => <StatusBadge status={row.status} />
      },
      {
        key: 'similar',
        header: t('admin.reportQueue.columns.similar'),
        render: (row) => (
          <span className="whitespace-nowrap text-xs font-semibold text-ink">
            {row.similarCount}
          </span>
        )
      },
      {
        key: 'date',
        header: t('admin.reportQueue.columns.date'),
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-xs text-ink-muted">{formatDate(row.createdAt, i18n.language)}</span>
        )
      },
      {
        key: 'actions',
        header: t('admin.reportQueue.columns.actions'),
        align: 'end',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            {row.resourceId && row.resource ? (
              <>
                <Link
                  to={`/resource/${row.resourceId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary h-8 px-2 text-xs"
                  aria-label={t('admin.reportQueue.actions.openResource')}
                  title={t('admin.reportQueue.actions.openResource')}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  to={`/admin/resources/${row.resourceId}/edit`}
                  className="btn-secondary h-8 px-2 text-xs"
                  aria-label={t('admin.reportQueue.actions.editResource')}
                  title={t('admin.reportQueue.actions.editResource')}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setSelected(row)}
              className="btn-secondary h-8 px-2.5 text-xs"
            >
              {t('admin.reportQueue.actions.open')}
            </button>
          </div>
        )
      }
    ],
    [t, i18n.language]
  );

  const refreshButton = (
    <button
      type="button"
      onClick={() => setReloadToken((value) => value + 1)}
      disabled={loading}
      className="btn-secondary"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
      {t('admin.reportQueue.refresh')}
    </button>
  );

  return (
    <div>
      <PageHeader
        title={t('admin.reportQueue.title')}
        description={t('admin.reportQueue.subtitle')}
        actions={
          <>
            <div
              role="group"
              aria-label={t('admin.reportQueue.view.label')}
              className="inline-flex rounded-xl border border-sand-200 bg-surface p-0.5"
            >
              <button
                type="button"
                onClick={() => switchView('board')}
                aria-pressed={view === 'board'}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
                  view === 'board'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.reportQueue.view.board')}
              </button>
              <button
                type="button"
                onClick={() => switchView('table')}
                aria-pressed={view === 'table'}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
                  view === 'table'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.reportQueue.view.table')}
              </button>
            </div>
            {refreshButton}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            id="admin-reports-search"
            value={search}
            onChange={setSearch}
            placeholder={t('admin.reportQueue.filters.searchPlaceholder')}
            label={t('admin.reportQueue.filters.searchLabel')}
            className="w-full sm:max-w-md"
          />

          <label className="text-xs font-semibold text-ink-muted">
            <span className="mb-1 block">{t('admin.reportQueue.filters.reason')}</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="input h-10 py-0 text-xs"
            >
              <option value="">{t('admin.reportQueue.filters.allReasons')}</option>
              {REASON_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.reportQueue.filters.reasonOptions.${value}`)}
                </option>
              ))}
            </select>
          </label>

          {view === 'table' && (
            <label className="text-xs font-semibold text-ink-muted">
              <span className="mb-1 block">{t('admin.reportQueue.filters.status')}</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input h-10 py-0 text-xs"
              >
                <option value="">{t('admin.reportQueue.filters.allStatuses')}</option>
                {REPORT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`admin.status.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary h-10 gap-1.5 self-end px-3 text-xs"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reportQueue.filters.clear')}
            </button>
          )}
        </div>

        {truncated && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('admin.reportQueue.truncated', { limit: 500 })}
          </p>
        )}
      </div>

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.reportQueue.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.reportQueue.errorText')}
          </p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.reportQueue.retry')}
          </button>
        </div>
      ) : view === 'board' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {REPORT_STATUSES.map((status) => {
            const items = board[status] || [];
            return (
              <section
                key={status}
                className={`rounded-2xl border border-t-4 border-sand-200 bg-sand-50/50 dark:border-sand-700 dark:bg-sand-100/5 ${STATUS_ACCENTS[status]}`}
                aria-label={t(`admin.status.${status}`)}
              >
                <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <StatusBadge status={status} />
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-muted ring-1 ring-inset ring-sand-300">
                    {items.length}
                  </span>
                </header>

                <div className="space-y-3 px-3 pb-3">
                  {loading && !items.length ? (
                    Array.from({ length: 2 }).map((_, index) => (
                      <div
                        key={`report-skeleton-${status}-${index}`}
                        className="rounded-2xl border border-sand-200 bg-surface p-4"
                      >
                        <span className="skeleton block h-5 w-24" />
                        <span className="skeleton mt-3 block h-4 w-full" />
                        <span className="skeleton mt-2 block h-3 w-2/3" />
                        <span className="skeleton mt-4 block h-3 w-1/2" />
                      </div>
                    ))
                  ) : items.length ? (
                    items.map((report) => (
                      <ReportCard key={report.id} report={report} onOpen={setSelected} />
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-sand-300 px-3 py-8 text-center text-xs text-ink-muted">
                      {hasFilters
                        ? t('admin.reportQueue.board.emptyFiltered')
                        : t('admin.reportQueue.board.empty')}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={pagedRows}
          rowKey={(row) => row.id}
          rowClassName={(row) =>
            isIllegalReason(row.reason) ? 'bg-rose-50/60 dark:bg-rose-500/5' : ''
          }
          loading={loading}
          skeletonRows={8}
          emptyIcon={hasFilters ? MessageSquare : Flag}
          emptyTitle={
            hasFilters
              ? t('admin.reportQueue.emptyFilteredTitle')
              : t('admin.reportQueue.emptyTitle')
          }
          emptyText={
            hasFilters
              ? t('admin.reportQueue.emptyFilteredText')
              : t('admin.reportQueue.emptyText')
          }
          caption={t('admin.reportQueue.tableCaption')}
          pagination={{
            page,
            pageSize,
            total: rows.length,
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

      <ReportDetailDrawer
        open={Boolean(selected)}
        report={selected}
        onClose={() => setSelected(null)}
        onChanged={(next) => {
          // Merge the server's fresh status/note into the open drawer without
          // losing the similar-report count and loaded resource summary.
          if (next) {
            setSelected((current) =>
              current ? { ...current, ...next, similarCount: current.similarCount } : next
            );
          }
          setReloadToken((value) => value + 1);
        }}
      />
    </div>
  );
}
