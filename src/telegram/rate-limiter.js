// Rate limiter simple en memoria para usuarios de Telegram

const DEFAULT_LIMIT = 5; // artículos
const DEFAULT_WINDOW = 60 * 1000; // 60 segundos

// userId -> array de timestamps
const userTimestamps = new Map();

/**
 * Comprueba si un usuario ha superado el límite de artículos
 * @param {string|number} userId
 * @param {number} [limit] - Límite de artículos (opcional)
 * @param {number} [windowMs] - Ventana de tiempo en ms (opcional)
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
export function checkRateLimit(
  userId,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW
) {
  const now = Date.now();
  const timestamps = userTimestamps.get(userId) || [];
  // Filtrar solo los timestamps dentro de la ventana
  const recent = timestamps.filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    // Calcular cuánto falta para poder volver a intentar
    const retryAfter = windowMs - (now - recent[0]);
    return { allowed: false, retryAfter };
  }
  // Registrar el nuevo intento
  recent.push(now);
  userTimestamps.set(userId, recent);
  return { allowed: true };
}

/**
 * Limpia los contadores antiguos (opcional, para evitar memory leak)
 * Llamar periódicamente si el bot tiene muchos usuarios
 */
export function cleanupRateLimiter(windowMs = DEFAULT_WINDOW) {
  const now = Date.now();
  for (const [userId, timestamps] of userTimestamps.entries()) {
    const recent = timestamps.filter((ts) => now - ts < windowMs);
    if (recent.length > 0) {
      userTimestamps.set(userId, recent);
    } else {
      userTimestamps.delete(userId);
    }
  }
}
