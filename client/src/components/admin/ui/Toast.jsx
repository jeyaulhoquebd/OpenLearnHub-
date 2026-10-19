/**
 * Admin code uses the app-wide toast system rather than a second, competing
 * stack: one aria-live region, one z-index layer, consistent styling.
 *
 *   import { useAdminToast } from '../../components/admin/ui';
 *   const { push } = useAdminToast();
 *   push(t('admin.approveSuccess'));
 */
export {
  ToastProvider,
  useToast,
  useToast as useAdminToast
} from '../../../context/ToastContext';
