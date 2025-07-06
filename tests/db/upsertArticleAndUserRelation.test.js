import { createClient } from "@supabase/supabase-js";
import { upsertArticleAndUserRelation } from "../../src/db/service.js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

describe("upsertArticleAndUserRelation", () => {
  const testUserId = "9305ee7a-146e-4029-9693-60a9f0b2347e"; // ID real proporcionado por el usuario
  const testUrl = "https://test-upsert-article.com";
  const articleData = {
    url: testUrl,
    title: "Artículo de Test",
    language: "es",
    authors: ["Test Author"],
    topics: ["test", "upsert"],
    featured_image: "https://test.com/image.png",
  };

  afterAll(async () => {
    // Limpia los datos de test
    await supabase.from("user_articles").delete().eq("user_id", testUserId);
    await supabase.from("articles").delete().eq("url", testUrl);
  });

  test("inserta un artículo nuevo y la relación usuario-artículo", async () => {
    const result = await upsertArticleAndUserRelation(
      supabase,
      articleData,
      testUserId
    );
    expect(result.success).toBe(true);
    expect(result.article.url).toBe(testUrl);
    expect(result.relation.user_id).toBe(testUserId);
  });

  test("actualiza el artículo si ya existe y mantiene la relación", async () => {
    // Cambia el título para probar la actualización
    const updatedData = { ...articleData, title: "Título Actualizado" };
    const result = await upsertArticleAndUserRelation(
      supabase,
      updatedData,
      testUserId
    );
    expect(result.success).toBe(true);
    expect(result.article.title).toBe("Título Actualizado");
    expect(result.relation.user_id).toBe(testUserId);
  });
});
