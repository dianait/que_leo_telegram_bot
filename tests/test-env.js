import dotenv from "dotenv";

dotenv.config();

if (process.env.TEST_VERBOSE === "1") {
  console.log("Checking test environment variables...");
  console.log(
    "TELEGRAM_TOKEN:",
    process.env.TELEGRAM_TOKEN ? "set" : "missing"
  );
  console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "set" : "missing");
  console.log(
    "SUPABASE_ANON_KEY:",
    process.env.SUPABASE_ANON_KEY ? "set" : "missing"
  );
}
