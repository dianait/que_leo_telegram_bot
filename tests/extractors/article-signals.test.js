import {
  buildArticleSignals,
  classifyContentDepth,
  countWords,
  formatArticleContextForAi,
  getArticleDomain,
} from "../../src/extractors/article-signals.js";

describe("article-signals", () => {
  test("countWords cuenta palabras", () => {
    expect(countWords("Hola mundo desde Node")).toBe(4);
    expect(countWords("")).toBe(0);
  });

  test("getArticleDomain normaliza hostname", () => {
    expect(getArticleDomain("https://www.medium.com/post")).toBe("medium.com");
  });

  test("classifyContentDepth por umbrales de palabras", () => {
    expect(classifyContentDepth(50)).toBe("escaso");
    expect(classifyContentDepth(400)).toBe("medio");
    expect(classifyContentDepth(1200)).toBe("extenso");
  });

  test("buildArticleSignals agrega longitud y profundidad", () => {
    const signals = buildArticleSignals({
      url: "https://dianait.blog/post",
      text: "palabra ".repeat(900),
      authors: ["Diana"],
      publishedAt: "2026-05-08T10:00:00.000Z",
    });

    expect(signals.domain).toBe("dianait.blog");
    expect(signals.authors).toEqual(["Diana"]);
    expect(signals.wordCount).toBe(900);
    expect(signals.readingMinutes).toBeGreaterThan(0);
    expect(signals.contentDepth).toBe("extenso");
  });

  test("formatArticleContextForAi incluye bloque de metadatos", () => {
    const context = formatArticleContextForAi({
      url: "https://medium.com/post",
      title: "SwiftUI tips",
      description: "Tips útiles",
      text: "Contenido del artículo",
      authors: ["Autor"],
      publishedAt: "2026-01-15T00:00:00.000Z",
    });

    expect(context).toContain("Metadatos del artículo:");
    expect(context).toContain("Fuente: medium.com");
    expect(context).toContain("Autor(es): Autor");
    expect(context).toContain("Publicado: 2026-01-15");
    expect(context).toContain("SwiftUI tips");
  });
});
