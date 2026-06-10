import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { registerTelegramHandlers } from "./src/telegram/handlers.js";
import { cleanupRateLimiter } from "./src/telegram/rate-limiter.js";
import { cleanupPreferencesState } from "./src/telegram/preferences-state.js";
import { startWebServer } from "./src/web/server.js";
import { isOllamaEnabled } from "./src/ai/ollama-client.js";
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltan variables de entorno. Revisa tu archivo .env");
  console.error("Necesitas: TELEGRAM_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🚀 Bot de Telegram iniciado");

if (isOllamaEnabled()) {
  console.log(
    `Resúmenes Ollama habilitados (${process.env.OLLAMA_MODEL} @ ${process.env.OLLAMA_BASE_URL})`
  );
} else if (process.env.OLLAMA_ENABLED === "true") {
  console.warn(
    "OLLAMA_ENABLED=true pero faltan OLLAMA_BASE_URL u OLLAMA_MODEL; resúmenes desactivados"
  );
}

registerTelegramHandlers(bot, supabase);

const server = startWebServer();

const SHUTDOWN_TIMEOUT_MS = 10_000;
const RATE_LIMITER_CLEANUP_MS = 5 * 60 * 1000;
const rateLimiterCleanupInterval = setInterval(() => {
  cleanupRateLimiter();
  cleanupPreferencesState();
}, RATE_LIMITER_CLEANUP_MS);

function shutdown(signal) {
  console.log(`\n${signal} recibido, cerrando servicios...`);

  clearInterval(rateLimiterCleanupInterval);
  bot.stopPolling();

  server.close(() => {
    console.log("Servidor web cerrado correctamente");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Timeout de cierre alcanzado, forzando salida");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
