const WORDS_PER_MINUTE = 200;

/**
 * @param {string|null|undefined} text
 * @returns {number}
 */
export function countWords(text) {
  if (!text?.trim()) {
    return 0;
  }

  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * @param {number} wordCount
 * @param {number} [wordsPerMinute]
 * @returns {number}
 */
export function estimateReadingMinutes(wordCount, wordsPerMinute = WORDS_PER_MINUTE) {
  if (wordCount <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(wordCount / wordsPerMinute));
}

/**
 * @param {string} url
 * @returns {string|null}
 */
export function getArticleDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * @param {number} wordCount
 * @returns {"escaso"|"medio"|"extenso"}
 */
export function classifyContentDepth(wordCount) {
  if (wordCount < 200) {
    return "escaso";
  }

  if (wordCount < 800) {
    return "medio";
  }

  return "extenso";
}

/**
 * @param {number} wordCount
 * @returns {string}
 */
export function describeExtractionQuality(wordCount) {
  if (wordCount === 0) {
    return "Sin texto extraído; valora solo con título y descripción.";
  }

  if (wordCount < 150) {
    return "Muy poco texto extraído; el artículo podría ser breve o estar recortado en el HTML.";
  }

  if (wordCount < 400) {
    return "Texto parcial o artículo corto.";
  }

  return "Texto extenso extraído del HTML.";
}

/**
 * @param {string|null|undefined} publishedAt
 * @returns {string}
 */
export function formatPublishedDate(publishedAt) {
  if (!publishedAt) {
    return "desconocida";
  }

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    return publishedAt;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * @param {{
 *   url: string,
 *   title?: string|null,
 *   description?: string|null,
 *   text?: string,
 *   authors?: string[],
 *   publishedAt?: string|null,
 * }} article
 * @returns {{
 *   domain: string|null,
 *   authors: string[],
 *   publishedAt: string|null,
 *   wordCount: number,
 *   readingMinutes: number,
 *   contentDepth: "escaso"|"medio"|"extenso",
 *   extractionNote: string,
 * }}
 */
export function buildArticleSignals(article) {
  const wordCount = countWords(article.text);

  return {
    domain: getArticleDomain(article.url),
    authors: article.authors ?? [],
    publishedAt: article.publishedAt ?? null,
    wordCount,
    readingMinutes: estimateReadingMinutes(wordCount),
    contentDepth: classifyContentDepth(wordCount),
    extractionNote: describeExtractionQuality(wordCount),
  };
}

/**
 * @param {{
 *   url: string,
 *   title?: string|null,
 *   description?: string|null,
 *   text?: string,
 *   authors?: string[],
 *   publishedAt?: string|null,
 * }} article
 * @returns {string}
 */
export function formatArticleContextForAi(article) {
  const signals = buildArticleSignals(article);
  const authors =
    signals.authors.length > 0 ? signals.authors.join(", ") : "desconocido";

  const metadataBlock = `Metadatos del artículo:
- Fuente: ${signals.domain ?? "desconocida"}
- Autor(es): ${authors}
- Publicado: ${formatPublishedDate(signals.publishedAt)}
- Longitud: ${signals.wordCount} palabras (~${signals.readingMinutes} min lectura)
- Profundidad aparente: ${signals.contentDepth}
- Extracción: ${signals.extractionNote}`;

  return `${metadataBlock}

URL: ${article.url}
Título: ${article.title || "(sin título)"}
Descripción: ${article.description || "(sin descripción)"}
Contenido:
${article.text?.trim() || "(sin texto extraído — usa título y descripción para el resumen)"}`;
}
