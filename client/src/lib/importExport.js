import { resourceFormSchema, toResourcePayload } from './resourceForm';

/**
 * Client-side import parsing and preview validation.
 *
 * The browser parses JSON/CSV, maps each row onto the same flat form model as
 * the admin resource editor, and validates it with `resourceFormSchema`. The
 * server repeats validation with its own zod schema before writing anything.
 */

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

const FIELD_LABELS = {
  type: 'admin.importExport.fields.type',
  category: 'admin.importExport.fields.category',
  level: 'admin.importExport.fields.level',
  languages: 'admin.importExport.fields.languages',
  countries: 'admin.importExport.fields.countries',
  platform: 'admin.importExport.fields.platform',
  tags: 'admin.importExport.fields.tags',
  license: 'admin.importExport.fields.license',
  licenseUrl: 'admin.importExport.fields.licenseUrl',
  author: 'admin.importExport.fields.author',
  title_en: 'admin.importExport.fields.titleEn',
  title_bn: 'admin.importExport.fields.titleBn',
  title_ur: 'admin.importExport.fields.titleUr',
  description_en: 'admin.importExport.fields.descriptionEn',
  description_bn: 'admin.importExport.fields.descriptionBn',
  description_ur: 'admin.importExport.fields.descriptionUr',
  sourceName: 'admin.importExport.fields.sourceName',
  sourceUrl: 'admin.importExport.fields.sourceUrl',
  thumbnailUrl: 'admin.importExport.fields.thumbnailUrl',
  status: 'admin.importExport.fields.status',
  featured: 'admin.importExport.fields.featured'
};

/** RFC-like CSV parser with quoted fields, escaped quotes and CRLF support. */
export function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // Ignore; the following \n ends the row.
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => String(cell).trim() !== ''));
}

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

/** CSV rows → objects keyed by lower-case header names. */
export function csvToObjects(text) {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const headers = table[0].map(normalizeHeader);
  return table.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, index) => {
      if (!header || row[header] != null) return;
      const cell = cells[index] ?? '';
      // Undo the formula guard added by our own CSV export ('=… → =…).
      row[header] = /^'[=+\-@]/.test(cell) ? cell.slice(1) : cell;
    });
    return row;
  });
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value || '')
    .split(/[|;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());
}

function mapObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return {
    en: typeof value.en === 'string' ? value.en : '',
    bn: typeof value.bn === 'string' ? value.bn : '',
    ur: typeof value.ur === 'string' ? value.ur : ''
  };
}

/** Maps a JSON object or CSV row onto the flat admin-form model. */
export function normalizeImportRow(raw = {}) {
  const title = mapObject(raw.title);
  const description = mapObject(raw.description);
  const language = raw.language ?? raw.languages;
  const platform = raw.platform ?? raw.platforms;
  // The server writes list values with `|`, while the form expects a single
  // comma-separated tag string. Accept arrays, pipes, semicolons and commas so
  // a CSV exported from this panel can be re-imported unchanged.
  const tags = splitList(raw.tags).join(', ');

  return {
    type: firstString(raw.type) || 'course',
    category: firstString(raw.category),
    level: firstString(raw.level) || 'All levels',
    languages: splitList(language).length ? splitList(language) : ['English'],
    countries: splitList(raw.countries),
    platform: splitList(platform),
    tags,
    license: firstString(raw.license),
    licenseUrl: firstString(raw.licenseUrl, raw.license_url, raw.licenseurl),
    author: firstString(raw.author),
    title_en: firstString(raw.title_en, raw.title?.en, title.en, typeof raw.title === 'string' ? raw.title : ''),
    title_bn: firstString(raw.title_bn, raw.title?.bn, title.bn),
    title_ur: firstString(raw.title_ur, raw.title?.ur, title.ur),
    description_en: firstString(
      raw.description_en,
      raw.description?.en,
      description.en,
      typeof raw.description === 'string' ? raw.description : ''
    ),
    description_bn: firstString(raw.description_bn, raw.description?.bn, description.bn),
    description_ur: firstString(raw.description_ur, raw.description?.ur, description.ur),
    sourceName: firstString(raw.sourceName, raw.source_name, raw.sourcename, raw.provider),
    sourceUrl: firstString(raw.sourceUrl, raw.source_url, raw.sourceurl, raw.url),
    thumbnailUrl: firstString(raw.thumbnailUrl, raw.thumbnail_url, raw.thumbnailurl),
    status: firstString(raw.status) || 'draft',
    featured: parseBoolean(raw.featured)
  };
}

function extractArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.resources)) return parsed.resources;
  if (Array.isArray(parsed?.items)) return parsed.items;
  return null;
}

/** Parses a File into raw row objects. Throws an Error with a translation key. */
export async function parseImportFile(file) {
  if (!file) {
    throw new Error('admin.importExport.errors.noFile');
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('admin.importExport.errors.fileTooLarge');
  }

  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (!['json', 'csv'].includes(extension)) {
    throw new Error('admin.importExport.errors.fileType');
  }

  const text = await file.text();
  let rawRows;

  if (extension === 'json') {
    let parsed;
    try {
      // Accept JSON saved with a UTF-8 BOM (common when a file is edited in
      // Excel or a Windows editor) without confusing it with a parse error.
      parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch {
      throw new Error('admin.importExport.errors.parseError');
    }
    rawRows = extractArray(parsed);
    if (!rawRows) throw new Error('admin.importExport.errors.parseError');
  } else {
    rawRows = csvToObjects(text);
  }

  if (!rawRows.length) throw new Error('admin.importExport.errors.noRows');
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error('admin.importExport.errors.tooManyRows');
  }

  return rawRows;
}

/** Translates one zod issue into a readable, localised preview message. */
export function formatImportIssue(issue, i18n) {
  const fieldKey = FIELD_LABELS[issue.path?.[0]];
  const field = fieldKey ? i18n.t(fieldKey) : String(issue.path?.join('.') || 'row');

  if (issue.message && i18n.exists(issue.message)) return i18n.t(issue.message);

  if (issue.code === 'invalid_enum_value') {
    return i18n.t('admin.importExport.validation.invalidOption', { field });
  }
  if (issue.code === 'too_small') {
    return i18n.t('admin.importExport.validation.tooShort', { field });
  }
  if (issue.code === 'too_big') {
    return i18n.t('admin.importExport.validation.tooLong', { field });
  }
  if (issue.code === 'invalid_type') {
    return i18n.t('admin.importExport.validation.required', { field });
  }
  if (issue.code === 'invalid_string' || issue.code === 'invalid_format') {
    return i18n.t('admin.importExport.validation.invalidField', { field });
  }
  return i18n.t('admin.importExport.validation.invalidField', { field });
}

/**
 * Validates every row with the resource form schema.
 * Returns preview rows carrying the values, payload, errors and title/URL.
 */
export function buildImportPreview(rawRows, i18n) {
  return rawRows.map((raw, index) => {
    const values = normalizeImportRow(raw);
    const parsed = resourceFormSchema.safeParse(values);
    const errors = parsed.success
      ? []
      : parsed.error.issues.map((issue) => formatImportIssue(issue, i18n));

    return {
      index,
      values,
      payload: parsed.success ? toResourcePayload(parsed.data) : null,
      title:
        values.title_en ||
        values.title_bn ||
        values.title_ur ||
        values.sourceUrl ||
        i18n.t('admin.importExport.preview.untitled'),
      sourceUrl: values.sourceUrl,
      type: values.type,
      valid: parsed.success,
      errors,
      duplicate: null,
      result: null
    };
  });
}

export function applyDuplicates(rows, matches = {}) {
  return rows.map((row) => ({
    ...row,
    duplicate: row.sourceUrl ? matches[row.sourceUrl] || null : null
  }));
}

export function chunkRows(rows, size = 400) {
  const output = [];
  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }
  return output;
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Neutralise spreadsheet formulas (= + - @) — see server/src/lib/importExport.js.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Downloads an error/result report for every row in the preview. */
export function buildImportReportCsv(rows = []) {
  const headers = ['row', 'title', 'sourceUrl', 'status', 'message'];
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.index + 1,
        row.title,
        row.sourceUrl,
        row.finalStatus || (row.valid ? 'pending' : 'failed'),
        row.errorMessage || (row.errors || []).join('; ')
      ]
        .map(csvCell)
        .join(',')
    )
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
