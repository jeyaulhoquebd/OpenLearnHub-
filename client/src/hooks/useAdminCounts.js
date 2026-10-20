import { useCallback, useEffect, useState } from 'react';
import { fetchAdminCounts } from '../lib/data';

/** Fired after an admin action so the shell's badges reload. */
export const ADMIN_COUNTS_REFRESH_EVENT = 'openlearn:admin-counts-refresh';

/**
 * Asks the mounted `useAdminCounts` instance (in AdminLayout) to reload.
 * Pages dispatch this after resolving reports or flagging resources, so the
 * sidebar and notification bell update without a full page reload.
 */
export function refreshAdminCounts() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ADMIN_COUNTS_REFRESH_EVENT));
}

/**
 * Loads the small counters used across the admin shell (open reports badge,
 * dashboard stat cards). Failures are non-fatal: the panel keeps working with
 * zeroed counters.
 */
export function useAdminCounts({ enabled = true } = {}) {
  const [counts, setCounts] = useState({ resources: 0, pending: 0, reports: 0 });
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminCounts();
      setCounts(next);
    } catch (err) {
      console.warn('[admin-counts]', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Let pages request a badge refresh after a mutation.
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = () => refresh();
    window.addEventListener(ADMIN_COUNTS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(ADMIN_COUNTS_REFRESH_EVENT, handler);
  }, [enabled, refresh]);

  return { counts, loading, error, refresh };
}
