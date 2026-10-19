import { FolderTree } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminCategoriesPage() {
  return (
    <AdminPlaceholder
      pageKey="categories"
      icon={FolderTree}
      bullets={['admin.pages.categories.b1', 'admin.pages.categories.b2']}
    />
  );
}
