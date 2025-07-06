import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { registerTelegramHandlers } from "./src/telegram/handlers.js";
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

console.log("🚀 Bot iniciado - usando extracción básica de metadatos");

registerTelegramHandlers(bot, supabase);
