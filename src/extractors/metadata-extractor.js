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
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extraer idioma
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  const language = langMatch ? langMatch[1] : null;

  // Extraer autor
  const authorMatch = html.match(
    /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i
  );
  const authors = authorMatch ? [authorMatch[1]] : [];

  // Extraer keywords
  const keywordsMatch = html.match(
    /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i
  );
  const topics = keywordsMatch
    ? keywordsMatch[1]
        .split(",")
        .map((t) => t.trim())
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
