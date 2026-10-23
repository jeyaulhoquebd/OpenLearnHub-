import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  Settings,
  Share2,
  ShieldAlert,
  Wrench
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import FormField from '../../components/admin/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { getAdminSiteSettings, saveAdminSiteSettings } from '../../lib/api';
import {
  ANNOUNCEMENT_TYPES,
  SOCIAL_FIELDS
} from '../../lib/siteSettings';
import {
  siteSettingsFormSchema,
  siteSettingsToFormValues,
  toSiteSettingsPayload
} from '../../lib/siteSettingsForm';

const ANNOUNCEMENT_STYLES = {
  info: 'border-brand-200 bg-brand-50 text-brand-950 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100',
  critical:
    'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100'
};

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Admin → Site settings.
 *
 * Edits the public `settings/site` document (site name, tagline, contact and
 * social links, announcement banner and maintenance switch). The API validates
 * and writes with the Admin SDK; clients can only read the public document.
 */
export default function AdminSiteSettingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();
  const { refresh: refreshPublicSettings } = useSiteSettings();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(siteSettingsFormSchema),
    defaultValues: siteSettingsToFormValues()
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError('');
      try {
        const token = await user.getIdToken();
        const response = await getAdminSiteSettings(token);
        if (cancelled) return;
        reset(siteSettingsToFormValues(response.settings));
      } catch (error) {
        if (cancelled) return;
        console.warn('[admin-site-settings] load failed:', error);
        setLoadError(error.message || t('admin.siteSettings.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, reset, reloadToken, t]);

  async function onSubmit(values) {
    if (saving || !user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await saveAdminSiteSettings(toSiteSettingsPayload(values), token);
      reset(siteSettingsToFormValues(response.settings));
      await refreshPublicSettings();
      setSavedAt(new Date());
      push(t('admin.siteSettings.saved'), { type: 'success' });
    } catch (error) {
      console.warn('[admin-site-settings] save failed:', error);
      push(error.message || t('admin.siteSettings.saveError'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const values = watch();
  const announcementText =
    values[`announcement_${String(i18n.language || 'en').split('-')[0]}`] ||
    values.announcement_en ||
    '';
  const announcementStyle =
    ANNOUNCEMENT_STYLES[values.announcementType] || ANNOUNCEMENT_STYLES.info;

  return (
    <div>
      <PageHeader
        title={t('admin.siteSettings.title')}
        description={t('admin.siteSettings.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading || saving}
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('admin.siteSettings.refresh')}
            </button>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('admin.siteSettings.viewSite')}
            </a>
          </div>
        }
      />

      {loading ? (
        <div className="card grid min-h-[16rem] place-items-center p-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
            <p className="mt-3 text-sm text-ink-muted">{t('admin.siteSettings.loading')}</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.siteSettings.loadErrorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.siteSettings.retry')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <SectionCard
            icon={Globe2}
            title={t('admin.siteSettings.sections.general')}
            description={t('admin.siteSettings.sections.generalText')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                id="site-name"
                label={t('admin.siteSettings.fields.siteName')}
                hint={t('admin.siteSettings.fields.siteNameHint')}
                error={errors.siteName && t(errors.siteName.message)}
                required
              >
                <input
                  id="site-name"
                  type="text"
                  maxLength={80}
                  className="input"
                  aria-invalid={Boolean(errors.siteName)}
                  {...register('siteName')}
                />
              </FormField>

              <FormField
                id="contact-email"
                label={t('admin.siteSettings.fields.contactEmail')}
                hint={t('admin.siteSettings.fields.contactEmailHint')}
                error={errors.contactEmail && t(errors.contactEmail.message)}
                required
              >
                <input
                  id="contact-email"
                  type="email"
                  maxLength={200}
                  className="input"
                  aria-invalid={Boolean(errors.contactEmail)}
                  {...register('contactEmail')}
                />
              </FormField>

              {['en', 'bn', 'ur'].map((code) => (
                <FormField
                  key={code}
                  id={`tagline-${code}`}
                  label={t(`admin.siteSettings.fields.tagline.${code}`)}
                  error={errors[`tagline_${code}`] && t(errors[`tagline_${code}`].message)}
                  required={code === 'en'}
                >
                  <input
                    id={`tagline-${code}`}
                    type="text"
                    dir={code === 'ur' ? 'rtl' : undefined}
                    maxLength={160}
                    className="input"
                    aria-invalid={Boolean(errors[`tagline_${code}`])}
                    {...register(`tagline_${code}`)}
                  />
                </FormField>
              ))}

              <FormField
                id="legal-email"
                label={t('admin.siteSettings.fields.legalEmail')}
                hint={t('admin.siteSettings.fields.legalEmailHint')}
                error={errors.legalEmail && t(errors.legalEmail.message)}
              >
                <input
                  id="legal-email"
                  type="email"
                  maxLength={200}
                  className="input"
                  aria-invalid={Boolean(errors.legalEmail)}
                  {...register('legalEmail')}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            icon={Share2}
            title={t('admin.siteSettings.sections.social')}
            description={t('admin.siteSettings.sections.socialText')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {SOCIAL_FIELDS.map(({ key, labelKey }) => {
                const field = `social_${key}`;
                return (
                  <FormField
                    key={key}
                    id={`social-${key}`}
                    label={t(labelKey)}
                    error={errors[field] && t(errors[field].message)}
                  >
                    <input
                      id={`social-${key}`}
                      type="url"
                      inputMode="url"
                      dir="ltr"
                      maxLength={600}
                      placeholder="https://"
                      className="input"
                      aria-invalid={Boolean(errors[field])}
                      {...register(field)}
                    />
                  </FormField>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            icon={Megaphone}
            title={t('admin.siteSettings.sections.announcement')}
            description={t('admin.siteSettings.sections.announcementText')}
          >
            <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
              <div className="space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50/60 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-accent-600"
                    {...register('announcementEnabled')}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {t('admin.siteSettings.fields.announcementEnabled')}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {t('admin.siteSettings.fields.announcementEnabledHint')}
                    </span>
                  </span>
                </label>

                <FormField
                  id="announcement-type"
                  label={t('admin.siteSettings.fields.announcementType')}
                  hint={t('admin.siteSettings.fields.announcementTypeHint')}
                  error={errors.announcementType && t(errors.announcementType.message)}
                >
                  <select
                    id="announcement-type"
                    className="input"
                    aria-invalid={Boolean(errors.announcementType)}
                    {...register('announcementType')}
                  >
                    {ANNOUNCEMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`admin.siteSettings.types.${type}`)}
                      </option>
                    ))}
                  </select>
                </FormField>

                {['en', 'bn', 'ur'].map((code) => (
                  <FormField
                    key={code}
                    id={`announcement-${code}`}
                    label={t(`admin.siteSettings.fields.announcementText.${code}`)}
                    error={
                      errors[`announcement_${code}`] && t(errors[`announcement_${code}`].message)
                    }
                    required={code === 'en'}
                  >
                    <textarea
                      id={`announcement-${code}`}
                      rows={2}
                      dir={code === 'ur' ? 'rtl' : undefined}
                      maxLength={300}
                      className="input min-h-[4.5rem] resize-y"
                      aria-invalid={Boolean(errors[`announcement_${code}`])}
                      {...register(`announcement_${code}`)}
                    />
                  </FormField>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {t('admin.siteSettings.preview.title')}
                </p>
                <div className="mt-2 overflow-hidden rounded-2xl border border-sand-200 bg-sand-50">
                  <div className="grid h-9 place-items-center bg-navy-900 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
                    {t('admin.siteSettings.preview.header')}
                  </div>
                  {values.announcementEnabled && announcementText ? (
                    <div className={`border-b px-3 py-2.5 text-xs font-medium ${announcementStyle}`}>
                      {announcementText}
                    </div>
                  ) : (
                    <div className="border-b border-dashed border-sand-300 px-3 py-5 text-center text-[11px] text-ink-muted">
                      {t('admin.siteSettings.preview.empty')}
                    </div>
                  )}
                  <div className="space-y-1.5 p-3">
                    <div className="h-2 w-2/3 rounded-full bg-sand-300" />
                    <div className="h-2 w-1/2 rounded-full bg-sand-200" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                  {t('admin.siteSettings.preview.hint')}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Wrench}
            title={t('admin.siteSettings.sections.maintenance')}
            description={t('admin.siteSettings.sections.maintenanceText')}
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-600"
                {...register('maintenanceMode')}
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-950 dark:text-amber-100">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  {t('admin.siteSettings.fields.maintenanceMode')}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                  {t('admin.siteSettings.fields.maintenanceModeHint')}
                </span>
              </span>
            </label>
          </SectionCard>

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-surface/95 p-3 shadow-soft backdrop-blur">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              {isDirty ? (
                t('admin.siteSettings.unsaved')
              ) : savedAt ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  {t('admin.siteSettings.savedAt', {
                    time: new Intl.DateTimeFormat(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit'
                    }).format(savedAt)
                  })}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('admin.siteSettings.readOnlyHint')}
                </span>
              )}
            </p>
            <button type="submit" disabled={saving || !isDirty} className="btn-primary">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {saving ? t('admin.siteSettings.saving') : t('admin.siteSettings.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
