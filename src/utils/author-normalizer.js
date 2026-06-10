const PLACEHOLDER_AUTHOR =
  /^(desconocido|unknown|n\/a|sin autor|anonymous|anónimo)$/i;

/**
 * @param {string|null|undefined} author
 * @returns {boolean}
 */
export function isPlaceholderAuthor(author) {
  const trimmed = author?.trim();
  return Boolean(trimmed && PLACEHOLDER_AUTHOR.test(trimmed));
}

/**
 * @param {string|null|undefined} author
 * @returns {string|null}
 */
export function normalizeAuthor(author) {
  const trimmed = author?.trim();
  if (!trimmed || isPlaceholderAuthor(trimmed)) {
    return null;
  }

  const mediumHandle = trimmed.match(/medium\.com\/@([a-zA-Z0-9_-]+)/i);
  if (mediumHandle) {
    return `@${mediumHandle[1]}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const handle = trimmed.match(/@([a-zA-Z0-9_-]+)/);
    if (handle) {
      return `@${handle[1]}`;
    }

    return null;
  }

  return trimmed;
}

/**
 * @param {string[]|null|undefined} authors
 * @returns {string[]}
 */
export function normalizeAuthors(authors) {
  return [
    ...new Set((authors ?? []).map(normalizeAuthor).filter(Boolean)),
  ];
}

/**
 * @param {string[]|null|undefined} authors
 * @returns {boolean}
 */
export function authorsNeedCleanup(authors) {
  if (!authors?.length) {
    return false;
  }

  const normalized = normalizeAuthors(authors);
  if (normalized.length !== authors.length) {
    return true;
  }

  return authors.some((author, index) => author?.trim() !== normalized[index]);
}
