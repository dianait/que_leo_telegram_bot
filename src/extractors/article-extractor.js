import { isValidUrl as baseIsValidUrl } from "../utils/validators.js";
import { extractMetadataBasic } from "./metadata-extractor.js";

/**
 * Hace fetch a una URL y extrae metadatos básicos del HTML
 * @param {string} url - URL a procesar
 * @returns {Promise<Object>} Metadatos extraídos
 */
export async function fetchAndExtractMetadata(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    return extractMetadataBasic(html, url);
  } catch (error) {
    // Si hay error, devolver metadatos vacíos
    return {
      title: null,
      description: null,
      language: null,
      authors: [],
      topics: [],
      featuredimage: null,
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
