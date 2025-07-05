/**
 * Sistema de manejo de errores robusto para el bot de Telegram
 */

/**
 * Maneja errores de base de datos (Supabase)
 * @param {Error} error - Error de Supabase
 * @param {number} chatId - ID del chat de Telegram
 * @param {TelegramBot} bot - Instancia del bot
 * @param {string} context - Contexto de la operación
 */
export function handleDatabaseError(error, chatId, bot, context = "database") {
  logError(error, { context, chatId, type: "database" });

  // Determinar el tipo de error de Supabase
  if (error.code === "23505") {
    // Error de duplicado (unique constraint)
    bot.sendMessage(
      chatId,
      "⚠️ Ya existe un registro con estos datos. Intenta con información diferente."
    );
  } else if (error.code === "23503") {
    // Error de foreign key
    bot.sendMessage(
      chatId,
      "❌ Error de referencia en la base de datos. Contacta al administrador."
    );
  } else if (error.code === "42P01") {
    // Tabla no existe
    bot.sendMessage(
      chatId,
      "❌ Error de configuración de la base de datos. Contacta al administrador."
    );
  } else if (error.code === "42501") {
    // Error de permisos
    bot.sendMessage(
      chatId,
      "❌ Error de permisos en la base de datos. Contacta al administrador."
    );
  } else {
    // Error genérico de base de datos
    bot.sendMessage(
      chatId,
      "❌ Error al acceder a la base de datos. Intenta de nuevo en unos momentos."
    );
  }
}

/**
 * Maneja errores de red (fetch, timeout, etc.)
 * @param {Error} error - Error de red
 * @param {number} chatId - ID del chat de Telegram
 * @param {TelegramBot} bot - Instancia del bot
 * @param {string} context - Contexto de la operación
 */
export function handleNetworkError(error, chatId, bot, context = "network") {
  logError(error, { context, chatId, type: "network" });

  if (error.message.includes("fetch")) {
    bot.sendMessage(
      chatId,
      "❌ No se pudo acceder a la URL. Verifica que el enlace sea válido y esté disponible."
    );
  } else if (error.message.includes("timeout")) {
    bot.sendMessage(
      chatId,
      "⏰ La página tardó demasiado en responder. Intenta de nuevo más tarde."
    );
  } else if (error.message.includes("ENOTFOUND")) {
    bot.sendMessage(
      chatId,
      "❌ No se pudo encontrar la página. Verifica que la URL sea correcta."
    );
  } else if (error.message.includes("ECONNREFUSED")) {
    bot.sendMessage(
      chatId,
      "❌ No se pudo conectar al servidor. Intenta de nuevo más tarde."
    );
  } else {
    bot.sendMessage(
      chatId,
      "❌ Error de conexión. Intenta de nuevo en unos momentos."
    );
  }
}

/**
 * Maneja errores de validación
 * @param {Error} error - Error de validación
 * @param {number} chatId - ID del chat de Telegram
 * @param {TelegramBot} bot - Instancia del bot
 * @param {string} context - Contexto de la operación
 */
export function handleValidationError(
  error,
  chatId,
  bot,
  context = "validation"
) {
  logError(error, { context, chatId, type: "validation" });

  if (error.message.includes("URL")) {
    bot.sendMessage(
      chatId,
      "❌ La URL no es válida. Asegúrate de que comience con http:// o https://"
    );
  } else if (error.message.includes("user_id")) {
    bot.sendMessage(
      chatId,
      "❌ ID de usuario inválido. Usa el botón de la app web para vincular tu cuenta."
    );
  } else if (error.message.includes("required")) {
    bot.sendMessage(chatId, "❌ Faltan datos requeridos. Intenta de nuevo.");
  } else {
    bot.sendMessage(
      chatId,
      "❌ Error de validación. Verifica los datos e intenta de nuevo."
    );
  }
}

/**
 * Maneja errores inesperados
 * @param {Error} error - Error inesperado
 * @param {number} chatId - ID del chat de Telegram
 * @param {TelegramBot} bot - Instancia del bot
 * @param {string} context - Contexto de la operación
 */
export function handleUnexpectedError(
  error,
  chatId,
  bot,
  context = "unexpected"
) {
  logError(error, { context, chatId, type: "unexpected" });

  bot.sendMessage(
    chatId,
    "❌ Error inesperado. Nuestro equipo ha sido notificado. Intenta de nuevo más tarde."
  );
}

/**
 * Maneja errores específicos de Telegram
 * @param {Error} error - Error de Telegram
 * @param {number} chatId - ID del chat de Telegram
 * @param {TelegramBot} bot - Instancia del bot
 * @param {string} context - Contexto de la operación
 */
export function handleTelegramError(error, chatId, bot, context = "telegram") {
  logError(error, { context, chatId, type: "telegram" });

  if (error.code === 403) {
    bot.sendMessage(
      chatId,
      "❌ No tengo permisos para enviar mensajes en este chat."
    );
  } else if (error.code === 400) {
    bot.sendMessage(
      chatId,
      "❌ Error en el formato del mensaje. Intenta de nuevo."
    );
  } else if (error.code === 429) {
    bot.sendMessage(
      chatId,
      "⏰ Demasiadas solicitudes. Espera un momento antes de intentar de nuevo."
    );
  } else {
    bot.sendMessage(chatId, "❌ Error al enviar el mensaje. Intenta de nuevo.");
  }
}

/**
 * Logging detallado de errores
 * @param {Error} error - Error a loggear
 * @param {Object} context - Contexto adicional
 * @param {string} context.context - Contexto de la operación
 * @param {number} context.chatId - ID del chat
 * @param {string} context.type - Tipo de error
 */
export function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context,
  };

  console.error("🚨 ERROR:", JSON.stringify(errorInfo, null, 2));

  // Aquí podrías enviar el error a un servicio de logging externo
  // como Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === "production") {
    // En producción, podrías enviar a un servicio de monitoreo
    console.error("📊 Error enviado a servicio de monitoreo");
  }
}

/**
 * Función helper para manejar errores de forma genérica
 * @param {Error} error - Error a manejar
 * @param {number} chatId - ID del chat de Telegram
 * @param {TelegramBot} bot - Instancia del bot
 * @param {string} context - Contexto de la operación
 */
export function handleError(error, chatId, bot, context = "general") {
  // Determinar el tipo de error y usar el handler apropiado
  if (error.message.includes("fetch") || error.message.includes("network")) {
    handleNetworkError(error, chatId, bot, context);
  } else if (
    error.message.includes("validation") ||
    error.message.includes("URL")
  ) {
    handleValidationError(error, chatId, bot, context);
  } else if (
    error.code &&
    typeof error.code === "string" &&
    (error.code.startsWith("23") || error.code.startsWith("42"))
  ) {
    handleDatabaseError(error, chatId, bot, context);
  } else if (
    error.code &&
    typeof error.code === "number" &&
    error.code >= 400 &&
    error.code < 500
  ) {
    handleTelegramError(error, chatId, bot, context);
  } else {
    handleUnexpectedError(error, chatId, bot, context);
  }
}
