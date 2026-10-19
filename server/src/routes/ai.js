import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { apiError } from '../lib/http.js';
import { findRelevantResources, generateLearnMateReply } from '../lib/ai.js';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000)
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
  locale: z.string().trim().max(8).optional().default('en')
});

export const aiRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.limits.aiPerHour,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    error: {
      code: 'rate_limited',
      message: 'You have reached the LearnMate hourly limit. Please try again later.'
    }
  }
});

aiRouter.post('/chat', requireAuth, aiLimiter, async (req, res, next) => {
  try {
    if (!config.llm.apiKey) {
      return apiError(
        res,
        503,
        'llm_unavailable',
        'LearnMate is not configured yet. An administrator needs to set LLM_API_KEY on the server.'
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

    const sources = await findRelevantResources(lastUserMessage.content);

    let reply;
    try {
      reply = await generateLearnMateReply({ messages, sources, locale });
    } catch (error) {
      if (error.code === 'llm_timeout') {
        return apiError(res, 504, 'llm_timeout', 'The AI provider took too long to respond. Please try again.');
      }
      if (error.code === 'llm_unreachable') {
        return apiError(res, 502, 'llm_unreachable', 'Could not reach the AI provider. Please try again.');
      }
      return apiError(res, 502, 'llm_error', 'The AI provider could not generate a response right now.');
    }

    return res.json({
      reply,
      sources: sources.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        type: source.type
      }))
    });
  } catch (error) {
    return next(error);
  }
});
