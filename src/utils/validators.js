/**
 * Valida si una URL es válida
 * @param {string} url - URL a validar
 * @returns {boolean} True si la URL es válida
 */
export function isValidUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch (error) {
    return false;
  }
}

/**
 * Valida si un mensaje es un comando /start
 * @param {string} text - Texto del mensaje
 * @returns {Object|null} Información del comando o null si no es /start
 */
export function parseStartCommand(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const match = text.match(/^\/start(?:\s+)?([a-zA-Z0-9-]+)?/);
  if (!match) {
    return null;
  }

  return {
    isStart: true,
    userId: match[1] || null,
  };
}

/**
 * Valida si un mensaje es un enlace
 * @param {string} text - Texto del mensaje
 * @returns {boolean} True si es un enlace
 */
export function isLinkMessage(text) {
  if (!text || typeof text !== "string") {
    return false;
  }

  return text.startsWith("http://") || text.startsWith("https://");
}

/**
 * Valida si un user_id tiene el formato correcto
 * @param {string} userId - ID del usuario
 * @returns {boolean} True si el formato es válido
 */
export function isValidUserId(userId) {
  if (!userId || typeof userId !== "string") {
    return false;
  }

  // Debe ser alfanumérico y puede contener guiones
  return /^[a-zA-Z0-9-]+$/.test(userId);
}

/**
 * Extrae la primera URL válida de un texto
 * @param {string} text - Texto que puede contener una URL
 * @returns {string|null} La primera URL encontrada o null si no hay ninguna
 */
export function extractFirstUrl(text) {
  if (!text || typeof text !== "string") return null;
  const urlRegex = /(https?:\/\/[\w\-\.\/?#&=;%+~:@!$'()*\[\],]+)/i;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}
