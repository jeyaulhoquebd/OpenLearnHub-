import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EmailVerificationBanner from './EmailVerificationBanner';

export default function ProtectedRoute({ children, adminOnly = false, requireVerified = false }) {
  const { user, loading, isAdmin, isVerified, firebaseReady } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-700" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (requireVerified && !isVerified) {
    return (
      <div className="container-page section">
        <div className="card mx-auto max-w-xl p-8">
          <MailCheck className="mx-auto h-10 w-10 text-amber-500 dark:text-amber-400" />
          <h1 className="mt-4 text-center font-display text-2xl font-semibold text-ink">
            {t('auth.verifyRequiredTitle')}
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">{t('auth.verifyRequiredText')}</p>
          <EmailVerificationBanner className="mt-5" />
          <div className="mt-5 text-center">
            <Link to="/dashboard" className="btn-secondary">
              {t('auth.verifyGoDashboard')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="container-page section">
        <div className="card mx-auto max-w-xl p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-500 dark:text-red-400" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{t('admin.notAuthorized')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('admin.notAuthorizedText')}</p>
        </div>
      </div>
    );
  }

  return children;
}
