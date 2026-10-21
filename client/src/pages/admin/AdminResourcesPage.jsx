import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Youtube
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import SearchInput from '../../components/admin/ui/SearchInput';
import DataTable from '../../components/admin/ui/DataTable';
import StatusBadge from '../../components/admin/ui/StatusBadge';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  bulkAdminResources,
  createAdminResource,
  listAdminResources
} from '../../lib/api';
import {
  categoryName,
  fetchCategories,
  fetchResourceById
} from '../../lib/data';
import {
  CATEGORIES,
  LANGUAGES,
  RESOURCE_TYPES,
  TYPE_META
} from '../../lib/constants';
import { resourceToFormValues, toResourcePayload } from '../../lib/resourceForm';
import { formatDate, formatNumber, localized } from '../../lib/utils';

const STATUS_OPTIONS = ['published', 'draft', 'pending', 'flagged', 'rejected'];

const BULK_TOAST = {
  publish: 'admin.resources.actions.publishSuccess',
  draft: 'admin.resources.actions.unpublishSuccess',
  flag: 'admin.resources.actions.flagSuccess',
  delete: 'admin.resources.actions.deleteSuccess'
};

function TypeChip({ type }) {
  const { t } = useTranslation();
  const meta = TYPE_META[type] || TYPE_META.course;
  return <span className={`chip ${meta.chip}`}>{t(meta.labelKey)}</span>;
}

/**
 * Row action menu. A small controlled popover (not a native <select>) so the
 * destructive action stays visually separated and the menu is keyboard
 * reachable (Escape closes, click outside closes).
 */
function RowMenu({ row, busy, onEdit, onDuplicate, onTogglePublish, onDelete }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function run(action) {
    setOpen(false);
    action();
  }

  const published = row.status === 'published';
  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-soft transition hover:bg-sand-100 hover:text-ink focus-visible:bg-sand-100';

  return (
    <div ref={ref} className="relative inline-flex justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('admin.resources.actions.menu', { title: localized(row.title) || row.id })}
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-ink-muted transition hover:border-sand-300 hover:bg-surface hover:text-ink disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('admin.resources.actions.menu', { title: localized(row.title) || row.id })}
          className="absolute end-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-sand-200 bg-surface py-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(onEdit)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t('admin.resources.actions.edit')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(onDuplicate)}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {t('admin.resources.actions.duplicate')}
          </button>
          <a
            role="menuitem"
            href={`/resource/${row.id}`}
            target="_blank"
            rel="noreferrer"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t('admin.resources.actions.view')}
          </a>
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(onTogglePublish)}>
            {published ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {published
              ? t('admin.resources.actions.unpublish')
              : t('admin.resources.actions.publish')}
          </button>
          <div className="my-1 border-t border-sand-100" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            onClick={() => run(onDelete)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('admin.resources.actions.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Admin → Resources.
 *
 * The table is server-driven: filters, search, sorting and pagination all go
 * through `GET /api/admin/resources`. Writes use the admin API (never direct
 * Firestore writes) so slugs, the blocklist and the audit log are applied in
 * one place.
 */
export default function AdminResourcesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState({ key: 'updatedAt', dir: 'desc' });

  const [selected, setSelected] = useState([]);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const cursorRef = useRef({ 1: '' });
  const requestRef = useRef(0);

  // Debounce the search box so a scan does not run on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch((err) => console.warn('[admin-resources] categories', err));
    return () => {
      active = false;
    };
  }, []);

  const sortParam = useMemo(() => {
    if (sort.key === 'title') return sort.dir === 'asc' ? 'title_asc' : 'title_desc';
    if (sort.key === 'views') return 'views_desc';
    if (sort.key === 'rating') return 'rating_desc';
    if (sort.key === 'createdAt') return sort.dir === 'asc' ? 'created_asc' : 'created_desc';
    return sort.dir === 'asc' ? 'updated_asc' : 'updated_desc';
  }, [sort]);

  const load = useCallback(
    async ({ targetPage = 1, reset = false } = {}) => {
      if (!user) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();
        const cursor = reset ? '' : cursorRef.current[targetPage] || '';
        const data = await listAdminResources(token, {
          q: debouncedSearch,
          type,
          status,
          category,
          language,
          sort: sortParam,
          cursor,
          limit: pageSize
        });

        if (requestId !== requestRef.current) return;

        setRows(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total) || 0);
        setTruncated(Boolean(data.truncated));
        setPage(targetPage);
        setSelected([]);

        if (data.nextCursor) {
          cursorRef.current = { ...cursorRef.current, [targetPage + 1]: data.nextCursor };
        }
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(err);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [user, debouncedSearch, type, status, category, language, sortParam, pageSize]
  );

  // Any filter/sort/page-size change (or an explicit Refresh) starts at page 1.
  useEffect(() => {
    cursorRef.current = { 1: '' };
    load({ targetPage: 1, reset: true });
  }, [load, reloadToken]);

  function goToPage(nextPage) {
    if (nextPage === page || nextPage < 1) return;
    if (!cursorRef.current[nextPage]) return;
    load({ targetPage: nextPage });
  }

  function clearFilters() {
    setSearch('');
    setType('');
    setStatus('');
    setCategory('');
    setLanguage('');
    setSort({ key: 'updatedAt', dir: 'desc' });
  }

  const hasFilters = Boolean(search || type || status || category || language);

  const categoryOptions = useMemo(() => {
    const fromFirestore = categories.map((item) => categoryName(item, 'en')).filter(Boolean);
    return Array.from(new Set([...fromFirestore, ...CATEGORIES])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [categories]);

  function categoryLabel(name) {
    const match = categories.find((item) => categoryName(item, 'en') === name);
    return match ? categoryName(match, i18n.language) : name;
  }

  async function applyBulk(action, ids, { source = 'bulk' } = {}) {
    if (!user || !ids.length) return;
    setBusy(source === 'bulk' ? 'bulk' : ids[0]);

    try {
      const token = await user.getIdToken();
      const result = await bulkAdminResources({ ids, action }, token);
      push(t(BULK_TOAST[action], { count: formatNumber(result.affected, i18n.language) }), {
        type: action === 'delete' ? 'info' : 'success'
      });
      setConfirm(null);
      setSelected([]);
      setReloadToken((value) => value + 1);
    } catch (err) {
      console.warn('[admin-resources] bulk', err);
      push(err?.message || t('admin.resources.errorText'), { type: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function handleDuplicate(row) {
    if (!user) return;
    setBusy(row.id);

    try {
      const resource = await fetchResourceById(row.id);
      if (!resource) throw new Error(t('admin.resources.duplicateMissing'));

      const values = resourceToFormValues(resource);
      values.title_en = `${values.title_en} (copy)`.slice(0, 160);
      values.status = 'draft';
      values.featured = false;

      const token = await user.getIdToken();
      const created = await createAdminResource(toResourcePayload(values), token);
      push(t('admin.resources.actions.duplicateSuccess'));
      navigate(`/admin/resources/${created.id}/edit`);
    } catch (err) {
      console.warn('[admin-resources] duplicate', err);
      push(err?.message || t('admin.resources.errorText'), { type: 'error' });
    } finally {
      setBusy(null);
    }
  }

  function requestDelete(row) {
    setConfirm({ action: 'delete', ids: [row.id], title: localized(row.title) || row.id });
  }

  function requestBulkDelete() {
    setConfirm({ action: 'delete', ids: [...selected], title: '' });
  }

  const columns = [
    {
      key: 'resource',
      header: t('admin.resources.columns.resource'),
      sortable: true,
      render: (row) => {
        const title = localized(row.title, i18n.language) || t('admin.resources.untitled');
        return (
          <div className="flex items-center gap-3">
            {row.thumbnailUrl ? (
              <img
                src={row.thumbnailUrl}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-lg border border-sand-200 object-cover"
              />
            ) : (
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sand-100 text-sm font-semibold text-ink-muted"
                aria-hidden="true"
              >
                {(title || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="max-w-[16rem] truncate font-medium text-ink" title={title}>
                {title}
              </p>
              <p className="max-w-[16rem] truncate text-xs text-ink-muted">
                {row.sourceName || row.slug || '—'}
              </p>
              {row.youtubePlaylistId && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
                  <Youtube className="h-2.5 w-2.5" aria-hidden="true" />
                  {t('youtubeCourse.adminBadge')}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'type',
      header: t('admin.resources.columns.type'),
      render: (row) => <TypeChip type={row.type} />
    },
    {
      key: 'category',
      header: t('admin.resources.columns.category'),
      render: (row) => (
        <span className="block max-w-[11rem] truncate" title={row.category || ''}>
          {categoryLabel(row.category) || '—'}
        </span>
      )
    },
    {
      key: 'status',
      header: t('admin.resources.columns.status'),
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      key: 'views',
      header: t('admin.resources.columns.views'),
      sortable: true,
      align: 'end',
      render: (row) => formatNumber(row.viewCount || 0, i18n.language)
    },
    {
      key: 'rating',
      header: t('admin.resources.columns.rating'),
      sortable: true,
      align: 'end',
      render: (row) =>
        row.ratingCount > 0 ? (
          <span className="whitespace-nowrap font-medium text-ink">
            {Number(row.ratingAvg || 0).toFixed(1)}
            <span className="ms-1 text-xs font-normal text-ink-muted">
              ({formatNumber(row.ratingCount, i18n.language)})
            </span>
          </span>
        ) : (
          <span className="text-ink-muted">{t('admin.resources.noRating')}</span>
        )
    },
    {
      key: 'updatedAt',
      header: t('admin.resources.columns.updated'),
      sortable: true,
      render: (row) => (
        <span className="whitespace-nowrap">{formatDate(row.updatedAt, i18n.language)}</span>
      )
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('admin.resources.columns.actions')}</span>,
      align: 'end',
      render: (row) => (
        <RowMenu
          row={row}
          busy={busy === row.id}
          onEdit={() => navigate(`/admin/resources/${row.id}/edit`)}
          onDuplicate={() => handleDuplicate(row)}
          onTogglePublish={() =>
            applyBulk(row.status === 'published' ? 'draft' : 'publish', [row.id], {
              source: 'row'
            })
          }
          onDelete={() => requestDelete(row)}
        />
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t('admin.eyebrow')}
        title={t('admin.resources.title')}
        description={t('admin.resources.subtitle')}
        actions={
          <>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading}
              className="btn-secondary"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {t('admin.resources.refresh')}
            </button>
            <Link to="/admin/resources/new?youtube=1" className="btn-secondary">
              <Youtube className="h-4 w-4" aria-hidden="true" />
              {t('youtubeCourse.adminButton')}
            </Link>
            <Link to="/admin/resources/new" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('admin.resources.newResource')}
            </Link>
          </>
        }
      />

      <div className="mb-4 rounded-2xl border border-sand-200 bg-surface p-3 shadow-soft">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(9rem,0.6fr))]">
          <SearchInput
            id="admin-resource-search"
            value={search}
            onChange={setSearch}
            placeholder={t('admin.resources.filters.searchPlaceholder')}
            label={t('admin.resources.filters.searchLabel')}
          />

          <label className="sr-only" htmlFor="admin-resource-type">
            {t('admin.resources.filters.type')}
          </label>
          <select
            id="admin-resource-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="input h-10 text-sm"
          >
            <option value="">{t('admin.resources.filters.allTypes')}</option>
            {RESOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`type.${value}`)}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="admin-resource-status">
            {t('admin.resources.filters.status')}
          </label>
          <select
            id="admin-resource-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="input h-10 text-sm"
          >
            <option value="">{t('admin.resources.filters.allStatuses')}</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`admin.status.${value}`)}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="admin-resource-category">
            {t('admin.resources.filters.category')}
          </label>
          <select
            id="admin-resource-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="input h-10 text-sm"
          >
            <option value="">{t('admin.resources.filters.allCategories')}</option>
            {categoryOptions.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="admin-resource-language">
            {t('admin.resources.filters.language')}
          </label>
          <select
            id="admin-resource-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="input h-10 text-sm"
          >
            <option value="">{t('admin.resources.filters.allLanguages')}</option>
            {LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {t(`admin.resources.languages.${value.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-accent-700 underline-offset-2 hover:underline dark:text-accent-300"
            >
              {t('admin.resources.filters.clear')}
            </button>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-accent-200 bg-accent-50/70 px-3 py-2 dark:border-accent-500/30 dark:bg-accent-500/10">
          <p className="me-auto text-sm font-semibold text-ink">
            {t('admin.resources.bulk.selected', {
              count: formatNumber(selected.length, i18n.language)
            })}
          </p>
          <button
            type="button"
            onClick={() => applyBulk('publish', selected)}
            disabled={busy === 'bulk'}
            className="btn-secondary !py-1.5 text-xs"
          >
            <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.resources.bulk.publish')}
          </button>
          <button
            type="button"
            onClick={() => applyBulk('draft', selected)}
            disabled={busy === 'bulk'}
            className="btn-secondary !py-1.5 text-xs"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.resources.bulk.draft')}
          </button>
          <button
            type="button"
            onClick={() => applyBulk('flag', selected)}
            disabled={busy === 'bulk'}
            className="btn-secondary !py-1.5 text-xs"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.resources.bulk.flag')}
          </button>
          <button
            type="button"
            onClick={requestBulkDelete}
            disabled={busy === 'bulk'}
            className="btn border border-rose-200 bg-rose-600 !py-1.5 text-xs text-white hover:bg-rose-700 dark:border-rose-500/40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.resources.bulk.delete')}
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            disabled={busy === 'bulk'}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            {t('admin.resources.bulk.clear')}
          </button>
        </div>
      )}

      {truncated && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t('admin.resources.truncated')}</p>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
          <AlertTriangle className="mx-auto h-6 w-6 text-rose-500" aria-hidden="true" />
          <p className="mt-2 font-semibold text-ink">{t('admin.resources.errorTitle')}</p>
          <p className="mt-1 text-sm text-ink-soft">{error.message || t('admin.resources.errorText')}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('admin.resources.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          skeletonRows={Math.min(pageSize, 8)}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          sort={sort}
          onSortChange={setSort}
          pagination={{
            page,
            pageSize,
            total,
            pageSizeOptions: [10, 25, 50],
            onPageChange: goToPage,
            onPageSizeChange: (size) => setPageSize(size)
          }}
          caption={t('admin.resources.tableCaption')}
          emptyTitle={
            hasFilters ? t('admin.resources.emptyFilteredTitle') : t('admin.resources.emptyTitle')
          }
          emptyText={
            hasFilters ? t('admin.resources.emptyFilteredText') : t('admin.resources.emptyText')
          }
          emptyAction={
            hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary">
                {t('admin.resources.filters.clear')}
              </button>
            ) : (
              <Link to="/admin/resources/new" className="btn-primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('admin.resources.newResource')}
              </Link>
            )
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm && confirm.ids.length > 1
            ? t('admin.resources.confirm.bulkDeleteTitle', {
                count: formatNumber(confirm.ids.length, i18n.language)
              })
            : t('admin.resources.confirm.deleteTitle')
        }
        message={
          confirm && confirm.ids.length > 1
            ? t('admin.resources.confirm.bulkDeleteMessage', {
                count: formatNumber(confirm.ids.length, i18n.language)
              })
            : t('admin.resources.confirm.deleteMessage', { title: confirm?.title || '' })
        }
        confirmLabel={t('admin.resources.actions.delete')}
        loading={Boolean(busy)}
        onConfirm={() =>
          confirm && applyBulk(confirm.action, confirm.ids, { source: confirm.ids.length > 1 ? 'bulk' : 'row' })
        }
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
