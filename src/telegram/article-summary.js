import {
  buildOllamaResponseText,
  formatSummaryMessage,
  isOllamaEnabled,
  logOllamaError,
  shouldNotifyOnOllamaError,
} from "../ai/ollama-client.js";
import { rateUserArticle as defaultRateUserArticle } from "../ai/rate-user-article.js";
import { logger } from "../utils/logger.js";

const defaultDeps = {
  isOllamaEnabled,
  logOllamaError,
  shouldNotifyOnOllamaError,
  buildOllamaResponseText,
  formatSummaryMessage,
};

/**
 * Genera y envía por Telegram un resumen y valoración del artículo (async).
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} chatId
 * @param {string} url
 * @param {{ supabase?: object, userId?: string, articleId?: string|number, [key: string]: any }} [options]
 */
export async function sendArticleSummary(bot, chatId, url, options = {}) {
  const {
    supabase,
    userId,
    articleId,
    rateUserArticle = defaultRateUserArticle,
    ...rest
  } = options;
  const deps = { ...defaultDeps, ...rest };

  if (!deps.isOllamaEnabled()) {
    return;
  }

  try {
    if (!supabase || !userId || !articleId) {
      return;
    }

    const result = await rateUserArticle(
      { supabase, userId, articleId, url },
      deps
    );

    if (!result.success) {
      throw new Error(result.error ?? "No se pudo valorar el artículo");
    }

    const parsed = result.parsed;
    if (!parsed?.summary && parsed?.rating == null) {
      logger.warn({ url, userId, articleId }, "Article rated without displayable summary");
      return;
    }

    const summaryText =
      deps.buildOllamaResponseText(parsed) ??
      [parsed.summary, parsed.rating != null ? `VALORACIÓN: ${parsed.rating}/10` : null, parsed.reason]
        .filter(Boolean)
        .join("\n\n");

    await bot.sendMessage(chatId, deps.formatSummaryMessage(summaryText));
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
