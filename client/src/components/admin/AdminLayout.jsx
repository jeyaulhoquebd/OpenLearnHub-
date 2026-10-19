import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import { useAdminCounts } from '../../hooks/useAdminCounts';

const COLLAPSE_KEY = 'openlearn.admin.sidebar.collapsed';

/**
 * Chrome for every /admin/* screen.
 *
 * The public site header/footer are intentionally not rendered here: the admin
 * panel is a separate workspace with its own navigation.
 */
export default function AdminLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { counts } = useAdminCounts();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist the desktop rail preference.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage can be blocked in private mode — the rail still toggles. */
    }
  }, [collapsed]);

  // The drawer closes whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Prevent the page behind the drawer from scrolling.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-sand-50">
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pendingReports={counts.reports}
      />

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
          collapsed ? 'lg:ps-[5.25rem]' : 'lg:ps-72'
        }`}
      >
        <AdminTopbar
          onOpenMenu={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          collapsed={collapsed}
          pendingReports={counts.reports}
        />

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-sand-200 px-4 py-4 text-center text-[11px] text-ink-muted">
          {t('admin.footer', { year: new Date().getFullYear() })}
        </footer>
      </div>
    </div>
  );
}
