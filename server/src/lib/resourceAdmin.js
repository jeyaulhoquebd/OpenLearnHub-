import { z } from 'zod';
import { sanitizeText } from './validation.js';
import {
  YOUTUBE_PLAYLIST_ID_RE,
  parseYouTubePlaylistId,
  youtubePlaylistUrl
} from './youtube.js';

/**
 * Shared rules for the admin resources API.
 *
 * The same field list is used by POST (create) and PUT (replace the editable
 * fields). Firestore writes go through `normalizeResourceInput`, which
 * sanitises every string and drops empty translations, so the document shape
 * matches what the public site already understands.
 */

export const RESOURCE_TYPES = ['course', 'book', 'software'];
export const RESOURCE_STATUSES = ['published', 'draft', 'pending', 'flagged', 'rejected'];
export const RESOURCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
export const RESOURCE_LANGUAGES = ['English', 'Bangla', 'Urdu'];
export const RESOURCE_COUNTRIES = ['Bangladesh', 'India', 'Pakistan'];
export const RESOURCE_PLATFORMS = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];

export const LIST_SORTS = [
  'updated_desc',
  'updated_asc',
  'created_desc',
  'created_asc',
  'title_asc',
  'title_desc',
  'views_desc',
  'rating_desc'
];

const textMap = (max, { minEn = 0 } = {}) =>
  z.object({
    en: z.string().trim().min(minEn).max(max),
    bn: z.string().trim().max(max).optional().default(''),
    ur: z.string().trim().max(max).optional().default('')
  });

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const httpUrl = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(isHttpUrl, { message: 'Must be a valid http:// or https:// URL.' });

const optionalHttpUrl = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .default('')
    .refine((value) => !value || isHttpUrl(value), {
      message: 'Must be a valid http:// or https:// URL.'
    });

export const resourceInputSchema = z
  .object({
    type: z.enum(RESOURCE_TYPES),
    category: z.string().trim().min(2).max(60),
    level: z.enum(RESOURCE_LEVELS).default('All levels'),
    language: z.array(z.enum(RESOURCE_LANGUAGES)).min(1).max(3),
    countries: z.array(z.enum(RESOURCE_COUNTRIES)).max(3).optional().default([]),
    platform: z.array(z.enum(RESOURCE_PLATFORMS)).max(6).optional().default([]),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),

    title: textMap(160, { minEn: 3 }),
    description: textMap(2000, { minEn: 40 }),

    sourceName: z.string().trim().min(2).max(160),
    sourceUrl: httpUrl(600),
    youtubePlaylistId: z
      .string()
      .trim()
      .max(600)
      .optional()
      .default('')
      .transform((value) => parseYouTubePlaylistId(value) || value)
      .refine((value) => !value || YOUTUBE_PLAYLIST_ID_RE.test(value), {
        message: 'Enter a valid YouTube playlist URL or playlist ID.'
      }),

    license: z.string().trim().min(2).max(160),
    licenseUrl: optionalHttpUrl(600),
    author: z.string().trim().max(120).optional().default(''),

    thumbnailUrl: optionalHttpUrl(800),

    status: z.enum(RESOURCE_STATUSES).default('draft'),
    featured: z.boolean().optional().default(false)
  })
  .superRefine((value, ctx) => {
    // Software must point at an official download page and state a licence.
    if (value.type === 'software') {
      if (!value.license || value.license.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['license'],
          message: 'Software listings must include a licence.'
        });
      }
      if (!value.sourceUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sourceUrl'],
          message: 'Software listings must link to the official download page.'
        });
      }
    }

    // A licence URL without a licence (or vice versa) is usually a mistake.
    if (value.licenseUrl && !value.license) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['license'],
        message: 'Add a licence name before linking to its text.'
      });
    }

    // On-site YouTube playback is only meaningful for courses. This also
    // catches an admin pasting a playlist URL into the generic source field
    // while the resource is still marked as a book or software listing.
    const playlistId = parseYouTubePlaylistId(value.youtubePlaylistId || value.sourceUrl);
    if (playlistId && value.type !== 'course') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['youtubePlaylistId'],
        message: 'YouTube playlists can only be attached to course resources.'
      });
    }
  });

/** Removes empty language keys so stored maps stay small and clean. */
function cleanTextMap(value, { max, multiline = false }) {
  const output = {};
  ['en', 'bn', 'ur'].forEach((lang) => {
    const text = sanitizeText(value?.[lang] || '', { max, multiline });
    if (text) output[lang] = text;
  });
  return output;
}

/**
 * Turns validated input into the exact Firestore payload (minus server fields
 * such as slug, counters and timestamps).
 */
export function normalizeResourceInput(input) {
  const tags = Array.from(
    new Set(
      (input.tags || [])
        .map((tag) => sanitizeText(tag, { max: 30 }))
        .filter(Boolean)
    )
  ).slice(0, 10);

  // Accept either an explicit playlist id or a playlist URL in the source
  // field. The canonical playlist URL is stored so the "open on YouTube" link
  // is stable even if the admin pasted a watch URL with extra parameters.
  const youtubePlaylistId = parseYouTubePlaylistId(input.youtubePlaylistId || input.sourceUrl);
  const sourceUrl = youtubePlaylistId
    ? youtubePlaylistUrl(youtubePlaylistId)
    : sanitizeText(input.sourceUrl, { max: 600 });

  return {
    type: input.type,
    category: sanitizeText(input.category, { max: 60 }),
    level: input.level,
    language: input.language,
    countries: input.countries || [],
    platform: input.platform || [],
    tags,

    title: cleanTextMap(input.title, { max: 160 }),
    description: cleanTextMap(input.description, { max: 2000, multiline: true }),

    sourceName: sanitizeText(input.sourceName, { max: 160 }),
    sourceUrl,
    youtubePlaylistId: youtubePlaylistId || null,

    license: sanitizeText(input.license, { max: 160 }),
    licenseUrl: input.licenseUrl ? sanitizeText(input.licenseUrl, { max: 600 }) : null,
    author: input.author ? sanitizeText(input.author, { max: 120 }) : null,

    thumbnailUrl: input.thumbnailUrl ? sanitizeText(input.thumbnailUrl, { max: 800 }) : null,

    status: input.status,
    featured: Boolean(input.featured)
  };
}

// ---------------------------------------------------------------------------
// slugs
// ---------------------------------------------------------------------------

/** URL-safe slug from an English title. */
export function buildResourceSlug(title) {
  const base = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

  return base || `resource-${Date.now().toString(36)}`;
}

/**
 * Returns `base`, or the first free `base-2`, `base-3`, … (excluding the
 * document being edited). Slugs are unique across the collection.
 */
export async function uniqueResourceSlug(db, base, excludeId = null) {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const candidate = `${base.slice(0, 70 - suffix.length)}${suffix}`;

    // eslint-disable-next-line no-await-in-loop
    const snapshot = await db
      .collection('resources')
      .where('slug', '==', candidate)
      .limit(2)
      .get();

    if (!snapshot.docs.some((doc) => doc.id !== excludeId)) return candidate;
  }

  return `${base.slice(0, 50)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// list shaping
// ---------------------------------------------------------------------------

export const RESOURCE_LIST_FIELDS = [
  'type',
  'title',
  'slug',
  'category',
  'status',
  'thumbnailUrl',
  'sourceName',
  'sourceUrl',
  'youtubePlaylistId',
  'viewCount',
  'saveCount',
  'ratingAvg',
  'ratingCount',
  'language',
  'level',
  'featured',
  'createdAt',
  'updatedAt',
  'publishedAt'
];

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (typeof value === 'string') return value;
  return null;
}

/** Compact row for the admin table (no long descriptions). */
export function serializeResource(snapshot) {
  const data = snapshot.data() || {};
  const row = { id: snapshot.id };

  RESOURCE_LIST_FIELDS.forEach((field) => {
    row[field] = data[field] ?? null;
  });

  row.title = data.title || {};
  row.language = Array.isArray(data.language) ? data.language : [];
  row.viewCount = Number(data.viewCount) || 0;
  row.saveCount = Number(data.saveCount) || 0;
  row.ratingAvg = Number(data.ratingAvg) || 0;
  row.ratingCount = Number(data.ratingCount) || 0;
  row.featured = data.featured === true;
  row.status = data.status || 'draft';
  row.createdAt = toIso(data.createdAt);
  row.updatedAt = toIso(data.updatedAt);
  row.publishedAt = toIso(data.publishedAt);

  return row;
}

/** Titles may be strings (legacy/seed) or `{ en, bn, ur }` maps. */
function titleText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return [value.en, value.bn, value.ur].filter(Boolean).join(' ');
}

/** Case-insensitive substring search across titles, slug and source name. */
export function matchesSearch(row, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    titleText(row.title),
    row.slug,
    row.sourceName,
    row.category
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

function time(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

const SORTERS = {
  updated_desc: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  updated_asc: (a, b) => time(a.updatedAt) - time(b.updatedAt),
  created_desc: (a, b) => time(b.createdAt) - time(a.createdAt),
  created_asc: (a, b) => time(a.createdAt) - time(b.createdAt),
  title_asc: (a, b) => titleText(a.title).localeCompare(titleText(b.title)),
  title_desc: (a, b) => titleText(b.title).localeCompare(titleText(a.title)),
  views_desc: (a, b) => b.viewCount - a.viewCount,
  rating_desc: (a, b) =>
    b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount
};

export function sortResources(rows, sort = 'updated_desc') {
  const sorter = SORTERS[sort] || SORTERS.updated_desc;
  return [...rows].sort(sorter);
}

/** Opaque offset cursor so the client never builds pagination itself. */
export function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ o: Math.max(0, Number(offset) || 0) }), 'utf8').toString(
    'base64url'
  );
}

export function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    const offset = Number(parsed?.o);
    return Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  } catch {
    return 0;
  }
}
