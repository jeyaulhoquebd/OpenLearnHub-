import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';

export default function Footer() {
  const { t } = useTranslation();
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'hello@openlearnhub.org';
  const legalEmail = import.meta.env.VITE_LEGAL_EMAIL || 'legal@openlearnhub.org';

  const columns = [
    {
      title: t('footer.explore'),
      links: [
        { to: '/explore', label: t('common.browseAll') },
        { to: '/courses', label: t('footer.courses') },
        { to: '/books', label: t('footer.books') },
        { to: '/software', label: t('footer.software') }
      ]
    },
    {
      title: t('footer.learn'),
      links: [
        { to: '/assistant', label: t('footer.assistant') },
        { to: '/submit', label: t('footer.submit') },
        { to: '/dashboard', label: t('footer.dashboard') }
      ]
    },
    {
      title: t('footer.company'),
      links: [
        { to: '/about', label: t('footer.about') },
        { to: '/contact', label: t('footer.contact') },
        { to: '/search', label: t('footer.search') },
        { to: '/submit', label: t('footer.submit') }
      ]
    },
    {
      title: t('footer.legal'),
      links: [
        { to: '/legal/copyright', label: t('footer.copyright') },
        { to: '/legal/terms', label: t('footer.terms') },
        { to: '/legal/privacy', label: t('footer.privacy') }
      ]
    }
  ];

  return (
    <footer className="mt-auto border-t border-sand-200 bg-surface">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t('footer.description')}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="badge-legal">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('common.legal')}
              </span>
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                <Mail className="h-3.5 w-3.5" />
                {contactEmail}
              </a>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.to}-${link.label}`}>
                    <Link
                      to={link.to}
                      className="text-sm text-ink-soft transition hover:text-brand-800 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-sand-200 pt-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs text-ink-muted">{t('footer.madeFor')}</p>
            <p className="text-xs text-ink-muted">{t('footer.disclaimer')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <LanguageSwitcher />
            <p className="text-xs text-ink-muted">{t('footer.rights', { year: new Date().getFullYear() })}</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-ink-muted">
          {t('legal.contactTitle')}:{' '}
          <a className="link" href={`mailto:${legalEmail}`}>
            {legalEmail}
          </a>
        </p>
      </div>
    </footer>
  );
}
