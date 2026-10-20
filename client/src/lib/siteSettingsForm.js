import { z } from 'zod';
import {
  ANNOUNCEMENT_TYPES,
  DEFAULT_SITE_SETTINGS,
  SOCIAL_FIELDS
} from './siteSettings';

/**
 * Flat form model for Admin → Site settings.
 *
 * As with the other admin forms, every language gets its own field so
 * react-hook-form can register plain inputs. The mappers turn those fields into
 * the nested `{ en, bn, ur }` shape stored in `settings/site`.
 */

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalUrl = z
  .string()
  .trim()
  .max(600, 'admin.siteSettings.errors.tooLong')
  .optional()
  .default('')
  .refine((value) => !value || isHttpUrl(value), 'admin.siteSettings.errors.url');

const optionalText = (max) =>
  z.string().trim().max(max, 'admin.siteSettings.errors.tooLong').optional().default('');

const email = z
  .string()
  .trim()
  .min(3, 'admin.siteSettings.errors.contactEmail')
  .max(200, 'admin.siteSettings.errors.tooLong')
  .email('admin.siteSettings.errors.email');

export const siteSettingsFormSchema = z
  .object({
    siteName: z
      .string()
      .trim()
      .min(2, 'admin.siteSettings.errors.siteName')
      .max(80, 'admin.siteSettings.errors.tooLong'),
    tagline_en: z
      .string()
      .trim()
      .min(2, 'admin.siteSettings.errors.tagline')
      .max(160, 'admin.siteSettings.errors.tooLong'),
    tagline_bn: optionalText(160),
    tagline_ur: optionalText(160),
    contactEmail: email,
    legalEmail: z
      .string()
      .trim()
      .max(200, 'admin.siteSettings.errors.tooLong')
      .optional()
      .default('')
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: 'admin.siteSettings.errors.email'
      }),
    social_facebook: optionalUrl,
    social_twitter: optionalUrl,
    social_instagram: optionalUrl,
    social_youtube: optionalUrl,
    social_linkedin: optionalUrl,
    social_github: optionalUrl,
    social_website: optionalUrl,
    announcementEnabled: z.boolean().optional().default(false),
    announcementType: z.enum(ANNOUNCEMENT_TYPES, {
      errorMap: () => ({ message: 'admin.siteSettings.errors.announcementType' })
    }),
    announcement_en: optionalText(300),
    announcement_bn: optionalText(300),
    announcement_ur: optionalText(300),
    maintenanceMode: z.boolean().optional().default(false)
  })
  .superRefine((value, ctx) => {
    if (value.announcementEnabled && !value.announcement_en.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['announcement_en'],
        message: 'admin.siteSettings.errors.announcementText'
      });
    }
  });

export function siteSettingsToFormValues(settings = DEFAULT_SITE_SETTINGS) {
  const safe = settings || DEFAULT_SITE_SETTINGS;
  return {
    siteName: safe.siteName || DEFAULT_SITE_SETTINGS.siteName,
    tagline_en: safe.tagline?.en || '',
    tagline_bn: safe.tagline?.bn || '',
    tagline_ur: safe.tagline?.ur || '',
    contactEmail: safe.contactEmail || DEFAULT_SITE_SETTINGS.contactEmail,
    legalEmail: safe.legalEmail || '',
    social_facebook: safe.socialLinks?.facebook || '',
    social_twitter: safe.socialLinks?.twitter || '',
    social_instagram: safe.socialLinks?.instagram || '',
    social_youtube: safe.socialLinks?.youtube || '',
    social_linkedin: safe.socialLinks?.linkedin || '',
    social_github: safe.socialLinks?.github || '',
    social_website: safe.socialLinks?.website || '',
    announcementEnabled: safe.announcement?.enabled === true,
    announcementType: safe.announcement?.type || 'info',
    announcement_en: safe.announcement?.text?.en || '',
    announcement_bn: safe.announcement?.text?.bn || '',
    announcement_ur: safe.announcement?.text?.ur || '',
    maintenanceMode: safe.maintenanceMode === true
  };
}

export function toSiteSettingsPayload(values) {
  const socialLinks = {};
  SOCIAL_FIELDS.forEach(({ key }) => {
    socialLinks[key] = (values[`social_${key}`] || '').trim();
  });

  return {
    siteName: values.siteName.trim(),
    tagline: {
      en: values.tagline_en.trim(),
      bn: (values.tagline_bn || '').trim(),
      ur: (values.tagline_ur || '').trim()
    },
    contactEmail: values.contactEmail.trim(),
    legalEmail: (values.legalEmail || '').trim(),
    socialLinks,
    announcement: {
      enabled: Boolean(values.announcementEnabled),
      type: values.announcementType,
      text: {
        en: (values.announcement_en || '').trim(),
        bn: (values.announcement_bn || '').trim(),
        ur: (values.announcement_ur || '').trim()
      }
    },
    maintenanceMode: Boolean(values.maintenanceMode)
  };
}
