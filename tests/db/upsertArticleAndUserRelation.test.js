import {
  upsertArticleAndUserRelation,
  findPreviousLinkings,
  removeObsoleteLinkings,
  insertUser,
} from "../../src/db/service.js";
import { createInMemorySupabase } from "../helpers/in-memory-supabase.js";

describe("upsertArticleAndUserRelation", () => {
  let supabase;

  beforeEach(() => {
    supabase = createInMemorySupabase();
  });

  const testUserId = "9305ee7a-146e-4029-9693-60a9f0b2347e";
  const testUrl = "https://test-upsert-article.com";
  const articleData = {
    url: testUrl,
    title: "Artículo de Test",
    language: "es",
    authors: ["Test Author"],
    topics: ["test", "upsert"],
    featured_image: "https://test.com/image.png",
  };

  test("inserts a new article and user relation", async () => {
    const result = await upsertArticleAndUserRelation(
      supabase,
      articleData,
      testUserId
    );
    expect(result.success).toBe(true);
    expect(result.article.url).toBe(testUrl);
    expect(result.relation.user_id).toBe(testUserId);
  });

  test("updates an existing article and keeps the relation", async () => {
    await upsertArticleAndUserRelation(supabase, articleData, testUserId);

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

describe("Telegram user linking", () => {
  let supabase;

  beforeEach(() => {
    supabase = createInMemorySupabase();
  });

  const testUserId = "9305ee7a-146e-4029-9693-60a9f0b2347e";
  const testChatId1 = 123456789;
  const testChatId2 = 987654321;

  test("finds previous linkings by user_id", async () => {
    const userData1 = {
      user_id: testUserId,
      telegram_chat_id: testChatId1,
      telegram_username: "testuser1",
    };
    await insertUser(supabase, userData1);

    const previousLinkings = await findPreviousLinkings(supabase, testUserId);
    expect(previousLinkings.length).toBeGreaterThan(0);
    expect(previousLinkings[0].user_id).toBe(testUserId);
  });

  test("replaces obsolete linkings when relinking", async () => {
    await insertUser(supabase, {
      user_id: testUserId,
      telegram_chat_id: testChatId1,
      telegram_username: "testuser1",
    });

    const result = await insertUser(supabase, {
      user_id: testUserId,
      telegram_chat_id: testChatId2,
      telegram_username: "testuser2",
    });
    expect(result.success).toBe(true);

    const remainingLinkings = await findPreviousLinkings(supabase, testUserId);
    expect(remainingLinkings.length).toBe(1);
    expect(remainingLinkings[0].telegram_chat_id).toBe(testChatId2);
  });

  test("removes obsolete linkings manually", async () => {
    await insertUser(supabase, {
      user_id: testUserId,
      telegram_chat_id: testChatId1,
      telegram_username: "testuser",
    });

    const result = await removeObsoleteLinkings(supabase, testUserId);
    expect(result.success).toBe(true);

    const remainingLinkings = await findPreviousLinkings(supabase, testUserId);
    expect(remainingLinkings.length).toBe(0);
  });
});
