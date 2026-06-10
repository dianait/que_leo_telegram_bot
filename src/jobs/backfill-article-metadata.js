import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { backfillUserArticles } from "./backfill-user-articles.js";

dotenv.config();

const DEFAULT_DELAY_MS = 2_000;

function parseArgs(argv) {
  const userIdArg = argv.find((arg) => arg.startsWith("--user-id="));
  const delayArg = argv.find((arg) => arg.startsWith("--delay-ms="));

  return {
    userId:
      userIdArg?.split("=")[1] ?? process.env.BACKFILL_USER_ID ?? null,
    dryRun: argv.includes("--dry-run"),
    delayMs: delayArg ? Number(delayArg.split("=")[1]) : DEFAULT_DELAY_MS,
  };
}

async function main() {
  const { userId, dryRun, delayMs } = parseArgs(process.argv.slice(2));

  if (!userId) {
    console.error(
      "Indica el usuario con --user-id=<uuid> o BACKFILL_USER_ID en .env"
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan SUPABASE_URL y SUPABASE_ANON_KEY en .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(
    `Relleno de metadata (título, autor, topics) para ${userId}${dryRun ? " (dry-run)" : ""}`
  );

  const stats = await backfillUserArticles({
    supabase,
    userId,
    dryRun,
    skipMetadata: false,
    skipAi: true,
    delayMs,
  });

  console.log("\nResumen:");
  console.log(`  Procesados: ${stats.processed}`);
  console.log(`  Metadata actualizada: ${stats.metadataUpdated}`);
  console.log(`  Errores: ${stats.errors}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
