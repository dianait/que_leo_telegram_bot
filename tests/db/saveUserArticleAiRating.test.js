import { saveUserArticleAiRating, upsertArticleAndUserRelation } from "../../src/db/service.js";
import { createInMemorySupabase } from "../helpers/in-memory-supabase.js";

describe("saveUserArticleAiRating", () => {
  const supabase = createInMemorySupabase();
  const userId = "user-abc";
  const articleData = {
    url: "https://example.com/post",
    title: "Artículo de prueba",
  };

  beforeEach(() => {
    supabase.reset();
  });

  test("guarda resumen y valoración en la relación usuario-artículo", async () => {
    const upsert = await upsertArticleAndUserRelation(
      supabase,
      articleData,
      userId
    );

    const result = await saveUserArticleAiRating(
      supabase,
      userId,
      upsert.article.id,
      {
        ai_summary: "Resumen generado",
        ai_rating: 8,
        ai_rating_reason: "Encaja con tus gustos",
      }
    );

    expect(result.success).toBe(true);
    expect(result.relation).toMatchObject({
      user_id: userId,
      article_id: upsert.article.id,
      ai_summary: "Resumen generado",
      ai_rating: 8,
      ai_rating_reason: "Encaja con tus gustos",
      is_read: false,
    });
    expect(result.relation.ai_rated_at).toBeTruthy();
  });

  test("no sobrescribe is_read al actualizar la valoración", async () => {
    const upsert = await upsertArticleAndUserRelation(
      supabase,
      articleData,
      userId
    );

    await supabase.from("user_articles").upsert({
      user_id: userId,
      article_id: upsert.article.id,
      is_read: true,
    }).select().single();

    const result = await saveUserArticleAiRating(
      supabase,
      userId,
      upsert.article.id,
      {
        ai_summary: "Otro resumen",
        ai_rating: 7,
        ai_rating_reason: "Bien",
      }
    );

    expect(result.success).toBe(true);
    expect(result.relation.is_read).toBe(true);
    expect(result.relation.ai_rating).toBe(7);
  });

  test("falla si no hay datos que guardar", async () => {
    const result = await saveUserArticleAiRating(supabase, userId, "article-1", {
      ai_summary: null,
      ai_rating: null,
      ai_rating_reason: null,
    });

    expect(result.success).toBe(false);
  });
});
