import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, CircleDot, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PROGRESS_STATUSES, fetchProgressFor, setProgress } from '../lib/data';

const META = {
  not_started: { key: 'progress.notStarted', icon: Circle, className: 'text-ink-muted' },
  in_progress: { key: 'progress.inProgress', icon: CircleDot, className: 'text-amber-600 dark:text-amber-300' },
  completed: { key: 'progress.completed', icon: CheckCircle2, className: 'text-brand-700 dark:text-brand-300' }
};

export default function ProgressControl({ resourceId, className = '', onChange }) {
  const { t } = useTranslation();
  const { user, firebaseReady } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('not_started');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user || !resourceId) {
      setStatus('not_started');
      return undefined;
    }
    fetchProgressFor(user.uid, resourceId)
      .then((value) => {
        if (active) setStatus(value?.status || 'not_started');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, resourceId]);

  async function handleSelect(next) {
    if (!firebaseReady) {
      push(t('config.previewText'), { type: 'info' });
      return;
    }
    if (!user) {
      navigate('/login', { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }
    if (next === status || busy) return;
    setBusy(true);
    const previous = status;
    setStatus(next);
    try {
      await setProgress(user.uid, resourceId, next);
      push(t('progress.saved'));
      onChange?.(next);
    } catch (error) {
      console.warn('[progress]', error);
      setStatus(previous);
      push(t('progress.error'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-2xl border border-sand-200 bg-surface p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{t('progress.title')}</h3>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />}
        {!user && <LogIn className="h-4 w-4 text-ink-muted" aria-hidden="true" />}
      </div>
      <div className="mt-3 grid gap-2" role="group" aria-label={t('progress.title')}>
        {PROGRESS_STATUSES.map((value) => {
          const meta = META[value];
          const Icon = meta.icon;
          const active = status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              aria-pressed={active}
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100'
                  : 'border-sand-200 text-ink-soft hover:border-brand-200 hover:text-brand-800'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? meta.className : ''}`} />
              {t(meta.key)}
            </button>
          );
        })}
      </div>
      {!user && (
        <p className="mt-3 text-xs text-ink-muted">{t('progress.signInHint')}</p>
      )}
    </div>
  );
}
