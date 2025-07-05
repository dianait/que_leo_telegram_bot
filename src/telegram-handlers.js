import {
  fetchAndExtractMetadata,
  isValidUrl,
  buildConfirmationMessage,
} from "./article-extractor.js";
import {
  findUserByChatId,
  insertUser,
  isUserAlreadyLinked,
  findArticleByUrlOrTitle,
  insertArticle,
  prepareArticleData,
} from "./db-service.js";
import {
  handleError,
  handleDatabaseError,
  handleNetworkError,
  handleValidationError,
} from "./error-handler.js";

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
      const isAlreadyLinked = await isUserAlreadyLinked(supabase, chatId);
      if (isAlreadyLinked) {
        bot.sendMessage(
          chatId,
          "✅ Tu cuenta de Telegram ya está vinculada. ¡Ya puedes empezar a compartir artículos para guardarlos!"
        );
        return;
      }

      // Insertar nuevo usuario
      const userData = {
        user_id: userId,
        telegram_chat_id: chatId,
        telegram_username: username,
      };

      const result = await insertUser(supabase, userData);
      if (!result.success) {
        handleDatabaseError(result.error, chatId, bot, "user-linking");
      } else {
        bot.sendMessage(
          chatId,
          "✅ ¡Tu cuenta de Telegram ha sido vinculada correctamente!"
        );
      }
    } catch (error) {
      handleError(error, chatId, bot, "user-linking");
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

    try {
      // Busca el user_id vinculado a este chat
      const user = await findUserByChatId(supabase, chatId);
      if (!user) {
        bot.sendMessage(
          chatId,
          "❌ Debes vincular tu cuenta primero usando el botón de la app web."
        );
        return;
      }

      if (text && text.startsWith("http")) {
        // Validar URL antes de procesarla
        if (!isValidUrl(text)) {
          const validationError = new Error("URL inválida");
          handleValidationError(validationError, chatId, bot, "url-validation");
          return;
        }

        try {
          // Extraer metadatos usando función separada
          const { title, description, language, authors, topics } =
            await fetchAndExtractMetadata(text);

          // Verificar si el artículo ya existe por URL o título para este usuario
          const existingArticle = await findArticleByUrlOrTitle(
            supabase,
            text,
            title,
            user.user_id
          );
          if (existingArticle) {
            bot.sendMessage(chatId, "⚠️ Ya tienes este artículo guardado.");
            return;
          }

          // Preparar datos del artículo
          const articleData = prepareArticleData({
            url: text,
            userId: user.user_id,
            title,
            language,
            authors,
            topics,
            description,
          });

          // Insertar artículo
          const result = await insertArticle(supabase, articleData);
          if (!result.success) {
            handleDatabaseError(result.error, chatId, bot, "article-insertion");
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
        } catch (error) {
          // Manejar errores específicos de extracción de metadatos
          if (
            error.message.includes("fetch") ||
            error.message.includes("network")
          ) {
            handleNetworkError(error, chatId, bot, "metadata-extraction");
          } else {
            handleError(error, chatId, bot, "metadata-extraction");
          }
        }
      } else {
        bot.sendMessage(chatId, "Envíame un enlace para guardarlo.");
      }
    } catch (error) {
      handleError(error, chatId, bot, "message-processing");
    }
  });
}
