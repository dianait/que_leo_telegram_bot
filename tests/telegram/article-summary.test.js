import jest from "jest-mock";
import { sendArticleSummary } from "../../src/telegram/article-summary.js";

describe("sendArticleSummary", () => {
  const bot = {
    sendMessage: jest.fn().mockResolvedValue(undefined),
  };

  const rateUserArticle = jest.fn();
  const isOllamaEnabled = jest.fn();
  const logOllamaError = jest.fn();
  const shouldNotifyOnOllamaError = jest.fn();

  const deps = {
    rateUserArticle,
    isOllamaEnabled,
    logOllamaError,
    shouldNotifyOnOllamaError,
    buildOllamaResponseText: ({ summary, rating, reason }) =>
      [summary, rating != null ? `VALORACIÓN: ${rating}/10` : null, reason]
        .filter(Boolean)
        .join("\n\n"),
    formatSummaryMessage: (text) => `📖 Resumen y valoración\n\n${text}`,
  };

  beforeEach(() => {
    bot.sendMessage.mockClear();
    rateUserArticle.mockClear();
    isOllamaEnabled.mockClear();
    logOllamaError.mockClear();
    shouldNotifyOnOllamaError.mockClear();

    isOllamaEnabled.mockReturnValue(true);
    shouldNotifyOnOllamaError.mockReturnValue(true);
    rateUserArticle.mockResolvedValue({
      success: true,
      parsed: {
        summary: "Muy interesante.",
        rating: 9,
        reason: "Ensayo técnico con ejemplos claros.",
      },
    });
  });

  test("no hace nada si Ollama está deshabilitado", async () => {
    isOllamaEnabled.mockReturnValue(false);

    await sendArticleSummary(bot, 123, "https://example.com/post", {
      supabase: {},
      userId: "user-1",
      articleId: "article-1",
      ...deps,
    });

    expect(rateUserArticle).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  test("envía resumen y valoración por Telegram", async () => {
    await sendArticleSummary(bot, 123, "https://example.com/post", {
      supabase: {},
      userId: "user-1",
      articleId: "article-1",
      ...deps,
    });

    expect(rateUserArticle).toHaveBeenCalledWith(
      {
        supabase: {},
        userId: "user-1",
        articleId: "article-1",
        url: "https://example.com/post",
      },
      expect.objectContaining({
        isOllamaEnabled,
        logOllamaError,
        shouldNotifyOnOllamaError,
      })
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("VALORACIÓN: 9/10")
    );
  });

  test("notifica error si la valoración falla", async () => {
    rateUserArticle.mockResolvedValueOnce({
      success: false,
      error: "Ollama caído",
    });

    await sendArticleSummary(bot, 123, "https://example.com/post", {
      supabase: {},
      userId: "user-1",
      articleId: "article-1",
      ...deps,
    });

    expect(logOllamaError).toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      "⚠️ No pude generar el resumen (Ollama no disponible)."
    );
  });

  test("no hace nada sin contexto de usuario", async () => {
    await sendArticleSummary(bot, 123, "https://example.com/post", deps);

    expect(rateUserArticle).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  test("no notifica error si OLLAMA_NOTIFY_ON_ERROR es false", async () => {
    shouldNotifyOnOllamaError.mockReturnValue(false);
    rateUserArticle.mockResolvedValueOnce({
      success: false,
      error: "timeout",
    });

    await sendArticleSummary(bot, 123, "https://example.com/post", {
      supabase: {},
      userId: "user-1",
      articleId: "article-1",
      ...deps,
    });

    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});
