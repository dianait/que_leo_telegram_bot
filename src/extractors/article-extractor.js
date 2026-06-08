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

/**
 * Fetches a URL and extracts basic metadata from the HTML.
 * @param {string} url - URL to process
 * @returns {Promise<Object>} Extracted metadata
 */
export async function fetchAndExtractMetadata(url) {
  try {
    const res = await fetch(url);

    if (!res.ok) {
      logger.warn(
        { url, status: res.status, statusText: res.statusText },
        "Metadata fetch returned non-OK response"
      );
      return { ...EMPTY_METADATA };
    }

    const html = await res.text();
    return extractMetadataBasic(html, url);
  } catch (error) {
    logger.warn({ err: error, url }, "Failed to fetch article metadata");
    return { ...EMPTY_METADATA };
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
