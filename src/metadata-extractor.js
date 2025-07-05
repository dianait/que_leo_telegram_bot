/**
 * Extrae metadatos de una respuesta de Firecrawl
 * @param {Object} firecrawlResult - Resultado de Firecrawl
 * @returns {Object} Metadatos extraídos
 */
export function extractMetadataFromFirecrawl(firecrawlResult) {
  if (!firecrawlResult || !firecrawlResult.success || !firecrawlResult.data) {
    return {
      title: null,
      description: null,
      language: null,
      authors: [],
      topics: [],
    };
  }

  const metadata = firecrawlResult.data.metadata || {};

  // Extraer título
  const title = firecrawlResult.data.title || metadata.title || null;

  // Extraer descripción
  const description = metadata.description || null;

  // Extraer idioma
  const language = metadata.language || null;

  // Extraer autores
  let authors = [];
  if (metadata.author) {
    authors = Array.isArray(metadata.author)
      ? metadata.author
      : [metadata.author];
  } else if (metadata.authors) {
    authors = Array.isArray(metadata.authors)
      ? metadata.authors
      : [metadata.authors];
  }

  // Extraer temas/keywords
  let topics = [];
  if (metadata.keywords) {
    topics = Array.isArray(metadata.keywords)
      ? metadata.keywords
      : metadata.keywords
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
  } else if (metadata.tags) {
    topics = Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags];
  }

  return {
    title,
    description,
    language,
    authors,
    topics,
  };
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
  if (language.startsWith("en")) return "Inglés";
  if (language.startsWith("es")) return "Castellano";
  return language;
}
