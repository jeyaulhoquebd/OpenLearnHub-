import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * "Verify your email" banner with a resend button (60s cooldown) and an
 * "I've verified" button that reloads the Firebase user.
 *
 * Renders nothing for social-login users (their address is already verified)
 * or when the email is confirmed.
 */
export default function EmailVerificationBanner({ className = '' }) {
  const { t } = useTranslation();
  const { user, isVerified, resendVerification, reloadUser } = useAuth();
  const { push } = useToast();
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!user || isVerified) return null;

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerification();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      push(t('dashboard.resent'));
    } catch {
      push(t('auth.genericError'), { type: 'error' });
    } finally {
      setResending(false);
    }
  }

  async function handleVerified() {
    setChecking(true);
    try {
      const refreshed = await reloadUser();
      if (refreshed?.emailVerified) {
        push(t('auth.verifyReloadedToast'));
      } else {
        push(t('auth.verifyStillUnverified'), { type: 'error' });
      }
    } catch {
      push(t('auth.genericError'), { type: 'error' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t('dashboard.verifyTitle')}</p>
          <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-200">
            {t('dashboard.verifyText', { email: user.email })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="btn-secondary btn-sm"
        >
          {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('dashboard.resend')}
        </button>
        <button type="button" onClick={handleVerified} disabled={checking} className="btn-primary btn-sm">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {t('auth.verifyNow')}
        </button>
      </div>
    </div>
  );
}
