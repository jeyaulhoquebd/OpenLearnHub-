/**
 * Browser-side defaults and normalisation for `settings/site`.
 *
 * The public document is publicly readable; if it has not been created yet (or
 * Firestore is unavailable in preview mode) the site keeps working with these
 * defaults. The admin form still loads through the API so it sees the exact
 * server-normalised shape.
 */

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

export const SOCIAL_FIELDS = [
  { key: 'facebook', labelKey: 'admin.siteSettings.fields.socialFacebook' },
  { key: 'twitter', labelKey: 'admin.siteSettings.fields.socialTwitter' },
  { key: 'instagram', labelKey: 'admin.siteSettings.fields.socialInstagram' },
  { key: 'youtube', labelKey: 'admin.siteSettings.fields.socialYoutube' },
  { key: 'linkedin', labelKey: 'admin.siteSettings.fields.socialLinkedin' },
  { key: 'github', labelKey: 'admin.siteSettings.fields.socialGithub' },
  { key: 'website', labelKey: 'admin.siteSettings.fields.socialWebsite' }
];

export const ANNOUNCEMENT_TYPES = ['info', 'warning', 'success', 'critical'];

function cleanMap(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    en: typeof source.en === 'string' && source.en.trim() ? source.en : fallback.en,
    bn: typeof source.bn === 'string' && source.bn.trim() ? source.bn : fallback.bn,
    ur: typeof source.ur === 'string' && source.ur.trim() ? source.ur : fallback.ur
  };
}

export function normalizeSiteSettings(raw = {}) {
  const defaults = DEFAULT_SITE_SETTINGS;
  const announcement = raw.announcement && typeof raw.announcement === 'object' ? raw.announcement : {};
  const social = raw.socialLinks && typeof raw.socialLinks === 'object' ? raw.socialLinks : {};

  return {
    ...defaults,
    ...raw,
    siteName: String(raw.siteName || defaults.siteName).slice(0, 80),
    tagline: cleanMap(raw.tagline, defaults.tagline),
    contactEmail: String(raw.contactEmail || defaults.contactEmail).slice(0, 200),
    legalEmail: String(raw.legalEmail || defaults.legalEmail).slice(0, 200),
    socialLinks: Object.fromEntries(
      Object.keys(defaults.socialLinks).map((key) => [
        key,
        typeof social[key] === 'string' ? social[key].slice(0, 600) : ''
      ])
    ),
    announcement: {
      enabled: announcement.enabled === true,
      type: ANNOUNCEMENT_TYPES.includes(announcement.type) ? announcement.type : 'info',
      text: {
        en: typeof announcement.text?.en === 'string' ? announcement.text.en.slice(0, 300) : '',
        bn: typeof announcement.text?.bn === 'string' ? announcement.text.bn.slice(0, 300) : '',
        ur: typeof announcement.text?.ur === 'string' ? announcement.text.ur.slice(0, 300) : ''
      }
    },
    maintenanceMode: raw.maintenanceMode === true
  };
}
