import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookmarkPlus,
  Check,
  ExternalLink,
  GraduationCap,
  Library,
  Loader2,
  LogIn,
  MailCheck,
  Route,
  Sparkles,
  Trash2,
  Wand2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { generateRoadmap } from '../lib/api';
import { deleteRoadmap, fetchRoadmaps, saveRoadmap } from '../lib/data';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';
import { formatDate, localized } from '../lib/utils';

const LEVELS = [
  { value: 'beginner', labelKey: 'roadmap.levelBeginner' },
  { value: 'intermediate', labelKey: 'roadmap.levelIntermediate' },
  { value: 'advanced', labelKey: 'roadmap.levelAdvanced' }
];
const OUTPUT_LANGUAGES = ['en', 'bn', 'ur'];

/**
 * Generates a study roadmap from the user's goal, grounded in the curated
 * library via POST /api/ai/roadmap, and lets the learner save it to their
 * dashboard. Saving requires a signed-in, email-verified account.
 */
export default function RoadmapBuilder() {
  const { t, i18n } = useTranslation();
  const { user, firebaseReady, isVerified, loading } = useAuth();
  const { push } = useToast();

  const currentLanguage = OUTPUT_LANGUAGES.includes(i18n.language) ? i18n.language : 'en';
  const goalExamples = ['roadmap.example1', 'roadmap.example2', 'roadmap.example3'];

  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('beginner');
  const [language, setLanguage] = useState(currentLanguage);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [roadmap, setRoadmap] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [savedRoadmaps, setSavedRoadmaps] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setLanguage(currentLanguage);
  }, [currentLanguage]);

  const loadSaved = useCallback(async () => {
    if (!user) {
      setSavedRoadmaps([]);
      return;
    }
    setLoadingSaved(true);
    try {
      const items = await fetchRoadmaps(user.uid);
      setSavedRoadmaps(items);
    } catch (loadError) {
      console.warn('[roadmap] could not load saved roadmaps:', loadError);
    } finally {
      setLoadingSaved(false);
    }
  }, [user]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  async function handleGenerate(event) {
    event.preventDefault();
    const trimmed = goal.trim();
    if (trimmed.length < 4 || generating || loading || !user) return;

    setGenerating(true);
    setError('');
    setRoadmap(null);
    setSaved(false);

    try {
      const token = await user.getIdToken();
      const response = await generateRoadmap({ goal: trimmed, level, language, token });
      setRoadmap(response);
    } catch (generateError) {
      setError(generateError?.message || t('roadmap.error'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!roadmap || saving) return;
    setSaving(true);
    try {
      await saveRoadmap(user.uid, roadmap);
      setSaved(true);
      push(t('roadmap.savedToast'));
      loadSaved();
    } catch (saveError) {
      console.warn('[roadmap] save failed:', saveError);
      push(t('roadmap.saveError'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roadmapId) {
    if (!window.confirm(t('roadmap.confirmDelete'))) return;
    setBusyId(roadmapId);
    try {
      await deleteRoadmap(user.uid, roadmapId);
      setSavedRoadmaps((items) => items.filter((item) => item.id !== roadmapId));
      push(t('roadmap.deletedToast'));
    } catch (deleteError) {
      console.warn('[roadmap] delete failed:', deleteError);
      push(t('roadmap.saveError'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  if (!firebaseReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Route className="h-9 w-9 text-ink-muted" />
        <p className="text-sm font-semibold text-ink">{t('config.previewTitle')}</p>
        <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{t('auth.configText')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink">{t('common.loading')}</p>
        <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{t('roadmap.subtitle')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <LogIn className="h-5 w-5" />
        </span>
        <p className="font-display text-lg font-semibold text-ink">{t('assistant.signInTitle')}</p>
        <p className="max-w-xs text-sm leading-relaxed text-ink-soft">{t('assistant.signInText')}</p>
        <Link to="/login" className="btn-primary mt-2">
          {t('common.signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-sand-50/60 p-4 sm:p-5">
        {!isVerified && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="flex min-w-0 flex-1 items-start gap-2.5">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('roadmap.verifyText')}</span>
            </p>
            <Link to="/dashboard" className="shrink-0 font-bold underline underline-offset-2">
              {t('roadmap.verifyAction')}
            </Link>
          </div>
        )}

        <form
          onSubmit={handleGenerate}
          className="overflow-hidden rounded-3xl border border-brand-200/80 bg-surface shadow-sm"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-brand-800 px-5 py-5 text-white sm:px-6">
            <div className="pointer-events-none absolute -end-10 -top-16 h-44 w-44 rounded-full bg-brand-300/15 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/20">
                <Sparkles className="h-5 w-5 text-amber-200" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">{t('roadmap.introTitle')}</h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-white/75">
                  {t('roadmap.introText')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="roadmap-goal" className="text-sm font-bold text-ink">
                  {t('roadmap.goalLabel')}
                </label>
                <span className="text-[11px] tabular-nums text-ink-muted" aria-live="polite">
                  {t('roadmap.characters', { count: goal.length })}
                </span>
              </div>
              <textarea
                id="roadmap-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                rows={3}
                maxLength={300}
                placeholder={t('roadmap.goalPlaceholder')}
                className="input mt-2 min-h-28 resize-y rounded-2xl border-sand-300 bg-sand-50/50 px-4 py-3 focus:border-brand-400 focus:bg-surface"
              />
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t('roadmap.goalHint')}</p>
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  {t('roadmap.examplesLabel')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {goalExamples.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setGoal(t(key));
                        setError('');
                      }}
                      className="rounded-full border border-sand-300 bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2.5 text-sm font-bold text-ink">{t('roadmap.levelLabel')}</legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('roadmap.levelLabel')}>
                {LEVELS.map((option, index) => {
                  const selected = level === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setLevel(option.value)}
                      className={`relative flex min-h-[5.25rem] items-start gap-2.5 rounded-2xl border p-3 text-start transition ${
                        selected
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15 dark:bg-brand-900/20'
                          : 'border-sand-200 bg-surface hover:border-brand-300 hover:bg-sand-50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                          selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-sand-400'
                        }`}
                      >
                        {selected && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span>
                        <span className="block text-xs font-bold text-ink">{t(option.labelKey)}</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-ink-muted">
                          {t(`roadmap.level${['Beginner', 'Intermediate', 'Advanced'][index]}Hint`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label htmlFor="roadmap-language" className="block text-xs font-bold text-ink">
                  {t('roadmap.languageLabel')}
                </label>
                <select
                  id="roadmap-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="input mt-1.5 rounded-xl"
                >
                  {SUPPORTED_LANGUAGES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={generating || goal.trim().length < 4 || !isVerified}
                className="btn-primary min-h-11 justify-center rounded-xl px-5 shadow-soft sm:min-w-52"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {generating ? t('roadmap.generating') : t('roadmap.generate')}
              </button>
            </div>
          </div>
        </form>

        {generating && (
          <div
            className="rounded-2xl border border-brand-200 bg-surface p-5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/60" />
                <Loader2 className="relative h-5 w-5 animate-spin" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{t('roadmap.generating')}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{t('roadmap.generatingHint')}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-12 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && !generating && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {roadmap && !generating && (
          <article className="overflow-hidden rounded-3xl border border-brand-200 bg-surface shadow-soft">
            <div className="bg-gradient-to-r from-brand-50 via-surface to-amber-50/70 p-5 sm:p-6 dark:from-brand-900/20 dark:to-amber-900/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold text-brand-900 dark:bg-brand-800/50 dark:text-brand-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('roadmap.planSteps', { count: roadmap.steps.length })}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {t(LEVELS.find((item) => item.value === roadmap.level)?.labelKey || 'roadmap.levelBeginner')}
                </span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy-900 text-white shadow-sm">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">{roadmap.title}</h3>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{roadmap.summary}</p>
                </div>
              </div>
            </div>

            <ol className="relative space-y-3 px-4 py-5 sm:px-6 before:absolute before:bottom-8 before:start-[2.45rem] before:top-8 before:w-px before:bg-gradient-to-b before:from-brand-300 before:to-sand-200 sm:before:start-[2.95rem]">
              {roadmap.steps.map((step, index) => {
                const stepResources =
                  step.resources?.length > 0
                    ? step.resources
                    : (step.resourceIds || [])
                        .map((id) => roadmap.sources?.find((source) => source.id === id))
                        .filter(Boolean);

                return (
                  <li key={`${step.order || index}-${step.title}`} className="relative ps-11 sm:ps-14">
                    <span className="absolute start-0 top-1 grid h-8 w-8 place-items-center rounded-full border-4 border-surface bg-navy-800 text-[10px] font-bold text-white shadow-soft sm:h-9 sm:w-9">
                      {String(step.order || index + 1).padStart(2, '0')}
                    </span>
                    <div className="rounded-2xl border border-sand-200 bg-surface p-4 transition hover:border-brand-200 hover:shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
                        {t('roadmap.stepLabel', { number: step.order || index + 1 })}
                      </p>
                      <h4 className="mt-1 font-display text-base font-semibold text-ink">{step.title}</h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                        {step.explanation || step.description}
                      </p>

                      {stepResources.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            {t('roadmap.resourcesForStep')}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                          {stepResources.map((resource) => (
                            <a
                              key={resource.id}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex h-full flex-col rounded-xl border border-sand-200 bg-surface px-3 py-2.5 transition hover:border-brand-300 hover:shadow-sm"
                            >
                              <span className="flex items-start gap-2 text-xs font-semibold text-brand-800 dark:text-brand-200">
                                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="line-clamp-2">
                                  {localized(resource.title, i18n.language)}
                                </span>
                              </span>
                              <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-[10px] text-ink-muted">
                                <span className="chip bg-sand-50 text-ink-muted ring-sand-200">
                                  {resource.type === 'book' ? (
                                    <Library className="h-2.5 w-2.5" aria-hidden="true" />
                                  ) : (
                                    <GraduationCap className="h-2.5 w-2.5" aria-hidden="true" />
                                  )}
                                  {resource.type || t('roadmap.resourceFallback')}
                                </span>
                                {resource.sourceName && <span>{resource.sourceName}</span>}
                                {resource.level && <span>· {resource.level}</span>}
                              </span>
                            </a>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-3 border-t border-sand-200 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="btn-primary btn-sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                {saved ? t('roadmap.saved') : t('roadmap.save')}
              </button>
              <p className="text-[11px] leading-relaxed text-ink-muted">{t('assistant.disclaimer')}</p>
            </div>
          </article>
        )}

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            {t('roadmap.savedTitle')}
          </h3>

          {loadingSaved ? (
            <div className="mt-3 space-y-2">
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : savedRoadmaps.length ? (
            <ul className="mt-3 space-y-2">
              {savedRoadmaps.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-sand-200 bg-surface p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{item.title || item.goal}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t('roadmap.savedOn')}: {formatDate(item.createdAt, i18n.language)}
                    </p>
                    {item.steps?.length > 0 && (
                      <p className="mt-1 text-xs text-ink-soft">{t('roadmap.stepsCount', { n: item.steps.length })}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={busyId === item.id}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    aria-label={t('roadmap.delete')}
                    title={t('roadmap.delete')}
                  >
                    {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t('roadmap.savedEmpty')}</p>
          )}
        </section>
    </div>
  );
}
