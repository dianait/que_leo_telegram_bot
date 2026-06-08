import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const hasSupabaseEnv = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
);

export const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip;

export function createSupabaseTestClient() {
  if (!hasSupabaseEnv) {
    throw new Error("Supabase env vars are required for integration tests");
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}
