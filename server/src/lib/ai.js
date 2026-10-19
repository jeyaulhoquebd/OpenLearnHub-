import { config } from '../config.js';
import { getDb } from '../firebase.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
let indexCache = { items: [], fetchedAt: 0 };

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

async function loadResourceIndex() {
  const fresh = Date.now() - indexCache.fetchedAt < CACHE_TTL_MS;
  if (fresh && indexCache.items.length) return indexCache.items;

  const db = getDb();
  if (!db) return [];

  try {
    const snapshot = await db
      .collection('resources')
      .where('status', '==', 'published')
      .limit(250)
      .get();
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        title: data.title,
        provider: data.provider,
        url: data.url,
        category: data.category,
        description: data.description,
        license: data.license,
        tags: Array.isArray(data.tags) ? data.tags : [],
        languages: Array.isArray(data.languages) ? data.languages : []
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

function scoreResource(resource, terms) {
  if (!terms.length) return 0;
  const title = resource.title?.toLowerCase() || '';
  const provider = resource.provider?.toLowerCase() || '';
  const category = resource.category?.toLowerCase() || '';
  const description = resource.description?.toLowerCase() || '';
  const tags = (resource.tags || []).map((tag) => tag.toLowerCase()).join(' ');
  const languages = (resource.languages || []).map((item) => item.toLowerCase()).join(' ');

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 4;
    if (tags.includes(term)) score += 3;
    if (category.includes(term)) score += 3;
    if (provider.includes(term)) score += 2;
    if (description.includes(term)) score += 1;
    if (languages.includes(term)) score += 1;
  }
  return score;
}

export async function findRelevantResources(userText) {
  const items = await loadResourceIndex();
  if (!items.length) return [];
  const terms = extractTerms(userText);
  if (!terms.length) return [];

  return items
    .map((item) => ({ item, score: scoreResource(item, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.item);
}

function buildSystemPrompt({ sources, locale }) {
  const language = LOCALE_NAMES[locale] || 'English';
  const contextBlock = sources.length
    ? sources
        .map(
          (source, index) =>
            `${index + 1}. "${source.title}" — ${source.provider} — ${source.type} — ${source.url} — Licence: ${source.license}`
        )
        .join('\n')
    : 'No matching resource was found in the curated library for this question.';

  return [
    'You are LearnMate, the learning assistant inside OpenLearn Hub (openlearnhub.org), a curated directory of legal, free courses, books, and open-source software for learners in Bangladesh, India, and Pakistan.',
    '',
    'Your rules:',
    '- Recommend only resources from the curated library context below, and only link to the exact URLs provided there.',
    '- Never invent URLs, providers, licence terms, or resource names.',
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

export async function generateLearnMateReply({ messages, sources, locale }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  const payload = {
    model: config.llm.model,
    temperature: 0.4,
    max_tokens: config.llm.maxOutputTokens,
    messages: [
      { role: 'system', content: buildSystemPrompt({ sources, locale }) },
      ...messages.map((message) => ({ role: message.role, content: message.content }))
    ]
  };

  let response;
  try {
    response = await fetch(config.llm.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('The AI provider took too long to respond.'), { code: 'llm_timeout' });
    }
    throw Object.assign(new Error('Could not reach the AI provider.'), { code: 'llm_unreachable' });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    console.error(`[ai] Provider responded ${response.status}: ${bodyText.slice(0, 300)}`);
    throw Object.assign(new Error('The AI provider rejected the request.'), { code: 'llm_error' });
  }

  const data = await response.json().catch(() => null);
  const reply =
    data?.choices?.[0]?.message?.content?.trim() ||
    data?.choices?.[0]?.text?.trim() ||
    data?.output_text?.trim() ||
    '';

  if (!reply) {
    throw Object.assign(new Error('The AI provider returned an empty response.'), { code: 'llm_empty' });
  }

  return reply;
}
