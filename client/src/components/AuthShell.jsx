import { useTranslation } from 'react-i18next';
import { Check, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthShell({ title, subtitle, children, footer }) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden py-8 sm:py-12 lg:py-16">
      <div className="pointer-events-none absolute -end-32 -top-24 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -start-24 bottom-0 h-72 w-72 rounded-full bg-accent-100/60 blur-3xl dark:bg-accent-500/10" />
      <div className="container-page relative">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2.25rem] border border-sand-200 bg-surface shadow-float lg:grid-cols-[0.88fr_1.12fr]">
          <aside className="relative hidden overflow-hidden bg-navy-950 p-9 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-grid opacity-10" />
            <div className="absolute -end-20 -top-20 h-72 w-72 rounded-full bg-navy-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -start-16 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl" />
            <div className="relative">
              <span className="chip bg-white/10 text-white ring-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                {t('common.tagline')}
              </span>
              <p className="mt-8 font-display text-4xl font-semibold leading-[1.06]">
                {t('auth.asideTitle')}
                <br />
                <em className="text-navy-300">{t('auth.asideTitleAccent')}</em>
              </p>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-navy-100/75">{t('auth.asideText')}</p>
            </div>

            <div className="relative space-y-3">
              {[t('home.trust'), t('home.legalPoint4Text'), t('assistant.capability2')].map((line) => (
                <div key={line} className="flex items-start gap-2.5 text-xs leading-relaxed text-navy-100/80">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-navy-500/25">
                    <Check className="h-2.5 w-2.5 text-navy-200" />
                  </span>
                  {line}
                </div>
              ))}
              <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">
                <ShieldCheck className="h-4 w-4" />
                {t('auth.asideTrust')}
              </div>
            </div>
          </aside>

          <div className="p-6 sm:p-9 lg:p-11">
            <div className="mx-auto max-w-md">
              <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{subtitle}</p>
              <div className="mt-8">{children}</div>
              {footer && <div className="mt-7 border-t border-sand-100 pt-5 text-center text-sm text-ink-soft">{footer}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
