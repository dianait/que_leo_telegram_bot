import {
  buildTasteProfileFromHistory,
  formatTasteProfileForPrompt,
  getHistoryMaxArticles,
  getHistoryMinRating,
} from "./user-taste-profile.js";
import { fetchArticleContent } from "../extractors/article-extractor.js";
import {
  isOllamaEnabled,
  logOllamaError,
  parseOllamaResponse,
  summarizeAndRateArticle,
} from "./ollama-client.js";
import {
  getUserHighRatedArticles,
  getUserPreferences,
  saveUserArticleAiRating,
} from "../db/service.js";
import { needsAiBackfill } from "../jobs/backfill-helpers.js";
import { logger } from "../utils/logger.js";

/** @type {Map<string, Promise<{ success: boolean, skipped?: boolean, parsed?: object|null, error?: string }>>} */
const inFlight = new Map();

const defaultDeps = {
  fetchArticleContent,
  isOllamaEnabled,
  summarizeAndRateArticle,
  parseOllamaResponse,
  saveUserArticleAiRating,
  getUserHighRatedArticles,
  getUserPreferences,
  buildTasteProfileFromHistory,
  formatTasteProfileForPrompt,
  getHistoryMinRating,
  getHistoryMaxArticles,
  logOllamaError,
};

/**
 * @param {typeof defaultDeps} deps
 * @param {object} supabase
 * @param {string} userId
 * @param {string|number} articleId
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
 * Genera resumen, valoración y razón con Ollama y los guarda en user_articles.
 * @param {{ supabase: object, userId: string, articleId: string|number, url: string, force?: boolean }} params
 * @param {typeof defaultDeps} [deps]
 * @returns {Promise<{ success: boolean, skipped?: boolean, parsed?: object, error?: string }>}
 */
export function rateUserArticle(
  { supabase, userId, articleId, url, force = false, skipExistingCheck = false },
  deps = defaultDeps
) {
  const key = `${userId}:${articleId}`;
  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const task = runRateUserArticle(
    { supabase, userId, articleId, url, force, skipExistingCheck },
    deps
  );
  inFlight.set(key, task);
  task.finally(() => inFlight.delete(key));
  return task;
}

/**
 * @param {Parameters<typeof rateUserArticle>[0]} params
 * @param {typeof defaultDeps} deps
 */
async function runRateUserArticle(
  { supabase, userId, articleId, url, force, skipExistingCheck },
  deps
) {
  if (!deps.isOllamaEnabled()) {
    return { success: false, skipped: true, error: "Ollama deshabilitado" };
  }

  if (!force && !skipExistingCheck) {
    const { data: existing } = await supabase
      .from("user_articles")
      .select("ai_summary, ai_rating, ai_rating_reason")
      .eq("user_id", userId)
      .eq("article_id", articleId)
      .maybeSingle();

    if (existing && !needsAiBackfill(existing)) {
      return {
        success: true,
        skipped: true,
        parsed: {
          summary: existing.ai_summary,
          rating: existing.ai_rating,
          reason: existing.ai_rating_reason,
        },
      };
    }
  }

  try {
    const [tasteProfile, userPreferences, content] = await Promise.all([
      loadTasteProfile(deps, supabase, userId, articleId),
      deps.getUserPreferences(supabase, userId),
      deps.fetchArticleContent(url),
    ]);

    const rawSummary = await deps.summarizeAndRateArticle(content, {
      tasteProfile,
      userPreferences,
    });
    const parsed = deps.parseOllamaResponse(rawSummary);

    if (!parsed.summary && parsed.rating == null) {
      return { success: false, error: "No se pudo parsear la respuesta de Ollama" };
    }

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
      return {
        success: false,
        error: result.error?.message ?? "Error al guardar valoración",
      };
    }

    return { success: true, parsed };
  } catch (error) {
    deps.logOllamaError(error, url);
    return { success: false, error: error.message };
  }
}

/**
 * @param {Parameters<typeof rateUserArticle>[0]} params
 * @param {Parameters<typeof rateUserArticle>[1]} [deps]
 */
export function scheduleRateUserArticle(params, deps) {
  rateUserArticle(params, deps).catch((error) => {
    logger.warn(
      { err: error, userId: params.userId, articleId: params.articleId, url: params.url },
      "Unhandled error in scheduled article rating"
    );
  });
}
