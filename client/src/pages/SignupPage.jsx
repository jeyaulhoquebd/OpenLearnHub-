import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Eye, EyeOff, Link2, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import SocialAuthButtons from '../components/SocialAuthButtons';
import FirebaseRequiredNotice from '../components/FirebaseRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authErrorKey, isAccountExistsError, isDismissedPopup, providerLabelKey } from '../lib/authErrors';
import { signupSchema } from '../lib/validation';
import { usePageMeta } from '../hooks/usePageMeta';

export default function SignupPage() {
  const { t } = useTranslation();
  const { user, loading, signUp, signInWithProvider, firebaseReady, pendingLink } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeProvider, setActiveProvider] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: '', email: '', password: '', agree: false }
  });

  usePageMeta(t('auth.signupTitle'));

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(values) {
    setFormError('');
    try {
      await signUp({ displayName: values.displayName, email: values.email, password: values.password });
      push(t('auth.welcomeToast'));
      navigate('/dashboard', { replace: true });
    } catch (authError) {
      setFormError(t(authErrorKey(authError)));
    }
  }

  async function handleSocial(providerId) {
    setFormError('');
    setActiveProvider(providerId);
    try {
      const signedIn = await signInWithProvider(providerId);
      if (signedIn) {
        push(t('auth.welcomeToast'));
        navigate('/dashboard', { replace: true });
      }
    } catch (authError) {
      if (!isDismissedPopup(authError) && !isAccountExistsError(authError)) {
        setFormError(t(authErrorKey(authError)));
      }
    } finally {
      setActiveProvider('');
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
        <div className="space-y-5">
          {pendingLink && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('auth.accountExistsDifferent', {
                    email: pendingLink.email,
                    provider: t(providerLabelKey(pendingLink.providerId))
                  })}
                </span>
              </p>
              <Link to="/login" className="btn-secondary btn-sm mt-3">
                {t('auth.backToLogin')}
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                  placeholder={t('auth.displayNamePlaceholder')}
                  aria-invalid={Boolean(errors.displayName)}
                  aria-describedby={errors.displayName ? 'signup-name-error' : undefined}
                  className="input ps-11"
                  {...register('displayName')}
                />
              </div>
              {errors.displayName && (
                <p id="signup-name-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                  {t(errors.displayName.message)}
                </p>
              )}
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
                  placeholder={t('auth.emailPlaceholder')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'signup-email-error' : undefined}
                  className="input ps-11"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="signup-email-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                  {t(errors.email.message)}
                </p>
              )}
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
                  placeholder={t('auth.passwordPlaceholder')}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'signup-password-error' : 'signup-password-hint'}
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
              {errors.password ? (
                <p id="signup-password-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                  {t(errors.password.message)}
                </p>
              ) : (
                <p id="signup-password-hint" className="mt-1.5 text-xs text-ink-muted">{t('auth.passwordHint')}</p>
              )}
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-sand-100/70 p-3.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-sand-300"
                  aria-invalid={Boolean(errors.agree)}
                  {...register('agree')}
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
              {errors.agree && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                  {t(errors.agree.message)}
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
              {t('auth.signUp')}
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
