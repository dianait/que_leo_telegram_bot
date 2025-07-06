/**
 * Decodifica entidades HTML comunes
 * @param {string} text - Texto con entidades HTML
 * @returns {string} Texto decodificado
 */
function decodeHtmlEntities(text) {
  if (!text) return text;

  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™");
}

/**
 * Extrae metadatos usando extracción básica con regex
 * @param {string} html - HTML de la página
 * @returns {Object} Metadatos extraídos
 */
export function extractMetadataBasic(html) {
  if (!html) {
    return {
      title: null,
      description: null,
      language: null,
      authors: [],
      topics: [],
    };
  }

  // Extraer título
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;

  // Extraer idioma
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  const language = langMatch ? langMatch[1] : null;

  // Extraer autor
  const authorMatch = html.match(
    /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i
  );
  const authors = authorMatch ? [decodeHtmlEntities(authorMatch[1])] : [];

  // Extraer keywords
  const keywordsMatch = html.match(
    /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i
  );
  const topics = keywordsMatch
    ? keywordsMatch[1]
        .split(",")
        .map((t) => decodeHtmlEntities(t.trim()))
        .filter(Boolean)
    : [];

  return {
    title,
    description: null, // No extraemos descripción en modo básico
    language,
    authors,
    topics,
  };
}

/**
 * Traduce códigos de idioma a nombres legibles
 * @param {string} language - Código de idioma
 * @returns {string} Nombre del idioma
 */
export function translateLanguage(language) {
  if (!language) return null;
  const lang = language.toLowerCase();
  if (lang.startsWith("en")) return "Inglés";
  if (lang.startsWith("es")) return "Castellano";
  return language;
}
