import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  AppWindow,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  Image as ImageIcon,
  Info,
  Layers,
  Link2,
  Loader2,
  PlayCircle,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Youtube
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import FormField from '../../components/admin/ui/FormField';
import ImageUploader from '../../components/admin/ui/ImageUploader';
import StatusBadge from '../../components/admin/ui/StatusBadge';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createAdminResource, testResourceLink, updateAdminResource } from '../../lib/api';
import { categoryName, fetchCategories, fetchResourceById } from '../../lib/data';
import { COUNTRIES, LANGUAGES, LEVELS, PLATFORMS, RESOURCE_TYPES } from '../../lib/constants';
import {
  CONTENT_LANGUAGES,
  EMPTY_RESOURCE_FORM,
  LANGUAGE_KEYS,
  LEVEL_KEYS,
  RESOURCE_FORM_STATUSES,
  languageCompleteness,
  resourceToFormValues,
  resourceFormSchema,
  toResourcePayload
} from '../../lib/resourceForm';
import { prepareThumbnail, uploadThumbnail } from '../../lib/thumbnails';
import { parseYouTubePlaylistId, youtubeEmbedUrl, youtubePlaylistUrl } from '../../lib/youtube';
import { formatDate } from '../../lib/utils';

const TYPE_ICONS = {
  course: PlayCircle,
  book: BookOpen,
  software: AppWindow
};

const IMAGE_ERROR_KEYS = {
  image_type: 'type',
  image_size: 'size',
  image_too_large: 'tooLarge',
  image_decode_failed: 'decode',
  image_encode_failed: 'encode',
  storage_unavailable: 'storage',
  not_signed_in: 'storage'
};

const LINK_ERROR_KEYS = {
  timeout: 'timeout',
  unreachable: 'unreachable',
  dns_error: 'dns',
  too_many_redirects: 'redirects'
};

function Section({ icon: Icon, title, description, children, id }) {
  return (
    <section id={id} className="rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function CheckboxGroup({ legend, hint, error, children }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function PreviewTypeChip({ type }) {
  const { t } = useTranslation();
  const Icon = TYPE_ICONS[type] || PlayCircle;
  return (
    <span className="chip bg-navy-50 text-navy-800 ring-navy-200 dark:bg-white/10 dark:text-white dark:ring-white/20">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(`type.${type}`)}
    </span>
  );
}

/**
 * Admin → Create / edit resource.
 *
 * One form, five sections, a live public-site preview, and a language tab strip
 * with per-language completeness. English is required (the public site falls
 * back to it); Bangla and Urdu are optional translations.
 *
 * Writes always go through the admin API so the same server-side schema,
 * piracy blocklist, unique slug generation and audit logging apply to every
 * save. Image bytes go straight to Cloud Storage (admin-only prefix), then the
 * download URL is saved with the resource.
 */
export default function AdminResourceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const youtubeIntent = !isEdit && searchParams.get('youtube') === '1';
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [existing, setExisting] = useState(null);
  const [slug, setSlug] = useState('');
  const [categories, setCategories] = useState([]);
  const [activeLang, setActiveLang] = useState('en');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [linkState, setLinkState] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: EMPTY_RESOURCE_FORM,
    mode: 'onBlur'
  });

  const values = watch();
  const youtubePlaylistId = useMemo(
    () =>
      parseYouTubePlaylistId(values.youtubePlaylistUrl) ||
      parseYouTubePlaylistId(values.sourceUrl),
    [values.youtubePlaylistUrl, values.sourceUrl]
  );
  const youtubeEmbed = youtubeEmbedUrl(youtubePlaylistId);

  // Auto-fill the source metadata once a valid playlist is detected. The
  // effect only depends on the id, so an admin can still edit the name,
  // licence, or description afterwards without the form overwriting them.
  useEffect(() => {
    if (!youtubePlaylistId) return;
    setValue('type', 'course', { shouldDirty: true, shouldValidate: true });
    if (!parseYouTubePlaylistId(values.youtubePlaylistUrl)) {
      setValue('youtubePlaylistUrl', youtubePlaylistUrl(youtubePlaylistId), {
        shouldDirty: true,
        shouldValidate: true
      });
    }
    setValue('sourceUrl', youtubePlaylistUrl(youtubePlaylistId), {
      shouldDirty: true,
      shouldValidate: true
    });
    if (!String(values.sourceName || '').trim()) {
      setValue('sourceName', t('youtubeCourse.adminSourceName'), {
        shouldDirty: true,
        shouldValidate: true
      });
    }
    if (!String(values.license || '').trim()) {
      setValue('license', t('youtubeCourse.adminLicense'), {
        shouldDirty: true,
        shouldValidate: true
      });
      setValue('licenseUrl', t('youtubeCourse.adminLicenseUrl'), {
        shouldDirty: true,
        shouldValidate: true
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubePlaylistId]);

  // Warn on a real page unload (reload / tab close). In-app navigation is
  // guarded by the Cancel button's confirm dialog.
  useEffect(() => {
    if (!isDirty) return undefined;
    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch((err) => console.warn('[admin-resource-form] categories', err));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    fetchResourceById(id)
      .then((resource) => {
        if (!active) return;
        if (!resource) {
          const error = new Error('not_found');
          error.code = 'not_found';
          setLoadError(error);
          return;
        }
        setExisting(resource);
        setSlug(resource.slug || '');
        reset(resourceToFormValues(resource));
      })
      .catch((error) => {
        if (active) setLoadError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEdit, reset]);

  const categoryOptions = useMemo(() => {
    const names = categories.map((item) => categoryName(item, 'en')).filter(Boolean);
    const all = new Set([...names, ...(values.category ? [values.category] : [])]);
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [categories, values.category]);

  function categoryLabel(name) {
    const match = categories.find((item) => categoryName(item, 'en') === name);
    return match ? categoryName(match, i18n.language) : name;
  }

  function errorText(field) {
    const message = errors[field]?.message;
    return message ? t(message) : '';
  }

  function handleCancel() {
    if (isDirty) setCancelConfirm(true);
    else navigate('/admin/resources');
  }

  async function handleImage(file) {
    if (!user) return;
    setUploading(true);
    try {
      const prepared = await prepareThumbnail(file);
      const url = await uploadThumbnail(prepared, user.uid);
      setValue('thumbnailUrl', url, { shouldDirty: true, shouldValidate: true });
      push(t('admin.resources.form.image.uploaded'));
    } catch (error) {
      console.warn('[admin-resource-form] thumbnail', error);
      const key = IMAGE_ERROR_KEYS[error?.code] || 'generic';
      push(t(`admin.resources.form.image.errors.${key}`), { type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  async function handleTestLink() {
    const url = String(values.sourceUrl || '').trim();
    setLinkState(null);

    if (!url) {
      setLinkState({ type: 'error', message: t('admin.resources.form.source.testEmpty') });
      return;
    }

    if (!user) return;
    setTesting(true);

    try {
      const token = await user.getIdToken();
      const result = await testResourceLink(url, token);

      if (result.ok) {
        setLinkState({
          type: 'ok',
          message: t('admin.resources.form.source.testOk', { status: result.status })
        });
        return;
      }

      const key = result.error ? LINK_ERROR_KEYS[result.error] : null;
      setLinkState({
        type: 'error',
        message: key
          ? t(`admin.resources.form.source.errors.${key}`)
          : t('admin.resources.form.source.errors.http', { status: result.status })
      });
    } catch (error) {
      setLinkState({ type: 'error', message: error?.message || t('admin.resources.errorText') });
    } finally {
      setTesting(false);
    }
  }

  async function onSubmit(formValues) {
    if (!user) return;
    setSaving(true);

    try {
      const token = await user.getIdToken();
      const payload = toResourcePayload(formValues);

      if (isEdit) {
        await updateAdminResource(id, payload, token);
        push(t('admin.resources.form.updateSuccess'));
      } else {
        await createAdminResource(payload, token);
        push(t('admin.resources.form.createSuccess'));
      }

      navigate('/admin/resources');
    } catch (error) {
      console.warn('[admin-resource-form] save', error);
      push(error?.message || t('admin.resources.errorText'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && loading) {
    return (
      <div>
        <PageHeader
          eyebrow={t('admin.eyebrow')}
          title={t('admin.resources.form.editTitle')}
          description={t('admin.resources.form.loading')}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft"
              >
                <span className="skeleton block h-5 w-40" />
                <span className="skeleton mt-4 block h-10 w-full" />
                <span className="skeleton mt-3 block h-10 w-full" />
                <span className="skeleton mt-3 block h-24 w-full" />
              </div>
            ))}
          </div>
          <div className="h-72 rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft">
            <span className="skeleton block h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && loadError) {
    const notFound = loadError.code === 'not_found';
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-500" aria-hidden="true" />
        <h1 className="mt-3 font-display text-xl font-semibold text-ink">
          {notFound
            ? t('admin.resources.form.notFoundTitle')
            : t('admin.resources.form.loadErrorTitle')}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {notFound ? t('admin.resources.form.notFoundText') : loadError.message}
        </p>
        <Link to="/admin/resources" className="btn-secondary mt-5">
          {t('admin.resources.form.backToList')}
        </Link>
      </div>
    );
  }

  const previewTitle =
    String(values[`title_${activeLang}`] || values.title_en || '').trim() ||
    t('admin.resources.untitled');
  const previewDescription =
    String(values[`description_${activeLang}`] || values.description_en || '').trim();
  const previewDir = activeLang === 'ur' ? 'rtl' : undefined;

  return (
    <div>
      <PageHeader
        eyebrow={t('admin.eyebrow')}
        title={
          isEdit
            ? t('admin.resources.form.editTitle')
            : t('admin.resources.form.createTitle')
        }
        description={t('admin.resources.form.subtitle')}
        actions={
          <>
            <button type="button" onClick={handleCancel} className="btn-secondary">
              {t('admin.ui.cancel')}
            </button>
            <button type="submit" form="resource-form" disabled={saving} className="btn-primary">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {saving ? t('admin.resources.form.saving') : t('admin.resources.form.save')}
            </button>
          </>
        }
      />

      {isDirty && (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {t('admin.resources.form.unsaved')}
        </p>
      )}

      {youtubeIntent && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          <Youtube className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('youtubeCourse.adminSectionTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-900/80 dark:text-rose-100/80">
              {t('youtubeCourse.adminIntent')}
            </p>
          </div>
        </div>
      )}

      <form
        id="resource-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="space-y-6">
          {/* 1 — Basic info ------------------------------------------------ */}
          <Section
            icon={Layers}
            title={t('admin.resources.form.basic.title')}
            description={t('admin.resources.form.basic.description')}
          >
            <fieldset>
              <legend className="text-sm font-semibold text-ink">
                {t('admin.resources.form.fields.type')}
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {RESOURCE_TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const active = values.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setValue('type', type, { shouldDirty: true, shouldValidate: true });
                        if (type !== 'software') {
                          setValue('platform', [], { shouldDirty: true });
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                        active
                          ? 'border-accent-400 bg-accent-50 text-accent-800 dark:border-accent-500/50 dark:bg-accent-500/10 dark:text-accent-200'
                          : 'border-sand-200 bg-surface text-ink-soft hover:border-brand-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {t(`type.${type}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="resource-category"
                label={t('admin.resources.form.fields.category')}
                required
                error={errorText('category')}
              >
                <select
                  id="resource-category"
                  className="input"
                  aria-invalid={Boolean(errors.category)}
                  {...register('category')}
                >
                  <option value="">{t('admin.resources.form.fields.categoryPlaceholder')}</option>
                  {categoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {categoryLabel(name)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                id="resource-level"
                label={t('admin.resources.form.fields.level')}
                required
                error={errorText('level')}
              >
                <select id="resource-level" className="input" {...register('level')}>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {t(LEVEL_KEYS[level])}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <CheckboxGroup
              legend={t('admin.resources.form.fields.languages')}
              hint={t('admin.resources.form.fields.languagesHint')}
              error={errorText('languages')}
            >
              {LANGUAGES.map((language) => (
                <label
                  key={language}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sand-200 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft transition has-[:checked]:border-accent-400 has-[:checked]:bg-accent-50 has-[:checked]:text-accent-800 dark:has-[:checked]:border-accent-500/50 dark:has-[:checked]:bg-accent-500/10 dark:has-[:checked]:text-accent-200"
                >
                  <input
                    type="checkbox"
                    value={language}
                    className="h-3.5 w-3.5 rounded border-sand-300 accent-accent-600"
                    {...register('languages')}
                  />
                  {t(LANGUAGE_KEYS[language])}
                </label>
              ))}
            </CheckboxGroup>

            <CheckboxGroup
              legend={t('admin.resources.form.fields.countries')}
              hint={t('admin.resources.form.fields.countriesHint')}
              error={errorText('countries')}
            >
              {COUNTRIES.map((country) => (
                <label
                  key={country}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sand-200 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800 dark:has-[:checked]:border-brand-500/50 dark:has-[:checked]:bg-brand-500/10 dark:has-[:checked]:text-brand-200"
                >
                  <input
                    type="checkbox"
                    value={country}
                    className="h-3.5 w-3.5 rounded border-sand-300 accent-accent-600"
                    {...register('countries')}
                  />
                  {country}
                </label>
              ))}
            </CheckboxGroup>

            {values.type === 'software' && (
              <CheckboxGroup
                legend={t('admin.resources.form.fields.platform')}
                hint={t('admin.resources.form.fields.platformHint')}
                error={errorText('platform')}
              >
                {PLATFORMS.map((platform) => (
                  <label
                    key={platform}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sand-200 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800 dark:has-[:checked]:border-brand-500/50 dark:has-[:checked]:bg-brand-500/10 dark:has-[:checked]:text-brand-200"
                  >
                    <input
                      type="checkbox"
                      value={platform}
                      className="h-3.5 w-3.5 rounded border-sand-300 accent-accent-600"
                      {...register('platform')}
                    />
                    {platform}
                  </label>
                ))}
              </CheckboxGroup>
            )}

            <FormField
              id="resource-tags"
              label={t('admin.resources.form.fields.tags')}
              hint={t('admin.resources.form.fields.tagsHint')}
              error={errorText('tags')}
            >
              <input
                id="resource-tags"
                type="text"
                className="input"
                placeholder={t('admin.resources.form.fields.tagsPlaceholder')}
                aria-invalid={Boolean(errors.tags)}
                {...register('tags')}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="resource-license"
                label={t('admin.resources.form.fields.license')}
                required
                hint={t('admin.resources.form.fields.licenseHint')}
                error={errorText('license')}
              >
                <input
                  id="resource-license"
                  type="text"
                  className="input"
                  placeholder={t('admin.resources.form.fields.licensePlaceholder')}
                  aria-invalid={Boolean(errors.license)}
                  {...register('license')}
                />
              </FormField>

              <FormField
                id="resource-license-url"
                label={t('admin.resources.form.fields.licenseUrl')}
                hint={t('admin.resources.form.fields.licenseUrlHint')}
                error={errorText('licenseUrl')}
              >
                <input
                  id="resource-license-url"
                  type="url"
                  inputMode="url"
                  className="input"
                  placeholder="https://"
                  aria-invalid={Boolean(errors.licenseUrl)}
                  {...register('licenseUrl')}
                />
              </FormField>
            </div>
          </Section>

          {/* 2 — Content -------------------------------------------------- */}
          <Section
            icon={Globe2}
            title={t('admin.resources.form.content.title')}
            description={t('admin.resources.form.content.description')}
          >
            <div
              role="tablist"
              aria-label={t('admin.resources.form.content.title')}
              className="flex flex-wrap gap-1 rounded-xl border border-sand-200 bg-sand-50 p-1"
            >
              {CONTENT_LANGUAGES.map((language) => {
                const active = activeLang === language.code;
                const percent = languageCompleteness(values, language.code);
                return (
                  <button
                    key={language.code}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveLang(language.code)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      active
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t(language.labelKey)}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        percent === 100
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : percent > 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                            : 'bg-sand-200 text-ink-muted'
                      }`}
                    >
                      {percent}%
                    </span>
                  </button>
                );
              })}
            </div>

            {CONTENT_LANGUAGES.map((language) => {
              if (language.code !== activeLang) return null;
              const isUrdu = language.code === 'ur';
              const titleField = `title_${language.code}`;
              const descriptionField = `description_${language.code}`;
              const required = language.code === 'en';

              return (
                <div key={language.code} className="space-y-4" dir={isUrdu ? 'rtl' : undefined}>
                  {language.code !== 'en' && (
                    <p className="rounded-lg bg-brand-50/70 px-3 py-2 text-[11px] leading-relaxed text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
                      {t('admin.resources.form.content.translationHint')}
                    </p>
                  )}

                  <FormField
                    id={`resource-${titleField}`}
                    label={t('admin.resources.form.fields.title', {
                      language: t(language.labelKey)
                    })}
                    required={required}
                    error={errorText(titleField)}
                  >
                    <input
                      id={`resource-${titleField}`}
                      type="text"
                      dir={isUrdu ? 'rtl' : undefined}
                      className={`input ${isUrdu ? 'text-end' : ''}`}
                      aria-invalid={Boolean(errors[titleField])}
                      {...register(titleField)}
                    />
                  </FormField>

                  <FormField
                    id={`resource-${descriptionField}`}
                    label={t('admin.resources.form.fields.description', {
                      language: t(language.labelKey)
                    })}
                    required={required}
                    hint={
                      required
                        ? t('admin.resources.form.fields.descriptionHint')
                        : t('admin.resources.form.fields.descriptionOptional')
                    }
                    error={errorText(descriptionField)}
                  >
                    <textarea
                      id={`resource-${descriptionField}`}
                      rows={required ? 6 : 5}
                      dir={isUrdu ? 'rtl' : undefined}
                      className={`input ${isUrdu ? 'text-end' : ''}`}
                      aria-invalid={Boolean(errors[descriptionField])}
                      {...register(descriptionField)}
                    />
                  </FormField>
                </div>
              );
            })}
          </Section>

          {/* 3 — Source --------------------------------------------------- */}
          <Section
            icon={Link2}
            title={t('admin.resources.form.source.title')}
            description={t('admin.resources.form.source.description')}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="resource-source-name"
                label={t('admin.resources.form.fields.sourceName')}
                required
                error={errorText('sourceName')}
              >
                <input
                  id="resource-source-name"
                  type="text"
                  className="input"
                  placeholder={t('admin.resources.form.fields.sourceNamePlaceholder')}
                  aria-invalid={Boolean(errors.sourceName)}
                  {...register('sourceName')}
                />
              </FormField>

              <FormField
                id="resource-author"
                label={t('admin.resources.form.fields.author')}
                error={errorText('author')}
              >
                <input
                  id="resource-author"
                  type="text"
                  className="input"
                  aria-invalid={Boolean(errors.author)}
                  {...register('author')}
                />
              </FormField>
            </div>

            <FormField
              id="resource-source-url"
              label={t('admin.resources.form.fields.sourceUrl')}
              required
              hint={t('admin.resources.form.fields.sourceUrlHint')}
              error={errorText('sourceUrl')}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="resource-source-url"
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  className="input flex-1"
                  placeholder="https://"
                  aria-invalid={Boolean(errors.sourceUrl)}
                  {...register('sourceUrl')}
                />
                <button
                  type="button"
                  onClick={handleTestLink}
                  disabled={testing || uploading}
                  className="btn-secondary shrink-0"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {testing
                    ? t('admin.resources.form.source.testing')
                    : t('admin.resources.form.source.test')}
                </button>
              </div>
            </FormField>

            {linkState && (
              <div
                role="status"
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                  linkState.type === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                }`}
              >
                {linkState.type === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{linkState.message}</span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <p>{t('admin.resources.form.source.legalNote')}</p>
            </div>
          </Section>

          {/* 4 — YouTube playlist ---------------------------------------- */}
          <Section
            id="youtube-course"
            icon={Youtube}
            title={t('youtubeCourse.adminSectionTitle')}
            description={t('youtubeCourse.adminSectionDescription')}
          >
            <FormField
              id="resource-youtube-playlist"
              label={t('youtubeCourse.playlistUrl')}
              hint={t('youtubeCourse.playlistUrlHint')}
              error={errorText('youtubePlaylistUrl')}
            >
              <input
                id="resource-youtube-playlist"
                type="text"
                inputMode="url"
                dir="ltr"
                className="input"
                placeholder={t('youtubeCourse.playlistUrlPlaceholder')}
                aria-invalid={Boolean(errors.youtubePlaylistUrl)}
                {...register('youtubePlaylistUrl')}
              />
            </FormField>

            {youtubePlaylistId ? (
              <div className="space-y-3">
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('youtubeCourse.playlistDetected', { id: youtubePlaylistId })}
                </p>
                <div className="overflow-hidden rounded-2xl border border-sand-200 bg-black">
                  <div className="aspect-video w-full">
                    <iframe
                      src={youtubeEmbed}
                      title={t('youtubeCourse.adminPreviewTitle')}
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  {t('youtubeCourse.adminPreviewHint')}
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
                {t('youtubeCourse.playlistEmpty')}
              </p>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <p>{t('youtubeCourse.adminAutoFill')}</p>
            </div>
          </Section>

          {/* 5 — Thumbnail ------------------------------------------------ */}
          <Section
            icon={ImageIcon}
            title={t('admin.resources.form.thumbnail.title')}
            description={t('admin.resources.form.thumbnail.description')}
          >
            <ImageUploader
              value={values.thumbnailUrl || ''}
              onFile={handleImage}
              onRemove={() =>
                setValue('thumbnailUrl', '', { shouldDirty: true, shouldValidate: true })
              }
              loading={uploading}
              maxSizeMB={5}
              hint={t('admin.resources.form.thumbnail.hint')}
            />
            <p className="text-[11px] leading-relaxed text-ink-muted">
              {t('admin.resources.form.thumbnail.rule')}
            </p>
          </Section>

          {/* 5 — Publishing ----------------------------------------------- */}
          <Section
            icon={Rocket}
            title={t('admin.resources.form.publishing.title')}
            description={t('admin.resources.form.publishing.description')}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="resource-status"
                label={t('admin.resources.form.fields.status')}
                required
                error={errorText('status')}
              >
                <select id="resource-status" className="input" {...register('status')}>
                  {RESOURCE_FORM_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`admin.status.${status}`)}
                    </option>
                  ))}
                </select>
              </FormField>

              {isEdit && (
                <FormField id="resource-slug" label={t('admin.resources.form.fields.slug')}>
                  <input
                    id="resource-slug"
                    type="text"
                    dir="ltr"
                    className="input bg-sand-50 text-ink-muted"
                    value={slug || '—'}
                    readOnly
                  />
                </FormField>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand-200 bg-surface p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-sand-300 accent-accent-600"
                {...register('featured')}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {t('admin.resources.form.fields.featured')}
                </span>
                <span className="block text-xs leading-relaxed text-ink-muted">
                  {t('admin.resources.form.fields.featuredHint')}
                </span>
              </span>
            </label>

            {existing && (
              <dl className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-ink-soft">
                    {t('admin.resources.form.fields.created')}
                  </dt>
                  <dd>{formatDate(existing.createdAt, i18n.language)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-soft">
                    {t('admin.resources.form.fields.updated')}
                  </dt>
                  <dd>{formatDate(existing.updatedAt, i18n.language)}</dd>
                </div>
              </dl>
            )}
          </Section>
        </div>

        {/* Live preview ----------------------------------------------------- */}
        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="rounded-2xl border border-sand-200 bg-surface shadow-soft">
            <div className="border-b border-sand-100 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.resources.form.preview.title')}
              </p>
            </div>

            <div className="aspect-[16/9] bg-sand-100">
              {values.thumbnailUrl ? (
                <img
                  src={values.thumbnailUrl}
                  alt={previewTitle}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-full place-items-center text-ink-muted">
                  <ImageIcon className="h-8 w-8" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="space-y-3 p-4" dir={previewDir}>
              <div className="flex flex-wrap items-center gap-2">
                <PreviewTypeChip type={values.type} />
                <StatusBadge status={values.status} />
                {youtubePlaylistId && (
                  <span className="chip bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
                    <Youtube className="h-3 w-3" aria-hidden="true" />
                    {t('youtubeCourse.adminBadge')}
                  </span>
                )}
                {values.featured && (
                  <span className="chip bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                    {t('admin.resources.form.preview.featured')}
                  </span>
                )}
              </div>

              <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                {previewTitle}
              </h3>

              <p className="line-clamp-4 text-sm leading-relaxed text-ink-soft">
                {previewDescription || t('admin.resources.form.preview.descriptionPlaceholder')}
              </p>

              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-ink-muted">
                {values.category && (
                  <span className="rounded-full bg-sand-100 px-2 py-0.5">
                    {categoryLabel(values.category)}
                  </span>
                )}
                <span className="rounded-full bg-sand-100 px-2 py-0.5">
                  {t(LEVEL_KEYS[values.level] || LEVEL_KEYS['All levels'])}
                </span>
                {(values.languages || []).map((language) => (
                  <span key={language} className="rounded-full bg-sand-100 px-2 py-0.5">
                    {t(LANGUAGE_KEYS[language])}
                  </span>
                ))}
              </div>

              {values.sourceUrl && (
                <a
                  href={values.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline dark:text-accent-300"
                >
                  {values.sourceName || t('admin.resources.form.preview.source')}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-sand-200 bg-surface px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted shadow-soft">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{t('admin.resources.form.preview.hint')}</p>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-sand-200 bg-surface px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted shadow-soft">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{t('admin.resources.form.preview.missing')}</p>
          </div>
        </aside>
      </form>

      <ConfirmDialog
        open={cancelConfirm}
        tone="danger"
        title={t('admin.resources.form.unsavedTitle')}
        message={t('admin.resources.form.unsavedText')}
        confirmLabel={t('admin.resources.form.leave')}
        onConfirm={() => navigate('/admin/resources')}
        onCancel={() => setCancelConfirm(false)}
      />
    </div>
  );
}
