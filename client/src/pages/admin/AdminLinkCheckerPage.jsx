import { Link2 } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminLinkCheckerPage() {
  return (
    <AdminPlaceholder
      pageKey="linkChecker"
      icon={Link2}
      bullets={['admin.pages.linkChecker.b1', 'admin.pages.linkChecker.b2']}
    />
  );
}
