import {
  fetchAndExtractMetadata,
  isValidUrl,
  buildConfirmationMessage,
} from "./article-extractor.js";

/**
 * Registra los handlers de Telegram en el bot
 * @param {TelegramBot} bot
 * @param {SupabaseClient} supabase
 */
export function registerTelegramHandlers(bot, supabase) {
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
      // Validar URL antes de procesarla
      if (!isValidUrl(text)) {
        bot.sendMessage(
          chatId,
          "❌ La URL no es válida. Asegúrate de que comience con http:// o https://"
        );
        return;
      }

      try {
        // Extraer metadatos usando función separada
        const { title, description, language, authors, topics } =
          await fetchAndExtractMetadata(text);

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

        const { error } = await supabase.from("articles").insert([
          {
            url: text,
            user_id: data.user_id,
            dateAdded: new Date().toISOString(),
            title: title || null,
            language: language || null,
            authors: authors && authors.length ? authors : null,
            topics: topics && topics.length ? topics : null,
            description: description || null,
          },
        ]);
        if (error) {
          console.error("Error al guardar en Supabase:", error);
          bot.sendMessage(chatId, "❌ Error al guardar el artículo.");
        } else {
          // Construir mensaje de confirmación usando función separada
          const confirmMessage = buildConfirmationMessage({
            url: text,
            title,
            description,
            language,
            authors,
            topics,
          });
          // Log para debug
          console.log("📊 Metadatos finales:", {
            title,
            description,
            language,
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
}
