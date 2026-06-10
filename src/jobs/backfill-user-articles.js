import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { rateUserArticle } from "../ai/rate-user-article.js";
import {
  extractArticleMetadataWithAi,
  isOllamaEnabled,
  logOllamaMetadataError,
  parseArticleMetadataResponse,
} from "../ai/ollama-client.js";
import {
  fetchAndExtractMetadata,
  fetchArticleContent,
} from "../extractors/article-extractor.js";
import {
  listUserArticlesWithDetails,
  updateArticleMetadata,
} from "../db/service.js";
import { logger } from "../utils/logger.js";
import {
  buildMetadataPatch,
  mapExtractedMetadata,
  needsAiBackfill,
  needsMetadataBackfill,
} from "./backfill-helpers.js";

dotenv.config();

const DEFAULT_DELAY_MS = 2_000;

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} params
 * @returns {Promise<{ metadataUpdated: boolean, aiUpdated: boolean, skipped: boolean, error?: string }>}
 */
export async function backfillUserArticle(
  {
    supabase,
    userId,
    row,
    dryRun = false,
    skipMetadata = false,
    skipAi = false,
    forceAi = false,
  },
  deps
) {
  const article = row.articles;
  if (!article?.url) {
    return { metadataUpdated: false, aiUpdated: false, skipped: true, error: "Sin URL" };
  }

  let metadataUpdated = false;
  let aiUpdated = false;
  /** @type {string[]} */
  const errors = [];

  if (!skipMetadata && needsMetadataBackfill(article)) {
    const extracted = mapExtractedMetadata(
      await deps.fetchAndExtractMetadata(article.url)
    );
    const patch = buildMetadataPatch(article, extracted);

    if (patch) {
      if (dryRun) {
        console.log(`  [dry-run] metadata (web) → ${JSON.stringify(patch)}`);
        Object.assign(article, patch);
        metadataUpdated = true;
      } else {
        const result = await deps.updateArticleMetadata(
          supabase,
          article.id,
          patch
        );
        if (!result.success) {
          errors.push(`metadata: ${result.error?.message ?? "unknown"}`);
        } else {
          Object.assign(article, result.article);
          metadataUpdated = true;
        }
      }
    }

    if (needsMetadataBackfill(article) && deps.isOllamaEnabled()) {
      try {
        const content = await deps.fetchArticleContent(article.url);
        const rawMetadata = await deps.extractArticleMetadataWithAi(content);
        const aiMetadata = deps.parseArticleMetadataResponse(rawMetadata);
        const aiPatch = buildMetadataPatch(
          article,
          mapExtractedMetadata({
            title: aiMetadata.title,
            language: null,
            authors: aiMetadata.authors,
            topics: aiMetadata.topics,
            featuredimage: null,
          })
        );

        if (aiPatch) {
          if (dryRun) {
            console.log(`  [dry-run] metadata (IA) → ${JSON.stringify(aiPatch)}`);
            Object.assign(article, aiPatch);
            metadataUpdated = true;
          } else {
            const result = await deps.updateArticleMetadata(
              supabase,
              article.id,
              aiPatch
            );
            if (!result.success) {
              errors.push(`metadata-ia: ${result.error?.message ?? "unknown"}`);
            } else {
              Object.assign(article, result.article);
              metadataUpdated = true;
            }
          }
        }
      } catch (error) {
        deps.logOllamaMetadataError(error, article.url);
        errors.push(`metadata-ia: ${error.message}`);
      }
    }
  }

  if (!skipAi && deps.isOllamaEnabled() && (forceAi || needsAiBackfill(row))) {
    if (dryRun) {
      console.log(`  [dry-run] IA → se valoraría ${article.url}`);
      aiUpdated = true;
    } else {
      const result = await deps.rateUserArticle(
        {
          supabase,
          userId,
          articleId: row.article_id,
          url: article.url,
          force: forceAi,
        },
        deps
      );

      if (!result.success) {
        errors.push(`ai: ${result.error ?? "unknown"}`);
      } else if (!result.skipped) {
        aiUpdated = true;
      }
    }
  }

  return {
    metadataUpdated,
    aiUpdated,
    skipped: false,
    error: errors.length ? errors.join("; ") : undefined,
  };
}

/**
 * @param {object} options
 * @param {object} [deps]
 * @returns {Promise<{ processed: number, metadataUpdated: number, aiUpdated: number, errors: number }>}
 */
export async function backfillUserArticles(
  {
    supabase,
    userId,
    dryRun = false,
    skipMetadata = false,
    skipAi = false,
    forceAi = false,
    delayMs = DEFAULT_DELAY_MS,
    userArticleIds = null,
  },
  deps = defaultDeps
) {
  const list = await deps.listUserArticlesWithDetails(supabase, userId);
  if (!list.success) {
    throw new Error(
      `No se pudieron listar artículos: ${list.error?.message ?? "unknown"}`
    );
  }

  const stats = {
    processed: 0,
    metadataUpdated: 0,
    aiUpdated: 0,
    errors: 0,
  };

  let rows = list.rows.filter((row) => row.articles);
  if (userArticleIds?.length) {
    const allowed = new Set(userArticleIds);
    rows = rows.filter((row) => allowed.has(row.id));
  }
  console.log(`Encontrados ${rows.length} artículos para el usuario ${userId}`);

  if (!skipAi && !deps.isOllamaEnabled()) {
    console.warn("Ollama deshabilitado: se omitirá el relleno de IA.");
  }

  for (const row of rows) {
    const article = row.articles;
    const needsMeta = !skipMetadata && needsMetadataBackfill(article);
    const needsAi =
      !skipAi &&
      deps.isOllamaEnabled() &&
      (forceAi || needsAiBackfill(row));

    if (!needsMeta && !needsAi) {
      continue;
    }

    stats.processed += 1;
    console.log(
      `\n[${stats.processed}] ${article.title || article.url} (ua_id=${row.id}, article_id=${article.id})`
    );

    try {
      const result = await backfillUserArticle(
        { supabase, userId, row, dryRun, skipMetadata, skipAi, forceAi },
        deps
      );

      if (result.error) {
        stats.errors += 1;
        console.error(`  ✗ ${result.error}`);
      } else {
        if (result.metadataUpdated) stats.metadataUpdated += 1;
        if (result.aiUpdated) stats.aiUpdated += 1;
        console.log(
          `  ✓ metadata=${result.metadataUpdated ? "sí" : "no"}, ia=${result.aiUpdated ? "sí" : "no"}`
        );
      }
    } catch (error) {
      stats.errors += 1;
      logger.warn({ err: error, articleId: article.id, url: article.url }, "Backfill failed");
      console.error(`  ✗ ${error.message}`);
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return stats;
}

const defaultDeps = {
  fetchAndExtractMetadata,
  fetchArticleContent,
  isOllamaEnabled,
  extractArticleMetadataWithAi,
  parseArticleMetadataResponse,
  logOllamaMetadataError,
  rateUserArticle,
  listUserArticlesWithDetails,
  updateArticleMetadata,
};

function parseArgs(argv) {
  const userIdArg = argv.find((arg) => arg.startsWith("--user-id="));
  const delayArg = argv.find((arg) => arg.startsWith("--delay-ms="));
  const userArticleIdsArg = argv.find((arg) =>
    arg.startsWith("--user-article-ids=")
  );

  return {
    userId:
      userIdArg?.split("=")[1] ??
      process.env.BACKFILL_USER_ID ??
      null,
    dryRun: argv.includes("--dry-run"),
    skipMetadata: argv.includes("--skip-metadata"),
    skipAi: argv.includes("--skip-ai"),
    forceAi: argv.includes("--force-ai"),
    delayMs: delayArg ? Number(delayArg.split("=")[1]) : DEFAULT_DELAY_MS,
    userArticleIds: userArticleIdsArg
      ? userArticleIdsArg
          .split("=")[1]
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isFinite(id))
      : null,
  };
}

async function main() {
  const { userId, dryRun, skipMetadata, skipAi, forceAi, delayMs, userArticleIds } =
    parseArgs(process.argv.slice(2));

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

  console.log(`Backfill para usuario ${userId}${dryRun ? " (dry-run)" : ""}`);

  const stats = await backfillUserArticles({
    supabase,
    userId,
    dryRun,
    skipMetadata,
    skipAi,
    forceAi,
    delayMs,
    userArticleIds,
  });

  console.log("\nResumen:");
  console.log(`  Procesados: ${stats.processed}`);
  console.log(`  Metadata actualizada: ${stats.metadataUpdated}`);
  console.log(`  IA actualizada: ${stats.aiUpdated}`);
  console.log(`  Errores: ${stats.errors}`);
}

const isMain = process.argv[1]?.includes("backfill-user-articles.js");
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
