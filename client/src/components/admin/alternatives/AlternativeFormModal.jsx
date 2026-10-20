import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';
import ResourcePicker from './ResourcePicker';
import {
  alternativeFormSchema,
  alternativeToFormValues,
  toAlternativePayload
} from '../../../lib/catalogForm';

const LANGUAGE_FIELDS = [
  {
    code: 'en',
    field: 'note_en',
    required: true,
    labelKey: 'admin.resources.form.languages.english'
  },
  {
    code: 'bn',
    field: 'note_bn',
    required: false,
    labelKey: 'admin.resources.form.languages.bangla'
  },
  {
    code: 'ur',
    field: 'note_ur',
    required: false,
    labelKey: 'admin.resources.form.languages.urdu'
  }
];

/**
 * Create / edit dialog for a paid → free pair.
 *
 * `alternative.freeResource` (returned by the API) seeds the resource picker,
 * so an existing link is visible straight away. The parent owns the API call
 * through `onSubmit`.
 */
export default function AlternativeFormModal({
  open,
  alternative = null,
  token,
  saving = false,
  onClose,
  onSubmit
}) {
  const { t } = useTranslation();

  const defaults = useMemo(() => alternativeToFormValues(alternative), [alternative]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(alternativeFormSchema),
    defaultValues: defaults
  });

  const [selectedResource, setSelectedResource] = useState(null);

  useEffect(() => {
    if (!open) return;
    reset(defaults);
    setSelectedResource(alternative?.freeResource || null);
  }, [open, alternative, defaults, reset]);

  const active = watch('active');

  function handlePick(resource) {
    setSelectedResource(resource);
    setValue('freeAlternativeResourceId', resource?.id || '', {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="lg"
      title={
        alternative
          ? t('admin.alternatives.form.editTitle')
          : t('admin.alternatives.form.createTitle')
      }
      description={t('admin.alternatives.form.subtitle')}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            {t('admin.ui.cancel')}
          </button>
          <button type="submit" form="alternative-form" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? t('admin.alternatives.form.saving') : t('admin.alternatives.form.save')}
          </button>
        </>
      }
    >
      <form
        id="alternative-form"
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit((values) => onSubmit(toAlternativePayload(values)))}
      >
        <FormField
          id="alternative-paid"
          label={t('admin.alternatives.form.fields.paidSoftware')}
          required
          error={errors.paidSoftware && t(errors.paidSoftware.message)}
        >
          <input
            id="alternative-paid"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder={t('admin.alternatives.form.fields.paidSoftwarePlaceholder')}
            className="input"
            aria-invalid={Boolean(errors.paidSoftware)}
            {...register('paidSoftware')}
          />
        </FormField>

        <FormField
          id="alternative-logo"
          label={t('admin.alternatives.form.fields.logoUrl')}
          hint={t('admin.alternatives.form.fields.logoUrlHint')}
          error={errors.paidSoftwareLogoUrl && t(errors.paidSoftwareLogoUrl.message)}
        >
          <input
            id="alternative-logo"
            type="url"
            dir="ltr"
            maxLength={800}
            autoComplete="off"
            placeholder="https://…"
            className="input"
            aria-invalid={Boolean(errors.paidSoftwareLogoUrl)}
            {...register('paidSoftwareLogoUrl')}
          />
        </FormField>

        <div>
          <p className="mb-1.5 block text-sm font-semibold text-ink">
            {t('admin.alternatives.form.fields.resource')}
            <span className="ms-1 text-rose-500" aria-hidden="true">
              *
            </span>
          </p>
          <ResourcePicker
            token={token}
            value={selectedResource}
            fallbackId={alternative?.freeAlternativeResourceId || ''}
            onChange={handlePick}
            label={t('admin.alternatives.form.fields.resource')}
            hint={t('admin.alternatives.form.fields.resourceHint')}
            error={errors.freeAlternativeResourceId && t(errors.freeAlternativeResourceId.message)}
            errorId="alternative-resource-error"
          />
          {/* Keeps the id inside react-hook-form so zod validates it. */}
          <input type="hidden" {...register('freeAlternativeResourceId')} />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">
            {t('admin.alternatives.form.fields.notes')}
          </p>
          {LANGUAGE_FIELDS.map(({ code, field, required, labelKey }) => (
            <FormField
              key={field}
              id={`alternative-${field}`}
              label={t('admin.alternatives.form.fields.note', {
                language: t(labelKey)
              })}
              required={required}
              hint={!required ? t('admin.resources.form.content.translationHint') : undefined}
              error={errors[field] && t(errors[field].message)}
            >
              <textarea
                id={`alternative-${field}`}
                rows={2}
                lang={code}
                dir={code === 'ur' ? 'rtl' : undefined}
                maxLength={300}
                className="input"
                aria-invalid={Boolean(errors[field])}
                {...register(field)}
              />
            </FormField>
          ))}
        </div>

        <label
          htmlFor="alternative-active"
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand-200 bg-sand-50 p-3"
        >
          <input
            id="alternative-active"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-sand-300 text-accent-600 focus:ring-accent-500"
            {...register('active')}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              {t('admin.alternatives.form.fields.active')}
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {active
                ? t('admin.alternatives.form.fields.activeHint')
                : t('admin.alternatives.form.fields.inactiveHint')}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
