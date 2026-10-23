import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Flag, Globe2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { OWNER } from '../lib/owner';

export default function ContactPage() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  usePageMeta(t('contact.title'), t('contact.subtitle'));

  const contactEmail =
    settings.contactEmail || import.meta.env.VITE_CONTACT_EMAIL || OWNER.email;
  const legalEmail = settings.legalEmail || import.meta.env.VITE_LEGAL_EMAIL || OWNER.email;

  const channels = [
    {
      icon: Mail,
      title: t('contact.generalTitle'),
      text: t('contact.generalText'),
      email: contactEmail,
      label: t('contact.generalButton')
    },
    {
      icon: ShieldCheck,
      title: t('contact.legalTitle'),
      text: t('contact.legalText'),
      email: legalEmail,
      label: t('contact.legalButton')
    }
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-sand-50 to-amber-50/60 pb-10 pt-10 sm:pb-14 sm:pt-14 dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.28]" />
        <div className="container-page relative">
          <span className="eyebrow">
            <span className="h-px w-7 bg-navy-500" />
            {t('contact.eyebrow')}
          </span>
          <h1 className="display-title mt-3 max-w-3xl">{t('contact.title')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
            {t('contact.subtitle')}
          </p>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="grid gap-5 lg:grid-cols-2">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.title} className="card flex flex-col p-6 sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-xl font-semibold text-ink">{channel.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{channel.text}</p>
                <a
                  href={`mailto:${channel.email}`}
                  className="btn-primary mt-6 w-fit"
                >
                  {channel.label}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <p className="mt-4 text-xs font-semibold text-ink-muted">{channel.email}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-sand-200 bg-surface shadow-card">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="eyebrow">
                <span className="h-px w-7 bg-navy-500" />
                {t('owner.contactTitle')}
              </span>
              <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{OWNER.name}</h2>
              <p className="mt-1 text-sm font-semibold text-brand-700">{t('owner.role')}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                {t('owner.contactText')}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a href={`mailto:${OWNER.email}`} className="btn-primary justify-center">
                <Mail className="h-4 w-4" />
                {t('owner.emailLabel')}
              </a>
              <a
                href={OWNER.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary justify-center"
              >
                <Globe2 className="h-4 w-4" />
                {t('owner.websiteLabel')}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="border-t border-sand-100 bg-sand-50/70 px-6 py-3 text-xs font-medium text-ink-muted sm:px-8">
            {OWNER.email} · {OWNER.website}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 dark:border-amber-500/30 dark:bg-amber-500/10">
            <Flag className="h-6 w-6 text-amber-600 dark:text-amber-300" />
            <h2 className="mt-3 font-display text-lg font-semibold text-ink">{t('contact.reportTitle')}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t('contact.reportText')}</p>
            <Link to="/explore" className="btn-secondary mt-4">
              {t('contact.reportButton')}
            </Link>
          </div>

          <div className="rounded-3xl border border-brand-200 bg-brand-50/70 p-6">
            <Sparkles className="h-6 w-6 text-accent-500" />
            <h2 className="mt-3 font-display text-lg font-semibold text-brand-950">{t('contact.submitTitle')}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-900/75">{t('contact.submitText')}</p>
            <Link to="/submit" className="btn-primary mt-4">
              {t('contact.submitButton')}
            </Link>
          </div>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-ink-muted">{t('contact.responseNote')}</p>
      </section>
    </>
  );
}
