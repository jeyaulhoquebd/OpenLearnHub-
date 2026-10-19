import { ArrowLeftRight } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminAlternativesPage() {
  return (
    <AdminPlaceholder
      pageKey="alternatives"
      icon={ArrowLeftRight}
      bullets={['admin.pages.alternatives.b1', 'admin.pages.alternatives.b2']}
    />
  );
}
