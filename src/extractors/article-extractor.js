import { isValidUrl as baseIsValidUrl } from "../utils/validators.js";
import { extractMetadataBasic } from "./metadata-extractor.js";
import { logger } from "../utils/logger.js";

const EMPTY_METADATA = {
  title: null,
  description: null,
  language: null,
  authors: [],
  topics: [],
  featuredimage: null,
};

const ARTICLE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
};

/**
 * Derives a readable title from the last URL path segment (e.g. Medium slugs).
 * @param {string} url
 * @returns {string|null}
 */
function titleFromUrlSlug(url) {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || last.startsWith("@")) return null;

    const slug = last.replace(/-[a-f0-9]{12}$/i, "");
    if (slug.length < 3) return null;

    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

/**
 * Fetches a URL and extracts basic metadata from the HTML.
 * @param {string} url - URL to process
 * @returns {Promise<Object>} Extracted metadata
 */
export async function fetchAndExtractMetadata(url) {
  try {
    const res = await fetch(url, { headers: ARTICLE_FETCH_HEADERS });

    if (!res.ok) {
      logger.warn(
        {
          url,
          finalUrl: res.url,
          status: res.status,
          statusText: res.statusText,
          hostname: new URL(url).hostname,
        },
        res.status === 403
          ? "Metadata fetch blocked (403) — el sitio rechazó la petición"
          : "Metadata fetch returned non-OK response"
      );

      const fallbackTitle = titleFromUrlSlug(url);
      return fallbackTitle
        ? { ...EMPTY_METADATA, title: fallbackTitle }
        : { ...EMPTY_METADATA };
    }

    const html = await res.text();
    const metadata = extractMetadataBasic(html, url);

    if (!metadata.title || metadata.title === "Medium") {
      const fallbackTitle = titleFromUrlSlug(url);
      if (fallbackTitle) {
        metadata.title = fallbackTitle;
      }
    }

    return metadata;
  } catch (error) {
    logger.warn({ err: error, url }, "Failed to fetch article metadata");
    const fallbackTitle = titleFromUrlSlug(url);
    return fallbackTitle
      ? { ...EMPTY_METADATA, title: fallbackTitle }
      : { ...EMPTY_METADATA };
  }
}

/**
 * Validates whether a URL uses HTTP or HTTPS.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidUrl(url) {
  return baseIsValidUrl(url);
}
