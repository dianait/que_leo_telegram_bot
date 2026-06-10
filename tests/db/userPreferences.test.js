import {
  deleteUserPreferences,
  getUserPreferences,
  upsertUserPreferences,
} from "../../src/db/service.js";
import { createInMemorySupabase } from "../helpers/in-memory-supabase.js";

describe("user preferences", () => {
  let supabase;

  beforeEach(() => {
    supabase = createInMemorySupabase();
  });

  test("getUserPreferences devuelve null si no hay preferencias", async () => {
    const result = await getUserPreferences(supabase, "user-1");
    expect(result).toBeNull();
  });

  test("upsertUserPreferences guarda y getUserPreferences las recupera", async () => {
    const text = "Me interesan Swift y arquitectura. Evito clickbait.";

    const saveResult = await upsertUserPreferences(supabase, "user-1", text);
    expect(saveResult.success).toBe(true);

    const preferences = await getUserPreferences(supabase, "user-1");
    expect(preferences).toBe(text);
  });

  test("upsertUserPreferences actualiza preferencias existentes", async () => {
    await upsertUserPreferences(supabase, "user-1", "Primera versión");
    await upsertUserPreferences(supabase, "user-1", "Versión actualizada");

    const preferences = await getUserPreferences(supabase, "user-1");
    expect(preferences).toBe("Versión actualizada");
  });

  test("deleteUserPreferences elimina las preferencias", async () => {
    await upsertUserPreferences(supabase, "user-1", "Gustos temporales");

    const deleteResult = await deleteUserPreferences(supabase, "user-1");
    expect(deleteResult.success).toBe(true);

    const preferences = await getUserPreferences(supabase, "user-1");
    expect(preferences).toBeNull();
  });
});
