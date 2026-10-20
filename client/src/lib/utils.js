export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(value, locale = 'en') {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

/** Same as formatDate, with the time of day (link-check timestamps). */
export function formatDateTime(value, locale = 'en') {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatNumber(value, locale = 'en') {
  return new Intl.NumberFormat(locale).format(value);
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function monogram(value = '') {
  const text = localized(value);
  const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  if (!cleaned) return 'OL';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

/**
 * Resource titles/descriptions may be stored as per-language maps
 * ({ en, bn, ur }) or as plain strings (legacy/seed data). This resolves
 * either shape to a single string, falling back to English.
 */
export function localized(value, language = 'en') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const lang = String(language || 'en').slice(0, 2);
  const candidate = value[lang] || value.en;
  if (typeof candidate === 'string' && candidate.trim()) return candidate;
  const fallback = Object.values(value).find((entry) => typeof entry === 'string' && entry.trim());
  return fallback || '';
}

export function truncate(value = '', length = 160) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trimEnd()}…`;
}

export function isValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function slugify(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70);
}

export function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  return null;
}

export function dedupeById(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

export function safeFileName(name = 'thumbnail') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
}
