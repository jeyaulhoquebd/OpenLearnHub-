import {
  ArrowLeftRight,
  BookOpen,
  Flag,
  FolderTree,
  LayoutDashboard,
  Link2,
  ScrollText,
  Settings,
  Sparkles,
  Star,
  Upload,
  Users
} from 'lucide-react';

/**
 * Single source of truth for the admin navigation. The sidebar, the top-bar
 * breadcrumbs and the router all read from here, so adding a screen means
 * editing one list.
 *
 * `key` maps to the `admin.sidebar.items.*` translation namespace.
 */
export const ADMIN_NAV_GROUPS = [
  {
    key: 'overview',
    items: [{ to: '/admin', key: 'dashboard', icon: LayoutDashboard, end: true }]
  },
  {
    key: 'content',
    items: [
      { to: '/admin/resources', key: 'resources', icon: BookOpen },
      { to: '/admin/categories', key: 'categories', icon: FolderTree },
      { to: '/admin/alternatives', key: 'alternatives', icon: ArrowLeftRight }
    ]
  },
  {
    key: 'community',
    items: [
      { to: '/admin/users', key: 'users', icon: Users },
      { to: '/admin/reviews', key: 'reviews', icon: Star },
      { to: '/admin/reports', key: 'reports', icon: Flag }
    ]
  },
  {
    key: 'system',
    items: [
      { to: '/admin/link-checker', key: 'linkChecker', icon: Link2 },
      { to: '/admin/import-export', key: 'importExport', icon: Upload },
      { to: '/admin/ai', key: 'aiSettings', icon: Sparkles },
      { to: '/admin/settings', key: 'siteSettings', icon: Settings },
      { to: '/admin/audit-log', key: 'auditLog', icon: ScrollText }
    ]
  }
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

/** Resolves the nav entry for a pathname (longest match wins). */
export function findAdminNavItem(pathname = '') {
  const matches = ADMIN_NAV_ITEMS.filter((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
  return matches.sort((a, b) => b.to.length - a.to.length)[0] || null;
}
