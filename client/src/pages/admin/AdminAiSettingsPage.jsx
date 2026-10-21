import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Zap
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import FormField from '../../components/admin/ui/FormField';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  deleteAiKey,
  getAiModels,
  getAiSettingsStatus,
  getAiUsage,
  saveAiSettings,
  testAiKey
} from '../../lib/api';
import { formatDate } from '../../lib/utils';

const SOURCE_KEYS = {
  admin: 'adminAi.source_admin',
  env: 'adminAi.source_env',
  none: 'adminAi.source_none'
};

function StatBox({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * Admin → AI Settings.
 *
 * Stores the Groq API key that powers LearnMate and the AI roadmap builder. The
 * key is posted to the Express server, encrypted with AES-256-GCM and saved in
 * the server-only `settings/ai` document. This page only ever sees a masked
 * hint, never the key itself.
 */
export default function AdminAiSettingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [status, setStatus] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [manualModel, setManualModel] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(10);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [formError, setFormError] = useState('');
  const [testResult, setTestResult] = useState(null);

  const loadModels = useCallback(
    async (hasKey = true) => {
      if (!user || !hasKey) {
        setModels([]);
        setManualModel(true);
        setModelsError('');
        return;
      }
      setLoadingModels(true);
      setModelsError('');
      try {
        const token = await user.getIdToken();
        const response = await getAiModels(token);
        const next = Array.isArray(response?.models) ? response.models : [];
        setModels(next);
        if (next.length) setManualModel(false);
      } catch (error) {
        console.warn('[admin-ai] model list failed:', error);
        setModels([]);
        setManualModel(true);
        setModelsError(error?.message || t('adminAi.modelLoadError'));
      } finally {
        setLoadingModels(false);
      }
    },
    [user, t]
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError('');
    try {
      const token = await user.getIdToken();
      const [nextStatus, usageResponse] = await Promise.all([
        getAiSettingsStatus(token),
        getAiUsage(token).catch(() => null)
      ]);
      setStatus(nextStatus);
      setUsage(usageResponse?.usage || null);
      setModel(nextStatus?.model || '');
      setEnabled(nextStatus?.enabled !== false);
      setDailyLimit(Number(nextStatus?.dailyLimitPerUser) || 10);
      loadModels(Boolean(nextStatus?.hasKey));
    } catch (error) {
      console.warn('[admin-ai] status load failed:', error);
      setLoadError(error?.message || t('adminAi.loadError'));
    } finally {
      setLoading(false);
    }
  }, [user, t, loadModels]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshUsage() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await getAiUsage(token);
      setUsage(response?.usage || null);
    } catch (error) {
      console.warn('[admin-ai] usage load failed:', error);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;

    const trimmedKey = apiKey.trim();
    if (trimmedKey && !trimmedKey.startsWith('gsk_')) {
      setFormError(t('adminAi.keyInvalid'));
      return;
    }

    setSaving(true);
    setFormError('');
    setTestResult(null);

    try {
      const token = await user.getIdToken();
      const response = await saveAiSettings(
        {
          apiKey: trimmedKey,
          model: model.trim(),
          enabled,
          dailyLimitPerUser: Number(dailyLimit) || 10
        },
        token
      );
      setStatus(response.status);
      setModel(response.status?.model || '');
      setEnabled(response.status?.enabled !== false);
      setDailyLimit(Number(response.status?.dailyLimitPerUser) || 10);
      setApiKey('');
      setShowKey(false);
      push(t('adminAi.saveSuccess'));
      loadModels(Boolean(response.status?.hasKey));
      refreshUsage();
    } catch (error) {
      console.warn('[admin-ai] save failed:', error);
      setFormError(error?.message || t('adminAi.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    const trimmedKey = apiKey.trim();
    if (trimmedKey && !trimmedKey.startsWith('gsk_')) {
      setFormError(t('adminAi.keyInvalid'));
      return;
    }

    setTesting(true);
    setFormError('');
    setTestResult(null);

    try {
      const token = await user.getIdToken();
      const response = await testAiKey({ apiKey: trimmedKey, model: model.trim() }, token);
      setTestResult(response);
      push(t('adminAi.testSuccess'));
    } catch (error) {
      console.warn('[admin-ai] test failed:', error);
      const retry =
        error?.retryAfter > 0
          ? ` ${t('adminAi.testRetry', { seconds: error.retryAfter })}`
          : '';
      setFormError(`${error?.message || t('adminAi.testError')}${retry}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove() {
    if (removing) return;
    setRemoving(true);
    setFormError('');
    setTestResult(null);

    try {
      const token = await user.getIdToken();
      const response = await deleteAiKey(token);
      setStatus(response.status);
      setModel(response.status?.model || '');
      setEnabled(response.status?.enabled !== false);
      setDailyLimit(Number(response.status?.dailyLimitPerUser) || 10);
      setApiKey('');
      setShowKey(false);
      setConfirmRemove(false);
      push(t('adminAi.removeSuccess'));
      loadModels(Boolean(response.status?.hasKey));
    } catch (error) {
      console.warn('[admin-ai] remove failed:', error);
      setFormError(error?.message || t('adminAi.saveError'));
    } finally {
      setRemoving(false);
    }
  }

  const busy = saving || testing || removing;
  const hasKey = Boolean(status?.hasKey);
  const configured = hasKey && status?.enabled !== false;
  const sourceKey = SOURCE_KEYS[status?.source] || SOURCE_KEYS.none;
  const usageToday = usage?.today || { requests: 0, failures: 0 };
  const usageWeek = usage?.week || { requests: 0, failures: 0 };

  return (
    <>
      <PageHeader
        eyebrow={t('adminAi.eyebrow')}
        title={t('adminAi.title')}
        description={t('adminAi.subtitle')}
        actions={
          <button type="button" onClick={load} disabled={loading || busy} className="btn-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('admin.refresh')}
          </button>
        }
      />

      {loadError && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {loadError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <form onSubmit={handleSave} className="card p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
            <KeyRound className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {t('adminAi.formTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('adminAi.formText')}</p>

          <div className="mt-5">
            <FormField
              id="ai-key"
              label={t('adminAi.keyLabel')}
              hint={t('adminAi.keyHint')}
              required={!hasKey}
            >
              <div className="relative">
                <input
                  id="ai-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="new-password"
                  spellCheck="false"
                  maxLength={300}
                  placeholder={
                    hasKey ? t('adminAi.keyPlaceholderKeep') : t('adminAi.keyPlaceholder')
                  }
                  className="input pe-11 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition hover:bg-sand-100 hover:text-ink"
                  aria-label={showKey ? t('adminAi.hideKey') : t('adminAi.showKey')}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </FormField>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
              >
                {t('adminAi.getKey')}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-2">
              <label htmlFor="ai-model" className="block text-sm font-semibold text-ink">
                {t('adminAi.modelLabel')}
              </label>
              <button
                type="button"
                onClick={() => setManualModel((value) => !value)}
                className="text-[11px] font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
              >
                {manualModel ? t('adminAi.modelUseList') : t('adminAi.modelManual')}
              </button>
            </div>

            <div className="mt-1.5">
              {manualModel ? (
                <input
                  id="ai-model"
                  type="text"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  maxLength={120}
                  placeholder="qwen/qwen3.8-27b"
                  className="input font-mono text-sm"
                />
              ) : (
                <select
                  id="ai-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="input font-mono text-sm"
                  disabled={loadingModels || !models.length}
                >
                  {!model && <option value="">{t('adminAi.modelNone')}</option>}
                  {model && !models.some((entry) => entry.id === model) && (
                    <option value={model}>{model}</option>
                  )}
                  {models.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
              {loadingModels ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {t('adminAi.modelLoading')}
                </span>
              ) : modelsError ? (
                <span className="text-amber-700 dark:text-amber-300">{modelsError}</span>
              ) : (
                t('adminAi.modelHint')
              )}
            </p>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{t('adminAi.enabledLabel')}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{t('adminAi.enabledHint')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={t('adminAi.enabledLabel')}
                  onClick={() => setEnabled((value) => !value)}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
                    enabled
                      ? 'border-accent-500 bg-accent-500'
                      : 'border-sand-300 bg-sand-200 dark:bg-navy-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      enabled ? 'start-6' : 'start-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <FormField
              id="ai-daily-limit"
              label={t('adminAi.dailyLimitLabel')}
              hint={t('adminAi.dailyLimitHint')}
            >
              <input
                id="ai-daily-limit"
                type="number"
                min={1}
                max={200}
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value)}
                className="input"
              />
            </FormField>
          </div>

          {formError && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{formError}</p>
            </div>
          )}

          {testResult && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <p>
                {t('adminAi.testResult', {
                  model: testResult.model,
                  ms: testResult.latencyMs
                })}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {saving ? t('adminAi.saving') : t('adminAi.save')}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={busy || (!hasKey && !apiKey.trim())}
              className="btn-secondary"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4" aria-hidden="true" />
              )}
              {testing ? t('adminAi.testing') : t('adminAi.test')}
            </button>
            {hasKey && status?.source === 'admin' && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
                className="btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              >
                {removing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {removing ? t('adminAi.removing') : t('adminAi.remove')}
              </button>
            )}
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                <BadgeCheck className="h-5 w-5 text-brand-700" aria-hidden="true" />
                {t('adminAi.statusTitle')}
              </h2>
              <span
                className={`chip ${
                  configured
                    ? 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30'
                    : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
                }`}
              >
                {configured ? t('adminAi.yes') : t('adminAi.no')}
              </span>
            </div>

            {loading && !status ? (
              <div className="mt-5 space-y-3">
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-5 w-1/2" />
                <div className="skeleton h-5 w-3/4" />
              </div>
            ) : (
              <dl className="mt-5 space-y-3.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">{t('adminAi.statusConfigured')}</dt>
                  <dd className="font-medium text-ink">
                    {hasKey ? t('adminAi.statusConfiguredYes') : t('adminAi.statusConfiguredNo')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">{t('adminAi.statusSource')}</dt>
                  <dd className="font-medium text-ink">{t(sourceKey)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">{t('adminAi.statusModel')}</dt>
                  <dd className="max-w-[60%] truncate font-mono text-xs font-medium text-ink">
                    {status?.model || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">{t('adminAi.statusKey')}</dt>
                  <dd className="font-mono text-xs text-ink">
                    {status?.maskedKey || t('adminAi.statusNoKey')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">{t('adminAi.statusEnabled')}</dt>
                  <dd className="font-medium text-ink">
                    {!status
                      ? '—'
                      : status.enabled === false
                        ? t('adminAi.disabled')
                        : t('adminAi.active')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">{t('adminAi.statusDailyLimit')}</dt>
                  <dd className="font-medium text-ink">{status?.dailyLimitPerUser ?? '—'}</dd>
                </div>
                {status?.updatedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">{t('adminAi.statusUpdated')}</dt>
                    <dd className="text-xs text-ink-soft">
                      {formatDate(status.updatedAt, i18n.language)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          <div className="card p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
              <Activity className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('adminAi.usageTitle')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t('adminAi.usageNote')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatBox
                label={t('adminAi.usageToday')}
                value={usageToday.requests ?? 0}
                hint={t('adminAi.usageRequests')}
              />
              <StatBox
                label={t('adminAi.usageWeek')}
                value={usageWeek.requests ?? 0}
                hint={t('adminAi.usageRequests')}
              />
              <StatBox
                label={t('adminAi.usageFailures')}
                value={usageWeek.failures ?? 0}
                hint={t('adminAi.usageWeek')}
              />
            </div>
            {usage?.daily?.length > 0 && (
              <div className="mt-4 flex items-end gap-1.5" aria-hidden="true">
                {[...usage.daily].reverse().map((day) => {
                  const max = Math.max(
                    1,
                    ...usage.daily.map((entry) => Number(entry.requests) || 0)
                  );
                  const height = Math.max(4, Math.round(((Number(day.requests) || 0) / max) * 44));
                  return (
                    <div key={day.date} className="flex-1">
                      <div
                        className="rounded-t-md bg-brand-300/80 dark:bg-brand-500/50"
                        style={{ height: `${height}px` }}
                        title={`${day.date}: ${day.requests || 0}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
              {t('adminAi.securityTitle')}
            </p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
              {['adminAi.security1', 'adminAi.security2', 'adminAi.security3'].map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-relaxed text-ink-muted dark:bg-white/5">
              <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('adminAi.modelNote')}
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        loading={removing}
        title={t('adminAi.confirmRemoveTitle')}
        message={t('adminAi.confirmRemove')}
        confirmLabel={t('adminAi.remove')}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
      />
    </>
  );
}
