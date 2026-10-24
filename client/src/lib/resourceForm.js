import { z } from 'zod';
import {
  COUNTRIES,
  LANGUAGES,
  LEVELS,
  PLATFORMS,
  RESOURCE_TYPES
} from './constants';
import { parseYouTubePlaylistId, youtubePlaylistUrl } from './youtube';

/**
 * Form model for the admin resource editor.
 *
 * The form keeps one field per language (`title_en`, `description_bn`, …) so
 * react-hook-form can register plain inputs, then converts to the nested
 * `{ en, bn, ur }` maps stored in Firestore on submit. Validation messages are
 * translation keys and rendered with `t(error.message)`.
 */

export const RESOURCE_FORM_STATUSES = ['published', 'draft', 'pending', 'flagged', 'rejected'];

export const CONTENT_LANGUAGES = [
  { code: 'en', labelKey: 'admin.resources.form.languages.english' },
  { code: 'bn', labelKey: 'admin.resources.form.languages.bangla' },
  { code: 'ur', labelKey: 'admin.resources.form.languages.urdu' }
];

export const LEVEL_KEYS = {
  Beginner: 'admin.resources.levels.beginner',
  Intermediate: 'admin.resources.levels.intermediate',
  Advanced: 'admin.resources.levels.advanced',
  'All levels': 'admin.resources.levels.allLevels'
};

export const LANGUAGE_KEYS = {
  English: 'admin.resources.languages.english',
  Bangla: 'admin.resources.languages.bangla',
  Urdu: 'admin.resources.languages.urdu'
};

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalHttpUrl = (max) =>
  z
    .string()
    .trim()
    .max(max, 'admin.resources.form.errors.tooLong')
    .optional()
    .default('')
    .refine((value) => !value || isHttpUrl(value), 'admin.resources.form.errors.url');

export function splitTags(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

const tagsSchema = z
  .string()
  .max(300, 'admin.resources.form.errors.tooLong')
  .optional()
  .default('')
  .refine((value) => splitTags(value).length <= 10, 'admin.resources.form.errors.tagsMax');

export const resourceFormSchema = z.object({
  type: z.enum(RESOURCE_TYPES),
  category: z
    .string()
    .trim()
    .min(1, 'admin.resources.form.errors.category')
    .max(60, 'admin.resources.form.errors.tooLong'),
  level: z.enum(LEVELS),
  languages: z.array(z.enum(LANGUAGES)).min(1, 'admin.resources.form.errors.languages'),
  countries: z.array(z.enum(COUNTRIES)).optional().default([]),
  platform: z.array(z.enum(PLATFORMS)).optional().default([]),
  tags: tagsSchema,

  license: z
    .string()
    .trim()
    .min(2, 'admin.resources.form.errors.license')
    .max(160, 'admin.resources.form.errors.tooLong'),
  licenseUrl: optionalHttpUrl(600),
  author: z.string().trim().max(120, 'admin.resources.form.errors.tooLong').optional().default(''),

  title_en: z
    .string()
    .trim()
    .min(3, 'admin.resources.form.errors.titleEn')
    .max(160, 'admin.resources.form.errors.tooLong'),
  title_bn: z.string().trim().max(160, 'admin.resources.form.errors.tooLong').optional().default(''),
  title_ur: z.string().trim().max(160, 'admin.resources.form.errors.tooLong').optional().default(''),

  description_en: z
    .string()
    .trim()
    .min(40, 'admin.resources.form.errors.descriptionEn')
    .max(2000, 'admin.resources.form.errors.tooLong'),
  description_bn: z
    .string()
    .trim()
    .max(2000, 'admin.resources.form.errors.tooLong')
    .optional()
    .default(''),
  description_ur: z
    .string()
    .trim()
    .max(2000, 'admin.resources.form.errors.tooLong')
    .optional()
    .default(''),

  sourceName: z
    .string()
    .trim()
    .min(2, 'admin.resources.form.errors.sourceName')
    .max(160, 'admin.resources.form.errors.tooLong'),
  sourceUrl: z
    .string()
    .trim()
    .max(600, 'admin.resources.form.errors.tooLong')
    .refine(isHttpUrl, 'admin.resources.form.errors.url'),
  youtubePlaylistUrl: z
    .string()
    .trim()
    .max(600, 'admin.resources.form.errors.tooLong')
    .optional()
    .default('')
    .refine(
      (value) => !value || Boolean(parseYouTubePlaylistId(value)),
      'youtubeCourse.playlistInvalid'
    ),

  thumbnailUrl: optionalHttpUrl(800),

  status: z.enum(RESOURCE_FORM_STATUSES),
  featured: z.boolean().default(false)
});

export const EMPTY_RESOURCE_FORM = {
  type: 'course',
  category: '',
  level: 'All levels',
  languages: ['English'],
  countries: [],
  platform: [],
  tags: '',
  license: '',
  licenseUrl: '',
  author: '',
  title_en: '',
  title_bn: '',
  title_ur: '',
  description_en: '',
  description_bn: '',
  description_ur: '',
  sourceName: '',
  sourceUrl: '',
  youtubePlaylistUrl: '',
  thumbnailUrl: '',
  status: 'draft',
  featured: false
};

/** `{ en: 'x' }` / plain string → a safe per-language map for form fields. */
function languageMap(value) {
  if (!value) return {};
  if (typeof value === 'string') return { en: value };
  if (typeof value === 'object') {
    return {
      en: typeof value.en === 'string' ? value.en : '',
      bn: typeof value.bn === 'string' ? value.bn : '',
      ur: typeof value.ur === 'string' ? value.ur : ''
    };
  }
  return {};
}

/**
 * Maps a stored/normalized resource (new map shape or legacy flat seed shape)
 * onto the form's flat fields.
 */
export function resourceToFormValues(resource = {}) {
  const title = languageMap(resource.title);
  const description = languageMap(resource.description);
  const languages = Array.isArray(resource.language)
    ? resource.language
    : Array.isArray(resource.languages)
      ? resource.languages
      : ['English'];

  return {
    ...EMPTY_RESOURCE_FORM,
    type: RESOURCE_TYPES.includes(resource.type) ? resource.type : 'course',
    category: resource.category || '',
    level: LEVELS.includes(resource.level) ? resource.level : 'All levels',
    languages: languages.filter((language) => LANGUAGES.includes(language)),
    countries: (Array.isArray(resource.countries) ? resource.countries : []).filter((country) =>
      COUNTRIES.includes(country)
    ),
    platform: (Array.isArray(resource.platform) ? resource.platform : []).filter((platform) =>
      PLATFORMS.includes(platform)
    ),
    tags: Array.isArray(resource.tags) ? resource.tags.join(', ') : '',
    license: resource.license || '',
    licenseUrl: resource.licenseUrl || '',
    author: resource.author || '',
    title_en: title.en || '',
    title_bn: title.bn || '',
    title_ur: title.ur || '',
    description_en: description.en || '',
    description_bn: description.bn || '',
    description_ur: description.ur || '',
    sourceName: resource.sourceName || resource.provider || '',
    sourceUrl: resource.sourceUrl || resource.url || '',
    youtubePlaylistUrl: resource.youtubePlaylistId
      ? youtubePlaylistUrl(resource.youtubePlaylistId)
      : '',
    thumbnailUrl: resource.thumbnailUrl || '',
    status: RESOURCE_FORM_STATUSES.includes(resource.status) ? resource.status : 'draft',
    featured: Boolean(resource.featured)
  };
}

function compactMap(values) {
  const map = {};
  ['en', 'bn', 'ur'].forEach((code) => {
    const text = String(values[code] || '').trim();
    if (text) map[code] = text;
  });
  return map;
}

/**
 * Form values → the JSON body expected by the admin API.
 *
 * `extra` carries the imported YouTube lesson metadata, which is not part of
 * react-hook-form (it is fetched and previewed separately).
 */
export function toResourcePayload(values, extra = {}) {
  const youtubePlaylistId =
    parseYouTubePlaylistId(values.youtubePlaylistUrl) ||
    parseYouTubePlaylistId(values.sourceUrl);
  const payload = {
    type: values.type,
    category: values.category,
    level: values.level,
    language: values.languages,
    countries: values.countries || [],
    platform: values.platform || [],
    tags: splitTags(values.tags),
    title: compactMap({
      en: values.title_en,
      bn: values.title_bn,
      ur: values.title_ur
    }),
    description: compactMap({
      en: values.description_en,
      bn: values.description_bn,
      ur: values.description_ur
    }),
    sourceName: values.sourceName,
    sourceUrl: youtubePlaylistId
      ? youtubePlaylistUrl(youtubePlaylistId)
      : values.sourceUrl,
    youtubePlaylistId: youtubePlaylistId || '',
    license: values.license,
    licenseUrl: values.licenseUrl || '',
    author: values.author || '',
    thumbnailUrl: values.thumbnailUrl || '',
    status: values.status,
    featured: Boolean(values.featured)
  };

  if (extra.youtubePlaylistTitle !== undefined) {
    payload.youtubePlaylistTitle = extra.youtubePlaylistTitle || '';
  }
  if (extra.youtubeChannelTitle !== undefined) {
    payload.youtubeChannelTitle = extra.youtubeChannelTitle || '';
  }
  if (extra.youtubeChannelId !== undefined) {
    payload.youtubeChannelId = extra.youtubeChannelId || '';
  }
  if (extra.youtubeVideos !== undefined) {
    payload.youtubeVideos = Array.isArray(extra.youtubeVideos) ? extra.youtubeVideos : [];
  }

  return payload;
}

export function languageCompleteness(values, code) {
  const fields = [`title_${code}`, `description_${code}`];
  const filled = fields.filter((field) => String(values?.[field] || '').trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}
