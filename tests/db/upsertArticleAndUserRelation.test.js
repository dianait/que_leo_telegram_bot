import { createClient } from "@supabase/supabase-js";
import {
  upsertArticleAndUserRelation,
  findPreviousLinkings,
  removeObsoleteLinkings,
  insertUser,
} from "../../src/db/service.js";
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

describe("Gestión de vinculaciones de usuarios", () => {
  const testUserId = "9305ee7a-146e-4029-9693-60a9f0b2347e"; // UUID válido
  const testChatId1 = 123456789;
  const testChatId2 = 987654321;

  afterAll(async () => {
    // Limpia los datos de test
    await supabase.from("telegram_users").delete().eq("user_id", testUserId);
  });

  test("encuentra vinculaciones anteriores por user_id", async () => {
    // Primero crear una vinculación
    const userData1 = {
      user_id: testUserId,
      telegram_chat_id: testChatId1,
      telegram_username: "testuser1",
    };
    await insertUser(supabase, userData1);

    // Buscar vinculaciones anteriores
    const previousLinkings = await findPreviousLinkings(supabase, testUserId);
    expect(previousLinkings.length).toBeGreaterThan(0);
    expect(previousLinkings[0].user_id).toBe(testUserId);
  });

  test("elimina vinculaciones obsoletas y crea nueva", async () => {
    // Crear nueva vinculación (esto debería limpiar la anterior)
    const userData2 = {
      user_id: testUserId,
      telegram_chat_id: testChatId2,
      telegram_username: "testuser2",
    };

    const result = await insertUser(supabase, userData2);
    expect(result.success).toBe(true);

    // Verificar que solo existe la nueva vinculación
    const remainingLinkings = await findPreviousLinkings(supabase, testUserId);
    expect(remainingLinkings.length).toBe(1);
    expect(remainingLinkings[0].telegram_chat_id).toBe(testChatId2);
  });

  test("elimina vinculaciones obsoletas manualmente", async () => {
    // Crear una vinculación
    const userData = {
      user_id: testUserId,
      telegram_chat_id: testChatId1,
      telegram_username: "testuser",
    };
    await insertUser(supabase, userData);

    // Eliminar manualmente
    const result = await removeObsoleteLinkings(supabase, testUserId);
    expect(result.success).toBe(true);

    // Verificar que se eliminó
    const remainingLinkings = await findPreviousLinkings(supabase, testUserId);
    expect(remainingLinkings.length).toBe(0);
  });
});
