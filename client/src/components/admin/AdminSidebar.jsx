import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X
} from 'lucide-react';
import { ADMIN_NAV_GROUPS } from './adminNav';

/**
 * Navy admin sidebar.
 *
 * Desktop: fixed, collapsible to an icon rail (state persisted by AdminLayout).
 * Mobile: an off-canvas drawer controlled by the top bar's menu button.
 * The drawer slides from the inline-start edge, so it mirrors in Urdu.
 */
export default function AdminSidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onClose,
  pendingReports = 0
}) {
  const { t, i18n } = useTranslation();
  const isRtl = String(i18n.language || 'en').startsWith('ur');
  const hiddenTransform = isRtl ? 'translate-x-full' : '-translate-x-full';

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="admin-sidebar"
        aria-label={t('admin.sidebar.menuLabel')}
        className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-white/10 bg-navy-950 text-navy-100 transition-transform duration-200 lg:translate-x-0 ${
          collapsed ? 'lg:w-[5.25rem]' : 'lg:w-72'
        } ${mobileOpen ? 'visible translate-x-0' : `invisible lg:visible ${hiddenTransform}`}`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-3.5">
          <Link
            to="/admin"
            className={`flex min-w-0 items-center gap-2.5 rounded-xl ${collapsed ? 'lg:mx-auto' : ''}`}
            aria-label={`${t('common.appName')} — ${t('admin.sidebar.badge')}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
                <path d="M16 20.5C16 18.6 17.6 17 19.5 17H30v29H19.5C17.6 46 16 44.4 16 42.5v-22Z" fill="#93B4F8" />
                <path d="M48 20.5C48 18.6 46.4 17 44.5 17H34v29h10.5c1.9 0 3.5-1.6 3.5-3.5v-22Z" fill="#EAF0FA" />
                <path d="M32 17v31" stroke="#071433" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="46" cy="45" r="7.5" fill="#7C3AED" />
                <path d="M43.5 45h5M46 42.5v5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            {!collapsed && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-display text-sm font-semibold text-white">
                  {t('common.appName')}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-200 ring-1 ring-accent-400/30">
                  <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                  {t('admin.sidebar.badge')}
                </span>
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="ms-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-navy-100 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={t('admin.sidebar.close')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.key} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-200/45">
                  {t(`admin.sidebar.groups.${group.key}`)}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const label = t(`admin.sidebar.items.${item.key}`);
                  const badge = item.key === 'reports' && pendingReports > 0 ? pendingReports : null;

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            collapsed ? 'lg:justify-center' : ''
                          } ${
                            isActive
                              ? 'bg-accent-500 text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.95)]'
                              : 'text-navy-100/75 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="truncate">{label}</span>}
                        {badge != null &&
                          (!collapsed ? (
                            <span className="ms-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {badge}
                            </span>
                          ) : (
                            <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-400" />
                          ))}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 space-y-1 border-t border-white/10 p-2.5">
          <Link
            to="/"
            title={collapsed ? t('admin.sidebar.backToSite') : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-100/70 transition hover:bg-white/10 hover:text-white ${
              collapsed ? 'lg:justify-center' : ''
            }`}
          >
            <ArrowUpRight className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{t('admin.sidebar.backToSite')}</span>}
          </Link>

          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? t('admin.sidebar.expand') : t('admin.sidebar.collapse')}
            aria-label={collapsed ? t('admin.sidebar.expand') : t('admin.sidebar.collapse')}
            className={`hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-100/60 transition hover:bg-white/10 hover:text-white lg:flex ${
              collapsed ? 'lg:justify-center' : ''
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px] shrink-0 rtl:rotate-180" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0 rtl:rotate-180" aria-hidden="true" />
            )}
            {!collapsed && <span className="truncate">{t('admin.sidebar.collapse')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
