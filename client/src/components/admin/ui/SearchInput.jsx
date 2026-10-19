import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Search box shared by admin tables and the top bar.
 *
 * `onChange` receives the raw string (not the event) so callers can debounce or
 * store it directly. This component is presentational: filtering is the
 * caller's job.
 */
export default function SearchInput({
  id = 'admin-search',
  value = '',
  onChange,
  placeholder,
  label,
  className = '',
  disabled = false
}) {
  const { t } = useTranslation();
  const accessibleLabel = label || placeholder || t('admin.ui.search');

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {accessibleLabel}
      </label>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder || t('admin.ui.searchPlaceholder')}
        className="input h-10 w-full ps-9 pe-9 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.('')}
          className="absolute end-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition hover:bg-sand-100 hover:text-ink"
          aria-label={t('admin.ui.clearSearch')}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
