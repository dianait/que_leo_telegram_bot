import jest from "jest-mock";
import { sendArticleSummary } from "../../src/telegram/article-summary.js";

describe("sendArticleSummary", () => {
  const bot = {
    sendMessage: jest.fn().mockResolvedValue(undefined),
  };

  const fetchArticleContent = jest.fn();
  const isOllamaEnabled = jest.fn();
  const summarizeAndRateArticle = jest.fn();
  const formatSummaryMessage = jest.fn(
    (text) => `📖 Resumen y valoración\n\n${text}`
  );
  const parseOllamaResponse = jest.fn();
  const saveUserArticleAiRating = jest.fn();
  const logOllamaError = jest.fn();
  const shouldNotifyOnOllamaError = jest.fn();

  const deps = {
    fetchArticleContent,
    isOllamaEnabled,
    summarizeAndRateArticle,
    parseOllamaResponse,
    formatSummaryMessage,
    saveUserArticleAiRating,
    logOllamaError,
    shouldNotifyOnOllamaError,
  };

  beforeEach(() => {
    bot.sendMessage.mockClear();
    fetchArticleContent.mockClear();
    isOllamaEnabled.mockClear();
    summarizeAndRateArticle.mockClear();
    parseOllamaResponse.mockClear();
    formatSummaryMessage.mockClear();
    saveUserArticleAiRating.mockClear();
    logOllamaError.mockClear();
    shouldNotifyOnOllamaError.mockClear();

    isOllamaEnabled.mockReturnValue(true);
    shouldNotifyOnOllamaError.mockReturnValue(true);
    parseOllamaResponse.mockReturnValue({
      summary: "Muy interesante.",
      rating: 9,
      reason: "Encaja con tus gustos.",
    });
    saveUserArticleAiRating.mockResolvedValue({ success: true });
    fetchArticleContent.mockResolvedValue({
      title: "Artículo de prueba",
      description: "Descripción corta",
      text: "Contenido largo del artículo",
    });
    summarizeAndRateArticle.mockResolvedValue(
      "RESUMEN:\nMuy interesante.\n\nVALORACIÓN: 9/10\nRAZÓN:\nEncaja con tus gustos."
    );
  });

  test("no hace nada si Ollama está deshabilitado", async () => {
    isOllamaEnabled.mockReturnValue(false);

    await sendArticleSummary(bot, 123, "https://example.com/post", deps);

    expect(fetchArticleContent).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  test("envía resumen y valoración por Telegram", async () => {
    await sendArticleSummary(bot, 123, "https://example.com/post", deps);

    expect(fetchArticleContent).toHaveBeenCalledWith("https://example.com/post");
    expect(summarizeAndRateArticle).toHaveBeenCalledWith({
      title: "Artículo de prueba",
      description: "Descripción corta",
      text: "Contenido largo del artículo",
      url: "https://example.com/post",
    });
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("VALORACIÓN: 9/10")
    );
  });

  test("notifica error si Ollama falla", async () => {
    const error = new Error("Ollama caído");
    summarizeAndRateArticle.mockRejectedValueOnce(error);

    await sendArticleSummary(bot, 123, "https://example.com/post", deps);

    expect(logOllamaError).toHaveBeenCalledWith(error, "https://example.com/post");
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      "⚠️ No pude generar el resumen (Ollama no disponible)."
    );
  });

  test("guarda valoración en base de datos cuando hay contexto de usuario", async () => {
    const supabase = {};

    await sendArticleSummary(bot, 123, "https://example.com/post", {
      supabase,
      userId: "user-1",
      articleId: "article-1",
      ...deps,
    });

    expect(parseOllamaResponse).toHaveBeenCalled();
    expect(saveUserArticleAiRating).toHaveBeenCalledWith(
      supabase,
      "user-1",
      "article-1",
      {
        ai_summary: "Muy interesante.",
        ai_rating: 9,
        ai_rating_reason: "Encaja con tus gustos.",
      }
    );
  });

  test("no guarda en base de datos si faltan ids", async () => {
    await sendArticleSummary(bot, 123, "https://example.com/post", deps);

    expect(saveUserArticleAiRating).not.toHaveBeenCalled();
  });

  test("no notifica error si OLLAMA_NOTIFY_ON_ERROR es false", async () => {
    shouldNotifyOnOllamaError.mockReturnValue(false);
    summarizeAndRateArticle.mockRejectedValueOnce(new Error("timeout"));

    await sendArticleSummary(bot, 123, "https://example.com/post", deps);

    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});
