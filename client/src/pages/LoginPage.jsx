import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import GoogleIcon from '../components/GoogleIcon';
import FirebaseRequiredNotice from '../components/FirebaseRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { authErrorKey } from '../lib/authErrors';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, signIn, signInWithGoogle, firebaseReady } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  usePageMeta(t('auth.loginTitle'), t('auth.loginSubtitle'));

  const from = location.state?.from || '/dashboard';
  if (!loading && user) return <Navigate to={from} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      push(t('auth.welcomeToast'));
      navigate(from, { replace: true });
    } catch (authError) {
      setError(t(authErrorKey(authError)));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      push(t('auth.welcomeToast'));
      navigate(from, { replace: true });
    } catch (authError) {
      if (authError?.code !== 'auth/popup-closed-by-user' && authError?.code !== 'auth/cancelled-popup-request') {
        setError(t(authErrorKey(authError)));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/signup" state={{ from }} className="font-semibold text-brand-700 hover:text-brand-900">
            {t('auth.createOne')}
          </Link>
        </>
      }
    >
      {!firebaseReady ? (
        <FirebaseRequiredNotice />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-email">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="input ps-11"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="label" htmlFor="login-password">
                {t('auth.password')}
              </label>
              <Link to="/forgot-password" className="mb-2 text-xs font-semibold text-brand-700 hover:text-brand-900">
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="input px-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute end-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('auth.signIn')}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-sand-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('auth.or')}</span>
            <span className="h-px flex-1 bg-sand-200" />
          </div>

          <button type="button" onClick={handleGoogle} disabled={submitting} className="btn-secondary w-full justify-center py-3">
            <GoogleIcon className="h-4 w-4" />
            {t('auth.google')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
