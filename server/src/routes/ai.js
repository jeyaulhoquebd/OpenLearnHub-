import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { apiError } from '../lib/http.js';
import { sanitizeText } from '../lib/validation.js';
import { resolveAiConfig } from '../lib/settings.js';
import { readDailyUsage, incrementDailyUsage } from '../lib/quota.js';
import {
  findRelevantResources,
  generateLearnMateReply,
  generateRoadmapPlan,
  resourceSummary
} from '../lib/ai.js';

const LOCALES = ['en', 'bn', 'ur'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .transform((value) => sanitizeText(value, { max: 2000, multiline: true }))
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
  locale: z.string().trim().max(8).optional().default('en')
});

const roadmapRequestSchema = z.object({
  goal: z
    .string()
    .trim()
    .min(4, { message: 'Describe your goal in at least a few words.' })
    .max(300)
    .transform((value) => sanitizeText(value, { max: 300 })),
  level: z.enum(LEVELS).optional().default('beginner'),
  language: z.enum(LOCALES).optional(),
  locale: z.string().trim().max(8).optional()
});

// Shape we require from the model after normalisation. Enforces the
// "recommend only existing resources" contract downstream.
const roadmapStepSchema = z.object({
  order: z.number().int().min(1).max(50),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(5).max(1500),
  resourceIds: z.array(z.string().trim().min(1).max(160)).max(6),
  estimatedWeeks: z.number().int().min(0).max(52).nullable()
});

const roadmapPlanSchema = z.object({
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(10).max(1200),
  steps: z.array(roadmapStepSchema).min(1).max(10)
});

export const aiRouter = Router();

function makeLimiter({ limit, message }) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.uid || req.ip,
    message: { error: { code: 'rate_limited', message } }
  });
}

const chatLimiter = makeLimiter({
  limit: config.limits.aiPerHour,
  message: 'You have reached the LearnMate hourly limit. Please try again later.'
});

const roadmapLimiter = makeLimiter({
  limit: config.limits.roadmapPerHour,
  message: 'You have reached the roadmap hourly limit. Please try again later.'
});

/** Maps AI library error codes to HTTP responses. */
function respondToAiError(res, error, fallbackCode, fallbackMessage) {
  switch (error.code) {
    case 'llm_unavailable':
      return apiError(res, 503, 'llm_unavailable', 'AI is not configured yet. Please try again later.');
    case 'llm_timeout':
      return apiError(res, 504, 'llm_timeout', 'The AI provider took too long to respond. Please try again.');
    case 'llm_rate_limited':
      return apiError(res, 429, 'llm_rate_limited', 'The AI provider is rate-limiting requests. Please try again shortly.');
    case 'llm_unauthorized':
      return apiError(res, 502, 'llm_unauthorized', 'The AI provider rejected the configured API key. An administrator needs to check it.');
    case 'llm_invalid':
    case 'llm_empty':
      return apiError(res, 502, 'llm_invalid', 'The AI returned an unexpected response. Please try again.');
    default:
      return apiError(res, 502, fallbackCode, fallbackMessage);
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai/chat — conversational grounding assistant
// ---------------------------------------------------------------------------
aiRouter.post('/chat', requireAuth, chatLimiter, async (req, res, next) => {
  try {
    const ai = await resolveAiConfig();
    if (!ai.apiKey) {
      return apiError(
        res,
        503,
        'llm_unavailable',
        'LearnMate is not configured yet. An administrator needs to add a Gemini API key.'
      );
    }

    const parsed = chatSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_chat', 'The chat request was invalid.', parsed.error.flatten());
    }

    const { messages, locale } = parsed.data;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage) {
      return apiError(res, 400, 'invalid_chat', 'A user message is required.');
    }

    const sources = await findRelevantResources(lastUserMessage.content, locale, 6);

    let reply;
    try {
      reply = await generateLearnMateReply({ messages, sources, locale, ai });
    } catch (error) {
      return respondToAiError(res, error, 'llm_error', 'The AI provider could not generate a response right now.');
    }

    return res.json({
      reply,
      sources: sources.map((source) => resourceSummary(source, locale))
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/roadmap — structured, library-grounded study roadmap
// ---------------------------------------------------------------------------
aiRouter.post('/roadmap', requireAuth, requireVerifiedEmail, roadmapLimiter, async (req, res, next) => {
  try {
    const ai = await resolveAiConfig();
    if (!ai.apiKey) {
      return apiError(
        res,
        503,
        'llm_unavailable',
        'AI is not configured yet. An administrator needs to add a Gemini API key in AI Settings.'
      );
    }

    const parsed = roadmapRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(
        res,
        400,
        'invalid_roadmap',
        'Please describe your goal in a few more words and pick a level.',
        parsed.error.flatten()
      );
    }

    const { goal, level } = parsed.data;
    const locale = parsed.data.language || parsed.data.locale || 'en';

    const quota = await readDailyUsage({
      uid: req.user.uid,
      dailyLimit: config.limits.roadmapPerDay
    });
    if (!quota.allowed) {
      return apiError(
        res,
        429,
        'quota_exceeded',
        `You have reached today's roadmap limit (${quota.limit}). Please try again tomorrow.`
      );
    }

    // Ground the model in real, published resources only.
    const matches = await findRelevantResources(goal, locale, 12);
    if (!matches.length) {
      return apiError(
        res,
        422,
        'no_matching_resources',
        'We could not find matching resources for that goal yet. Try a broader topic or different wording.'
      );
    }

    let rawPlan;
    try {
      rawPlan = await generateRoadmapPlan({ goal, level, locale, matches, ai });
    } catch (error) {
      return respondToAiError(res, error, 'llm_error', 'The AI provider could not build a roadmap right now.');
    }

    const normalized = normalizePlan(rawPlan);
    const validated = normalized ? roadmapPlanSchema.safeParse(normalized) : { success: false };
    if (!validated.success) {
      return apiError(res, 502, 'llm_invalid', 'The AI returned an unexpected roadmap format. Please try again.');
    }

    // Drop any step that cites no real resource — the model may only use the
    // curated library, so unknown ids are discarded rather than trusted.
    const byId = new Map(matches.map((resource) => [resource.id, resource]));
    const steps = validated.data.steps
      .map((step, index) => ({
        order: step.order || index + 1,
        title: step.title,
        description: step.description,
        estimatedWeeks: step.estimatedWeeks,
        resources: step.resourceIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((resource) => resourceSummary(resource, locale))
      }))
      .filter((step) => step.resources.length > 0);

    if (!steps.length) {
      return apiError(
        res,
        502,
        'llm_invalid',
        'The AI did not recommend any library resources. Please try rephrasing your goal.'
      );
    }

    // Only count a roadmap against the daily quota once it is successfully built.
    await incrementDailyUsage({ uid: req.user.uid, action: 'roadmap' });

    return res.json({
      goal,
      level,
      language: locale,
      title: validated.data.title,
      summary: validated.data.summary,
      steps,
      sources: matches.map((resource) => resourceSummary(resource, locale))
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Coerces the model's JSON into the exact shape zod expects, so a slightly
 * loose response (string weeks, single id instead of an array) still validates.
 */
function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const asString = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];

  return {
    title: asString(raw.title, 200),
    summary: asString(raw.summary, 1200),
    steps: rawSteps.slice(0, 10).map((step, index) => {
      const ids = Array.isArray(step?.resourceIds)
        ? step.resourceIds
        : typeof step?.resourceIds === 'string' && step.resourceIds.trim()
          ? [step.resourceIds]
          : [];
      const weeks = Number(step?.estimatedWeeks);
      const order = Number(step?.order);

      return {
        order: Number.isFinite(order) && order >= 1 ? Math.min(Math.round(order), 50) : index + 1,
        title: asString(step?.title, 200),
        description: asString(step?.description, 1500),
        resourceIds: ids
          .map((id) => String(id).trim())
          .filter(Boolean)
          .slice(0, 6),
        estimatedWeeks:
          Number.isFinite(weeks) && weeks >= 0 && weeks <= 52 ? Math.round(weeks) : null
      };
    })
  };
}
