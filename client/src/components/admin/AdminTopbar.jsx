import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ChevronRight,
  ExternalLink,
  Flag,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound
} from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import ThemeToggle from '../ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { initials } from '../../lib/utils';
import { findAdminNavItem } from './adminNav';
import SearchInput from './ui/SearchInput';

/** Small dropdown helper: closes on outside click and on Escape. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

function NotificationsMenu({ count = 0 }) {
  const { t } = useTranslation();
  const { open, setOpen, ref } = useDropdown();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('admin.topbar.notifications')}
        title={t('admin.topbar.notifications')}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-sand-300 bg-surface text-ink-soft shadow-sm transition hover:border-brand-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -end-1 -top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-sand-200 bg-surface shadow-soft animate-fade-up"
        >
          <div className="flex items-center justify-between gap-2 border-b border-sand-200 px-4 py-3">
            <p className="text-sm font-semibold text-ink">{t('admin.topbar.notifications')}</p>
            {count > 0 && (
              <span className="chip bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
                {t('admin.topbar.notificationsCount', { count })}
              </span>
            )}
          </div>

          <div className="px-4 py-4">
            <p className="text-xs leading-relaxed text-ink-soft">
              {count > 0 ? t('admin.topbar.notificationsHint') : t('admin.topbar.noNotifications')}
            </p>
          </div>

          <Link
            to="/admin/reports"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-sand-200 px-4 py-3 text-xs font-semibold text-brand-800 transition hover:bg-sand-50 dark:text-brand-200"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.topbar.viewReports')}
          </Link>
        </div>
      )}
    </div>
  );
}

function AdminMenu() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { push } = useToast();
  const { open, setOpen, ref } = useDropdown();
  const navigate = useNavigate();

  const name = profile?.displayName || user?.displayName || user?.email || '';

  async function handleSignOut() {
    setOpen(false);
    try {
      await signOut();
      push(t('auth.signOutToast'), { type: 'info' });
      navigate('/');
    } catch (error) {
      console.warn('[admin] sign out failed', error);
      push(t('common.error'), { type: 'error' });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('admin.topbar.accountMenu')}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-navy-900 text-xs font-bold text-white ring-2 ring-accent-500/40 transition hover:ring-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        {profile?.photoURL || user?.photoURL ? (
          <img
            src={profile?.photoURL || user?.photoURL}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials(name) || <UserRound className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-sand-200 bg-surface shadow-soft animate-fade-up"
        >
          <div className="border-b border-sand-200 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{name || t('admin.topbar.profile')}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{user?.email}</p>
          </div>

          <Link
            to="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition hover:bg-sand-50 hover:text-ink"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            {t('admin.topbar.profile')}
          </Link>

          <Link
            to="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition hover:bg-sand-50 hover:text-ink"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t('admin.topbar.backToSite')}
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 border-t border-sand-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('admin.topbar.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Sticky admin top bar: breadcrumbs + page title, global search (UI only for
 * now), theme, language, report notifications, and the account menu.
 */
export default function AdminTopbar({
  onOpenMenu,
  onToggleCollapse,
  collapsed = false,
  pendingReports = 0
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { pathname } = useLocation();
  const active = findAdminNavItem(pathname);
  const title = active
    ? t(`admin.sidebar.items.${active.key}`)
    : t('admin.sidebar.items.dashboard');
  const showCrumb = active && active.to !== '/admin';

  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-50/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sand-300 bg-surface text-ink shadow-sm transition hover:border-brand-300 lg:hidden"
          aria-label={t('admin.sidebar.open')}
          aria-controls="admin-sidebar"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-sand-300 bg-surface text-ink-soft shadow-sm transition hover:border-brand-300 hover:text-ink lg:grid"
          aria-label={collapsed ? t('admin.sidebar.expand') : t('admin.sidebar.collapse')}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>

        <div className="ms-1 min-w-0 flex-1">
          <nav aria-label={t('admin.topbar.breadcrumbLabel')}>
            <ol className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
              <li>
                <Link to="/admin" className="rounded transition hover:text-ink">
                  {t('admin.topbar.breadcrumbHome')}
                </Link>
              </li>
              {showCrumb && (
                <li className="flex min-w-0 items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 shrink-0 rtl:rotate-180" aria-hidden="true" />
                  <span className="truncate text-ink-soft" aria-current="page">
                    {title}
                  </span>
                </li>
              )}
            </ol>
          </nav>
          <p className="truncate font-display text-sm font-semibold text-ink">{title}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <SearchInput
              id="admin-global-search"
              value={query}
              onChange={setQuery}
              className="w-48 xl:w-72"
              label={t('admin.topbar.searchLabel')}
              placeholder={t('admin.topbar.searchPlaceholder')}
            />
          </div>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <div className="hidden lg:block">
            <LanguageSwitcher compact />
          </div>

          <NotificationsMenu count={pendingReports} />
          <AdminMenu />
        </div>
      </div>

      {/* Small screens: search on its own row so the bar stays uncluttered. */}
      <div className="border-t border-sand-100 px-4 pb-3 pt-2 md:hidden">
        <SearchInput
          id="admin-global-search-mobile"
          value={query}
          onChange={setQuery}
          label={t('admin.topbar.searchLabel')}
          placeholder={t('admin.topbar.searchPlaceholder')}
        />
      </div>
    </header>
  );
}
