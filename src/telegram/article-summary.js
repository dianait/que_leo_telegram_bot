import {
  buildTasteProfileFromHistory,
  formatTasteProfileForPrompt,
  getHistoryMaxArticles,
  getHistoryMinRating,
} from "../ai/user-taste-profile.js";
import { fetchArticleContent } from "../extractors/article-extractor.js";
import {
  buildOllamaResponseText,
  formatSummaryMessage,
  isOllamaEnabled,
  logOllamaError,
  parseOllamaResponse,
  shouldNotifyOnOllamaError,
  summarizeAndRateArticle,
} from "../ai/ollama-client.js";
import {
  getUserHighRatedArticles,
  getUserPreferences,
  saveUserArticleAiRating,
} from "../db/service.js";
import { logger } from "../utils/logger.js";

const defaultDeps = {
  fetchArticleContent,
  isOllamaEnabled,
  summarizeAndRateArticle,
  parseOllamaResponse,
  buildOllamaResponseText,
  formatSummaryMessage,
  logOllamaError,
  shouldNotifyOnOllamaError,
  saveUserArticleAiRating,
  getUserHighRatedArticles,
  getUserPreferences,
  buildTasteProfileFromHistory,
  formatTasteProfileForPrompt,
  getHistoryMinRating,
  getHistoryMaxArticles,
};

/**
 * @param {typeof defaultDeps} deps
 * @param {object} supabase
 * @param {string} userId
 * @param {string|number|undefined} articleId
 * @returns {Promise<string|null>}
 */
async function loadTasteProfile(deps, supabase, userId, articleId) {
  const history = await deps.getUserHighRatedArticles(supabase, userId, {
    excludeArticleId: articleId,
    minRating: deps.getHistoryMinRating(),
    limit: deps.getHistoryMaxArticles(),
  });

  return deps.formatTasteProfileForPrompt(
    deps.buildTasteProfileFromHistory(history)
  );
}

/**
 * @param {typeof defaultDeps} deps
 * @param {object} supabase
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function loadUserPreferences(deps, supabase, userId) {
  return deps.getUserPreferences(supabase, userId);
}

/**
 * Genera y envía por Telegram un resumen y valoración del artículo (async).
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} chatId
 * @param {string} url
 * @param {{ supabase?: object, userId?: string, articleId?: string|number, [key: string]: any }} [options]
 */
export async function sendArticleSummary(bot, chatId, url, options = {}) {
  const { supabase, userId, articleId, ...rest } = options;
  const deps = { ...defaultDeps, ...rest };

  if (!deps.isOllamaEnabled()) {
    return;
  }

  try {
    const article = await deps.fetchArticleContent(url);
    const [tasteProfile, userPreferences] =
      supabase && userId
        ? await Promise.all([
            loadTasteProfile(deps, supabase, userId, articleId),
            loadUserPreferences(deps, supabase, userId),
          ])
        : [null, null];

    const rawSummary = await deps.summarizeAndRateArticle(article, {
      tasteProfile,
      userPreferences,
    });

    const parsed = deps.parseOllamaResponse(rawSummary);
    const summaryText =
      deps.buildOllamaResponseText(parsed) ?? rawSummary;

    await bot.sendMessage(chatId, deps.formatSummaryMessage(summaryText));

    if (supabase && userId && articleId) {
      if (parsed.summary || parsed.rating != null) {
        const result = await deps.saveUserArticleAiRating(
          supabase,
          userId,
          articleId,
          {
            ai_summary: parsed.summary,
            ai_rating: parsed.rating,
            ai_rating_reason: parsed.reason,
          }
        );

        if (!result.success) {
          logger.warn(
            { err: result.error, userId, articleId, url },
            "Failed to save AI rating to database"
          );
        }
      } else {
        logger.warn({ url, userId, articleId }, "Could not parse Ollama response for DB save");
      }
    }
  } catch (error) {
    deps.logOllamaError(error, url);

    if (deps.shouldNotifyOnOllamaError()) {
      await bot.sendMessage(
        chatId,
        "⚠️ No pude generar el resumen (Ollama no disponible)."
      );
    }
  }
}
