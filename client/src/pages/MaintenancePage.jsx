import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ShieldCheck, Wrench } from 'lucide-react';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { useSiteSettings } from '../context/SiteSettingsContext';

/**
 * Public maintenance screen.
 *
 * Rendered instead of the normal public layout for signed-out visitors and
 * non-admins while `settings/site.maintenanceMode` is on. Administrators keep
 * the full site and can manage settings from `/admin/site-settings`.
 */
export default function MaintenancePage() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <header className="container-page flex items-center justify-between gap-4 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="container-page flex flex-1 items-center justify-center py-12">
        <div className="card w-full max-w-2xl p-8 text-center sm:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
            <Wrench className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            {t('site.maintenance.badge')}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {t('site.maintenance.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
            {t('site.maintenance.text')}
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-ink-muted">
            {t('site.maintenance.contactHint')}
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={`mailto:${settings.contactEmail}`} className="btn-primary justify-center">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {settings.contactEmail}
            </a>
            <Link to="/login" className="btn-secondary justify-center">
              {t('site.maintenance.adminSignIn')}
            </Link>
          </div>
        </div>
      </main>

      <footer className="container-page py-6 text-center text-xs text-ink-muted">
        {t('footer.rights', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
