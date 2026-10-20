import { z } from 'zod';
import { CATEGORY_ICON_OPTIONS } from './categoryIcons';

/**
 * Client form models for the admin catalogue screens (categories and free
 * alternatives).
 *
 * As with the resource editor, one flat field is kept per language
 * (`name_en`, `note_bn`, …) so react-hook-form can register plain inputs; the
 * mappers below convert to the nested `{ en, bn, ur }` maps stored in
 * Firestore. Validation messages are translation keys rendered with
 * `t(error.message)`.
 */

export const CATEGORY_TYPE_VALUES = ['course', 'book', 'software', 'all'];

export const CATEGORY_TYPE_OPTIONS = [
  { value: 'course', labelKey: 'admin.categories.form.types.course' },
  { value: 'book', labelKey: 'admin.categories.form.types.book' },
  { value: 'software', labelKey: 'admin.categories.form.types.software' },
  { value: 'all', labelKey: 'admin.categories.form.types.all' }
];

const ICON_NAMES = CATEGORY_ICON_OPTIONS.map((option) => option.name);

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const trimmed = (max, tooLongKey) => z.string().trim().max(max, tooLongKey);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categoryFormSchema = z.object({
  name_en: z
    .string()
    .trim()
    .min(2, 'admin.categories.form.errors.nameEn')
    .max(60, 'admin.categories.form.errors.tooLong'),
  name_bn: trimmed(60, 'admin.categories.form.errors.tooLong').optional().default(''),
  name_ur: trimmed(60, 'admin.categories.form.errors.tooLong').optional().default(''),
  slug: z
    .string()
    .trim()
    .max(70, 'admin.categories.form.errors.tooLong')
    .optional()
    .default('')
    .refine((value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
      message: 'admin.categories.form.errors.slug'
    }),
  type: z.enum(CATEGORY_TYPE_VALUES, {
    errorMap: () => ({ message: 'admin.categories.form.errors.type' })
  }),
  icon: z
    .string()
    .optional()
    .default('BookOpen')
    .refine((value) => ICON_NAMES.includes(value), {
      message: 'admin.categories.form.errors.icon'
    }),
  color: z.string().trim().optional().default('')
});

export function categoryToFormValues(category) {
  return {
    name_en: category?.name?.en || '',
    name_bn: category?.name?.bn || '',
    name_ur: category?.name?.ur || '',
    slug: category?.slug || '',
    type: category?.type || 'course',
    icon: category?.icon || 'BookOpen',
    color: category?.color || ''
  };
}

export function toCategoryPayload(values) {
  return {
    name: {
      en: values.name_en.trim(),
      bn: (values.name_bn || '').trim(),
      ur: (values.name_ur || '').trim()
    },
    slug: (values.slug || '').trim(),
    type: values.type,
    icon: values.icon || 'BookOpen',
    color: (values.color || '').trim()
  };
}

// ---------------------------------------------------------------------------
// Free alternatives
// ---------------------------------------------------------------------------

export const alternativeFormSchema = z.object({
  paidSoftware: z
    .string()
    .trim()
    .min(2, 'admin.alternatives.form.errors.paidSoftware')
    .max(120, 'admin.alternatives.form.errors.tooLong'),
  paidSoftwareLogoUrl: z
    .string()
    .trim()
    .max(800, 'admin.alternatives.form.errors.tooLong')
    .optional()
    .default('')
    .refine((value) => !value || isHttpUrl(value), {
      message: 'admin.alternatives.form.errors.logoUrl'
    }),
  freeAlternativeResourceId: z
    .string()
    .trim()
    .min(1, 'admin.alternatives.form.errors.resource'),
  note_en: z
    .string()
    .trim()
    .min(2, 'admin.alternatives.form.errors.noteEn')
    .max(300, 'admin.alternatives.form.errors.tooLong'),
  note_bn: trimmed(300, 'admin.alternatives.form.errors.tooLong').optional().default(''),
  note_ur: trimmed(300, 'admin.alternatives.form.errors.tooLong').optional().default(''),
  active: z.boolean().optional().default(true)
});

export function alternativeToFormValues(alternative) {
  return {
    paidSoftware: alternative?.paidSoftware || '',
    paidSoftwareLogoUrl: alternative?.paidSoftwareLogoUrl || '',
    freeAlternativeResourceId: alternative?.freeAlternativeResourceId || '',
    note_en: alternative?.note?.en || '',
    note_bn: alternative?.note?.bn || '',
    note_ur: alternative?.note?.ur || '',
    active: alternative ? alternative.active !== false : true
  };
}

export function toAlternativePayload(values) {
  return {
    paidSoftware: values.paidSoftware.trim(),
    paidSoftwareLogoUrl: (values.paidSoftwareLogoUrl || '').trim(),
    freeAlternativeResourceId: values.freeAlternativeResourceId.trim(),
    note: {
      en: values.note_en.trim(),
      bn: (values.note_bn || '').trim(),
      ur: (values.note_ur || '').trim()
    },
    active: values.active !== false
  };
}
