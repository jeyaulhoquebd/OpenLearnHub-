import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from '../lib/siteSettings';

const SiteSettingsContext = createContext(null);

/**
 * Loads the public `settings/site` document once per session.
 *
 * The document is readable by everyone (firestore.rules) and contains only
 * public fields. If it is missing, or Firebase is not configured in preview
 * mode, the built-in defaults keep the layout working.
 */
export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!db) {
      setSettings(DEFAULT_SITE_SETTINGS);
      setLoading(false);
      return DEFAULT_SITE_SETTINGS;
    }

    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDoc(doc(db, 'settings', 'site'));
      const next = normalizeSiteSettings(snapshot.exists() ? snapshot.data() : {});
      setSettings(next);
      return next;
    } catch (err) {
      // A missing rules deployment or an offline browser must not take the
      // public site down. Keep the defaults and let the admin page report it.
      console.warn('[site-settings] Could not load settings/site:', err?.code || err?.message);
      setError(err);
      setSettings(DEFAULT_SITE_SETTINGS);
      return DEFAULT_SITE_SETTINGS;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ settings, loading, error, refresh }),
    [settings, loading, error, refresh]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) throw new Error('useSiteSettings must be used inside SiteSettingsProvider');
  return context;
}
