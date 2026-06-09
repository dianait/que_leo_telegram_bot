/**
 * Extrae el atributo content de un meta tag por property o name.
 * Soporta ambos órdenes de atributos (property/content o content/property).
 * @param {string} html
 * @param {{ property?: string, name?: string }} selector
 * @returns {string|null}
 */
function extractMetaContent(html, { property, name }) {
  if (!html) return null;

  const attr = property ? "property" : "name";
  const value = property ?? name;
  const patterns = [
    new RegExp(
      `<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${value}["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1].trim());
  }

  return null;
}

/**
 * Limpia títulos largos de sitios como Medium ("Título | by Autor | Medium").
 * @param {string|null} title
 * @returns {string|null}
 */
function cleanPageTitle(title) {
  if (!title) return null;
  if (title === "Medium") return null;

  const byIndex = title.indexOf(" | by ");
  if (byIndex > 0) return title.slice(0, byIndex).trim();

  const withoutMedium = title.replace(/\s*\|\s*Medium\s*$/i, "").trim();
  return withoutMedium || title;
}

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
      publishedAt: null,
    };
  }

  // Extraer título (og:title es más fiable en sitios como Medium)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
  const title =
    extractMetaContent(html, { property: "og:title" }) ??
    extractMetaContent(html, { name: "twitter:title" }) ??
    cleanPageTitle(rawTitle);

  const description =
    extractMetaContent(html, { property: "og:description" }) ??
    extractMetaContent(html, { name: "description" });

  // Extraer idioma
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  const language = langMatch ? langMatch[1] : null;

  // Extraer autor
  const authorFromMeta =
    extractMetaContent(html, { property: "article:author" }) ??
    extractMetaContent(html, { name: "author" }) ??
    extractMetaContent(html, { name: "twitter:creator" });
  const authors = authorFromMeta ? [decodeHtmlEntities(authorFromMeta)] : [];

  const publishedAt =
    extractMetaContent(html, { property: "article:published_time" }) ??
    extractMetaContent(html, { property: "article:modified_time" }) ??
    extractMetaContent(html, { name: "date" });

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
    description,
    language,
    authors,
    topics,
    featuredimage,
    publishedAt,
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
