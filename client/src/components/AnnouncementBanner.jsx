import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, Megaphone, X } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { localized } from '../lib/utils';

const STYLES = {
  info: {
    wrap: 'border-brand-200 bg-brand-50 text-brand-950 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100',
    icon: Info,
    iconClass: 'text-brand-600 dark:text-brand-300'
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
    icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-300'
  },
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-300'
  },
  critical: {
    wrap: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100',
    icon: AlertTriangle,
    iconClass: 'text-rose-600 dark:text-rose-300'
  }
};

/**
 * Public announcement bar driven by `settings/site`.
 *
 * Dismissal is per browser session and keyed by the current message, so a new
 * announcement from an admin appears even if the previous one was dismissed.
 */
export default function AnnouncementBanner() {
  const { t, i18n } = useTranslation();
  const { settings } = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);

  const text = localized(settings.announcement.text, i18n.language);
  const type = STYLES[settings.announcement.type] ? settings.announcement.type : 'info';
  const key = `openlearn.announcement.${type}.${text}`;
  const style = STYLES[type];
  const Icon = style.icon;

  useEffect(() => {
    if (!text) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.sessionStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [key, text]);

  if (!settings.announcement.enabled || !text || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* private mode: dismissal only lasts for this page view */
    }
  }

  return (
    <div className={`border-b ${style.wrap}`} role="region" aria-label={t('site.announcementLabel')}>
      <div className="container-page flex items-center gap-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/60 dark:bg-white/10">
          <Megaphone className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed">
          <Icon className={`me-1.5 inline h-4 w-4 align-[-2px] ${style.iconClass}`} aria-hidden="true" />
          {text}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={t('common.dismiss')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
