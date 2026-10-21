import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Scale, ShieldCheck } from 'lucide-react';
import { OWNER } from '../lib/owner';

export default function LegalLayout({ title, subtitle, children }) {
  const { t } = useTranslation();
  const legalEmail = import.meta.env.VITE_LEGAL_EMAIL || OWNER.email;
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || OWNER.email;

  const links = [
    { to: '/legal/copyright', label: t('legal.copyrightTitle') },
    { to: '/legal/terms', label: t('legal.termsTitle') },
    { to: '/legal/privacy', label: t('legal.privacyTitle') }
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-sand-50 to-amber-50/40 pb-10 pt-10 dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="container-page relative">
          <span className="eyebrow">
            <span className="h-px w-7 bg-navy-500" />
            {t('footer.legal')}
          </span>
          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-navy-900 text-white sm:grid">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>
              <p className="mt-3 text-xs font-medium text-ink-muted">
                {t('legal.lastUpdated')}: {t('legal.lastUpdatedValue')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="grid gap-9 lg:grid-cols-[15rem_1fr] xl:grid-cols-[17rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="rounded-3xl border border-sand-200 bg-surface p-4 shadow-sm" aria-label={t('footer.legal')}>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                {t('footer.legal')}
              </p>
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-sand-100'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-4 rounded-3xl border border-brand-200 bg-brand-50/70 p-5">
              <ShieldCheck className="h-5 w-5 text-brand-700" />
              <p className="mt-3 text-sm font-bold text-brand-950">{t('legal.contactTitle')}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-brand-900/80">
                Copyright notices are actioned quickly. Include the exact URL and a description of the work.
              </p>
              <a
                href={`mailto:${legalEmail}`}
                className="mt-3 inline-flex items-center gap-1.5 break-all text-xs font-semibold text-brand-700 underline underline-offset-2"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {legalEmail}
              </a>
              <p className="mt-3 border-t border-brand-200/70 pt-3 text-[11px] text-brand-900/75">
                General enquiries: {contactEmail}
              </p>
            </div>
          </aside>

          <article className="prose-legal max-w-3xl">
            {children}
            <p className="mt-10 rounded-2xl border border-sand-200 bg-sand-100/70 px-5 py-4 text-xs leading-relaxed text-ink-soft">
              {t('legal.englishOnly')}
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
