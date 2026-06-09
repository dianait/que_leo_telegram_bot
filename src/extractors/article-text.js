const DEFAULT_MAX_TEXT_LENGTH = 12_000;

/**
 * Extrae texto legible del HTML de un artículo.
 * @param {string} html
 * @param {number} [maxLength]
 * @returns {string}
 */
export function extractTextFromHtml(html, maxLength = DEFAULT_MAX_TEXT_LENGTH) {
  if (!html) return "";

  let content = html;
  for (const tag of ["article", "main"]) {
    const match = html.match(
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
    );
    if (match && match[1].length > 80) {
      content = match[1];
      break;
    }
  }

  content = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (content.length > maxLength) {
    return `${content.slice(0, maxLength)}...`;
  }

  return content;
}
