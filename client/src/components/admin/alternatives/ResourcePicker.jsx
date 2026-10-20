import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Loader2, Search, X } from 'lucide-react';
import { listAdminResources } from '../../../lib/api';
import { localized } from '../../../lib/utils';

/**
 * Searchable picker for a published software resource.
 *
 * Reuses the admin resources endpoint (`type=software&status=published`) so the
 * search, pagination and field trimming stay in one place. `value` is the
 * currently selected resource preview (or null); `fallbackId` is the id stored
 * on the alternative when that resource can no longer be loaded.
 */
export default function ResourcePicker({
  token,
  value,
  fallbackId = '',
  onChange,
  label,
  hint,
  error,
  errorId
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!token || debounced.length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return undefined;
    }

    let active = true;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setFailed(false);

    listAdminResources(token, {
      q: debounced,
      type: 'software',
      status: 'published',
      limit: 8,
      sort: 'title_asc'
    })
      .then((data) => {
        if (active && requestId === requestRef.current) {
          setResults(Array.isArray(data.items) ? data.items : []);
        }
      })
      .catch(() => {
        if (active && requestId === requestRef.current) setFailed(true);
      })
      .finally(() => {
        if (active && requestId === requestRef.current) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, debounced]);

  function select(resource) {
    onChange?.({
      id: resource.id,
      title: resource.title || {},
      slug: resource.slug || '',
      status: resource.status || '',
      thumbnailUrl: resource.thumbnailUrl || null
    });
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-accent-300 bg-accent-500/5 p-3 dark:border-accent-500/40">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-navy-900 text-xs font-bold text-white">
            {value.thumbnailUrl ? (
              <img src={value.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <Check className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">
              {localized(value.title) || value.id}
            </p>
            <p className="truncate text-xs text-ink-muted" dir="ltr">
              {value.slug ? `/${value.slug}` : value.id}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="btn-secondary h-8 gap-1 px-2 text-xs"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admin.ui.remove')}
          </button>
        </div>
      ) : (
        <>
          {fallbackId && (
            <p
              id={errorId ? `${errorId}-unavailable` : undefined}
              className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t('admin.alternatives.form.selector.unavailable')} <code dir="ltr">{fallbackId}</code>
              </span>
            </p>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('admin.alternatives.form.selector.searchPlaceholder')}
              aria-label={label}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="input h-10 w-full ps-9 text-sm [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-sand-200 bg-surface">
            {loading ? (
              <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('admin.alternatives.form.selector.loading')}
              </p>
            ) : failed ? (
              <p className="px-3 py-3 text-sm text-rose-600 dark:text-rose-400">
                {t('admin.alternatives.errorText')}
              </p>
            ) : debounced.length < 2 ? (
              <p className="px-3 py-3 text-sm text-ink-muted">
                {t('admin.alternatives.form.selector.typeFirst')}
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-muted">
                {t('admin.alternatives.form.selector.empty')}
              </p>
            ) : (
              <ul>
                {results.map((resource) => (
                  <li key={resource.id}>
                    <button
                      type="button"
                      onClick={() => select(resource)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-sand-100"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-sand-100 text-[10px] font-bold text-ink-muted">
                        {resource.thumbnailUrl ? (
                          <img
                            src={resource.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          t('admin.alternatives.freeLabel')
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {localized(resource.title) || resource.id}
                        </span>
                        <span className="block truncate text-xs text-ink-muted" dir="ltr">
                          {resource.slug || resource.id}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {hint && !error ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{hint}</p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
