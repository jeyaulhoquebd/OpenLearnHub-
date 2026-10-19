import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';

export default function LanguageSwitcher({ compact = false }) {
  const { i18n, t } = useTranslation();
  const { user, updatePreferredLanguage } = useAuth();

  async function handleChange(event) {
    const next = event.target.value;
    await i18n.changeLanguage(next);
    if (user) {
      // Persist the choice to the signed-in user's profile as well.
      updatePreferredLanguage(next).catch(() => {});
    }
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t('nav.language')}</span>
      <Globe className="pointer-events-none absolute start-3 h-4 w-4 text-ink-muted" aria-hidden="true" />
      <select
        value={i18n.language?.slice(0, 2) || 'en'}
        onChange={handleChange}
        className={`cursor-pointer appearance-none rounded-full border border-sand-300 bg-surface py-2 pe-8 ps-9 text-xs font-semibold text-ink-soft shadow-sm transition hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          compact ? 'w-[4.5rem]' : ''
        }`}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {compact ? language.short : language.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute end-2.5 h-3.5 w-3.5 text-ink-muted"
        aria-hidden="true"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.2 7.2a1 1 0 0 1 1.4 0L10 10.6l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.6a1 1 0 0 1 0-1.4Z"
          clipRule="evenodd"
        />
      </svg>
    </label>
  );
}
