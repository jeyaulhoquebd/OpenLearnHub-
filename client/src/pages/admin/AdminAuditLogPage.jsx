import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FilterX,
  RefreshCw,
  ScrollText,
  Search
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import DataTable from '../../components/admin/ui/DataTable';
import AuditDetails from '../../components/admin/auditLog/AuditDetails';
import { useAuth } from '../../context/AuthContext';
import { listAdminAuditLogs } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

const EMPTY_FILTERS = { admin: '', action: '', targetType: '', from: '', to: '' };
const EMPTY_FACETS = { actions: [], targetTypes: [], admins: [] };

/**
 * Admin → Audit log.
 *
 * Read-only timeline of privileged actions. The server scans a bounded,
 * newest-first window and filters in memory, so this page never requires
 * composite indexes for arbitrary filter combinations.
 */
export default function AdminAuditLogPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState([]);
  const [facets, setFacets] = useState(EMPTY_FACETS);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [scanLimit, setScanLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [cursors, setCursors] = useState(['']);
  const [expanded, setExpanded] = useState([]);

  const cursor = cursors[page - 1] || '';
  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => String(value || '').trim()),
    [filters]
  );
  const hasDraftFilters = useMemo(
    () => Object.values(draft).some((value) => String(value || '').trim()),
    [draft]
  );

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await listAdminAuditLogs(token, {
        ...filters,
        cursor,
        limit: pageSize
      });
      setRows(Array.isArray(response.items) ? response.items : []);
      setTotal(Number(response.total) || 0);
      setTruncated(Boolean(response.truncated));
      setScanLimit(Number(response.scanLimit) || 0);
      setFacets({
        actions: response.facets?.actions || [],
        targetTypes: response.facets?.targetTypes || [],
        admins: response.facets?.admins || []
      });
      setCursors((current) => {
        const next = current.slice(0, page);
        if (response.nextCursor) next[page] = response.nextCursor;
        return next;
      });
      setExpanded([]);
    } catch (err) {
      console.warn('[admin-audit-log] load failed:', err);
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, filters, cursor, page, pageSize]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setCursors(['']);
    setFilters({ ...draft });
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setCursors(['']);
  }

  function changePage(nextPage) {
    setPage(Math.max(1, nextPage));
  }

  function changePageSize(nextSize) {
    setPageSize(nextSize);
    setPage(1);
    setCursors(['']);
  }

  function toggleExpanded(id) {
    setExpanded((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function targetLabel(type) {
    if (!type) return '—';
    const key = `admin.auditLog.targets.${type}`;
    return i18n.exists(key) ? t(key) : type;
  }

  const columns = [
    {
      key: 'when',
      header: t('admin.auditLog.columns.when'),
      className: 'whitespace-nowrap text-xs',
      render: (row) => formatDateTime(row.createdAt, i18n.language)
    },
    {
      key: 'admin',
      header: t('admin.auditLog.columns.admin'),
      render: (row) => (
        <div className="min-w-[10rem] max-w-[15rem]">
          <p className="truncate font-semibold text-ink">
            {row.adminName || row.adminEmail || t('admin.auditLog.unknownAdmin')}
          </p>
          {row.adminEmail && row.adminName ? (
            <p className="truncate text-[11px] text-ink-muted">{row.adminEmail}</p>
          ) : null}
          <p className="truncate font-mono text-[10px] text-ink-muted">{row.adminUid}</p>
        </div>
      )
    },
    {
      key: 'action',
      header: t('admin.auditLog.columns.action'),
      render: (row) => (
        <code
          dir="ltr"
          className="inline-block max-w-[13rem] truncate rounded bg-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-soft dark:bg-white/10"
          title={row.action}
        >
          {row.action}
        </code>
      )
    },
    {
      key: 'target',
      header: t('admin.auditLog.columns.target'),
      render: (row) => (
        <div className="min-w-[8rem] max-w-[13rem]">
          <p className="truncate text-xs font-semibold text-ink-soft">{targetLabel(row.targetType)}</p>
          {row.targetId && (
            <p className="truncate font-mono text-[10px] text-ink-muted" title={row.targetId}>
              {row.targetId}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'details',
      header: t('admin.auditLog.columns.details'),
      align: 'end',
      render: (row) => {
        const open = expanded.includes(row.id);
        return (
          <button
            type="button"
            onClick={() => toggleExpanded(row.id)}
            aria-expanded={open}
            className="btn-secondary btn-sm whitespace-nowrap"
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {open ? t('admin.auditLog.details.hide') : t('admin.auditLog.details.show')}
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.auditLog.title')}
        description={t('admin.auditLog.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('admin.auditLog.refresh')}
          </button>
        }
      />

      <form onSubmit={applyFilters} className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label htmlFor="audit-admin" className="block text-xs font-semibold text-ink">
              {t('admin.auditLog.filters.admin')}
            </label>
            <input
              id="audit-admin"
              type="search"
              list="audit-admin-options"
              value={draft.admin}
              onChange={(event) => setDraft((current) => ({ ...current, admin: event.target.value }))}
              placeholder={t('admin.auditLog.filters.adminPlaceholder')}
              maxLength={200}
              className="input mt-1.5"
            />
            <datalist id="audit-admin-options">
              {facets.admins.map((admin) => (
                <option key={admin.uid} value={admin.email || admin.uid}>
                  {admin.name || admin.email || admin.uid}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="audit-action" className="block text-xs font-semibold text-ink">
              {t('admin.auditLog.filters.action')}
            </label>
            <select
              id="audit-action"
              value={draft.action}
              onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))}
              className="input mt-1.5"
            >
              <option value="">{t('admin.auditLog.filters.allActions')}</option>
              {draft.action && !facets.actions.includes(draft.action) && (
                <option value={draft.action}>{draft.action}</option>
              )}
              {facets.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-target" className="block text-xs font-semibold text-ink">
              {t('admin.auditLog.filters.targetType')}
            </label>
            <select
              id="audit-target"
              value={draft.targetType}
              onChange={(event) =>
                setDraft((current) => ({ ...current, targetType: event.target.value }))
              }
              className="input mt-1.5"
            >
              <option value="">{t('admin.auditLog.filters.allTargets')}</option>
              {facets.targetTypes.map((type) => (
                <option key={type} value={type}>
                  {targetLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-from" className="block text-xs font-semibold text-ink">
              {t('admin.auditLog.filters.from')}
            </label>
            <input
              id="audit-from"
              type="date"
              value={draft.from}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
              className="input mt-1.5"
            />
          </div>

          <div>
            <label htmlFor="audit-to" className="block text-xs font-semibold text-ink">
              {t('admin.auditLog.filters.to')}
            </label>
            <input
              id="audit-to"
              type="date"
              value={draft.to}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
              className="input mt-1.5"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.auditLog.filters.apply')}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            disabled={loading || (!hasFilters && !hasDraftFilters)}
            className="btn-secondary btn-sm"
          >
            <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.auditLog.filters.clear')}
          </button>
        </div>
      </form>

      {truncated && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('admin.auditLog.truncated', { limit: scanLimit })}</span>
        </div>
      )}

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.auditLog.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.auditLog.errorText')}
          </p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.auditLog.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          caption={t('admin.auditLog.tableCaption')}
          emptyTitle={
            hasFilters ? t('admin.auditLog.emptyFilteredTitle') : t('admin.auditLog.emptyTitle')
          }
          emptyText={
            hasFilters ? t('admin.auditLog.emptyFilteredText') : t('admin.auditLog.emptyText')
          }
          emptyIcon={ScrollText}
          pageSize={pageSize}
          renderExpandedRow={(row) => <AuditDetails row={row} />}
          expandedRowKeys={expanded}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: changePage,
            onPageSizeChange: changePageSize,
            pageSizeOptions: [25, 50, 100]
          }}
        />
      )}
    </div>
  );
}
