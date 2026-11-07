import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

/**
 * Route guard for /admin/*.
 *
 * Waits for auth to settle, then force-refreshes the ID token with
 * `getIdTokenResult(true)` instead of trusting a cached value — a claim granted by
 * `npm run set-admin` only appears in a freshly minted token. Anyone without
 * `admin === true` is sent home with a translated "Access denied" toast and
 * never sees the admin shell.
 */
export default function AdminRoute({ children }) {
  const { user, loading, firebaseReady } = useAuth();
  const { push } = useToast();
  const { t } = useTranslation();
  const location = useLocation();

  const [check, setCheck] = useState({ checking: true, allowed: false });
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (loading) return undefined;

    if (!firebaseReady || !user) {
      setCheck({ checking: false, allowed: false });
      return undefined;
    }

    let active = true;
    setCheck((current) => ({ ...current, checking: true }));

    (async () => {
      try {
        const result = await user.getIdTokenResult(true);
        if (active) {
          setCheck({ checking: false, allowed: result?.claims?.admin === true });
        }
      } catch (error) {
        console.warn('[admin-route] Could not read token claims:', error);
        if (active) setCheck({ checking: false, allowed: false });
      }
    })();

    return () => {
      active = false;
    };
  }, [loading, firebaseReady, user]);

  // Announce the denial exactly once, just before redirecting away.
  useEffect(() => {
    if (loading || check.checking || check.allowed) return;
    if (!firebaseReady || !user || notifiedRef.current) return;
    notifiedRef.current = true;
    push(t('admin.accessDenied'), { type: 'error' });
  }, [loading, check, firebaseReady, user, push, t]);

  if (!firebaseReady) {
    return (
      <div className="container-page section">
        <div className="card mx-auto max-w-xl p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500 dark:text-amber-400" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{t('auth.configTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('auth.configText')}</p>
        </div>
      </div>
    );
  }

  if (loading || check.checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <div className="flex flex-col items-center gap-3 text-sm text-ink-muted">
          <Loader2 className="h-8 w-8 animate-spin text-accent-600" aria-hidden="true" />
          <p>{t('admin.checkingAccess')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!check.allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}
