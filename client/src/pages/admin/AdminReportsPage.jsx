import { Flag } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminReportsPage() {
  return (
    <AdminPlaceholder
      pageKey="reports"
      icon={Flag}
      bullets={['admin.pages.reports.b1', 'admin.pages.reports.b2']}
    />
  );
}
