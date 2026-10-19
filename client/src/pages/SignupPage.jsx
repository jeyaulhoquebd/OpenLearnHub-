import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import GoogleIcon from '../components/GoogleIcon';
import FirebaseRequiredNotice from '../components/FirebaseRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authErrorKey } from '../lib/authErrors';
import { usePageMeta } from '../hooks/usePageMeta';

export default function SignupPage() {
  const { t } = useTranslation();
  const { user, loading, signUp, signInWithGoogle, firebaseReady } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  usePageMeta(t('auth.signupTitle'));

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (displayName.trim().length < 2) {
      setError(t('submit.validationRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.weakPassword'));
      return;
    }
    if (!agreed) {
      setError(t('submit.validationLegal'));
      return;
    }
    setSubmitting(true);
    try {
      await signUp({ displayName: displayName.trim(), email: email.trim(), password });
      push(t('auth.welcomeToast'));
      navigate('/dashboard', { replace: true });
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
      navigate('/dashboard', { replace: true });
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
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-900">
            {t('auth.signInInstead')}
          </Link>
        </>
      }
    >
      {!firebaseReady ? (
        <FirebaseRequiredNotice />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="signup-name">
              {t('auth.displayName')}
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t('auth.displayNamePlaceholder')}
                className="input ps-11"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="signup-email">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="signup-email"
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
            <label className="label" htmlFor="signup-password">
              {t('auth.password')}
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
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
            <p className="mt-1.5 text-xs text-ink-muted">{t('auth.passwordHint')}</p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-sand-100/70 p-3.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-sand-300"
              required
            />
            <span className="text-xs leading-relaxed text-ink-soft">
              {t('auth.agreePrefix')}{' '}
              <Link to="/legal/terms" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
                {t('auth.terms')}
              </Link>{' '}
              {t('auth.and')}{' '}
              <Link to="/legal/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
                {t('auth.privacy')}
              </Link>
              .
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.signUp')}
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
