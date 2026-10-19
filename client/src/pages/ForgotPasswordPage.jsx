import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import FirebaseRequiredNotice from '../components/FirebaseRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { authErrorKey } from '../lib/authErrors';
import { usePageMeta } from '../hooks/usePageMeta';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword, firebaseReady } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  usePageMeta(t('auth.forgotTitle'));

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (authError) {
      setError(t(authErrorKey(authError)));
    } finally {
      setSubmitting(false);
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
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label" htmlFor="forgot-email">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="input ps-11"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.sendReset')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
