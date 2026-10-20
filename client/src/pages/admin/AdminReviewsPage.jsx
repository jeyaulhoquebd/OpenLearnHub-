import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Star,
  Trash2,
  X
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import SearchInput from '../../components/admin/ui/SearchInput';
import DataTable from '../../components/admin/ui/DataTable';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import ReviewDetailModal from '../../components/admin/reviews/ReviewDetailModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  bulkAdminReviews,
  deleteAdminReview,
  hideAdminReview,
  listAdminReviews,
  showAdminReview
} from '../../lib/api';
import { formatDate, localized } from '../../lib/utils';
import { TYPE_META } from '../../lib/constants';

const RATINGS = [5, 4, 3, 2, 1];

const ACTION_META = {
  hide: {
    label: 'admin.reviews.actions.hide',
    title: 'admin.reviews.confirm.hideTitle',
    message: 'admin.reviews.confirm.hideMessage',
    success: 'admin.reviews.confirm.hideSuccess',
    tone: 'primary'
  },
  show: {
    label: 'admin.reviews.actions.show',
    title: 'admin.reviews.confirm.showTitle',
    message: 'admin.reviews.confirm.showMessage',
    success: 'admin.reviews.confirm.showSuccess',
    tone: 'primary'
  },
  delete: {
    label: 'admin.reviews.actions.delete',
    title: 'admin.reviews.confirm.deleteTitle',
    message: 'admin.reviews.confirm.deleteMessage',
    success: 'admin.reviews.confirm.deleteSuccess',
    tone: 'danger'
  }
};

/**
 * Review moderation queue.
 *
 * Hidden reviews stay here (the public list filters them out). Bulk actions run
 * one transaction per review on the server, each of which also recalculates the
 * resource rating, so the public cards stay accurate.
 */
export default function AdminReviewsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rating, setRating] = useState('');

  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const cursorsRef = useRef({ 1: '' });
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      if (next === debouncedSearch) return;
      cursorsRef.current = { 1: '' };
      setPage(1);
      setSelected([]);
      setDebouncedSearch(next);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, debouncedSearch]);

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
      const data = await listAdminReviews(token, {
        cursor: cursorsRef.current[page] || '',
        limit,
        q: debouncedSearch,
        rating
      });

      if (requestId !== requestRef.current) return;

      const items = Array.isArray(data.items) ? data.items : [];

      // A delete can empty the last page; fall back to the first page instead
      // of showing an empty table with a page number that no longer exists.
      if (!items.length && page > 1) {
        cursorsRef.current = { 1: '' };
        setPage(1);
        return;
      }

      setRows(items);
      setTotal(Number(data.total) || 0);
      setNextCursor(data.nextCursor || null);
      setTruncated(Boolean(data.truncated));

      if (data.nextCursor) {
        cursorsRef.current = { ...cursorsRef.current, [page + 1]: data.nextCursor };
      }
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [user, page, limit, debouncedSearch, rating]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  function updateRating(value) {
    setRating(value);
    cursorsRef.current = { 1: '' };
    setPage(1);
    setSelected([]);
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setRating('');
    cursorsRef.current = { 1: '' };
    setPage(1);
    setSelected([]);
  }

  async function runAction(ids, action) {
    if (!ids.length) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      let updated = ids.length;
      let failed = 0;

      if (ids.length === 1) {
        const [id] = ids;
        if (action === 'delete') await deleteAdminReview(id, token);
        else if (action === 'hide') await hideAdminReview(id, token);
        else await showAdminReview(id, token);
      } else {
        const result = await bulkAdminReviews(ids, action, token);
        updated = result.updated ?? ids.length;
        failed = Array.isArray(result.failed) ? result.failed.length : 0;
      }

      push(t(ACTION_META[action].success, { count: updated }), {
        type: failed ? 'error' : 'success'
      });
      if (failed) {
        push(t('admin.reviews.confirm.partialFailure', { failed }), { type: 'error' });
      }

      setPending(null);
      setDetail(null);
      setSelected([]);
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.reviews.actionError'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function openConfirm(ids, action) {
    setPending({ ids, action });
  }

  const hasFilters = Boolean(debouncedSearch || rating);
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const columns = useMemo(
    () => [
      {
        key: 'reviewer',
        header: t('admin.reviews.columns.reviewer'),
        render: (row) => (
          <div className="min-w-[150px]">
            <p className="font-semibold text-ink">
              {row.authorName || t('admin.reviews.anonymous')}
            </p>
            <p className="max-w-[180px] truncate text-[11px] text-ink-muted" dir="ltr">
              {row.userId === 'deleted' ? '—' : row.userId}
            </p>
          </div>
        )
      },
      {
        key: 'resource',
        header: t('admin.reviews.columns.resource'),
        render: (row) => (
          <div className="min-w-[180px] max-w-[280px]">
            <p className="truncate font-medium text-ink" dir="auto">
              {row.resource
                ? localized(row.resource.title, i18n.language)
                : row.resourceId || '—'}
            </p>
            {row.resource?.type ? (
              <span className="chip mt-1 border border-sand-300 bg-sand-100 text-[10px] text-ink-muted">
                {t(TYPE_META[row.resource.type]?.labelKey || 'type.course')}
              </span>
            ) : null}
          </div>
        )
      },
      {
        key: 'rating',
        header: t('admin.reviews.columns.rating'),
        render: (row) => (
          <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ink">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            {row.rating}
            <span className="text-[11px] font-normal text-ink-muted">/ 5</span>
          </span>
        )
      },
      {
        key: 'comment',
        header: t('admin.reviews.columns.comment'),
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        render: (row) => (
          <p className="line-clamp-2 max-w-[320px] text-xs leading-relaxed text-ink-soft" dir="auto">
            {row.body || t('admin.reviews.noComment')}
          </p>
        )
      },
      {
        key: 'date',
        header: t('admin.reviews.columns.date'),
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-xs text-ink-muted">{formatDate(row.createdAt, i18n.language)}</span>
        )
      },
      {
        key: 'status',
        header: t('admin.reviews.columns.status'),
        render: (row) =>
          row.hidden ? (
            <span className="chip border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reviews.hidden')}
            </span>
          ) : (
            <span className="chip border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reviews.visible')}
            </span>
          )
      },
      {
        key: 'actions',
        header: t('admin.reviews.columns.actions'),
        align: 'end',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            {row.resource ? (
              <Link
                to={`/resource/${row.resourceId}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary h-8 px-2 text-xs"
                aria-label={t('admin.reviews.actions.viewResource')}
                title={t('admin.reviews.actions.viewResource')}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setDetail(row)}
              className="btn-secondary h-8 px-2.5 text-xs"
            >
              {t('admin.reviews.actions.view')}
            </button>
          </div>
        )
      }
    ],
    [t, i18n.language]
  );

  const pendingMeta = pending ? ACTION_META[pending.action] : null;
  const pendingCount = pending?.ids.length || 0;

  return (
    <div>
      <PageHeader
        title={t('admin.reviews.title')}
        description={t('admin.reviews.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('admin.reviews.refresh')}
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            id="admin-reviews-search"
            value={search}
            onChange={setSearch}
            placeholder={t('admin.reviews.searchPlaceholder')}
            label={t('admin.reviews.searchLabel')}
            className="w-full sm:max-w-md"
          />
          <label className="text-xs font-semibold text-ink-muted sm:ms-auto">
            <span className="mb-1 block">{t('admin.reviews.filters.rating')}</span>
            <select
              value={rating}
              onChange={(event) => updateRating(event.target.value)}
              className="input h-10 py-0 text-xs"
            >
              <option value="">{t('admin.reviews.filters.allRatings')}</option>
              {RATINGS.map((value) => (
                <option key={value} value={String(value)}>
                  {t('admin.reviews.filters.ratingOption', { value })}
                </option>
              ))}
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary h-10 gap-1.5 self-end px-3 text-xs"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reviews.filters.clear')}
            </button>
          )}
        </div>

        {truncated && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('admin.reviews.truncated', { limit: 500 })}
          </p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent-200 bg-accent-50/70 px-3 py-2 dark:border-accent-500/30 dark:bg-accent-500/10">
          <p className="text-xs font-semibold text-ink">
            {t('admin.reviews.bulk.selected', { count: selected.length })}
          </p>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => openConfirm(selected, 'hide')}
              className="btn-secondary h-8 gap-1 px-2.5 text-xs"
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reviews.bulk.hide')}
            </button>
            <button
              type="button"
              onClick={() => openConfirm(selected, 'show')}
              className="btn-secondary h-8 gap-1 px-2.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reviews.bulk.show')}
            </button>
            <button
              type="button"
              onClick={() => openConfirm(selected, 'delete')}
              className="btn h-8 gap-1 border border-red-200 bg-red-600 px-2.5 text-xs text-white hover:bg-red-700 dark:border-red-500/40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.reviews.bulk.delete')}
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
              aria-label={t('admin.reviews.bulk.clear')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.reviews.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{t('admin.reviews.errorText')}</p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.reviews.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          skeletonRows={8}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          emptyIcon={Star}
          emptyTitle={hasFilters ? t('admin.reviews.emptyFilteredTitle') : t('admin.reviews.emptyTitle')}
          emptyText={hasFilters ? t('admin.reviews.emptyFilteredText') : t('admin.reviews.emptyText')}
          caption={t('admin.reviews.tableCaption')}
          sort={null}
          pagination={{
            page,
            pageSize: limit,
            total,
            pageSizeOptions: [10, 20, 50],
            onPageSizeChange: (size) => {
              cursorsRef.current = { 1: '' };
              setPage(1);
              setSelected([]);
              setLimit(size);
            },
            onPageChange: (next) => {
              if (next < 1 || next > pageCount) return;
              if (next > page && !nextCursor) return;
              setSelected([]);
              setPage(next);
            }
          }}
        />
      )}

      <ReviewDetailModal
        open={Boolean(detail)}
        review={detail}
        onClose={() => setDetail(null)}
        onAction={(action) => {
          if (!detail) return;
          setDetail(null);
          openConfirm([detail.id], action);
        }}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        loading={busy}
        title={pendingMeta ? t(pendingMeta.title) : ''}
        message={pendingMeta ? t(pendingMeta.message, { count: pendingCount }) : ''}
        confirmLabel={pendingMeta ? t(pendingMeta.label) : ''}
        tone={pendingMeta?.tone || 'danger'}
        onCancel={() => setPending(null)}
        onConfirm={() => runAction(pending?.ids || [], pending?.action)}
      />
    </div>
  );
}
