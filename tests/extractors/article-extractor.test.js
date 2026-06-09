import jest from "jest-mock";
import {
  fetchAndExtractMetadata,
  fetchArticleContent,
} from "../../src/extractors/article-extractor.js";

global.fetch = jest.fn();

describe("Article Extractor", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test("envía headers de navegador al hacer fetch", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      url: "https://example.com/post",
      text: () =>
        Promise.resolve(
          "<html><head><title>Mi artículo</title></head><body></body></html>"
        ),
    });

    await fetchAndExtractMetadata("https://example.com/post");

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/post",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("Mozilla"),
          "Accept-Language": expect.stringContaining("en-US"),
        }),
      })
    );
  });

  test("extrae og:title de Medium", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      url: "https://medium.com/@user/my-article-abc123def456",
      text: () =>
        Promise.resolve(`
        <html lang="en">
          <head>
            <title>My Article | by Author | Medium</title>
            <meta property="og:title" content="My Article"/>
            <meta property="og:description" content="A short summary."/>
            <meta property="og:image" content="https://cdn.example.com/cover.jpg"/>
          </head>
        </html>
      `),
    });

    const metadata = await fetchAndExtractMetadata(
      "https://medium.com/@user/my-article-abc123def456"
    );

    expect(metadata.title).toBe("My Article");
    expect(metadata.description).toBe("A short summary.");
    expect(metadata.featuredimage).toBe("https://cdn.example.com/cover.jpg");
  });

  test("usa el slug de la URL como fallback si la respuesta es 403", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      url: "https://medium.com/@user/how-to-learn-rust-abc123def456",
    });

    const metadata = await fetchAndExtractMetadata(
      "https://medium.com/@user/how-to-learn-rust-abc123def456"
    );

    expect(metadata.title).toBe("How To Learn Rust");
    expect(metadata.description).toBeNull();
  });

  test("fetchArticleContent extrae título, descripción y texto", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      url: "https://example.com/post",
      text: () =>
        Promise.resolve(`
        <html>
          <head>
            <title>Mi artículo</title>
            <meta property="og:description" content="Resumen corto"/>
          </head>
          <body>
            <article><p>Contenido principal del artículo.</p></article>
          </body>
        </html>
      `),
    });

    const content = await fetchArticleContent("https://example.com/post");

    expect(content.title).toBe("Mi artículo");
    expect(content.description).toBe("Resumen corto");
    expect(content.text).toContain("Contenido principal del artículo");
  });

  test("devuelve metadatos vacíos si fetch falla sin slug útil", async () => {
    fetch.mockRejectedValueOnce(new Error("Network error"));

    const metadata = await fetchAndExtractMetadata("https://example.com/");

    expect(metadata).toEqual({
      title: null,
      description: null,
      language: null,
      authors: [],
      topics: [],
      featuredimage: null,
      publishedAt: null,
    });
  });

  test("extrae fecha de publicación y autor", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      url: "https://dianait.blog/post",
      text: () =>
        Promise.resolve(`
        <html>
          <head>
            <title>Post</title>
            <meta property="article:published_time" content="2026-05-08T09:00:00.000Z"/>
            <meta property="article:author" content="Diana"/>
          </head>
          <body><p>Contenido</p></body>
        </html>
      `),
    });

    const content = await fetchArticleContent("https://dianait.blog/post");

    expect(content.publishedAt).toBe("2026-05-08T09:00:00.000Z");
    expect(content.authors).toEqual(["Diana"]);
    expect(content.url).toBe("https://dianait.blog/post");
  });
});
