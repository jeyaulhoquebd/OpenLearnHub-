import { Settings } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminSiteSettingsPage() {
  return (
    <AdminPlaceholder
      pageKey="siteSettings"
      icon={Settings}
      bullets={['admin.pages.siteSettings.b1', 'admin.pages.siteSettings.b2']}
    />
  );
}
