import jest from "jest-mock";
import { rateUserArticle } from "../../src/ai/rate-user-article.js";

describe("rateUserArticle", () => {
  const supabase = {
    from: jest.fn(),
  };

  const fetchArticleContent = jest.fn();
  const isOllamaEnabled = jest.fn();
  const summarizeAndRateArticle = jest.fn();
  const parseOllamaResponse = jest.fn();
  const saveUserArticleAiRating = jest.fn();
  const getUserHighRatedArticles = jest.fn();
  const getUserPreferences = jest.fn();
  const buildTasteProfileFromHistory = jest.fn();
  const formatTasteProfileForPrompt = jest.fn();
  const getHistoryMinRating = jest.fn();
  const getHistoryMaxArticles = jest.fn();
  const logOllamaError = jest.fn();

  const deps = {
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

  beforeEach(() => {
    supabase.from.mockReset();
    fetchArticleContent.mockReset();
    isOllamaEnabled.mockReset();
    summarizeAndRateArticle.mockReset();
    parseOllamaResponse.mockReset();
    saveUserArticleAiRating.mockReset();
    getUserHighRatedArticles.mockReset();
    getUserPreferences.mockReset();
    buildTasteProfileFromHistory.mockReset();
    formatTasteProfileForPrompt.mockReset();
    getHistoryMinRating.mockReset();
    getHistoryMaxArticles.mockReset();
    logOllamaError.mockReset();

    isOllamaEnabled.mockReturnValue(true);
    getHistoryMinRating.mockReturnValue(7);
    getHistoryMaxArticles.mockReturnValue(15);
    getUserHighRatedArticles.mockResolvedValue([]);
    getUserPreferences.mockResolvedValue("Me interesan ensayos técnicos");
    buildTasteProfileFromHistory.mockReturnValue({ totalArticles: 0 });
    formatTasteProfileForPrompt.mockReturnValue(null);
    fetchArticleContent.mockResolvedValue({
      title: "Artículo",
      text: "Contenido",
      url: "https://example.com/post",
    });
    summarizeAndRateArticle.mockResolvedValue("raw");
    parseOllamaResponse.mockReturnValue({
      summary: "Resumen",
      rating: 8,
      reason: "Tema técnico con profundidad.",
    });
    saveUserArticleAiRating.mockResolvedValue({ success: true });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
  });

  test("guarda valoración cuando Ollama responde", async () => {
    const result = await rateUserArticle(
      {
        supabase,
        userId: "user-1",
        articleId: 10,
        url: "https://example.com/post",
      },
      deps
    );

    expect(result.success).toBe(true);
    expect(saveUserArticleAiRating).toHaveBeenCalledWith(
      supabase,
      "user-1",
      10,
      {
        ai_summary: "Resumen",
        ai_rating: 8,
        ai_rating_reason: "Tema técnico con profundidad.",
      }
    );
  });

  test("omite si ya hay valoración completa", async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                ai_summary: "Ya valorado",
                ai_rating: 9,
                ai_rating_reason: "Razón existente",
              },
            }),
          }),
        }),
      }),
    });

    const result = await rateUserArticle(
      {
        supabase,
        userId: "user-1",
        articleId: 10,
        url: "https://example.com/post",
      },
      deps
    );

    expect(result.skipped).toBe(true);
    expect(summarizeAndRateArticle).not.toHaveBeenCalled();
    expect(result.parsed).toEqual({
      summary: "Ya valorado",
      rating: 9,
      reason: "Razón existente",
    });
  });

  test("reutiliza la misma promesa si ya hay una valoración en curso", async () => {
    let resolveSummary;
    summarizeAndRateArticle.mockReturnValue(
      new Promise((resolve) => {
        resolveSummary = resolve;
      })
    );

    const first = rateUserArticle(
      {
        supabase,
        userId: "user-1",
        articleId: 10,
        url: "https://example.com/post",
      },
      deps
    );
    const second = rateUserArticle(
      {
        supabase,
        userId: "user-1",
        articleId: 10,
        url: "https://example.com/post",
      },
      deps
    );

    resolveSummary("raw");
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe(b);
    expect(summarizeAndRateArticle).toHaveBeenCalledTimes(1);
  });
});
