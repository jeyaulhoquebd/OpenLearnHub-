import { Upload } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminImportExportPage() {
  return (
    <AdminPlaceholder
      pageKey="importExport"
      icon={Upload}
      bullets={['admin.pages.importExport.b1', 'admin.pages.importExport.b2']}
    />
  );
}
