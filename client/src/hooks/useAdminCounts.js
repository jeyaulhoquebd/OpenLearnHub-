import { useCallback, useEffect, useState } from 'react';
import { fetchAdminCounts } from '../lib/data';

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

  return { counts, loading, error, refresh };
}
