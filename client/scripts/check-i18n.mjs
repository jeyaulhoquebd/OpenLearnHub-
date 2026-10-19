#!/usr/bin/env node
/**
 * i18n parity check.
 *
 * 1. Ensures en / bn / ur have exactly the same set of translation keys.
 * 2. Scans the source for every i18n key used in the UI and verifies it
 *    exists in all three locale files.
 *
 * Exits non-zero when something is missing, so it can gate CI:
 *   npm run check:i18n
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(here, '..');
const srcRoot = join(clientRoot, 'src');
const localesRoot = join(srcRoot, 'locales');

const LANGUAGES = ['en', 'bn', 'ur'];

function flatten(object, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const locales = {};
for (const lang of LANGUAGES) {
  const raw = readFileSync(join(localesRoot, `${lang}.json`), 'utf8');
  locales[lang] = flatten(JSON.parse(raw));
}

const reference = locales[LANGUAGES[0]];

// ---- 1. key parity across languages ----
const parityErrors = [];
for (const lang of LANGUAGES.slice(1)) {
  const keys = locales[lang];
  for (const key of reference.keys()) {
    if (!keys.has(key)) parityErrors.push(`[${lang}] missing key: ${key}`);
  }
  for (const key of keys.keys()) {
    if (!reference.has(key)) parityErrors.push(`[${lang}] extra key (not in ${LANGUAGES[0]}): ${key}`);
  }
}

// ---- 2. keys used in source ----
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const USAGE_PATTERNS = [
  /\bt\(\s*['"`]([A-Za-z0-9_][A-Za-z0-9_.-]*)['"`]/g,
  /i18nKey=["']([A-Za-z0-9_][A-Za-z0-9_.-]*)["']/g,
  /labelKey:\s*['"]([A-Za-z0-9_][A-Za-z0-9_.-]*)['"]/g,
  /\bkey:\s*['"]([a-z][A-Za-z0-9_]*\.[A-Za-z0-9_.-]+)['"]/g
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const usedKeys = new Map(); // key -> Set(files)
for (const file of walk(srcRoot)) {
  if (file.includes(`${'locales'}`)) continue;
  const content = readFileSync(file, 'utf8');
  for (const pattern of USAGE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1];
      if (!usedKeys.has(key)) usedKeys.set(key, new Set());
      usedKeys.get(key).add(file.replace(clientRoot, ''));
    }
  }
}

const usageErrors = [];
for (const [key, files] of usedKeys) {
  for (const lang of LANGUAGES) {
    if (!locales[lang].has(key)) {
      usageErrors.push(`[${lang}] missing used key "${key}" (used in ${[...files].join(', ')})`);
    }
  }
}

// ---- report ----
if (parityErrors.length) {
  console.error('\ni18n key parity problems:');
  parityErrors.forEach((line) => console.error(`  ✖ ${line}`));
}

if (usageErrors.length) {
  console.error('\ni18n keys used in the UI but missing from a locale file:');
  usageErrors.forEach((line) => console.error(`  ✖ ${line}`));
}

if (parityErrors.length || usageErrors.length) {
  console.error(`\ncheck:i18n failed — ${parityErrors.length + usageErrors.length} problem(s).`);
  process.exit(1);
}

console.log(
  `check:i18n passed — ${reference.size} keys in ${LANGUAGES.join(', ')}; ${usedKeys.size} keys used in the UI.`
);
