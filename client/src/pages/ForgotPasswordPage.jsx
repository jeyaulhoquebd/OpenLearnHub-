import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import FirebaseRequiredNotice from '../components/FirebaseRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { authErrorKey } from '../lib/authErrors';
import { forgotPasswordSchema } from '../lib/validation';
import { usePageMeta } from '../hooks/usePageMeta';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword, firebaseReady } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' }
  });

  usePageMeta(t('auth.forgotTitle'));

  async function onSubmit(values) {
    setFormError('');
    try {
      await resetPassword(values.email);
      setSent(true);
    } catch (authError) {
      setFormError(t(authErrorKey(authError)));
    }
  }

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-900">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      {!firebaseReady ? (
        <FirebaseRequiredNotice />
      ) : sent ? (
        <div className="rounded-3xl border border-brand-200 bg-brand-50/70 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" />
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">{t('auth.resetToast')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('auth.resetSent')}</p>
          <Link to="/login" className="btn-primary mt-5">
            {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label className="label" htmlFor="forgot-email">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                className="input ps-11"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p id="forgot-email-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                {t(errors.email.message)}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.sendReset')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
