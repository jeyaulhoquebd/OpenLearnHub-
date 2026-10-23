import { z } from 'zod';
import { getDb } from '../firebase.js';
import { sanitizeText } from './validation.js';

/**
 * Public site settings (`settings/site`).
 *
 * Firestore exposes this one settings document to the browser so the public
 * layout can read the announcement banner and maintenance switch without an
 * API round-trip. Writes are still server-only: this module validates and
 * stores the document with the Admin SDK, and firestore.rules denies client
 * writes. `settings/ai` remains completely unreadable.
 */

const DOC_ID = 'site';
const CACHE_TTL_MS = 15 * 1000;

export const ANNOUNCEMENT_TYPES = ['info', 'warning', 'success', 'critical'];

export const DEFAULT_SITE_SETTINGS = {
  siteName: 'OpenLearn Hub',
  tagline: {
    en: 'Knowledge for Everyone',
    bn: 'সবার জন্য জ্ঞান',
    ur: 'سب کے لیے علم'
  },
  contactEmail: 'jeyaulhoquejaber@gmail.com',
  legalEmail: 'jeyaulhoquejaber@gmail.com',
  socialLinks: {
    facebook: '',
    twitter: '',
    instagram: '',
    youtube: '',
    linkedin: '',
    github: '',
    website: 'https://jeyaulhoque.pages.dev/'
  },
  announcement: {
    enabled: false,
    type: 'info',
    text: { en: '', bn: '', ur: '' }
  },
  maintenanceMode: false
};

let cache = { value: null, fetchedAt: 0 };

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalHttpUrl = (max = 600) =>
  z
    .string()
    .trim()
    .max(max, 'That URL is too long.')
    .optional()
    .default('')
    .refine((value) => !value || isHttpUrl(value), {
      message: 'Use a valid http:// or https:// URL.'
    });

const languageText = (max, { requireEnglish = false } = {}) =>
  z.object({
    en: requireEnglish
      ? z.string().trim().min(1, 'Add English text.').max(max)
      : z.string().trim().max(max).optional().default(''),
    bn: z.string().trim().max(max).optional().default(''),
    ur: z.string().trim().max(max).optional().default('')
  });

export const siteSettingsSchema = z
  .object({
    siteName: z.string().trim().min(2, 'Add a site name.').max(80),
    tagline: languageText(160, { requireEnglish: true }),
    contactEmail: z
      .string()
      .trim()
      .min(3, 'Add a contact email.')
      .max(200)
      .email('Use a valid email address.'),
    legalEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default('')
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: 'Use a valid email address.'
      }),
    socialLinks: z
      .object({
        facebook: optionalHttpUrl(),
        twitter: optionalHttpUrl(),
        instagram: optionalHttpUrl(),
        youtube: optionalHttpUrl(),
        linkedin: optionalHttpUrl(),
        github: optionalHttpUrl(),
        website: optionalHttpUrl()
      })
      .optional()
      .default({}),
    announcement: z
      .object({
        enabled: z.boolean().optional().default(false),
        type: z.enum(ANNOUNCEMENT_TYPES).optional().default('info'),
        text: languageText(300, { requireEnglish: false })
      })
      .optional()
      .default({ enabled: false, type: 'info', text: { en: '', bn: '', ur: '' } }),
    maintenanceMode: z.boolean().optional().default(false)
  })
  .superRefine((value, ctx) => {
    if (value.announcement.enabled && !value.announcement.text.en) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['announcement', 'text', 'en'],
        message: 'Add announcement text before enabling the banner.'
      });
    }
  });

function cleanMap(value, max) {
  // Keep empty translations when saving so an admin can clear the Bangla or
  // Urdu tagline/announcement and let the public site fall back to English.
  const output = {};
  ['en', 'bn', 'ur'].forEach((code) => {
    output[code] = sanitizeText(value?.[code] || '', { max });
  });
  return output;
}

/**
 * Merges a stored document over the defaults, filling missing translations.
 * Only public fields are returned: this document is readable by every visitor,
 * and the editing administrator is recorded in the server-only audit log.
 */
export function normalizeSiteSettings(raw = {}) {
  const defaults = DEFAULT_SITE_SETTINGS;
  const social = raw.socialLinks && typeof raw.socialLinks === 'object' ? raw.socialLinks : {};
  const announcement = raw.announcement && typeof raw.announcement === 'object' ? raw.announcement : {};
  const text = announcement.text && typeof announcement.text === 'object' ? announcement.text : {};
  const tagline = raw.tagline && typeof raw.tagline === 'object' ? raw.tagline : {};

  return {
    siteName: sanitizeText(raw.siteName || defaults.siteName, { max: 80 }),
    tagline: {
      en: sanitizeText(tagline.en ?? defaults.tagline.en, { max: 160 }),
      bn: sanitizeText(tagline.bn ?? defaults.tagline.bn, { max: 160 }),
      ur: sanitizeText(tagline.ur ?? defaults.tagline.ur, { max: 160 })
    },
    contactEmail: sanitizeText(raw.contactEmail || defaults.contactEmail, { max: 200 }),
    legalEmail: sanitizeText(raw.legalEmail || defaults.legalEmail, { max: 200 }),
    socialLinks: Object.fromEntries(
      Object.entries(defaults.socialLinks).map(([key, fallback]) => [
        key,
        social[key] === undefined ? fallback : sanitizeText(social[key] || '', { max: 600 })
      ])
    ),
    announcement: {
      enabled: announcement.enabled === true,
      type: ANNOUNCEMENT_TYPES.includes(announcement.type) ? announcement.type : 'info',
      text: {
        en: sanitizeText(text.en ?? '', { max: 300 }),
        bn: sanitizeText(text.bn ?? '', { max: 300 }),
        ur: sanitizeText(text.ur ?? '', { max: 300 })
      }
    },
    maintenanceMode: raw.maintenanceMode === true
  };
}

/** Server-side read used by the admin form. */
export async function getSiteSettings({ force = false } = {}) {
  const fresh = !force && cache.value && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return cache.value;

  const db = getDb();
  if (!db) return normalizeSiteSettings();

  try {
    const snap = await db.collection('settings').doc(DOC_ID).get();
    const value = normalizeSiteSettings(snap.exists ? snap.data() : {});
    cache = { value, fetchedAt: Date.now() };
    return value;
  } catch (error) {
    console.warn('[settings] Could not read settings/site:', error?.message || error);
    return normalizeSiteSettings();
  }
}

function cleanPayload(input) {
  const social = input.socialLinks || {};
  return {
    siteName: sanitizeText(input.siteName, { max: 80 }),
    tagline: cleanMap(input.tagline, 160),
    contactEmail: sanitizeText(input.contactEmail, { max: 200 }).toLowerCase(),
    legalEmail: input.legalEmail ? sanitizeText(input.legalEmail, { max: 200 }).toLowerCase() : null,
    socialLinks: Object.fromEntries(
      Object.keys(DEFAULT_SITE_SETTINGS.socialLinks).map((key) => [
        key,
        social[key] ? sanitizeText(social[key], { max: 600 }) : null
      ])
    ),
    announcement: {
      enabled: input.announcement?.enabled === true,
      type: ANNOUNCEMENT_TYPES.includes(input.announcement?.type)
        ? input.announcement.type
        : 'info',
      text: cleanMap(input.announcement?.text, 300)
    },
    maintenanceMode: input.maintenanceMode === true
  };
}

/** Saves the public site settings and returns the normalized document. */
export async function saveSiteSettings(input) {
  const db = getDb();
  if (!db) {
    const error = new Error('Site settings storage is unavailable.');
    error.code = 'database_unavailable';
    throw error;
  }

  const payload = cleanPayload(input);
  const ref = db.collection('settings').doc(DOC_ID);

  // Replace the whole public document so stale metadata (for example an old
  // `updatedBy` field) cannot linger from an earlier schema.
  await ref.set(payload);

  cache = { value: null, fetchedAt: 0 };
  return getSiteSettings({ force: true });
}
