import { getArticleDomain } from "../extractors/article-signals.js";

const DEFAULT_HISTORY_MIN_RATING = 7;
const DEFAULT_HISTORY_MAX_ARTICLES = 15;

/**
 * @returns {number}
 */
export function getHistoryMinRating() {
  const value = Number(process.env.OLLAMA_HISTORY_MIN_RATING);
  return Number.isFinite(value) && value >= 1 && value <= 10
    ? value
    : DEFAULT_HISTORY_MIN_RATING;
}

/**
 * @returns {number}
 */
export function getHistoryMaxArticles() {
  const value = Number(process.env.OLLAMA_HISTORY_MAX_ARTICLES);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_HISTORY_MAX_ARTICLES;
}

/**
 * @param {Map<string, number>} counts
 * @param {number} limit
 * @returns {Array<{ name: string, count: number }>}
 */
function topCounted(counts, limit) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * @param {Array<{ ai_rating: number, title?: string|null, url?: string|null, authors?: string[], topics?: string[] }>} entries
 * @returns {{
 *   totalArticles: number,
 *   authors: Array<{ name: string, count: number }>,
 *   topics: Array<{ name: string, count: number }>,
 *   domains: Array<{ name: string, count: number }>,
 *   samples: Array<{ title: string, rating: number }>,
 * }}
 */
export function buildTasteProfileFromHistory(entries) {
  const authorCounts = new Map();
  const topicCounts = new Map();
  const domainCounts = new Map();

  for (const entry of entries ?? []) {
    for (const author of entry.authors ?? []) {
      const normalized = author.trim();
      if (!normalized) continue;
      authorCounts.set(normalized, (authorCounts.get(normalized) ?? 0) + 1);
    }

    for (const topic of entry.topics ?? []) {
      const normalized = topic.trim();
      if (!normalized) continue;
      topicCounts.set(normalized, (topicCounts.get(normalized) ?? 0) + 1);
    }

    const domain = entry.url ? getArticleDomain(entry.url) : null;
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  return {
    totalArticles: entries?.length ?? 0,
    authors: topCounted(authorCounts, 5),
    topics: topCounted(topicCounts, 8),
    domains: topCounted(domainCounts, 5),
    samples: (entries ?? [])
      .filter((entry) => entry.title)
      .slice(0, 5)
      .map((entry) => ({
        title: entry.title,
        rating: entry.ai_rating,
      })),
  };
}

/**
 * @param {Array<{ name: string, count: number }>} items
 * @returns {string}
 */
function formatCountedList(items) {
  if (items.length === 0) {
    return "sin datos";
  }

  return items.map((item) => `${item.name} (${item.count})`).join(", ");
}

/**
 * @param {ReturnType<typeof buildTasteProfileFromHistory>} profile
 * @returns {string|null}
 */
export function formatTasteProfileForPrompt(profile) {
  if (!profile?.totalArticles) {
    return null;
  }

  const samples = profile.samples
    .map((sample) => `"${sample.title}" (${sample.rating}/10)`)
    .join("; ");

  return `- Artículos de referencia analizados: ${profile.totalArticles}
- Autores que suele valorar alto: ${formatCountedList(profile.authors)}
- Temas recurrentes en sus mejores valoraciones: ${formatCountedList(profile.topics)}
- Fuentes habituales: ${formatCountedList(profile.domains)}
- Ejemplos recientes: ${samples || "sin títulos"}
Usa este historial real junto con las preferencias generales para personalizar la valoración.`;
}
