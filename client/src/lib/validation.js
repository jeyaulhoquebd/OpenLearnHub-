import { z } from 'zod';

/**
 * Shared client-side validation and text sanitisation.
 *
 * Every message below is an i18n key — render it with `t(error.message)`.
 * Rules are mirrored on the server (see `server/src/lib/validation.js`).
 */

export const EMAIL_MAX = 254;
export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const URL_MAX = 2048;

// Control characters that should never be stored or rendered.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Neutralises user-supplied text before it is stored or echoed back:
 * strips control characters, normalises whitespace/newlines, trims, and
 * hard-caps the length. It is a defence-in-depth measure — React escapes all
 * text nodes, and we never render user content with dangerouslySetInnerHTML.
 */
export function sanitizeText(value, { max = 2000, multiline = false } = {}) {
  if (value == null) return '';
  let text = String(value).replace(CONTROL_CHARS, '');
  text = multiline ? text.replace(/\r\n?/g, '\n') : text.replace(/[\r\n\t]+/g, ' ');
  text = multiline ? text.replace(/[ \t]{2,}/g, ' ') : text.replace(/ {2,}/g, ' ');
  if (multiline) text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim().slice(0, max);
}

/** Strips angle brackets so text can never be interpreted as markup. */
export function stripMarkup(value) {
  return sanitizeText(value).replace(/[<>]/g, '');
}

/** True for http(s) URLs only. */
export function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** True for https URLs only (used for official resource links). */
export function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === 'https:';
  } catch {
    return false;
  }
}

export const emailSchema = z
  .string({ required_error: 'validation.emailRequired' })
  .trim()
  .min(1, 'validation.emailRequired')
  .max(EMAIL_MAX, 'validation.emailInvalid')
  .email('validation.emailInvalid');

export const passwordSchema = z
  .string({ required_error: 'validation.passwordRequired' })
  .min(1, 'validation.passwordRequired')
  .min(PASSWORD_MIN, 'validation.passwordShort')
  .max(PASSWORD_MAX, 'validation.passwordLong');

// The server stores an article-style password policy on sign-up only.
export const strongPasswordSchema = passwordSchema
  .regex(/[A-Za-z]/, 'validation.passwordComplex')
  .regex(/[0-9]/, 'validation.passwordComplex');

export const displayNameSchema = z
  .string({ required_error: 'validation.nameRequired' })
  .trim()
  .min(NAME_MIN, 'validation.nameShort')
  .max(NAME_MAX, 'validation.nameLong');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const signupSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: strongPasswordSchema,
  agree: z.literal(true, {
    errorMap: () => ({ message: 'validation.agreeRequired' })
  })
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const profileSchema = z.object({
  displayName: displayNameSchema,
  preferredLanguage: z.enum(['en', 'bn', 'ur'])
});

export const reviewSchema = z.object({
  rating: z
    .number({ required_error: 'validation.ratingRequired', invalid_type_error: 'validation.ratingRequired' })
    .min(1, 'validation.ratingRequired')
    .max(5, 'validation.ratingRequired'),
  title: z.string().trim().max(120, 'validation.maxLength').optional().or(z.literal('')),
  body: z
    .string({ required_error: 'validation.reviewBodyShort' })
    .trim()
    .min(10, 'validation.reviewBodyShort')
    .max(2000, 'validation.reviewBodyLong')
});

export const REPORT_REASON_VALUES = [
  'copyright',
  'broken-link',
  'piracy',
  'inaccurate',
  'spam',
  'other'
];

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASON_VALUES, {
    errorMap: () => ({ message: 'report.requiredReason' })
  }),
  details: z.string().trim().max(1000, 'validation.maxLength').optional().or(z.literal('')),
  email: z.union([z.literal(''), emailSchema])
});

export const httpUrlSchema = z
  .string({ required_error: 'validation.urlRequired' })
  .trim()
  .min(1, 'validation.urlRequired')
  .max(URL_MAX, 'validation.maxLength')
  .refine(isHttpUrl, 'validation.urlInvalid');

/**
 * Community resource submission. Mirrored by the Firestore security rules
 * (`firebase/firestore.rules` → resources create).
 */
export const submitResourceSchema = z.object({
  type: z.enum(['course', 'book', 'software']),
  title: z.string().trim().min(3, 'validation.required').max(140, 'validation.maxLength'),
  provider: z.string().trim().min(2, 'validation.required').max(120, 'validation.maxLength'),
  url: z
    .string()
    .trim()
    .min(1, 'validation.urlRequired')
    .max(URL_MAX, 'validation.maxLength')
    .refine(isHttpsUrl, 'submit.validationUrl'),
  author: z.string().trim().max(120, 'validation.maxLength').optional().or(z.literal('')),
  description: z.string().trim().min(40, 'submit.validationDescription').max(420, 'validation.maxLength'),
  longDescription: z.string().trim().max(2000, 'validation.maxLength').optional().or(z.literal('')),
  category: z.string().trim().min(1, 'validation.required'),
  level: z.string().trim().min(1, 'validation.required'),
  languages: z.array(z.string()).min(1, 'submit.validationLanguages'),
  countries: z.array(z.string()).min(1, 'submit.validationCountries'),
  platform: z.array(z.string()).optional().default([]),
  tags: z.string().max(200, 'validation.maxLength').optional().or(z.literal('')),
  licenseNote: z.string().trim().min(2, 'validation.required').max(160, 'validation.maxLength'),
  licenseUrl: z
    .union([z.literal(''), z.string().trim().max(URL_MAX).refine(isHttpsUrl, 'validation.urlInvalid')])
    .optional(),
  legalConfirmed: z.literal(true, { errorMap: () => ({ message: 'submit.validationLegal' }) }),
  officialConfirmed: z.literal(true, { errorMap: () => ({ message: 'submit.validationLegal' }) })
});
