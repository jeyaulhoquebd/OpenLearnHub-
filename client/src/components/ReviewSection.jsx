import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MessageSquare, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import StarRating from './StarRating';
import EmailVerificationBanner from './EmailVerificationBanner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteReview, fetchReviews, fetchUserReview, saveReview, summarizeReviews } from '../lib/data';
import { reviewSchema, sanitizeText } from '../lib/validation';
import { formatDate, initials } from '../lib/utils';

function DistributionBars({ distribution, count }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {[5, 4, 3, 2, 1].map((star) => {
        const value = distribution[star - 1] || 0;
        const pct = count ? Math.round((value / count) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2.5 text-xs text-ink-muted">
            <span className="w-8 shrink-0 font-semibold">{star} ★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200 dark:bg-white/10">
              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
            </span>
            <span className="w-8 shrink-0 text-end tabular-nums">{value}</span>
          </div>
        );
      })}
      <span className="sr-only">{t('reviews.summarySr', { count })}</span>
    </div>
  );
}

export default function ReviewSection({ resourceId }) {
  const { t, i18n } = useTranslation();
  const { user, isVerified, firebaseReady } = useAuth();
  const { push } = useToast();
  const [reviews, setReviews] = useState([]);
  const [ownReview, setOwnReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, body: '' }
  });

  const rating = watch('rating');

  const load = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      const [list, mine] = await Promise.all([
        fetchReviews(resourceId),
        user ? fetchUserReview(resourceId, user.uid) : Promise.resolve(null)
      ]);
      setReviews(list);
      setOwnReview(mine);
    } catch (error) {
      console.warn('[reviews]', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [resourceId, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (ownReview && editing) {
      reset({ rating: ownReview.rating || 0, body: ownReview.text || '' });
    }
  }, [ownReview, editing, reset]);

  const summary = summarizeReviews(reviews);
  const canReview = Boolean(user && isVerified);

  async function onSubmit(values) {
    try {
      // The server sets the author name from the profile / verified token.
      await saveReview({
        resourceId,
        uid: user.uid,
        rating: values.rating,
        body: sanitizeText(values.body, { max: 2000, multiline: true })
      });
      push(ownReview ? t('reviews.updated') : t('reviews.posted'));
      setEditing(false);
      reset({ rating: 0, body: '' });
      await load();
    } catch (error) {
      console.warn('[review-save]', error);
      push(t('reviews.error'), { type: 'error' });
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('reviews.confirmDelete'))) return;
    try {
      await deleteReview(resourceId, user.uid);
      push(t('reviews.deleted'));
      setEditing(false);
      reset({ rating: 0, body: '' });
      await load();
    } catch (error) {
      console.warn('[review-delete]', error);
      push(t(error?.code === 'review_moderated' ? 'reviews.moderatedNoDelete' : 'reviews.error'), {
        type: 'error'
      });
    }
  }

  return (
    <section className="mt-5 card p-6 sm:p-8" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="reviews-title" className="font-display text-2xl font-semibold text-ink">
            {t('reviews.title')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('reviews.subtitle')}</p>
        </div>
        {user && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-secondary btn-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            {ownReview ? t('reviews.editMine') : t('reviews.write')}
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[10rem_1fr] sm:items-center">
        <div className="text-center sm:text-start">
          <p className="font-display text-4xl font-semibold text-ink">
            {summary.count ? summary.average.toFixed(1) : '—'}
          </p>
          <StarRating value={summary.average} size="sm" className="mt-1.5" />
          <p className="mt-1.5 text-xs text-ink-muted">
            {t('reviews.count', { count: summary.count })}
          </p>
        </div>
        <DistributionBars distribution={summary.distribution} count={summary.count} />
      </div>

      {!firebaseReady && <EmailVerificationBanner className="mt-6" />}

      {firebaseReady && !user && (
        <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50/70 p-5 text-sm text-ink-soft">
          <p className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <span>
              {t('reviews.signInToReview')}{' '}
              <Link
                to="/login"
                state={{ from: `${window.location.pathname}${window.location.search}` }}
                className="font-semibold text-brand-700 underline underline-offset-2"
              >
                {t('nav.login')}
              </Link>
            </span>
          </p>
        </div>
      )}

      {user && !isVerified && (
        <div className="mt-6">
          <p className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {t('reviews.verifyToReview')}
          </p>
          <EmailVerificationBanner />
        </div>
      )}

      {canReview && editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-2xl border border-sand-200 bg-sand-50/60 p-5" noValidate>
          <div>
            <span className="label">{t('reviews.ratingLabel')}</span>
            <div className="mt-1 flex items-center gap-3">
              <StarRating
                value={rating}
                size="lg"
                onChange={(value) => setValue('rating', value, { shouldValidate: true })}
                label={t('reviews.ratingLabel')}
              />
            </div>
            {errors.rating && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                {t(errors.rating.message)}
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="review-body">
              {t('reviews.bodyLabel')}
            </label>
            <textarea
              id="review-body"
              className="input min-h-[120px] resize-y"
              maxLength={2000}
              placeholder={t('reviews.bodyPlaceholder')}
              aria-invalid={Boolean(errors.body)}
              {...register('body')}
            />
            {errors.body && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                {t(errors.body.message)}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary justify-center">
              {t('common.cancel')}
            </button>
            {ownReview && (
              <button
                type="button"
                onClick={handleDelete}
                className="btn-secondary justify-center border-red-300 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:text-red-200"
              >
                <Trash2 className="h-4 w-4" />
                {t('reviews.delete')}
              </button>
            )}
            <button type="submit" className="btn-primary justify-center" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {ownReview ? t('common.save') : t('reviews.submit')}
            </button>
          </div>
        </form>
      )}

      <div className="mt-7 space-y-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((item) => (
              <div key={item} className="skeleton h-24 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="rounded-2xl bg-sand-50/70 px-5 py-6 text-center text-sm text-ink-muted">
            {t('reviews.empty')}
          </p>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="border-t border-sand-100 pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                  {initials(review.authorName || 'Learner')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {review.authorName || t('reviews.anonymous')}
                      {user && review.userId === user.uid && (
                        <span className="ms-2 text-[11px] font-medium text-brand-700">{t('reviews.you')}</span>
                      )}
                    </p>
                    <StarRating value={review.rating} size="sm" />
                    <span className="text-xs text-ink-muted">
                      {formatDate(review.createdAt, i18n.language)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                    {review.text}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
