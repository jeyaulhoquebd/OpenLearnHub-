import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from './ui/PageHeader';

/**
 * Shared placeholder for admin screens that arrive in the next build step.
 *
 * Every menu entry is routable today so the shell, breadcrumbs, lazy loading
 * and permissions can be tested end to end; the real tools replace
 * `<AdminPlaceholder>` one screen at a time without touching the layout.
 */
export default function AdminPlaceholder({ pageKey, icon: Icon, bullets = [] }) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        eyebrow={t('admin.eyebrow')}
        title={t(`admin.pages.${pageKey}.title`)}
        description={t(`admin.pages.${pageKey}.description`)}
        actions={
          <span className="chip bg-accent-50 text-accent-700 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-200 dark:ring-accent-500/30">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.pages.comingSoon')}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <section className="card p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
            {Icon ? <Icon className="h-6 w-6" aria-hidden="true" /> : <Sparkles className="h-6 w-6" aria-hidden="true" />}
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">
            {t('admin.pages.placeholderTitle')}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            {t('admin.pages.placeholderText')}
          </p>

          {bullets.length > 0 && (
            <>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                {t('admin.pages.upcoming')}
              </p>
              <ul className="mt-3 space-y-2.5">
                {bullets.map((key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <aside className="rounded-2xl border border-sand-200 bg-surface p-6 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <ShieldCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
            {t('admin.pages.noteTitle')}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">{t('admin.pages.noteText')}</p>
          <div className="mt-4 rounded-xl bg-sand-50 px-3.5 py-3 text-[11px] leading-relaxed text-ink-muted">
            {t('admin.pages.noteAudit')}
          </div>
        </aside>
      </div>
    </>
  );
}
