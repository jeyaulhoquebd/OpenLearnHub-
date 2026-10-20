import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Eye, EyeOff, Star, Trash2, UserRound } from 'lucide-react';
import Modal from '../ui/Modal';
import StarRating from '../../StarRating';
import { formatDate } from '../../../lib/utils';
import { TYPE_META } from '../../../lib/constants';

/**
 * Read-only review detail. Moderation actions are delegated to the page so the
 * same confirmation flow is used by the table and the modal.
 */
export default function ReviewDetailModal({ open, review, onClose, onAction }) {
  const { t, i18n } = useTranslation();

  if (!review) return null;

  const resourceTitle = review.resource?.title?.en || review.resourceId;
  const resourceLink = review.resourceId ? `/resource/${review.resourceId}` : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      id="admin-review-detail"
      title={t('admin.reviews.detail.title')}
      description={t('admin.reviews.detail.subtitle')}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('admin.reviews.detail.close')}
          </button>
          <button
            type="button"
            onClick={() => onAction(review.hidden ? 'show' : 'hide')}
            className="btn-secondary"
          >
            {review.hidden ? (
              <Eye className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            )}
            {review.hidden ? t('admin.reviews.actions.show') : t('admin.reviews.actions.hide')}
          </button>
          <button
            type="button"
            onClick={() => onAction('delete')}
            className="btn border border-red-200 bg-red-600 text-white hover:bg-red-700 dark:border-red-500/40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('admin.reviews.actions.delete')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <UserRound className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              {review.authorName || t('admin.reviews.anonymous')}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted" dir="ltr">
              {review.userId === 'deleted' ? t('admin.reviews.anonymous') : review.userId}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StarRating value={review.rating} />
            <span
              className={`chip ${
                review.hidden
                  ? 'border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
              }`}
            >
              {review.hidden ? (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {review.hidden ? t('admin.reviews.hidden') : t('admin.reviews.visible')}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('admin.reviews.detail.resource')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink" dir="auto">
              {resourceTitle}
            </span>
            {review.resource?.type ? (
              <span className="chip border border-sand-300 bg-sand-100 text-ink-muted">
                {t(TYPE_META[review.resource.type]?.labelKey || 'type.course')}
              </span>
            ) : null}
            {resourceLink && review.resource ? (
              <Link
                to={resourceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline dark:text-accent-300"
              >
                {t('admin.reviews.detail.viewResource')}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('admin.reviews.detail.comment')}
          </p>
          {review.body ? (
            <p className="mt-1.5 whitespace-pre-line rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm leading-relaxed text-ink-soft">
              {review.body}
            </p>
          ) : (
            <p className="mt-1.5 text-sm italic text-ink-muted">
              {t('admin.reviews.detail.noComment')}
            </p>
          )}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('admin.reviews.detail.createdAt')}
            </dt>
            <dd className="mt-0.5 text-ink-soft">{formatDate(review.createdAt, i18n.language)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('admin.reviews.detail.updatedAt')}
            </dt>
            <dd className="mt-0.5 text-ink-soft">{formatDate(review.updatedAt, i18n.language)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('admin.reviews.detail.reviewId')}
            </dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-ink-muted" dir="ltr">
              {review.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('admin.reviews.detail.rating')}
            </dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 text-ink-soft">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {t('admin.reviews.ratingOutOf', { value: review.rating })}
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
