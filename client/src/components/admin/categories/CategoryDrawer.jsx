import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2, Eraser } from 'lucide-react';
import Drawer from '../ui/Drawer';
import FormField from '../ui/FormField';
import { CATEGORY_ICON_OPTIONS, getCategoryIcon } from '../../../lib/categoryIcons';
import {
  CATEGORY_TYPE_OPTIONS,
  categoryFormSchema,
  categoryToFormValues,
  toCategoryPayload
} from '../../../lib/catalogForm';

/** Grid of allowed category icons. Keyboard reachable via `aria-pressed`. */
function IconPicker({ value, onChange, label, errorId }) {

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={errorId}
      className="grid grid-cols-6 gap-1.5 rounded-xl border border-sand-200 bg-sand-50 p-2 sm:grid-cols-8"
    >
      {CATEGORY_ICON_OPTIONS.map(({ name, Icon }) => {
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            title={name}
            onClick={() => onChange(name)}
            className={`grid h-9 w-full place-items-center rounded-lg border transition ${
              active
                ? 'border-accent-500 bg-accent-500/10 text-accent-700 dark:text-accent-300'
                : 'border-transparent text-ink-muted hover:border-sand-300 hover:bg-surface hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Slide-over form for creating or editing a category.
 *
 * The parent owns the API call (`onSubmit`) and the saving flag, so the same
 * component serves both create and edit and stays testable in isolation.
 */
export default function CategoryDrawer({
  open,
  category = null,
  defaultType = 'course',
  saving = false,
  onClose,
  onSubmit
}) {
  const { t } = useTranslation();

  const defaults = useMemo(
    () => ({
      ...categoryToFormValues(category),
      type: category?.type || defaultType
    }),
    [category, defaultType]
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaults
  });

  // Re-seed the form whenever the drawer opens for a different category.
  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const icon = watch('icon');
  const color = watch('color');
  const nameEn = watch('name_en');

  const PreviewIcon = getCategoryIcon(icon);

  return (
    <Drawer
      open={open}
      onClose={saving ? () => {} : onClose}
      width="md"
      title={category ? t('admin.categories.form.editTitle') : t('admin.categories.form.createTitle')}
      description={t('admin.categories.form.subtitle')}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            {t('admin.ui.cancel')}
          </button>
          <button type="submit" form="category-form" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? t('admin.categories.form.saving') : t('admin.categories.form.save')}
          </button>
        </>
      }
    >
      <form
        id="category-form"
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit((values) => onSubmit(toCategoryPayload(values)))}
      >
        {/* Live preview of the icon tile + English name */}
        <div className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-sand-50 p-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={
              color
                ? { backgroundColor: `${color}1F`, color }
                : undefined
            }
          >
            <PreviewIcon
              className={`h-5 w-5 ${color ? '' : 'text-accent-600 dark:text-accent-300'}`}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {nameEn || t('admin.categories.form.previewFallback')}
            </p>
            <p className="text-xs text-ink-muted">{t('admin.categories.form.previewHint')}</p>
          </div>
        </div>

        <FormField
          id="category-name-en"
          label={t('admin.categories.form.fields.nameEn')}
          required
          error={errors.name_en && t(errors.name_en.message)}
        >
          <input
            id="category-name-en"
            type="text"
            maxLength={60}
            autoComplete="off"
            className="input"
            aria-invalid={Boolean(errors.name_en)}
            {...register('name_en')}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="category-name-bn"
            label={t('admin.categories.form.fields.nameBn')}
            error={errors.name_bn && t(errors.name_bn.message)}
          >
            <input
              id="category-name-bn"
              type="text"
              lang="bn"
              maxLength={60}
              autoComplete="off"
              className="input"
              {...register('name_bn')}
            />
          </FormField>

          <FormField
            id="category-name-ur"
            label={t('admin.categories.form.fields.nameUr')}
            error={errors.name_ur && t(errors.name_ur.message)}
          >
            <input
              id="category-name-ur"
              type="text"
              lang="ur"
              dir="rtl"
              maxLength={60}
              autoComplete="off"
              className="input"
              {...register('name_ur')}
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="category-type"
            label={t('admin.categories.form.fields.type')}
            hint={t('admin.categories.form.fields.typeHint')}
            required
            error={errors.type && t(errors.type.message)}
          >
            <select id="category-type" className="input" {...register('type')}>
              {CATEGORY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="category-slug"
            label={t('admin.categories.form.fields.slug')}
            hint={t('admin.categories.form.fields.slugHint')}
            error={errors.slug && t(errors.slug.message)}
          >
            <input
              id="category-slug"
              type="text"
              maxLength={70}
              autoComplete="off"
              placeholder="computer-science"
              dir="ltr"
              className="input"
              aria-invalid={Boolean(errors.slug)}
              {...register('slug')}
            />
          </FormField>
        </div>

        <FormField
          id="category-icon"
          label={t('admin.categories.form.fields.icon')}
          required
          error={errors.icon && t(errors.icon.message)}
        >
          <IconPicker
            label={t('admin.categories.form.fields.icon')}
            value={icon}
            errorId={errors.icon ? 'category-icon-error' : undefined}
            onChange={(name) => setValue('icon', name, { shouldDirty: true, shouldValidate: true })}
          />
        </FormField>

        <FormField
          id="category-color"
          label={t('admin.categories.form.fields.color')}
          hint={t('admin.categories.form.fields.colorHint')}
        >
          <div className="flex items-center gap-2">
            <input
              id="category-color"
              type="color"
              value={color || '#7C3AED'}
              onChange={(event) =>
                setValue('color', event.target.value, { shouldDirty: true })
              }
              className="h-10 w-14 cursor-pointer rounded-lg border border-sand-300 bg-surface p-1"
            />
            <span className="font-mono text-xs text-ink-muted">{color || '—'}</span>
            {color ? (
              <button
                type="button"
                onClick={() => setValue('color', '', { shouldDirty: true })}
                className="btn-secondary h-9 gap-1.5 px-2.5 text-xs"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                {t('admin.categories.form.fields.colorClear')}
              </button>
            ) : null}
          </div>
        </FormField>
      </form>
    </Drawer>
  );
}
