import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Link2, Loader2, LockKeyhole, Mail } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import SocialAuthButtons from '../components/SocialAuthButtons';
import FirebaseRequiredNotice from '../components/FirebaseRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { authErrorKey, isAccountExistsError, isDismissedPopup, providerIdFromMethod, providerLabelKey } from '../lib/authErrors';
import { loginSchema } from '../lib/validation';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, signIn, signInWithProvider, firebaseReady, pendingLink, linkNotice, clearLinkNotice } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeProvider, setActiveProvider] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  usePageMeta(t('auth.loginTitle'), t('auth.loginSubtitle'));

  const from = location.state?.from || '/dashboard';
  if (!loading && user) return <Navigate to={from} replace />;

  async function onSubmit(values) {
    setFormError('');
    clearLinkNotice();
    try {
      await signIn(values.email, values.password);
      push(t('auth.welcomeToast'));
      navigate(from, { replace: true });
    } catch (authError) {
      setFormError(t(authErrorKey(authError)));
    }
  }

  async function handleSocial(providerId) {
    setFormError('');
    clearLinkNotice();
    setActiveProvider(providerId);
    try {
      const signedIn = await signInWithProvider(providerId);
      if (signedIn) {
        push(t('auth.welcomeToast'));
        navigate(from, { replace: true });
      }
    } catch (authError) {
      if (!isDismissedPopup(authError) && !isAccountExistsError(authError)) {
        setFormError(t(authErrorKey(authError)));
      }
    } finally {
      setActiveProvider('');
    }
  }

  const linkedProviderId = pendingLink ? providerIdFromMethod(pendingLink.providerId) : null;

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
        <div className="space-y-5">
          {linkNotice?.type === 'success' && (
            <p role="status" className="flex items-start gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {t('auth.linkSuccess')}
            </p>
          )}

          {pendingLink && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {pendingLink.providerId
                    ? t('auth.accountExistsDifferent', {
                        email: pendingLink.email,
                        provider: t(providerLabelKey(pendingLink.providerId))
                      })
                    : t('auth.accountExistsUnknown', { email: pendingLink.email })}
                </span>
              </p>
              {linkedProviderId ? (
                <button
                  type="button"
                  onClick={() => handleSocial(linkedProviderId)}
                  disabled={Boolean(activeProvider)}
                  className="btn-secondary btn-sm mt-3"
                >
                  {activeProvider === linkedProviderId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t('auth.signInWithProvider', { provider: t(providerLabelKey(pendingLink.providerId)) })}
                </button>
              ) : pendingLink.providerId === 'password' ? (
                <p className="mt-2 text-xs">{t('auth.linkWithPasswordHint')}</p>
              ) : null}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                  placeholder={t('auth.emailPlaceholder')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  className="input ps-11"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="login-email-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                  {t(errors.email.message)}
                </p>
              )}
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
                  placeholder={t('auth.passwordPlaceholder')}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  className="input px-11"
                  {...register('password')}
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
              {errors.password && (
                <p id="login-password-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                  {t(errors.password.message)}
                </p>
              )}
            </div>

            {formError && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </p>
            )}

            <button type="submit" disabled={isSubmitting || Boolean(activeProvider)} className="btn-primary w-full justify-center py-3">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('auth.signIn')}
            </button>
          </form>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-sand-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('auth.or')}</span>
            <span className="h-px flex-1 bg-sand-200" />
          </div>

          <SocialAuthButtons
            onSelect={handleSocial}
            disabled={isSubmitting || Boolean(activeProvider)}
            activeProvider={activeProvider}
          />
        </div>
      )}
    </AuthShell>
  );
}
