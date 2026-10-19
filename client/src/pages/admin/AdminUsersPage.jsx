import { Users } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminUsersPage() {
  return (
    <AdminPlaceholder
      pageKey="users"
      icon={Users}
      bullets={['admin.pages.users.b1', 'admin.pages.users.b2']}
    />
  );
}
