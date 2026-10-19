import { Star } from 'lucide-react';
import AdminPlaceholder from '../../components/admin/AdminPlaceholder';

export default function AdminReviewsPage() {
  return (
    <AdminPlaceholder
      pageKey="reviews"
      icon={Star}
      bullets={['admin.pages.reviews.b1', 'admin.pages.reviews.b2']}
    />
  );
}
