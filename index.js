import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import FirecrawlApp from "firecrawl";
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltan variables de entorno. Revisa tu archivo .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Inicializar Firecrawl si hay API key disponible
let firecrawl = null;
if (FIRECRAWL_API_KEY) {
  firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });
  console.log("✅ Firecrawl inicializado con API key");
} else {
  console.log("⚠️ Firecrawl no disponible - usando extracción básica");
}

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
      // Validar URL antes de procesarla
      let urlToProcess = text;
      try {
        new URL(text); // Validar que es una URL válida
      } catch (urlError) {
        bot.sendMessage(
          chatId,
          "❌ La URL no es válida. Asegúrate de que comience con http:// o https://"
        );
        return;
      }

      // Obtener metadatos de la página usando Firecrawl o extracción básica
      let title = null;
      let language = null;
      let authors = [];
      let topics = [];
      let description = null;

      try {
        if (firecrawl) {
          // Usar Firecrawl para extracción avanzada
          console.log("🔍 Extrayendo metadatos con Firecrawl...");
          const result = await firecrawl.scrapeUrl({
            url: text,
            pageOptions: {
              onlyMainContent: false,
              includeHtml: false,
              includeMarkdown: false,
              includeScreenshot: false,
              includeAllMetadata: true,
            },
          });

          if (result.success && result.data) {
            console.log(
              "🔍 Respuesta completa de Firecrawl:",
              JSON.stringify(result, null, 2)
            );

            const metadata = result.data.metadata || {};
            title = metadata.title || result.data.title || null;
            description = metadata.description || null;
            language = metadata.language || null;

            // Extraer autores de diferentes fuentes
            if (metadata.author) {
              authors = Array.isArray(metadata.author)
                ? metadata.author
                : [metadata.author];
            } else if (metadata.authors) {
              authors = Array.isArray(metadata.authors)
                ? metadata.authors
                : [metadata.authors];
            }

            // Extraer temas/keywords
            if (metadata.keywords) {
              topics = Array.isArray(metadata.keywords)
                ? metadata.keywords
                : metadata.keywords
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
            } else if (metadata.tags) {
              topics = Array.isArray(metadata.tags)
                ? metadata.tags
                : [metadata.tags];
            }

            console.log("✅ Metadatos extraídos con Firecrawl:", {
              title,
              description,
              language,
              authors,
              topics,
            });
          } else {
            console.log("❌ Firecrawl no devolvió datos válidos:", result);
          }
        } else {
          // Fallback a extracción básica con fetch
          console.log("🔍 Usando extracción básica...");
          try {
            const res = await fetch(text);
            const html = await res.text();

            // Extracción básica de título
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            title = titleMatch ? titleMatch[1].trim() : null;

            // Extracción básica de idioma
            const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
            language = langMatch ? langMatch[1] : null;

            // Extracción básica de autor
            const authorMatch = html.match(
              /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i
            );
            if (authorMatch) {
              authors = [authorMatch[1]];
            }

            // Extracción básica de keywords
            const keywordsMatch = html.match(
              /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i
            );
            if (keywordsMatch) {
              topics = keywordsMatch[1]
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            }

            console.log("✅ Metadatos extraídos con método básico:", {
              title,
              language,
              authors,
              topics,
            });
          } catch (fetchError) {
            console.error("❌ Error en extracción básica:", fetchError);
          }
        }
      } catch (e) {
        console.error("No se pudieron obtener los metadatos de la URL:", e);
      }
      // Verificar si el artículo ya existe por URL o título para este usuario
      const { data: existingArticle, error: searchError } = await supabase
        .from("articles")
        .select("id")
        .or(`url.eq.${text},title.eq.${title}`)
        .eq("user_id", data.user_id)
        .maybeSingle();
      if (existingArticle && !searchError) {
        bot.sendMessage(chatId, "⚠️ Ya tienes este artículo guardado.");
        return;
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
          description: description || null,
        },
      ]);
      if (error) {
        console.error("Error al guardar en Supabase:", error);
        bot.sendMessage(chatId, "❌ Error al guardar el artículo.");
      } else {
        // Construir mensaje de confirmación
        let confirmMessage = `✅ ¡Artículo guardado!\n🔗 URL: ${text}`;

        if (title) {
          confirmMessage += `\n📝 Título: ${title}`;
        }

        if (description) {
          confirmMessage += `\n📄 Descripción: ${description.substring(
            0,
            200
          )}${description.length > 200 ? "..." : ""}`;
        }

        if (languageName) {
          confirmMessage += `\n🌍 Idioma: ${languageName}`;
        }

        if (authors.length > 0) {
          confirmMessage += `\n👥 Autor(es): ${authors.join(", ")}`;
        }

        if (topics.length > 0) {
          confirmMessage += `\n🏷️ Temas: ${topics.join(", ")}`;
        }

        // Log para debug
        console.log("📊 Metadatos finales:", {
          title,
          description,
          language: languageName,
          authors,
          topics,
        });

        bot.sendMessage(chatId, confirmMessage);
      }
    } catch (e) {
      console.error("Error inesperado:", e);
      bot.sendMessage(chatId, "❌ Error inesperado.");
    }
  } else {
    bot.sendMessage(chatId, "Envíame un enlace para guardarlo.");
  }
});
