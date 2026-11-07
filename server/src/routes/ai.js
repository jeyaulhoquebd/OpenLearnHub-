import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { apiError } from '../lib/http.js';
import { sanitizeText } from '../lib/validation.js';
import { resolveAiConfig } from '../lib/settings.js';
import { config } from '../config.js';
import {
  incrementDailyUsage,
  recordAiFailure,
  releaseDailyUsage,
  reserveDailyUsage
} from '../lib/quota.js';
import { findRelevantSitePages } from '../lib/siteGuide.js';
import {
  findRelevantResources,
  generateLearnMateReply,
  generateRoadmapPlan,
  resourceSummary
} from '../lib/ai.js';

const LOCALES = ['en', 'bn', 'ur'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const MAX_CONTEXT_RESOURCES = 40;

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

// Shape we require from the model after normalisation. `resourceIds` are
// checked against the grounded context before anything is returned.
const roadmapStepSchema = z.object({
  order: z.number().int().min(1).max(50).optional(),
  title: z.string().trim().min(2).max(200),
  explanation: z.string().trim().min(5).max(1500),
  resourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(6)
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

function setRetryAfter(res, error) {
  if (Number.isFinite(error?.retryAfter) && error.retryAfter > 0) {
    res.set('Retry-After', String(error.retryAfter));
  }
}

/** Maps AI library error codes to HTTP responses and records the failure. */
async function respondToAiError(res, error, { action, fallbackCode, fallbackMessage }) {
  await recordAiFailure({ action });
  setRetryAfter(res, error);

  switch (error.code) {
    case 'llm_unavailable':
      return apiError(res, 503, 'llm_unavailable', 'AI is not configured yet. Please try again later.');
    case 'llm_timeout':
      return apiError(
        res,
        504,
        'llm_timeout',
        'The AI provider took too long to respond. Please try again.'
      );
    case 'llm_rate_limited':
      return apiError(
        res,
        429,
        'llm_rate_limited',
        'The AI provider is rate-limiting requests right now. Please wait a moment and try again.'
      );
    case 'llm_unauthorized':
      return apiError(
        res,
        502,
        'llm_unauthorized',
        'The AI provider rejected the configured API key. An administrator needs to check it.'
      );
    case 'llm_bad_request':
      return apiError(
        res,
        502,
        'llm_bad_request',
        'The AI provider rejected the request. An administrator may need to check the selected Groq model.'
      );
    case 'llm_invalid':
    case 'llm_empty':
      return apiError(res, 502, 'llm_invalid', 'The AI returned an unexpected response. Please try again.');
    default:
      return apiError(res, 502, fallbackCode, fallbackMessage);
  }
}

/** Shared "is AI usable?" check: a key must exist and the feature be enabled. */
async function resolveReadyAi() {
  const ai = await resolveAiConfig();
  if (!ai.apiKey) {
    return {
      error: {
        status: 503,
        code: 'llm_unavailable',
        message:
          'AI is not configured yet. An administrator needs to add a Groq API key in Admin → AI Settings.'
      }
    };
  }
  if (!ai.enabled) {
    return {
      error: {
        status: 503,
        code: 'ai_disabled',
        message: 'AI features are temporarily disabled by an administrator.'
      }
    };
  }
  return { ai };
}

// ---------------------------------------------------------------------------
// POST /api/ai/chat — conversational grounding assistant
// ---------------------------------------------------------------------------
aiRouter.post('/chat', requireAuth, chatLimiter, async (req, res, next) => {
  try {
    const parsed = chatSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_chat', 'The chat request was invalid.', parsed.error.flatten());
    }

    const ready = await resolveReadyAi();
    if (ready.error) {
      return apiError(res, ready.error.status, ready.error.code, ready.error.message);
    }
    const { ai } = ready;

    const { messages, locale } = parsed.data;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage) {
      return apiError(res, 400, 'invalid_chat', 'A user message is required.');
    }

    const reservation = await reserveDailyUsage({
      uid: req.user.uid,
      dailyLimit: config.groq.chatDailyLimitPerUser,
      field: 'chatCount',
      action: 'chat'
    });
    if (!reservation.allowed) {
      return apiError(
        res,
        429,
        'quota_exceeded',
        `You have reached today's LearnMate limit (${reservation.limit} messages). Please try again tomorrow.`,
        { limit: reservation.limit, used: reservation.used, date: reservation.date }
      );
    }

    const sources = await findRelevantResources(lastUserMessage.content, locale, 6);
    const sitePages = findRelevantSitePages(lastUserMessage.content, locale, 3);

    let reply;
    try {
      reply = await generateLearnMateReply({ messages, sources, locale, ai });
    } catch (error) {
      await releaseDailyUsage({ uid: req.user.uid, field: 'chatCount', reservation });
      return respondToAiError(res, error, {
        action: 'chat',
        fallbackCode: 'llm_error',
        fallbackMessage: 'The AI provider could not generate a response right now.'
      });
    }

    // The per-user chat unit was reserved above; this only bumps the global
    // usage counters (it does not consume the roadmap daily quota).
    await incrementDailyUsage({ uid: req.user.uid, action: 'chat', countUser: false });

    return res.json({
      reply,
      sources: sources.map((source) => resourceSummary(source, locale)),
      sitePages
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/roadmap — structured, library-grounded study roadmap
// ---------------------------------------------------------------------------
aiRouter.post(
  '/roadmap',
  requireAuth,
  requireVerifiedEmail,
  roadmapLimiter,
  async (req, res, next) => {
    try {
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

      const ready = await resolveReadyAi();
      if (ready.error) {
        return apiError(res, ready.error.status, ready.error.code, ready.error.message);
      }
      const { ai } = ready;

      const { goal, level } = parsed.data;
      const locale = parsed.data.language || parsed.data.locale || 'en';

      // Reserve the unit up front (atomic), and give it back on any failure.
      const quota = await reserveDailyUsage({
        uid: req.user.uid,
        dailyLimit: ai.dailyLimitPerUser,
        field: 'count',
        action: 'roadmap'
      });
      const release = () =>
        releaseDailyUsage({ uid: req.user.uid, field: 'count', reservation: quota });
      if (!quota.allowed) {
        return apiError(
          res,
          429,
          'quota_exceeded',
          `You have reached today's roadmap limit (${quota.limit}). Please try again tomorrow.`,
          { limit: quota.limit, used: quota.used, date: quota.date }
        );
      }

      // Ground the model in real, published resources only (max 40).
      const matches = await findRelevantResources(goal, locale, MAX_CONTEXT_RESOURCES);
      if (!matches.length) {
        await release();
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
        await release();
        return respondToAiError(res, error, {
          action: 'roadmap',
          fallbackCode: 'llm_error',
          fallbackMessage: 'The AI provider could not build a roadmap right now.'
        });
      }

      const normalized = normalizePlan(rawPlan);
      const validated = normalized ? roadmapPlanSchema.safeParse(normalized) : { success: false };
      if (!validated.success) {
        await release();
        await recordAiFailure({ action: 'roadmap' });
        return apiError(
          res,
          502,
          'llm_invalid',
          'The AI returned an unexpected roadmap format. Please try again.'
        );
      }

      // Drop any resource id the model invented: only ids from the grounded
      // context are allowed through to the response.
      const byId = new Map(matches.map((resource) => [resource.id, resource]));
      const steps = validated.data.steps
        .map((step, index) => {
          const resources = step.resourceIds
            .map((id) => byId.get(id))
            .filter(Boolean);
          const uniqueResources = [...new Map(resources.map((item) => [item.id, item])).values()];

          return {
            order: index + 1,
            title: step.title,
            explanation: step.explanation,
            resourceIds: uniqueResources.map((resource) => resource.id),
            resources: uniqueResources.map((resource) => resourceSummary(resource, locale))
          };
        })
        .filter((step) => step.resourceIds.length > 0);

      if (!steps.length) {
        await release();
        await recordAiFailure({ action: 'roadmap' });
        return apiError(
          res,
          502,
          'llm_invalid',
          'The AI did not recommend any library resources. Please try rephrasing your goal.'
        );
      }

      // The per-user unit was reserved above; record the global counter only.
      await incrementDailyUsage({ uid: req.user.uid, action: 'roadmap', countUser: false });

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
  }
);

/**
 * Coerces the model's JSON into the exact shape zod expects, so a slightly
 * loose response still validates. Unknown resource ids are removed later.
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

      return {
        order: index + 1,
        title: asString(step?.title, 200),
        explanation: asString(step?.explanation || step?.description, 1500),
        resourceIds: ids
          .map((id) => String(id).trim())
          .filter(Boolean)
          .slice(0, 6)
      };
    }).filter((step) => step.resourceIds.length > 0)
  };
}
