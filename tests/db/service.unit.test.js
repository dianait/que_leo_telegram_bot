import {
  upsertArticleAndUserRelation,
  insertUser,
  findUserByChatId,
} from "../../src/db/service.js";
import {
  createMockSupabase,
  deleteEqChain,
  insertChain,
  selectEqLimitChain,
  upsertChain,
} from "../helpers/mock-supabase.js";

describe("db service (unit)", () => {
  test("upsertArticleAndUserRelation uses native article upsert", async () => {
    const article = {
      id: "article-1",
      url: "https://example.com/post",
      title: "Example",
      created_at: "2026-01-01T00:00:00.000Z",
      added_at: "2026-01-01T00:00:00.000Z",
    };
    const relation = { user_id: "user-1", article_id: "article-1" };

    const supabase = createMockSupabase({
      articles: upsertChain(async () => ({ data: article, error: null })),
      user_articles: upsertChain(async () => ({ data: relation, error: null })),
    });

    const result = await upsertArticleAndUserRelation(
      supabase,
      { url: article.url, title: article.title },
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(result.article).toEqual(article);
    expect(result.relation).toEqual(relation);
  });

  test("upsertArticleAndUserRelation falls back when url index is missing", async () => {
    const article = {
      id: "article-2",
      url: "https://example.com/legacy",
      title: "Legacy",
    };
    const relation = { user_id: "user-2", article_id: "article-2" };

    const supabase = createMockSupabase({
      articles: {
        ...upsertChain(async () => ({
          data: null,
          error: { code: "42P10", message: "no unique constraint" },
        })),
        ...selectEqLimitChain(async () => ({ data: [], error: null })),
        ...insertChain(async () => ({ data: article, error: null })),
      },
      user_articles: upsertChain(async () => ({ data: relation, error: null })),
    });

    const result = await upsertArticleAndUserRelation(
      supabase,
      { url: article.url, title: article.title },
      "user-2"
    );

    expect(result.success).toBe(true);
    expect(result.article).toEqual(article);
    expect(result.relation).toEqual(relation);
  });

  test("insertUser uses native upsert on user_id", async () => {
    const userData = {
      user_id: "user-3",
      telegram_chat_id: 111,
      telegram_username: "reader",
    };

    const supabase = createMockSupabase({
      telegram_users: upsertChain(async () => ({ data: userData, error: null })),
    });

    const result = await insertUser(supabase, userData);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(userData);
  });

  test("insertUser falls back when user_id index is missing", async () => {
    const userData = {
      user_id: "user-4",
      telegram_chat_id: 222,
      telegram_username: "reader2",
    };

    const supabase = createMockSupabase({
      telegram_users: {
        ...upsertChain(async () => ({
          data: null,
          error: { code: "42P10", message: "no unique constraint" },
        })),
        ...deleteEqChain(async () => ({ error: null })),
        ...insertChain(async () => ({ data: userData, error: null })),
      },
    });

    const result = await insertUser(supabase, userData);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(userData);
  });

  test("findUserByChatId returns null when lookup fails", async () => {
    const supabase = createMockSupabase({
      telegram_users: {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: null,
              error: { message: "not found" },
            }),
          }),
        }),
      },
    });

    const user = await findUserByChatId(supabase, 999);

    expect(user).toBeNull();
  });
});
