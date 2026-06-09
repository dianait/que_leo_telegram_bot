import { formatArticleContextForAi } from "../extractors/article-signals.js";
import { logger } from "../utils/logger.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_SUMMARY_MAX_CHARS = 400;
const DEFAULT_REASON_MAX_CHARS = 120;

/**
 * @returns {number}
 */
export function getSummaryMaxChars() {
  const value = Number(process.env.OLLAMA_SUMMARY_MAX_CHARS);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SUMMARY_MAX_CHARS;
}

/**
 * @returns {number}
 */
export function getReasonMaxChars() {
  const value = Number(process.env.OLLAMA_REASON_MAX_CHARS);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_REASON_MAX_CHARS;
}

/**
 * @param {string|null|undefined} text
 * @param {number} maxChars
 * @returns {string|null}
 */
export function truncateText(text, maxChars) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const slice = trimmed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");

  if (lastSpace <= 0) {
    return `${slice}…`;
  }

  return `${slice.slice(0, lastSpace)}…`;
}

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
 * @param {string|null|undefined} tasteProfile
 * @returns {string}
 */
export function buildSystemPrompt(tasteProfile) {
  const preferences =
    process.env.OLLAMA_USER_PREFERENCES?.trim() ||
    "Sin preferencias específicas definidas.";

  const tasteSection = tasteProfile
    ? `
Historial real del usuario (artículos que ya valoró alto en su cuenta):
${tasteProfile}
`
    : "";

  return `Eres un asistente que resume artículos web y los valora según los gustos del usuario.

Preferencias del usuario:
${preferences}
${tasteSection}
Criterios para VALORACIÓN y RAZÓN (obligatorio):
- Valora solo el CONTENIDO: profundidad, calidad técnica, claridad, originalidad y encaje con los temas que interesan al usuario.
- La RAZÓN debe explicar por qué el contenido encaja o no con esos gustos (tema, nivel, profundidad, estilo).
- NO uses como motivo de la nota: membresías, paywalls, Medium Partner, suscripciones, acceso de pago, si el texto está truncado o si no pudiste leerlo entero.
- Ignora barreras de acceso; asume que el usuario puede leer el artículo si le interesa.
- Usa los metadatos (fuente, autor, longitud, profundidad) como contexto para la valoración, no como excusa.

Responde SIEMPRE en español con este formato exacto:
RESUMEN:
(máximo 2-3 frases cortas; unas 80 palabras en total; ve al grano)

VALORACIÓN: X/10
RAZÓN:
(una sola línea breve, máximo 15 palabras; solo calidad y encaje temático con las preferencias del usuario)`;
}

/**
 * @param {{ title: string|null, description: string|null, text: string, url: string, authors?: string[], topics?: string[], publishedAt?: string|null }} article
 * @param {{ tasteProfile?: string|null }} [options]
 * @returns {Promise<string>}
 */
export async function summarizeAndRateArticle(article, { tasteProfile } = {}) {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.OLLAMA_MODEL;
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const userContent = formatArticleContextForAi(article);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(tasteProfile) },
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

const OLLAMA_RESPONSE_PATTERN =
  /RESUMEN:\s*([\s\S]*?)\n+\s*VALORACI[ÓO]N:\s*(\d{1,2})\s*\/\s*10\s*\n+\s*RAZ[ÓO]N:\s*([\s\S]*)/i;

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeOllamaRaw(raw) {
  return raw.replace(/\*\*/g, "").trim();
}

/**
 * @param {number} rating
 * @returns {boolean}
 */
function isValidRating(rating) {
  return Number.isInteger(rating) && rating >= 1 && rating <= 10;
}

/**
 * @param {string} normalized
 * @returns {{ summary: string|null, rating: number|null, reason: string|null }}
 */
function parseOllamaResponseFallback(normalized) {
  const summaryMatch = normalized.match(
    /RESUMEN:\s*([\s\S]*?)(?=\n\s*VALORACI[ÓO]N:|\s*$)/i
  );
  const ratingMatch = normalized.match(/VALORACI[ÓO]N:\s*(\d{1,2})\s*\/\s*10/i);
  const reasonMatch = normalized.match(/RAZ[ÓO]N:\s*([\s\S]*)/i);

  const summary = truncateText(summaryMatch?.[1]?.trim(), getSummaryMaxChars());
  const rating = ratingMatch ? Number.parseInt(ratingMatch[1], 10) : null;
  const reason = truncateText(reasonMatch?.[1]?.trim(), getReasonMaxChars());

  return {
    summary,
    rating: isValidRating(rating) ? rating : null,
    reason,
  };
}

/**
 * @param {string} raw
 * @returns {{ summary: string|null, rating: number|null, reason: string|null }}
 */
export function parseOllamaResponse(raw) {
  const normalized = normalizeOllamaRaw(raw);
  const match = normalized.match(OLLAMA_RESPONSE_PATTERN);

  if (match) {
    const summary = truncateText(match[1], getSummaryMaxChars());
    const rating = Number.parseInt(match[2], 10);
    const reason = truncateText(match[3], getReasonMaxChars());

    if (!isValidRating(rating)) {
      return { summary, rating: null, reason };
    }

    return { summary, rating, reason };
  }

  return parseOllamaResponseFallback(normalized);
}

/**
 * @param {{ summary: string|null, rating: number|null, reason: string|null }} parsed
 * @returns {string|null}
 */
export function buildOllamaResponseText({ summary, rating, reason }) {
  if (!summary && rating == null && !reason) {
    return null;
  }

  const parts = [];

  if (summary) {
    parts.push(`RESUMEN:\n${summary}`);
  }

  if (rating != null) {
    parts.push(`VALORACIÓN: ${rating}/10`);
  }

  if (reason) {
    parts.push(`RAZÓN:\n${reason}`);
  }

  return parts.join("\n\n");
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
