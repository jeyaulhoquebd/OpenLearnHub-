import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  AppWindow,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileImage,
  Info,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { submitResource } from '../lib/data';
import { CATEGORIES, COUNTRIES, LANGUAGES, LEVELS, PLATFORMS } from '../lib/constants';
import { sanitizeText, submitResourceSchema } from '../lib/validation';
import { usePageMeta } from '../hooks/usePageMeta';

const TYPE_OPTIONS = [
  { value: 'course', icon: PlayCircle, color: 'peer-checked:border-navy-500 peer-checked:bg-brand-50' },
  { value: 'book', icon: BookOpen, color: 'peer-checked:border-amber-500 peer-checked:bg-amber-50 dark:peer-checked:border-amber-400 dark:peer-checked:bg-amber-500/10' },
  { value: 'software', icon: AppWindow, color: 'peer-checked:border-accent-500 peer-checked:bg-accent-50 dark:peer-checked:border-accent-400 dark:peer-checked:bg-accent-500/15' }
];

const initialForm = {
  type: 'course',
  title: '',
  provider: '',
  url: '',
  author: '',
  description: '',
  longDescription: '',
  category: 'Computer Science',
  level: 'Beginner',
  languages: ['English'],
  countries: [...COUNTRIES],
  platform: [],
  tags: '',
  licenseNote: '',
  licenseUrl: ''
};

function Field({ label, hint, required, htmlFor, children, optionalLabel }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ms-1 text-red-500">*</span>
        ) : optionalLabel ? (
          <span className="ms-1 font-normal text-ink-muted">({optionalLabel})</span>
        ) : null}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  );
}

export default function SubmitResourcePage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState(initialForm);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [officialConfirmed, setOfficialConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const fileInputRef = useRef(null);
  usePageMeta(t('submit.title'), t('submit.subtitle'));

  const typeMeta = useMemo(
    () => ({
      course: { icon: PlayCircle, label: t('type.course') },
      book: { icon: BookOpen, label: t('type.book') },
      software: { icon: AppWindow, label: t('type.software') }
    }),
    [t]
  );

  useEffect(() => {
    if (!thumbnail) {
      setThumbnailPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(thumbnail);
    setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  useEffect(() => {
    if (done) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [done]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleArray(field, value) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
    }));
  }

  function handleThumbnail(event) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setThumbnail(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError(t('submit.thumbnailHint'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('submit.thumbnailHint'));
      return;
    }
    setError('');
    setThumbnail(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const parsed = submitResourceSchema.safeParse({ ...form, legalConfirmed, officialConfirmed });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0].message));
      return;
    }
    const data = parsed.data;

    setSubmitting(true);
    try {
      await submitResource({
        uid: user.uid,
        email: user.email,
        thumbnailFile: thumbnail,
        values: {
          ...data,
          title: sanitizeText(data.title, { max: 140 }),
          provider: sanitizeText(data.provider, { max: 120 }),
          url: sanitizeText(data.url, { max: 600 }),
          author: sanitizeText(data.author, { max: 120 }),
          description: sanitizeText(data.description, { max: 420, multiline: true }),
          longDescription: sanitizeText(data.longDescription, { max: 2000, multiline: true }),
          licenseNote: sanitizeText(data.licenseNote, { max: 160 }),
          licenseUrl: sanitizeText(data.licenseUrl, { max: 600 }),
          tags: sanitizeText(data.tags, { max: 200 })
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 10)
        }
      });
      setDone(true);
      push(t('submit.successTitle'));
    } catch (submitError) {
      console.error('[submit]', submitError);
      setError(submitError?.message || t('submit.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="container-page section">
        <div className="card mx-auto max-w-xl overflow-hidden text-center">
          <div className="bg-gradient-to-br from-navy-800 to-navy-600 px-6 py-10 text-white">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/15 ring-1 ring-inset ring-white/25">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold">{t('submit.successTitle')}</h1>
            <p className="mt-2 text-sm text-navy-100/80">{t('submit.previewNote')}</p>
          </div>
          <div className="p-7">
            <p className="text-sm leading-relaxed text-ink-soft">{t('submit.successText')}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/dashboard?tab=submissions" className="btn-primary">
                {t('submit.viewDashboard')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDone(false);
                  setForm(initialForm);
                  setThumbnail(null);
                  setLegalConfirmed(false);
                  setOfficialConfirmed(false);
                }}
                className="btn-secondary"
              >
                {t('submit.submitAnother')}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-sand-50 to-amber-50/50 pb-10 pt-10 sm:pb-14 dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div className="container-page relative">
          <span className="eyebrow">
            <span className="h-px w-7 bg-navy-500" />
            {t('submit.eyebrow')}
          </span>
          <h1 className="display-title mt-3 max-w-3xl">{t('submit.title')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">{t('submit.subtitle')}</p>
        </div>
      </section>

      <section className="container-page py-9 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="card p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">{t('submit.typeLabel')}</h2>
                  <p className="text-xs text-ink-muted">{t('submit.typeHint')}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = form.type === option.value;
                  return (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={option.value}
                        checked={isActive}
                        onChange={() => update('type', option.value)}
                        className="peer sr-only"
                      />
                      <span
                        className={`flex items-center gap-3 rounded-2xl border p-4 transition ${
                          isActive ? 'border-navy-500 bg-brand-50/70 shadow-sm' : 'border-sand-200 bg-surface hover:border-brand-200'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isActive ? 'text-brand-700' : 'text-ink-muted'}`} />
                        <span className={`text-sm font-semibold ${isActive ? 'text-brand-900' : 'text-ink-soft'}`}>
                          {typeMeta[option.value].label}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="card space-y-5 p-6 sm:p-8">
              <h2 className="font-display text-xl font-semibold text-ink">{t('submit.detailsTitle')}</h2>

              <Field label={t('submit.titleLabel')} htmlFor="resource-title" required>
                <input
                  id="resource-title"
                  className="input"
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder={t('submit.titlePlaceholder')}
                  maxLength={140}
                  required
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('submit.providerLabel')} htmlFor="resource-provider" required>
                  <input
                    id="resource-provider"
                    className="input"
                    value={form.provider}
                    onChange={(event) => update('provider', event.target.value)}
                    placeholder={t('submit.providerPlaceholder')}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label={t('submit.authorLabel')} htmlFor="resource-author" optionalLabel={t('submit.optional')}>
                  <input
                    id="resource-author"
                    className="input"
                    value={form.author}
                    onChange={(event) => update('author', event.target.value)}
                    placeholder={t('submit.authorPlaceholder')}
                    maxLength={120}
                  />
                </Field>
              </div>

              <Field label={t('submit.urlLabel')} htmlFor="resource-url" hint={t('submit.urlHint')} required>
                <input
                  id="resource-url"
                  type="url"
                  className="input"
                  value={form.url}
                  onChange={(event) => update('url', event.target.value)}
                  placeholder="https://"
                  pattern="https://.*"
                  required
                />
              </Field>

              <Field label={t('submit.descriptionLabel')} htmlFor="resource-description" required>
                <textarea
                  id="resource-description"
                  className="input min-h-[110px] resize-y"
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder={t('submit.descriptionPlaceholder')}
                  maxLength={420}
                  required
                />
                <p className="mt-1 text-end text-[11px] text-ink-muted">{form.description.length}/420</p>
              </Field>

              <Field
                label={t('submit.longDescriptionLabel')}
                htmlFor="resource-long-description"
                optionalLabel={t('submit.optional')}
              >
                <textarea
                  id="resource-long-description"
                  className="input min-h-[140px] resize-y"
                  value={form.longDescription}
                  onChange={(event) => update('longDescription', event.target.value)}
                  placeholder={t('submit.longDescriptionPlaceholder')}
                  maxLength={2000}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('submit.categoryLabel')} htmlFor="resource-category" required>
                  <div className="relative">
                    <select
                      id="resource-category"
                      className="input appearance-none pe-10"
                      value={form.category}
                      onChange={(event) => update('category', event.target.value)}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
                </Field>
                <Field label={t('submit.levelLabel')} htmlFor="resource-level" required>
                  <div className="relative">
                    <select
                      id="resource-level"
                      className="input appearance-none pe-10"
                      value={form.level}
                      onChange={(event) => update('level', event.target.value)}
                    >
                      {LEVELS.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
                </Field>
              </div>

              <Field label={t('submit.languagesLabel')} required>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((language) => (
                    <label
                      key={language}
                      className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                        form.languages.includes(language)
                          ? 'border-navy-500 bg-brand-50 text-brand-800'
                          : 'border-sand-300 bg-surface text-ink-soft hover:border-brand-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.languages.includes(language)}
                        onChange={() => toggleArray('languages', language)}
                      />
                      {language}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label={t('submit.countriesLabel')} required>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((country) => (
                    <label
                      key={country}
                      className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                        form.countries.includes(country)
                          ? 'border-navy-500 bg-brand-50 text-brand-800'
                          : 'border-sand-300 bg-surface text-ink-soft hover:border-brand-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.countries.includes(country)}
                        onChange={() => toggleArray('countries', country)}
                      />
                      {country}
                    </label>
                  ))}
                </div>
              </Field>

              {form.type === 'software' && (
                <Field label={t('submit.platformsLabel')}>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((platform) => (
                      <label
                        key={platform}
                        className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                          form.platform.includes(platform)
                            ? 'border-accent-500 bg-accent-50 text-accent-800 dark:border-accent-400 dark:bg-accent-500/15 dark:text-accent-200'
                            : 'border-sand-300 bg-surface text-ink-soft hover:border-accent-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={form.platform.includes(platform)}
                          onChange={() => toggleArray('platform', platform)}
                        />
                        {platform}
                      </label>
                    ))}
                  </div>
                </Field>
              )}

              <Field
                label={t('submit.tagsLabel')}
                htmlFor="resource-tags"
                hint={t('submit.tagsHint')}
                optionalLabel={t('submit.optional')}
              >
                <input
                  id="resource-tags"
                  className="input"
                  value={form.tags}
                  onChange={(event) => update('tags', event.target.value)}
                  placeholder="python, beginners, automation"
                  maxLength={200}
                />
              </Field>
            </div>

            <div className="card space-y-5 p-6 sm:p-8">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Licence & cover</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Clear licensing helps us verify that a resource is genuinely free and legal.
                </p>
              </div>

              <Field
                label={t('submit.licenseLabel')}
                htmlFor="resource-license"
                hint={t('submit.legalCheck')}
                required
              >
                <input
                  id="resource-license"
                  className="input"
                  value={form.licenseNote}
                  onChange={(event) => update('licenseNote', event.target.value)}
                  placeholder={t('submit.licensePlaceholder')}
                  maxLength={160}
                  required
                />
              </Field>

              <Field
                label={t('submit.licenseUrlLabel')}
                htmlFor="resource-license-url"
                optionalLabel={t('submit.optional')}
              >
                <input
                  id="resource-license-url"
                  type="url"
                  className="input"
                  value={form.licenseUrl}
                  onChange={(event) => update('licenseUrl', event.target.value)}
                  placeholder="https://creativecommons.org/licenses/..."
                  pattern="https://.*"
                />
              </Field>

              <Field label={t('submit.thumbnailLabel')} hint={t('submit.thumbnailHint')} optionalLabel={t('submit.optional')}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleThumbnail}
                  className="sr-only"
                  id="resource-thumbnail"
                />
                {thumbnailPreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-sand-200">
                    <img src={thumbnailPreview} alt="" decoding="async" className="h-40 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnail(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink shadow-sm transition hover:bg-surface dark:bg-white/15"
                      aria-label={t('common.close')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 px-5 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-brand-700 shadow-sm">
                      <Upload className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-ink">{t('submit.chooseImage')}</span>
                    <span className="text-xs text-ink-muted">JPG, PNG, WebP · max 2 MB</span>
                  </button>
                )}
              </Field>
            </div>

            <div className="card space-y-4 p-6 sm:p-8">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                <ShieldCheck className="h-5 w-5 text-brand-700" />
                Legal confirmation
              </h2>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50/60 p-4">
                <input
                  type="checkbox"
                  checked={legalConfirmed}
                  onChange={(event) => setLegalConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm leading-relaxed text-ink-soft">{t('submit.legalCheck')}</span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50/60 p-4">
                <input
                  type="checkbox"
                  checked={officialConfirmed}
                  onChange={(event) => setOfficialConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm leading-relaxed text-ink-soft">{t('submit.officialCheck')}</span>
              </label>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-sand-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('submit.previewNote')}
                </p>
                <button type="submit" disabled={submitting} className="btn-primary shrink-0 justify-center py-3">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {submitting ? t('submit.submitting') : t('submit.submitButton')}
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-brand-200 bg-brand-50/70 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-brand-950">
                <ShieldCheck className="h-4 w-4" />
                {t('home.legalEyebrow')}
              </h2>
              <ul className="mt-4 space-y-3">
                {[
                  t('home.legalPoint1Text'),
                  t('home.legalPoint2Text'),
                  t('home.legalPoint3Text'),
                  t('home.legalPoint4Text')
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-brand-900/75">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/legal/copyright" className="mt-4 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2">
                {t('footer.copyright')}
              </Link>
            </div>

            <div className="rounded-3xl border border-sand-200 bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <FileImage className="h-4 w-4 text-ink-muted" />
                Tips for approval
              </h2>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-soft">
                <li>• Link directly to the official course, book page, or download page.</li>
                <li>• Make the licence clear — “free to audit” is not the same as “open licence”.</li>
                <li>• For books, only submit public-domain, openly licensed, or author-permitted editions.</li>
                <li>• For software, never upload installers or link to file-sharing mirrors.</li>
              </ul>
              <p className="mt-4 border-t border-sand-100 pt-3 text-[11px] text-ink-muted">
                Submissions are reviewed before publication.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
