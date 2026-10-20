import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import Drawer from '../ui/Drawer';
import ConfirmDialog from '../ui/ConfirmDialog';
import StatusBadge from '../ui/StatusBadge';
import ReportReasonBadge from './ReportReasonBadge';
import { REPORT_STATUSES, isIllegalReason } from './reportMeta';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { refreshAdminCounts } from '../../../hooks/useAdminCounts';
import { unpublishReportedResource, updateAdminReport } from '../../../lib/api';
import { formatDate, localized } from '../../../lib/utils';

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-sand-100 py-2.5 last:border-0">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="min-w-0 text-end text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * Report detail drawer.
 *
 * The note + status form is saved in one PATCH; the quick actions resolve,
 * dismiss or unpublish the reported resource. Unpublishing is destructive and
 * confirmed first. Every successful write dispatches a shell-count refresh so
 * the sidebar and bell badges stay accurate.
 */
export default function ReportDetailDrawer({ open, report, onClose, onChanged }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [status, setStatus] = useState('open');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  useEffect(() => {
    if (!open || !report) return;
    setStatus(report.status || 'open');
    setNote(report.adminNote || '');
    setConfirmUnpublish(false);
  }, [open, report]);

  if (!report) {
    return <Drawer open={false} onClose={onClose} title={t('admin.reportQueue.drawer.title')} />;
  }

  const resourceTitle =
    localized(report.resource?.title || report.resourceTitle, i18n.language) ||
    report.resourceId ||
    t('admin.reportQueue.drawer.resourceMissing');

  const canUseResource = Boolean(report.resourceId && report.resource);
  const sourceUrl = report.resource?.sourceUrl || report.resourceUrl || '';
  const hasSafeSource = /^https?:\/\//i.test(sourceUrl);
  const dirty = status !== report.status || note !== (report.adminNote || '');
  const illegal = isIllegalReason(report.reason);

  async function run(update, successKey) {
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const result = await updateAdminReport(report.id, update, token);
      const next = result.report;
      setStatus(next?.status || status);
      setNote(next?.adminNote || '');
      refreshAdminCounts();
      push(t(successKey), { type: 'success' });
      onChanged?.(next);
    } catch (error) {
      push(error.message || t('admin.reportQueue.drawer.actionError'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!user || !report) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const result = await unpublishReportedResource(report.id, token);
      const next = result.report;
      setStatus(next?.status || 'resolved');
      setNote(next?.adminNote || note);
      refreshAdminCounts();
      push(t('admin.reportQueue.drawer.confirm.unpublishSuccess'), { type: 'success' });
      setConfirmUnpublish(false);
      onChanged?.(next);
    } catch (error) {
      push(error.message || t('admin.reportQueue.drawer.confirm.unpublishError'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={busy ? () => {} : onClose}
        width="lg"
        title={t('admin.reportQueue.drawer.title')}
        description={resourceTitle}
        footer={
          <>
            <span className="me-auto text-xs text-ink-muted">
              {dirty
                ? t('admin.reportQueue.drawer.unsaved')
                : t('admin.reportQueue.drawer.noChanges')}
            </span>
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
              {t('admin.ui.close')}
            </button>
            <button
              type="button"
              onClick={() => run({ status, adminNote: note }, 'admin.reportQueue.drawer.saved')}
              disabled={!dirty || busy}
              className="btn-primary"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('admin.reportQueue.drawer.save')}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {illegal && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{t('admin.reportQueue.drawer.illegalHint')}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <ReportReasonBadge reason={report.reason} />
            <StatusBadge status={report.status} />
            {report.similarCount > 1 && (
              <span className="chip bg-sand-100 text-ink-soft ring-sand-300">
                {t('admin.reportQueue.drawer.similar', { count: report.similarCount })}
              </span>
            )}
          </div>

          <dl className="rounded-xl border border-sand-200 bg-sand-50/60 px-3 py-1 dark:bg-sand-100/10">
            <InfoRow label={t('admin.reportQueue.drawer.resource')}>
              {canUseResource ? (
                <Link
                  to={`/resource/${report.resourceId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  <span className="line-clamp-2" dir="auto">
                    {resourceTitle}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>
              ) : (
                <span dir="auto">{resourceTitle}</span>
              )}
            </InfoRow>

            {canUseResource && (
              <InfoRow label={t('admin.reportQueue.drawer.resourceStatus')}>
                <StatusBadge status={report.resource.status} />
              </InfoRow>
            )}

            <InfoRow label={t('admin.reportQueue.drawer.reporter')}>
              <span className="block break-all" dir="ltr">
                {report.reporterEmail || t('admin.reportQueue.drawer.anonymous')}
              </span>
              {report.verifiedReporter && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {t('admin.reportQueue.drawer.verified')}
                </span>
              )}
            </InfoRow>

            <InfoRow label={t('admin.reportQueue.drawer.submitted')}>
              <span className="whitespace-nowrap">
                {formatDate(report.createdAt, i18n.language)}
              </span>
            </InfoRow>

            <InfoRow label={t('admin.reportQueue.drawer.reportId')}>
              <span className="break-all font-mono text-[11px] text-ink-muted" dir="ltr">
                {report.id}
              </span>
            </InfoRow>

            <InfoRow label={t('admin.reportQueue.drawer.locale')}>
              <span className="uppercase">{report.locale || 'en'}</span>
            </InfoRow>

            {hasSafeSource && (
              <InfoRow label={t('admin.reportQueue.drawer.sourceUrl')}>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  dir="ltr"
                >
                  {sourceUrl}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              </InfoRow>
            )}
          </dl>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {t('admin.reportQueue.drawer.message')}
            </h3>
            <p
              className="mt-2 whitespace-pre-line rounded-xl border border-sand-200 bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink-soft"
              dir="auto"
            >
              {report.details || t('admin.reportQueue.drawer.noMessage')}
            </p>
          </section>

          <section className="space-y-3">
            <div>
              <label
                htmlFor="report-status"
                className="mb-1.5 block text-xs font-semibold text-ink-soft"
              >
                {t('admin.reportQueue.drawer.statusLabel')}
              </label>
              <select
                id="report-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={busy}
                className="input h-10 py-0 text-sm"
              >
                {REPORT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`admin.status.${value}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="report-note"
                className="mb-1.5 block text-xs font-semibold text-ink-soft"
              >
                {t('admin.reportQueue.drawer.noteLabel')}
              </label>
              <textarea
                id="report-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                rows={4}
                disabled={busy}
                placeholder={t('admin.reportQueue.drawer.notePlaceholder')}
                className="input min-h-[104px] resize-y text-sm"
              />
              <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                <span>{t('admin.reportQueue.drawer.noteHint')}</span>
                <span className="tabular-nums">{note.length}/2000</span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {t('admin.reportQueue.drawer.quickActions')}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  run(
                    { status: 'resolved', adminNote: note },
                    'admin.reportQueue.drawer.statusUpdated'
                  )
                }
                disabled={busy || report.status === 'resolved'}
                className="btn-secondary h-9 gap-1.5 px-3 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.reportQueue.drawer.resolve')}
              </button>

              <button
                type="button"
                onClick={() =>
                  run(
                    { status: 'dismissed', adminNote: note },
                    'admin.reportQueue.drawer.statusUpdated'
                  )
                }
                disabled={busy || report.status === 'dismissed'}
                className="btn-secondary h-9 gap-1.5 px-3 text-xs"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.reportQueue.drawer.dismiss')}
              </button>

              {canUseResource && (
                <Link
                  to={`/admin/resources/${report.resourceId}/edit`}
                  className="btn-secondary h-9 gap-1.5 px-3 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('admin.reportQueue.drawer.editResource')}
                </Link>
              )}

              <button
                type="button"
                onClick={() => setConfirmUnpublish(true)}
                disabled={busy || !canUseResource}
                className="btn h-9 gap-1.5 border border-red-200 bg-red-600 px-3 text-xs text-white hover:bg-red-700 dark:border-red-500/40"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.reportQueue.drawer.unpublish')}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              {t('admin.reportQueue.drawer.unpublishHint')}
            </p>
          </section>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmUnpublish}
        loading={busy}
        title={t('admin.reportQueue.drawer.confirm.unpublishTitle')}
        message={t('admin.reportQueue.drawer.confirm.unpublishMessage', {
          resource: resourceTitle
        })}
        confirmLabel={t('admin.reportQueue.drawer.confirm.unpublishConfirm')}
        onCancel={() => setConfirmUnpublish(false)}
        onConfirm={unpublish}
      />
    </>
  );
}
