import jest from "jest-mock";
import { getUserHighRatedArticles } from "../../src/db/service.js";

describe("getUserHighRatedArticles", () => {
  test("mapea artículos valorados y excluye el actual", async () => {
    const limit = jest.fn().mockResolvedValue({
      data: [
        {
          ai_rating: 9,
          article_id: 1,
          articles: {
            title: "Actual",
            url: "https://example.com/current",
            authors: ["A"],
            topics: ["Swift"],
          },
        },
        {
          ai_rating: 8,
          article_id: 2,
          articles: {
            title: "Anterior",
            url: "https://example.com/previous",
            authors: ["B"],
            topics: ["iOS"],
          },
        },
      ],
      error: null,
    });
    const order = jest.fn(() => ({ limit }));
    const gte = jest.fn(() => ({ order }));
    const not = jest.fn(() => ({ gte }));
    const eq = jest.fn(() => ({ not }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));

    const supabase = { from };

    const result = await getUserHighRatedArticles(supabase, "user-1", {
      excludeArticleId: 1,
      minRating: 7,
      limit: 15,
    });

    expect(from).toHaveBeenCalledWith("user_articles");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(gte).toHaveBeenCalledWith("ai_rating", 7);
    expect(result).toEqual([
      {
        ai_rating: 8,
        title: "Anterior",
        url: "https://example.com/previous",
        authors: ["B"],
        topics: ["iOS"],
      },
    ]);
  });

  test("devuelve array vacío si hay error", async () => {
    const limit = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "db error" },
    });
    const order = jest.fn(() => ({ limit }));
    const gte = jest.fn(() => ({ order }));
    const not = jest.fn(() => ({ gte }));
    const eq = jest.fn(() => ({ not }));
    const select = jest.fn(() => ({ eq }));
    const supabase = { from: jest.fn(() => ({ select })) };

    const result = await getUserHighRatedArticles(supabase, "user-1");

    expect(result).toEqual([]);
  });
});
