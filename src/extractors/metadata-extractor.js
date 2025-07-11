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
 * Extrae la imagen destacada del HTML
 * @param {string} html - HTML de la página
 * @param {string} baseUrl - URL base para resolver URLs relativas
 * @returns {string|null} URL de la imagen destacada
 */
function extractFeaturedImage(html, baseUrl) {
  if (!html) return null;

  // 1. Buscar en Open Graph
  const ogImageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogImageMatch) {
    return resolveUrl(ogImageMatch[1], baseUrl);
  }

  // 2. Buscar en Twitter Cards
  const twitterImageMatch = html.match(
    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
  );
  if (twitterImageMatch) {
    return resolveUrl(twitterImageMatch[1], baseUrl);
  }

  // 3. Buscar en meta tags genéricos
  const metaImageMatch = html.match(
    /<meta[^>]*name=["']image["'][^>]*content=["']([^"']+)["']/i
  );
  if (metaImageMatch) {
    return resolveUrl(metaImageMatch[1], baseUrl);
  }

  // 4. Buscar la primera imagen del contenido (excluyendo iconos y logos pequeños)
  const imgMatches = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
  if (imgMatches) {
    for (const imgTag of imgMatches) {
      const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        const imgUrl = srcMatch[1];

        // Filtrar imágenes pequeñas, iconos, logos, etc.
        if (shouldIncludeImage(imgTag, imgUrl)) {
          return resolveUrl(imgUrl, baseUrl);
        }
      }
    }
  }

  return null;
}

/**
 * Determina si una imagen debe ser incluida como destacada
 * @param {string} imgTag - Tag completo de la imagen
 * @param {string} imgUrl - URL de la imagen
 * @returns {boolean}
 */
function shouldIncludeImage(imgTag, imgUrl) {
  // Excluir imágenes muy pequeñas
  const widthMatch = imgTag.match(/width=["'](\d+)["']/i);
  const heightMatch = imgTag.match(/height=["'](\d+)["']/i);

  if (widthMatch && heightMatch) {
    const width = parseInt(widthMatch[1]);
    const height = parseInt(heightMatch[1]);
    if (width < 200 || height < 200) return false;
  }

  // Excluir iconos, logos, avatares
  const excludePatterns = [
    /icon/i,
    /logo/i,
    /avatar/i,
    /profile/i,
    /thumb/i,
    /small/i,
    /favicon/i,
    /sprite/i,
    /button/i,
    /banner/i,
    /ad/i,
    /ads/i,
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(imgUrl) || pattern.test(imgTag)) {
      return false;
    }
  }

  // Excluir imágenes de tracking/analytics
  if (
    imgUrl.includes("tracking") ||
    imgUrl.includes("analytics") ||
    imgUrl.includes("pixel")
  ) {
    return false;
  }

  return true;
}

/**
 * Resuelve URLs relativas a absolutas
 * @param {string} url - URL a resolver
 * @param {string} baseUrl - URL base
 * @returns {string} URL absoluta
 */
function resolveUrl(url, baseUrl) {
  if (!url) return null;

  // Si ya es una URL absoluta, devolverla
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Si es una URL relativa, resolverla
  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    console.warn("Error resolviendo URL:", error);
    return url;
  }
}

/**
 * Extrae metadatos usando extracción básica con regex
 * @param {string} html - HTML de la página
 * @param {string} baseUrl - URL base para resolver URLs relativas
 * @returns {Object} Metadatos extraídos
 */
export function extractMetadataBasic(html, baseUrl = null) {
  if (!html) {
    return {
      title: null,
      description: null,
      language: null,
      authors: [],
      topics: [],
      featuredimage: null,
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

  // Extraer imagen destacada
  const featuredimage = extractFeaturedImage(html, baseUrl);

  return {
    title,
    description: null, // No extraemos descripción en modo básico
    language,
    authors,
    topics,
    featuredimage,
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
