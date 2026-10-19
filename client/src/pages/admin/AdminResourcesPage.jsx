import { BookOpen } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminResourcesPage() {
  return (
    <AdminPlaceholder
      pageKey="resources"
      icon={BookOpen}
      bullets={[
        'admin.pages.resources.b1',
        'admin.pages.resources.b2',
        'admin.pages.resources.b3'
      ]}
    />
  );
}
