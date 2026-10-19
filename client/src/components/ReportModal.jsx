import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, X } from 'lucide-react';
import { REPORT_REASONS } from '../lib/constants';
import { submitReport } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ReportModal({ open, onClose, resource }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
      setEmail(user?.email || '');
      setStatus('idle');
      setErrorMessage('');
    }
  }, [open, user?.email]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !resource) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!reason) {
      setErrorMessage(t('report.requiredReason'));
      return;
    }
    setStatus('submitting');
    setErrorMessage('');
    try {
      const token = user ? await user.getIdToken() : undefined;
      await submitReport(
        {
          resourceId: resource.id,
          resourceTitle: resource.title,
          resourceType: resource.type,
          resourceUrl: resource.url,
          reason,
          details: details.trim(),
          email: email.trim(),
          locale: i18n.language
        },
        token
      );
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error?.message || t('report.error'));
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-sand-200 bg-white p-6 shadow-float animate-fade-up sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 id="report-title" className="font-display text-xl font-semibold text-ink">
                {t('report.title')}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{t('report.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-sand-100 hover:text-ink"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" />
            <h3 className="mt-3 font-display text-lg font-semibold text-ink">{t('report.successTitle')}</h3>
            <p className="mt-1.5 text-sm text-ink-soft">{t('report.successText')}</p>
            <button type="button" onClick={onClose} className="btn-primary mt-5">
              {t('report.close')}
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="rounded-2xl bg-sand-100/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t('report.resource')}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{resource.title}</p>
            </div>

            <div>
              <label className="label" htmlFor="report-reason">
                {t('report.reason')}
              </label>
              <select
                id="report-reason"
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              >
                <option value="">{t('report.chooseReason')}</option>
                {REPORT_REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="report-details">
                {t('report.details')} <span className="font-normal text-ink-muted">({t('common.optional')})</span>
              </label>
              <textarea
                id="report-details"
                className="input min-h-[108px] resize-y"
                maxLength={1000}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={t('report.detailsPlaceholder')}
              />
            </div>

            <div>
              <label className="label" htmlFor="report-email">
                {t('report.email')}
              </label>
              <input
                id="report-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <p className="mt-1.5 text-xs text-ink-muted">{t('report.emailHint')}</p>
            </div>

            {errorMessage && (
              <p className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {errorMessage}
              </p>
            )}

            <p className="rounded-2xl bg-sand-100/80 px-4 py-3 text-xs leading-relaxed text-ink-muted">
              {t('report.legalNote')}
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="btn-secondary justify-center">
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary justify-center" disabled={status === 'submitting'}>
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('report.sending')}
                  </>
                ) : (
                  t('report.submit')
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
