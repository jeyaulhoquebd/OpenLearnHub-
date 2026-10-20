import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FilterX, RefreshCw, Settings2, Users } from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import SearchInput from '../../components/admin/ui/SearchInput';
import DataTable from '../../components/admin/ui/DataTable';
import AdminUserDrawer from '../../components/admin/users/AdminUserDrawer';
import {
  AccountStatusBadge,
  ProviderIcons,
  RoleBadge,
  UserAvatar,
  VerifiedBadge
} from '../../components/admin/users/UserBadges';
import { useAuth } from '../../context/AuthContext';
import { listAdminUsers } from '../../lib/api';
import { formatDate } from '../../lib/utils';

const PROVIDER_FILTERS = ['password', 'google', 'github', 'apple', 'other'];

/**
 * Users manager.
 *
 * The unfiltered list uses Firebase Auth's native pageToken pagination; any
 * search or filter switches to a bounded server-side scan (see the API) and
 * shows a note when the scan cap is reached. The detail drawer handles the
 * privileged actions.
 */
export default function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [verified, setVerified] = useState('');
  const [provider, setProvider] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [disabled, setDisabled] = useState('');

  const [drawerUid, setDrawerUid] = useState(null);

  const tokensRef = useRef({ 1: '' });
  const requestRef = useRef(0);

  // Debounce search and restart from page 1 when the term changes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      if (next === debouncedSearch) return;
      tokensRef.current = { 1: '' };
      setPage(1);
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
      const data = await listAdminUsers(token, {
        pageToken: tokensRef.current[page] || '',
        search: debouncedSearch,
        limit,
        verified,
        provider,
        admin: adminFilter,
        disabled
      });

      if (requestId !== requestRef.current) return;

      setRows(Array.isArray(data.items) ? data.items : []);
      setNextPageToken(data.nextPageToken || null);
      setTruncated(Boolean(data.truncated));

      if (data.nextPageToken) {
        tokensRef.current = { ...tokensRef.current, [page + 1]: data.nextPageToken };
      }
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [user, page, limit, debouncedSearch, verified, provider, adminFilter, disabled]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  function updateFilter(setter, value) {
    setter(value);
    tokensRef.current = { 1: '' };
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setVerified('');
    setProvider('');
    setAdminFilter('');
    setDisabled('');
    tokensRef.current = { 1: '' };
    setPage(1);
  }

  const hasFilters = Boolean(
    debouncedSearch || verified || provider || adminFilter || disabled
  );

  // DataTable's page count is derived from `total`; a page token means there is
  // at least one more row, so add one to make "next" available.
  const total = (page - 1) * limit + rows.length + (nextPageToken ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const columns = useMemo(
    () => [
      {
        key: 'user',
        header: t('admin.users.columns.user'),
        render: (row) => (
          <div className="flex min-w-[210px] items-center gap-3">
            <UserAvatar name={row.displayName} email={row.email} photoURL={row.photoURL} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-semibold text-ink">
                  {row.displayName || t('admin.users.noName')}
                </p>
                {row.uid === user?.uid && (
                  <span className="chip border border-accent-300 bg-accent-500/10 text-[10px] text-accent-700 dark:border-accent-500/40 dark:text-accent-300">
                    {t('admin.users.you')}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-ink-muted" dir="ltr">
                {row.email || t('admin.users.noEmail')}
              </p>
            </div>
          </div>
        )
      },
      {
        key: 'verified',
        header: t('admin.users.columns.verified'),
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        render: (row) => <VerifiedBadge verified={row.emailVerified} />
      },
      {
        key: 'providers',
        header: t('admin.users.columns.providers'),
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        render: (row) => <ProviderIcons providers={row.providers} />
      },
      {
        key: 'role',
        header: t('admin.users.columns.role'),
        render: (row) => <RoleBadge isAdmin={row.isAdmin} />
      },
      {
        key: 'status',
        header: t('admin.users.columns.status'),
        render: (row) => <AccountStatusBadge disabled={row.disabled} />
      },
      {
        key: 'joined',
        header: t('admin.users.columns.joined'),
        className: 'hidden xl:table-cell whitespace-nowrap',
        headerClassName: 'hidden xl:table-cell',
        render: (row) => (
          <span className="text-xs text-ink-muted">{formatDate(row.createdAt, i18n.language)}</span>
        )
      },
      {
        key: 'lastLogin',
        header: t('admin.users.columns.lastLogin'),
        className: 'hidden xl:table-cell whitespace-nowrap',
        headerClassName: 'hidden xl:table-cell',
        render: (row) => (
          <span className="text-xs text-ink-muted">
            {formatDate(row.lastSignInAt, i18n.language)}
          </span>
        )
      },
      {
        key: 'actions',
        header: t('admin.users.columns.actions'),
        align: 'end',
        render: (row) => (
          <button
            type="button"
            onClick={() => setDrawerUid(row.uid)}
            className="btn-secondary h-8 gap-1.5 px-2.5 text-xs"
            aria-label={t('admin.users.actions.manageFor', {
              name: row.displayName || row.email || row.uid
            })}
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.users.actions.manage')}
          </button>
        )
      }
    ],
    [t, i18n.language, user?.uid]
  );

  return (
    <div>
      <PageHeader
        title={t('admin.users.title')}
        description={t('admin.users.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('admin.users.refresh')}
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput
          id="admin-users-search"
          value={search}
          onChange={setSearch}
          placeholder={t('admin.users.searchPlaceholder')}
          label={t('admin.users.searchLabel')}
          className="w-full sm:max-w-md"
        />

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-ink-muted">
            <span className="mb-1 block">{t('admin.users.filters.verified')}</span>
            <select
              value={verified}
              onChange={(event) => updateFilter(setVerified, event.target.value)}
              className="input h-9 py-0 text-xs"
            >
              <option value="">{t('admin.users.filters.allVerified')}</option>
              <option value="true">{t('admin.users.verified')}</option>
              <option value="false">{t('admin.users.unverified')}</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-ink-muted">
            <span className="mb-1 block">{t('admin.users.filters.provider')}</span>
            <select
              value={provider}
              onChange={(event) => updateFilter(setProvider, event.target.value)}
              className="input h-9 py-0 text-xs"
            >
              <option value="">{t('admin.users.filters.allProviders')}</option>
              {PROVIDER_FILTERS.map((key) => (
                <option key={key} value={key}>
                  {t(`admin.users.providers.${key}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-ink-muted">
            <span className="mb-1 block">{t('admin.users.filters.role')}</span>
            <select
              value={adminFilter}
              onChange={(event) => updateFilter(setAdminFilter, event.target.value)}
              className="input h-9 py-0 text-xs"
            >
              <option value="">{t('admin.users.filters.allRoles')}</option>
              <option value="true">{t('admin.users.roleAdmin')}</option>
              <option value="false">{t('admin.users.roleUser')}</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-ink-muted">
            <span className="mb-1 block">{t('admin.users.filters.status')}</span>
            <select
              value={disabled}
              onChange={(event) => updateFilter(setDisabled, event.target.value)}
              className="input h-9 py-0 text-xs"
            >
              <option value="">{t('admin.users.filters.allStatuses')}</option>
              <option value="false">{t('admin.users.statusActive')}</option>
              <option value="true">{t('admin.users.statusDisabled')}</option>
            </select>
          </label>

          {hasFilters && (
            <button type="button" onClick={clearFilters} className="btn-secondary h-9 gap-1.5 px-2.5 text-xs">
              <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
              {t('admin.users.filters.clear')}
            </button>
          )}
        </div>

        {truncated && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('admin.users.truncated', { limit: 1000 })}
          </p>
        )}
      </div>

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.users.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{t('admin.users.errorText')}</p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.users.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.uid}
          rowClassName={(row) =>
            row.uid === user?.uid ? 'bg-accent-50/50 dark:bg-accent-500/5' : ''
          }
          loading={loading}
          skeletonRows={8}
          emptyIcon={Users}
          emptyTitle={hasFilters ? t('admin.users.emptyFilteredTitle') : t('admin.users.emptyTitle')}
          emptyText={hasFilters ? t('admin.users.emptyFilteredText') : t('admin.users.emptyText')}
          caption={t('admin.users.tableCaption')}
          pagination={{
            page,
            pageSize: limit,
            total,
            pageSizeOptions: [10, 25, 50, 100],
            onPageSizeChange: (size) => {
              tokensRef.current = { 1: '' };
              setPage(1);
              setLimit(size);
            },
            onPageChange: (next) => {
              if (next < 1 || next > pageCount) return;
              if (next > page && !nextPageToken) return;
              setPage(next);
            }
          }}
        />
      )}

      <AdminUserDrawer
        open={Boolean(drawerUid)}
        uid={drawerUid}
        onClose={() => setDrawerUid(null)}
        onChanged={() => setReloadToken((value) => value + 1)}
      />
    </div>
  );
}
