import { fetchArticleContent } from "../extractors/article-extractor.js";
import {
  formatSummaryMessage,
  isOllamaEnabled,
  logOllamaError,
  shouldNotifyOnOllamaError,
  summarizeAndRateArticle,
} from "../ai/ollama-client.js";

const defaultDeps = {
  fetchArticleContent,
  isOllamaEnabled,
  summarizeAndRateArticle,
  formatSummaryMessage,
  logOllamaError,
  shouldNotifyOnOllamaError,
};

/**
 * Genera y envía por Telegram un resumen y valoración del artículo (async).
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} chatId
 * @param {string} url
 * @param {typeof defaultDeps} [deps]
 */
export async function sendArticleSummary(bot, chatId, url, deps = defaultDeps) {
  if (!deps.isOllamaEnabled()) {
    return;
  }

  try {
    const { title, description, text } = await deps.fetchArticleContent(url);
    const summary = await deps.summarizeAndRateArticle({
      title,
      description,
      text,
      url,
    });

    await bot.sendMessage(chatId, deps.formatSummaryMessage(summary));
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
