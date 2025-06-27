import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Log de depuración para verificar las variables de entorno
console.log("SUPABASE_URL:", SUPABASE_URL);
console.log(
  "SUPABASE_ANON_KEY:",
  SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) + "..." : undefined
);

if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltan variables de entorno. Revisa tu archivo .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Vinculación de usuario con /start <user_id>
bot.onText(/^\/start(?:\s+)?([a-zA-Z0-9-]+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || null;
  const userId = match[1];

  if (!userId) {
    bot.sendMessage(
      chatId,
      "¡Hola! Para vincular tu cuenta, usa el botón de la app web."
    );
    return;
  }

  // Log de depuración para ver los valores enviados al insert
  console.log("Insertando en telegram_users:", {
    user_id: userId,
    telegram_chat_id: chatId,
    telegram_username: username,
    linked_at: new Date().toISOString(),
  });

  try {
    // Verificar si el usuario ya está vinculado
    const { data: existingUser, error: selectError } = await supabase
      .from("telegram_users")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .single();
    if (existingUser && !selectError) {
      bot.sendMessage(
        chatId,
        "✅ Tu cuenta de Telegram ya está vinculada. ¡Ya puedes empezar a compartir artículos para guardarlos!"
      );
      return;
    }
    const { error } = await supabase.from("telegram_users").insert([
      {
        user_id: userId,
        telegram_chat_id: chatId,
        telegram_username: username,
      },
    ]);

    if (error) {
      console.error("Error al vincular usuario:", error);
      bot.sendMessage(
        chatId,
        "❌ Error al vincular tu cuenta. Intenta de nuevo."
      );
    } else {
      bot.sendMessage(
        chatId,
        "✅ ¡Tu cuenta de Telegram ha sido vinculada correctamente!"
      );
    }
  } catch (e) {
    console.error("Error inesperado:", e);
    bot.sendMessage(chatId, "❌ Error inesperado al vincular tu cuenta.");
  }
});

// Guardar artículos solo si el usuario está vinculado
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Log para depuración: mostrar el chatId recibido
  console.log("Buscando vinculación para chatId:", chatId);

  // Ignora el mensaje /start con user_id (ya gestionado arriba)
  if (text && text.startsWith("/start")) return;

  // Busca el user_id vinculado a este chat
  const { data, error } = await supabase
    .from("telegram_users")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!data || error) {
    bot.sendMessage(
      chatId,
      "❌ Debes vincular tu cuenta primero usando el botón de la app web."
    );
    return;
  }

  if (text && text.startsWith("http")) {
    try {
      // Obtener metadatos de la página
      let title = null;
      let language = null;
      let authors = [];
      let topics = [];
      try {
        const res = await fetch(text);
        const html = await res.text();
        const $ = cheerio.load(html);
        title = $("title").text().trim();
        language =
          $("html").attr("lang") ||
          $('meta[http-equiv="content-language"]').attr("content") ||
          null;
        const authorMeta = $('meta[name="author"]').attr("content");
        if (authorMeta) {
          authors = [authorMeta];
        }
        const keywordsMeta = $('meta[name="keywords"]').attr("content");
        if (keywordsMeta) {
          topics = keywordsMeta
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }
      } catch (e) {
        console.error("No se pudieron obtener los metadatos de la URL:", e);
      }
      // Traducción simple de idioma
      let languageName = language;
      if (language) {
        if (language.startsWith("en")) languageName = "Inglés";
        else if (language.startsWith("es")) languageName = "Castellano";
      }
      const { error } = await supabase.from("articles").insert([
        {
          url: text,
          user_id: data.user_id,
          dateAdded: new Date().toISOString(),
          title: title || null,
          language: language || null,
          authors: authors.length ? authors : null,
          topics: topics.length ? topics : null,
        },
      ]);
      if (error) {
        console.error("Error al guardar en Supabase:", error);
        bot.sendMessage(chatId, "❌ Error al guardar el artículo.");
      } else {
        bot.sendMessage(
          chatId,
          `✅ ¡Artículo guardado!${title ? `\nTítulo: ${title}` : ""}${
            languageName ? `\nIdioma: ${languageName}` : ""
          }${authors.length ? `\nAutor(es): ${authors.join(", ")}` : ""}${
            topics.length ? `\nTemas: ${topics.join(", ")}` : ""
          }`
        );
      }
    } catch (e) {
      console.error("Error inesperado:", e);
      bot.sendMessage(chatId, "❌ Error inesperado.");
    }
  } else {
    bot.sendMessage(chatId, "Envíame un enlace para guardarlo.");
  }
});
