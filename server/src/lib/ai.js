import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { getDb } from '../firebase.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
let indexCache = { items: [], fetchedAt: 0 };
let geminiClient = null;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'are', 'was', 'were',
  'you', 'your', 'can', 'how', 'what', 'which', 'when', 'where', 'who', 'why', 'not', 'but',
  'about', 'into', 'over', 'under', 'then', 'than', 'also', 'just', 'some', 'any', 'all',
  'want', 'need', 'learn', 'learning', 'study', 'start', 'begin', 'best', 'free', 'good',
  'please', 'help', 'give', 'tell', 'show', 'recommend', 'suggest', 'course', 'courses',
  'book', 'books', 'software', 'tool', 'tools', 'resource', 'resources', 'using', 'use'
]);

const LOCALE_NAMES = {
  en: 'English',
  bn: 'Bangla (Bengali)',
  hi: 'Hindi',
  ur: 'Urdu'
};

/**
 * Resource titles/descriptions may be plain strings (legacy/seed) or per-language
 * maps ({ en, bn, ur }). Resolve either to one string, preferring the caller's
 * language and falling back to English.
 */
function textOf(value, locale = 'en') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const lang = String(locale || 'en').slice(0, 2);
  return (
    value[lang] ||
    value.en ||
    Object.values(value).find((entry) => typeof entry === 'string' && entry.trim()) ||
    ''
  );
}

function toStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

async function loadResourceIndex() {
  const fresh = Date.now() - indexCache.fetchedAt < CACHE_TTL_MS;
  if (fresh && indexCache.items.length) return indexCache.items;

  const db = getDb();
  if (!db) return [];

  try {
    const snapshot = await db
      .collection('resources')
      .where('status', '==', 'published')
      .limit(300)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        title: data.title,
        sourceName: data.sourceName || data.provider || '',
        url: data.sourceUrl || data.url || '',
        category: data.category,
        description: data.description,
        license: data.license || '',
        tags: toStringList(data.tags),
        languages: toStringList(data.language || data.languages)
      };
    });

    indexCache = { items, fetchedAt: Date.now() };
    return items;
  } catch (error) {
    console.warn('[ai] Could not load resource context:', error?.message);
    return [];
  }
}

function extractTerms(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOPWORDS.has(term))
    .slice(0, 20);
}

function scoreResource(resource, terms, locale) {
  if (!terms.length) return 0;
  const title = textOf(resource.title, locale).toLowerCase();
  const sourceName = String(resource.sourceName || '').toLowerCase();
  const category = String(resource.category || '').toLowerCase();
  const description = textOf(resource.description, locale).toLowerCase();
  const tags = (resource.tags || []).map((tag) => tag.toLowerCase()).join(' ');
  const languages = (resource.languages || []).map((item) => item.toLowerCase()).join(' ');

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 4;
    if (tags.includes(term)) score += 3;
    if (category.includes(term)) score += 3;
    if (sourceName.includes(term)) score += 2;
    if (description.includes(term)) score += 1;
    if (languages.includes(term)) score += 1;
  }
  return score;
}

export async function findRelevantResources(userText, locale = 'en') {
  const items = await loadResourceIndex();
  if (!items.length) return [];
  const terms = extractTerms(userText);
  if (!terms.length) return [];

  return items
    .map((item) => ({ item, score: scoreResource(item, terms, locale) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.item);
}

function buildSystemPrompt({ sources, locale }) {
  const language = LOCALE_NAMES[locale] || 'English';
  const contextBlock = sources.length
    ? sources
        .map((source, index) => {
          const title = textOf(source.title, locale) || 'Untitled';
          return `${index + 1}. "${title}" — ${source.sourceName} — ${source.type} — ${source.url} — Licence: ${source.license}`;
        })
        .join('\n')
    : 'No matching resource was found in the curated library for this question.';

  return [
    'You are LearnMate, the learning assistant inside OpenLearn Hub, a curated directory of legal, free courses, books, and open-source software for learners in Bangladesh, India, and Pakistan.',
    '',
    'Your rules:',
    '- Recommend only resources from the curated library context below, and only link to the exact URLs provided there.',
    '- Never invent URLs, sources, licence terms, or resource names.',
    '- Never recommend pirated, cracked, or unlicensed material, and never suggest file-sharing mirrors or unofficial downloads.',
    '- For software, always tell the user to download from the official website.',
    '- If the context has no good match, say so honestly, suggest the closest category or subject to explore in OpenLearn Hub, and invite the user to describe their goal in more detail. Do not fill the gap with unverified links.',
    '- Prefer practical, step-by-step study paths with a realistic weekly plan when the user shares their level or time available.',
    '- Be honest about uncertainty, and remind the user to verify enrolment, pricing, and licence details with the provider before committing.',
    `- Reply in ${language}. Keep the answer focused, warm, and under 300 words unless the user asks for detail.`,
    '- End with one short, useful next step.',
    '',
    'Curated library context:',
    contextBlock
  ].join('\n');
}

function getGeminiClient() {
  if (!config.gemini.apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return geminiClient;
}

function readResponseText(response) {
  const direct = typeof response?.text === 'function' ? response.text() : response?.text;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const joined = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  return joined;
}

export async function generateLearnMateReply({ messages, sources, locale }) {
  const client = getGeminiClient();
  if (!client) {
    throw Object.assign(new Error('The AI provider is not configured.'), { code: 'llm_unavailable' });
  }

  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(message.content) }]
  }));

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(Object.assign(new Error('The AI provider took too long to respond.'), { code: 'llm_timeout' }));
    }, config.gemini.timeoutMs);
  });

  let response;
  try {
    response = await Promise.race([
      client.models.generateContent({
        model: config.gemini.model,
        contents,
        config: {
          systemInstruction: buildSystemPrompt({ sources, locale }),
          temperature: 0.4,
          maxOutputTokens: config.gemini.maxOutputTokens
        }
      }),
      timeout
    ]);
  } catch (error) {
    if (error.code === 'llm_timeout') throw error;
    console.error('[ai] Gemini request failed:', error?.message || error);
    const code = error?.status === 429 ? 'llm_rate_limited' : 'llm_error';
    throw Object.assign(new Error('The AI provider could not generate a response right now.'), { code });
  } finally {
    clearTimeout(timeoutId);
  }

  const reply = readResponseText(response);
  if (!reply) {
    throw Object.assign(new Error('The AI provider returned an empty response.'), { code: 'llm_empty' });
  }

  return reply;
}
