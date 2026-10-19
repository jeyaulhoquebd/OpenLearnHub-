import { ScrollText } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminAuditLogPage() {
  return (
    <AdminPlaceholder
      pageKey="auditLog"
      icon={ScrollText}
      bullets={['admin.pages.auditLog.b1', 'admin.pages.auditLog.b2']}
    />
  );
}
