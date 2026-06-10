import {
  authorsNeedCleanup,
  normalizeAuthors,
} from "../utils/author-normalizer.js";

const BAD_TITLE_PATTERNS = [
  /^just a moment/i,
  /^checking your browser/i,
  /^\(sin título\)$/i,
];

export const MIN_TOPICS = 3;

/**
 * @param {string|null|undefined} title
 * @returns {boolean}
 */
export function isMissingOrBadTitle(title) {
  if (!title?.trim()) {
    return true;
  }

  return BAD_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

/**
 * @param {string[]|null|undefined} topics
 * @returns {boolean}
 */
export function needsTopicsBackfill(topics) {
  return (topics?.length ?? 0) < MIN_TOPICS;
}

/**
 * @param {{ title?: string|null, authors?: string[]|null, language?: string|null, topics?: string[]|null, featured_image?: string|null }} article
 * @returns {boolean}
 */
export function needsMetadataBackfill(article) {
  return (
    isMissingOrBadTitle(article.title) ||
    authorsNeedCleanup(article.authors) ||
    !article.language ||
    needsTopicsBackfill(article.topics) ||
    !article.featured_image
  );
}

/**
 * @param {{ ai_summary?: string|null, ai_rating?: number|null }} userArticle
 * @returns {boolean}
 */
export function needsAiBackfill(userArticle) {
  return (
    userArticle.ai_rating == null ||
    !userArticle.ai_summary?.trim() ||
    !userArticle.ai_rating_reason?.trim()
  );
}

/**
 * @param {object} existing
 * @param {object} fetched
 * @returns {object|null}
 */
export function buildMetadataPatch(existing, fetched) {
  const patch = {};

  if (
    isMissingOrBadTitle(existing.title) &&
    fetched.title &&
    !isMissingOrBadTitle(fetched.title)
  ) {
    patch.title = fetched.title;
  }

  if (!existing.language && fetched.language) {
    patch.language = fetched.language;
  }

  const existingAuthors = existing.authors ?? [];
  const resolvedAuthors = normalizeAuthors(
    fetched.authors?.length ? fetched.authors : existingAuthors
  );

  if (!existingAuthors.length && resolvedAuthors.length) {
    patch.authors = resolvedAuthors;
  } else if (authorsNeedCleanup(existingAuthors)) {
    patch.authors = resolvedAuthors;
  }

  if (needsTopicsBackfill(existing.topics)) {
    const merged = [
      ...new Set([...(existing.topics ?? []), ...(fetched.topics ?? [])]),
    ];
    if (merged.length > (existing.topics?.length ?? 0)) {
      patch.topics = merged;
    }
  } else if (!existing.topics?.length && fetched.topics?.length) {
    patch.topics = fetched.topics;
  }

  if (!existing.featured_image && fetched.featured_image) {
    patch.featured_image = fetched.featured_image;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Maps extractor metadata to article table column names.
 * @param {object} metadata
 * @returns {object}
 */
export function mapExtractedMetadata(metadata) {
  return {
    title: metadata.title ?? null,
    language: metadata.language ?? null,
    authors: normalizeAuthors(metadata.authors ?? []),
    topics: metadata.topics ?? [],
    featured_image: metadata.featuredimage ?? metadata.featured_image ?? null,
  };
}
