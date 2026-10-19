import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'bn', label: 'বাংলা', short: 'বাং' },
  { code: 'hi', label: 'हिन्दी', short: 'हि' },
  { code: 'ur', label: 'اردو', short: 'اردو' }
];

export default function LanguageSwitcher({ compact = false }) {
  const { i18n, t } = useTranslation();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t('nav.language')}</span>
      <Globe className="pointer-events-none absolute start-3 h-4 w-4 text-ink-muted" aria-hidden="true" />
      <select
        value={i18n.language?.slice(0, 2) || 'en'}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className={`cursor-pointer appearance-none rounded-full border border-sand-300 bg-white py-2 pe-8 ps-9 text-xs font-semibold text-ink-soft shadow-sm transition hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          compact ? 'w-[4.5rem]' : ''
        }`}
      >
        {LANGUAGES.map((language) => (
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
