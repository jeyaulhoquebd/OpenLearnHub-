import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../lib/utils';

function pretty(value) {
  if (value == null) return '';
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return '';
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        return text;
      }
    }
    return text;
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Expanded row for the audit log table.
 *
 * Audit details are stored as flat scalars (the writer stringifies nested
 * objects). `before` / `after` are rendered as pretty JSON when present;
 * everything else is listed as a simple definition list.
 */
export default function AuditDetails({ row }) {
  const { t, i18n } = useTranslation();
  const details = row.details && typeof row.details === 'object' ? row.details : {};
  const before = details.before;
  const after = details.after;
  const entries = Object.entries(details).filter(([key]) => key !== 'before' && key !== 'after');

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink-muted">{t('admin.auditLog.details.who')}</dt>
          <dd className="mt-0.5 break-words text-ink">
            {row.adminName || row.adminEmail || row.adminUid}
            {row.adminEmail && row.adminName ? (
              <span className="block text-ink-muted">{row.adminEmail}</span>
            ) : null}
            <span className="mt-0.5 block font-mono text-[10px] text-ink-muted">{row.adminUid}</span>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">{t('admin.auditLog.details.when')}</dt>
          <dd className="mt-0.5 text-ink">{formatDateTime(row.createdAt, i18n.language)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">{t('admin.auditLog.details.action')}</dt>
          <dd className="mt-0.5">
            <code className="rounded bg-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-ink dark:bg-white/10">
              {row.action}
            </code>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">{t('admin.auditLog.details.target')}</dt>
          <dd className="mt-0.5 break-words text-ink">
            {row.targetType || '—'}
            {row.targetId ? (
              <span className="block font-mono text-[10px] text-ink-muted">{row.targetId}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="min-w-0">
        {before || after ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                {t('admin.auditLog.details.before')}
              </p>
              <pre
                dir="ltr"
                className="mt-1 max-h-56 overflow-auto rounded-xl border border-sand-200 bg-surface p-3 text-[11px] leading-relaxed text-ink-soft"
              >
                {pretty(before) || '—'}
              </pre>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                {t('admin.auditLog.details.after')}
              </p>
              <pre
                dir="ltr"
                className="mt-1 max-h-56 overflow-auto rounded-xl border border-sand-200 bg-surface p-3 text-[11px] leading-relaxed text-ink-soft"
              >
                {pretty(after) || '—'}
              </pre>
            </div>
          </div>
        ) : null}

        {entries.length ? (
          <dl className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="font-semibold text-ink-muted">{key}</dt>
                <dd className="break-words text-ink-soft">
                  {Array.isArray(value) ? value.join(', ') : pretty(value) || '—'}
                </dd>
              </div>
            ))}
          </dl>
        ) : !before && !after ? (
          <p className="text-xs text-ink-muted">{t('admin.auditLog.details.noDetails')}</p>
        ) : null}
      </div>
    </div>
  );
}
