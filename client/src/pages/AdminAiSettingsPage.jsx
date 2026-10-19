import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { getAiSettingsStatus, saveAiSettings, testAiKey } from '../lib/api';
import { formatDate } from '../lib/utils';

const MODEL_SUGGESTIONS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

/**
 * Admin → AI Settings.
 *
 * Lets an administrator store the Gemini API key that powers LearnMate. The key
 * is sent to the Express server, encrypted with AES-256-GCM, and stored in the
 * server-only `settings/ai` document. It is never returned to the browser — the
 * page only ever sees a masked hint.
 */
export default function AdminAiSettingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();
  usePageMeta(t('adminAi.title'));

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [formError, setFormError] = useState('');
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError('');
    try {
      const token = await user.getIdToken();
      const next = await getAiSettingsStatus(token);
      setStatus(next);
      setModel((current) => current || next.model || '');
    } catch (error) {
      console.warn('[admin-ai] status load failed:', error);
      setLoadError(error?.message || t('adminAi.loadError'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function withToken(action) {
    const token = await user.getIdToken();
    return action(token);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setTestResult(null);

    try {
      const response = await withToken((token) =>
        saveAiSettings({ apiKey: apiKey.trim(), model: model.trim() }, token)
      );
      setStatus(response.status);
      setApiKey('');
      setShowKey(false);
      push(t('adminAi.saveSuccess'));
    } catch (error) {
      console.warn('[admin-ai] save failed:', error);
      setFormError(error?.message || t('adminAi.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setFormError('');
    setTestResult(null);

    try {
      const response = await withToken((token) =>
        testAiKey({ apiKey: apiKey.trim(), model: model.trim() }, token)
      );
      setTestResult(response);
      push(t('adminAi.testSuccess'));
    } catch (error) {
      console.warn('[admin-ai] test failed:', error);
      setFormError(error?.message || t('adminAi.testError'));
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove() {
    if (removing) return;
    if (!window.confirm(t('adminAi.confirmRemove'))) return;
    setRemoving(true);
    setFormError('');
    setTestResult(null);

    try {
      const response = await withToken((token) => saveAiSettings({ apiKey: '', model: model.trim() }, token));
      setStatus(response.status);
      setApiKey('');
      push(t('adminAi.removeSuccess'));
    } catch (error) {
      console.warn('[admin-ai] remove failed:', error);
      setFormError(error?.message || t('adminAi.saveError'));
    } finally {
      setRemoving(false);
    }
  }

  const encryptionAvailable = status?.encryptionAvailable ?? true;
  const busy = saving || testing || removing;

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-navy-950 pb-10 pt-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
        <div className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="container-page relative">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-100/80 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('adminAi.backToAdmin')}
          </Link>
          <span className="chip mt-4 bg-white/10 text-white ring-white/20">
            <Sparkles className="h-3.5 w-3.5" />
            {t('adminAi.eyebrow')}
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{t('adminAi.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy-100/75">{t('adminAi.subtitle')}</p>
        </div>
      </section>

      <section className="container-page py-9">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <form onSubmit={handleSave} className="card p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
              <KeyRound className="h-5 w-5 text-brand-700" />
              {t('adminAi.formTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('adminAi.formText')}</p>

            {!encryptionAvailable && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t('adminAi.encryptionWarning')}</p>
              </div>
            )}

            <div className="mt-5">
              <label htmlFor="ai-model" className="block text-sm font-semibold text-ink">
                {t('adminAi.modelLabel')}
              </label>
              <input
                id="ai-model"
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                maxLength={80}
                list="ai-model-options"
                placeholder={status?.model || 'gemini-2.5-flash'}
                className="input mt-2"
              />
              <datalist id="ai-model-options">
                {MODEL_SUGGESTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <p className="mt-1.5 text-[11px] text-ink-muted">{t('adminAi.modelHint')}</p>
            </div>

            <div className="mt-5">
              <label htmlFor="ai-key" className="block text-sm font-semibold text-ink">
                {t('adminAi.keyLabel')}
              </label>
              <div className="relative mt-2">
                <input
                  id="ai-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  maxLength={300}
                  placeholder={
                    status?.hasStoredKey ? t('adminAi.keyPlaceholderKeep') : t('adminAi.keyPlaceholder')
                  }
                  className="input pe-11"
                  disabled={!encryptionAvailable}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition hover:bg-sand-100 hover:text-ink"
                  aria-label={showKey ? t('adminAi.hideKey') : t('adminAi.showKey')}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {t('adminAi.keyHint')}{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2"
                >
                  {t('adminAi.getKey')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {formError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                {formError}
              </div>
            )}

            {testResult && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p>
                  {t('adminAi.testResult', {
                    model: testResult.model,
                    ms: testResult.latencyMs
                  })}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="submit" disabled={busy || !encryptionAvailable} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {saving ? t('adminAi.saving') : t('adminAi.save')}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={busy || (!status?.configured && !apiKey.trim())}
                className="btn-secondary"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {testing ? t('adminAi.testing') : t('adminAi.test')}
              </button>
              {status?.hasStoredKey && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={busy}
                  className="btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                >
                  {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t('adminAi.remove')}
                </button>
              )}
            </div>
          </form>

          <div className="space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                  <BadgeCheck className="h-5 w-5 text-brand-700" />
                  {t('adminAi.statusTitle')}
                </h2>
                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="btn-secondary btn-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {t('admin.refresh')}
                </button>
              </div>

              {loading && !status ? (
                <div className="mt-5 space-y-3">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-5 w-1/2" />
                  <div className="skeleton h-5 w-3/4" />
                </div>
              ) : loadError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                  {loadError}
                </div>
              ) : (
                <dl className="mt-5 space-y-3.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">{t('adminAi.statusConfigured')}</dt>
                    <dd>
                      <span
                        className={`chip ${
                          status?.configured
                            ? 'bg-brand-50 text-brand-800 ring-brand-200'
                            : 'bg-rose-50 text-rose-700 ring-rose-200'
                        }`}
                      >
                        {status?.configured ? t('adminAi.yes') : t('adminAi.no')}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">{t('adminAi.statusSource')}</dt>
                    <dd className="font-medium text-ink">{t(`adminAi.source_${status?.source || 'none'}`)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">{t('adminAi.statusModel')}</dt>
                    <dd className="font-mono text-xs font-medium text-ink">{status?.model || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">{t('adminAi.statusKey')}</dt>
                    <dd className="font-mono text-xs text-ink">{status?.keyHint || t('adminAi.statusNoKey')}</dd>
                  </div>
                  {status?.updatedAt && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted">{t('adminAi.statusUpdated')}</dt>
                      <dd className="text-xs text-ink-soft">{formatDate(status.updatedAt, i18n.language)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            <div className="rounded-3xl border border-sand-200 bg-surface p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand-700" />
                {t('adminAi.securityTitle')}
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
                {['adminAi.security1', 'adminAi.security2', 'adminAi.security3'].map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
