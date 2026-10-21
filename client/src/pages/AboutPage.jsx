import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  BookOpen,
  Globe2,
  Heart,
  Mail,
  ShieldCheck,
  Sparkles,
  Target,
  Users
} from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { COUNTRY_FLAGS } from '../lib/constants';
import { OWNER } from '../lib/owner';

export default function AboutPage() {
  const { t } = useTranslation();
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || OWNER.email;
  usePageMeta(t('about.title'), t('about.subtitle'));

  const standards = [
    { title: t('about.standard1Title'), text: t('about.standard1Text'), icon: Heart },
    { title: t('about.standard2Title'), text: t('about.standard2Text'), icon: ShieldCheck },
    { title: t('about.standard3Title'), text: t('about.standard3Text'), icon: ArrowUpRight },
    { title: t('about.standard4Title'), text: t('about.standard4Text'), icon: Globe2 }
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-white to-amber-50/50 pb-12 pt-12 sm:pb-16 dark:via-transparent dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="container-page relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="eyebrow">
              <span className="h-px w-7 bg-navy-500" />
              {t('about.eyebrow')}
            </span>
            <h1 className="display-title mt-3">{t('about.title')}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">{t('about.subtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/explore" className="btn-primary">
                {t('home.browseLibrary')}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a href={`mailto:${contactEmail}`} className="btn-secondary">
                <Mail className="h-4 w-4" />
                {t('about.contactButton')}
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { country: 'Bangladesh', label: t('home.bangladesh') },
              { country: 'India', label: t('home.india') },
              { country: 'Pakistan', label: t('home.pakistan') }
            ].map((item) => (
              <div key={item.country} className="rounded-3xl border border-sand-200 bg-surface p-5 text-center shadow-sm">
                <span className="text-3xl" aria-hidden="true">
                  {COUNTRY_FLAGS[item.country]}
                </span>
                <p className="mt-3 font-display text-lg font-semibold text-ink">{item.label}</p>
                <p className="mt-1 text-xs text-ink-muted">{t('home.statCountries')}</p>
              </div>
            ))}
            <div className="rounded-3xl border border-brand-200 bg-navy-900 p-5 text-white sm:col-span-3">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/20">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-xl font-semibold">{t('common.tagline')}</p>
                  <p className="mt-0.5 text-xs text-navy-100/70">{t('footer.madeFor')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="rounded-[2rem] border border-sand-200 bg-surface p-7 shadow-card sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Target className="h-5 w-5" />
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold text-ink">{t('about.missionTitle')}</h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">{t('about.missionP1')}</p>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">{t('about.missionP2')}</p>
            <Link to="/legal/copyright" className="link mt-6 inline-flex items-center gap-1 text-sm">
              {t('footer.copyright')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div>
            <span className="eyebrow">
              <span className="h-px w-7 bg-navy-500" />
              {t('about.standardsTitle')}
            </span>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {standards.map((standard) => {
                const Icon = standard.icon;
                return (
                  <div key={standard.title} className="rounded-2xl border border-sand-200 bg-sand-50/60 p-5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-brand-700 shadow-sm ring-1 ring-sand-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-sm font-bold text-ink">{standard.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{standard.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-sand-200 bg-sand-50/60 p-7 sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm ring-1 ring-sand-200">
              <Globe2 className="h-5 w-5" />
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold text-ink">{t('about.regionalTitle')}</h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">{t('about.regionalText')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Bangladesh', 'India', 'Pakistan'].map((country) => (
                <span key={country} className="rounded-full border border-sand-300 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft">
                  {COUNTRY_FLAGS[country]} {country}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-sand-200 bg-surface p-7 shadow-card sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-500/10 text-accent-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold text-ink">{t('about.aiTitle')}</h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">{t('about.aiText')}</p>
            <Link to="/assistant" className="btn-secondary mt-6">
              {t('assistant.name')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container-page">
          <div className="grid gap-6 rounded-[2rem] border border-sand-200 bg-sand-50/60 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="eyebrow">
                <span className="h-px w-7 bg-navy-500" />
                {t('owner.label')}
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold text-ink">{OWNER.name}</h2>
              <p className="mt-1 text-sm font-semibold text-brand-700">{t('owner.role')}</p>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-ink-soft">{t('owner.aboutText')}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a
                href={OWNER.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary justify-center"
              >
                <Globe2 className="h-4 w-4" />
                {t('owner.websiteLabel')}
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href={`mailto:${OWNER.email}`} className="btn-secondary justify-center">
                <Mail className="h-4 w-4" />
                {t('owner.emailLabel')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-navy-950 p-8 text-white sm:p-12">
            <div className="absolute inset-0 bg-grid opacity-10" />
            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div>
                <BookOpen className="h-8 w-8 text-navy-300" />
                <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{t('about.contactTitle')}</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy-100/75">{t('about.contactText')}</p>
              </div>
              <div className="flex flex-col gap-3">
                <a href={`mailto:${contactEmail}`} className="btn justify-center bg-surface text-brand-950 hover:bg-brand-50">
                  <Mail className="h-4 w-4" />
                  {t('about.contactButton')}
                </a>
                <Link to="/submit" className="btn justify-center border border-white/20 bg-white/10 text-white hover:bg-white/15">
                  {t('about.submitButton')}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
