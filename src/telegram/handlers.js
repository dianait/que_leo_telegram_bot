import {
  fetchAndExtractMetadata,
  isValidUrl,
  buildConfirmationMessage,
} from "../extractors/article-extractor.js";
import {
  findUserByChatId,
  insertUser,
  isUserAlreadyLinked,
  upsertArticleAndUserRelation,
} from "../db/service.js";
import {
  handleError,
  handleDatabaseError,
  handleNetworkError,
  handleValidationError,
} from "../utils/error-handler.js";
import { checkRateLimit } from "./rate-limiter.js";

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
        // Rate limiting: comprobar si el usuario puede guardar otro artículo
        const rate = checkRateLimit(user.user_id);
        if (!rate.allowed) {
          const seconds = Math.ceil(rate.retryAfter / 1000);
          bot.sendMessage(
            chatId,
            `⏳ Has alcanzado el límite de artículos. Espera ${seconds} segundos antes de enviar otro enlace.`
          );
          return;
        }

        // Validar URL antes de procesarla
        if (!isValidUrl(text)) {
          const validationError = new Error("URL inválida");
          handleValidationError(validationError, chatId, bot, "url-validation");
          return;
        }

        try {
          // Extraer metadatos usando función separada
          const {
            title,
            description,
            language,
            authors,
            topics,
            featuredimage,
          } = await fetchAndExtractMetadata(text);

          // Preparar datos del artículo para el nuevo modelo
          const articleData = {
            url: text,
            title,
            language,
            authors,
            topics,
            featured_image: featuredimage,
            // Puedes añadir aquí otros campos como less_15 si lo necesitas
          };

          // Guardar o actualizar artículo y relación usuario-artículo
          const result = await upsertArticleAndUserRelation(
            supabase,
            articleData,
            user.user_id
          );

          if (!result.success) {
            handleDatabaseError(result.error, chatId, bot, "article-insertion");
            return;
          }

          // Construir mensaje de confirmación usando función separada
          const confirmMessage = buildConfirmationMessage({
            url: text,
            title,
            description,
            language,
            authors,
            topics,
            featuredimage,
          });

          // Log para debug
          console.log("📊 Metadatos finales:", {
            title,
            description,
            language,
            authors,
            topics,
            featuredimage,
          });

          // Enviar mensaje con imagen si está disponible
          if (featuredimage) {
            try {
              await bot.sendPhoto(chatId, featuredimage, {
                caption: confirmMessage,
                parse_mode: "HTML",
              });
            } catch (photoError) {
              console.warn(
                "Error enviando imagen, enviando solo texto:",
                photoError.message
              );
              bot.sendMessage(chatId, confirmMessage);
            }
          } else {
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
