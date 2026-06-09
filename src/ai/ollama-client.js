import { logger } from "../utils/logger.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * @returns {boolean}
 */
export function isOllamaEnabled() {
  if (process.env.OLLAMA_ENABLED !== "true") {
    return false;
  }

  return Boolean(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL);
}

/**
 * @returns {string}
 */
function buildSystemPrompt() {
  const preferences =
    process.env.OLLAMA_USER_PREFERENCES?.trim() ||
    "Sin preferencias específicas definidas.";

  return `Eres un asistente que resume artículos web y los valora según los gustos del usuario.

Preferencias del usuario:
${preferences}

Responde SIEMPRE en español con este formato exacto:
RESUMEN:
(3-5 frases claras)

VALORACIÓN: X/10
RAZÓN:
(una línea explicando si encaja con los gustos del usuario)`;
}

/**
 * @param {{ title: string|null, description: string|null, text: string, url: string }} article
 * @returns {Promise<string>}
 */
export async function summarizeAndRateArticle({ title, description, text, url }) {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.OLLAMA_MODEL;
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const userContent = `URL: ${url}
Título: ${title || "(sin título)"}
Descripción: ${description || "(sin descripción)"}
Contenido:
${text || "(sin texto extraído — usa título y descripción para el resumen)"}`;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userContent },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama respondió con ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.message?.content?.trim();

  if (!content) {
    throw new Error("Ollama devolvió una respuesta vacía");
  }

  return content;
}

/**
 * @param {string} ollamaResponse
 * @returns {string}
 */
export function formatSummaryMessage(ollamaResponse) {
  return `📖 Resumen y valoración\n\n${ollamaResponse}`;
}

/**
 * @returns {boolean}
 */
export function shouldNotifyOnOllamaError() {
  return process.env.OLLAMA_NOTIFY_ON_ERROR !== "false";
}

/**
 * @param {Error} error
 * @param {string} url
 */
export function logOllamaError(error, url) {
  logger.warn({ err: error, url }, "Failed to generate article summary with Ollama");
}
