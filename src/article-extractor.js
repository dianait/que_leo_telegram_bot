import { isValidUrl as baseIsValidUrl } from "./validators.js";
import {
  extractMetadataBasic,
  translateLanguage,
} from "./metadata-extractor.js";

/**
 * Hace fetch a una URL y extrae metadatos básicos del HTML
 * @param {string} url - URL a procesar
 * @returns {Promise<Object>} Metadatos extraídos
 */
export async function fetchAndExtractMetadata(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    return extractMetadataBasic(html);
  } catch (error) {
    // Si hay error, devolver metadatos vacíos
    return {
      title: null,
      description: null,
      language: null,
      authors: [],
      topics: [],
    };
  }
}

/**
 * Valida si una URL es válida (HTTP/HTTPS)
 * @param {string} url
 * @returns {boolean}
 */
export function isValidUrl(url) {
  return baseIsValidUrl(url);
}

/**
 * Construye el mensaje de confirmación para Telegram
 * @param {Object} params
 * @param {string} params.url
 * @param {string|null} params.title
 * @param {string|null} params.description
 * @param {string|null} params.language
 * @param {Array<string>} params.authors
 * @param {Array<string>} params.topics
 * @returns {string}
 */
export function buildConfirmationMessage({
  url,
  title,
  description,
  language,
  authors,
  topics,
}) {
  let message = `✅ ¡Artículo guardado!\n🔗 URL: ${url}`;

  if (title) {
    message += `\n📝 Título: ${title}`;
  }

  if (description) {
    message += `\n📄 Descripción: ${description.substring(0, 200)}${
      description.length > 200 ? "..." : ""
    }`;
  }

  const languageName = translateLanguage(language);
  if (languageName) {
    message += `\n🌍 Idioma: ${languageName}`;
  }

  if (authors && authors.length > 0) {
    message += `\n👥 Autor(es): ${authors.join(", ")}`;
  }

  if (topics && topics.length > 0) {
    message += `\n🏷️ Temas: ${topics.join(", ")}`;
  }

  return message;
}
