import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Logo({ className = '', compact = false, to = '/' }) {
  const { t } = useTranslation();

  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2.5 rounded-xl ${className}`}
      aria-label={compact ? t('common.appName') : undefined}
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-navy-900 shadow-soft transition group-hover:scale-[1.04]">
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
          <path d="M16 20.5C16 18.6 17.6 17 19.5 17H30v29H19.5C17.6 46 16 44.4 16 42.5v-22Z" fill="#93B4F8" />
          <path d="M48 20.5C48 18.6 46.4 17 44.5 17H34v29h10.5c1.9 0 3.5-1.6 3.5-3.5v-22Z" fill="#EAF0FA" />
          <path d="M32 17v31" stroke="#0B1F4B" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="46" cy="45" r="7.5" fill="#7C3AED" />
          <path d="M43.5 45h5M46 42.5v5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="hidden flex-col leading-none min-[380px]:flex">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            {t('common.appName')}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
            {t('common.tagline')}
          </span>
        </span>
      )}
    </Link>
  );
}
