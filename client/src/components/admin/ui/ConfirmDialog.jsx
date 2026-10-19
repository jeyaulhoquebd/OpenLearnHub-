import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

/**
 * Destructive-action confirmation built on Modal.
 *
 * `tone="danger"` turns the confirm button red (publish/reject/delete). The
 * dialog stays open while `loading` is true so the caller can show progress.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  id = 'admin-confirm'
}) {
  const { t } = useTranslation();

  const confirmClass =
    tone === 'danger'
      ? 'btn border border-red-200 bg-red-600 text-white hover:bg-red-700 dark:border-red-500/40'
      : 'btn-primary';

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      id={id}
      size="sm"
      title={title || t('admin.ui.confirmTitle')}
      description={message || t('admin.ui.confirmText')}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
            {cancelLabel || t('admin.ui.cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={confirmClass}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel || t('admin.ui.confirm')}
          </button>
        </>
      }
    />
  );
}
