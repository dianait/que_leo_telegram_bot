import { extractTextFromHtml } from "../../src/extractors/article-text.js";

describe("Article Text Extractor", () => {
  test("extrae texto limpio de HTML simple", () => {
    const html = `
      <html>
        <body>
          <p>Primer párrafo del artículo.</p>
          <p>Segundo párrafo con más contenido.</p>
        </body>
      </html>
    `;

    const text = extractTextFromHtml(html);

    expect(text).toContain("Primer párrafo del artículo.");
    expect(text).toContain("Segundo párrafo con más contenido.");
    expect(text).not.toContain("<p>");
  });

  test("prioriza el contenido dentro de article", () => {
    const html = `
      <html>
        <body>
          <nav>Menú de navegación largo que no interesa</nav>
          <article>
            <h1>Título real</h1>
            <p>Contenido principal del artículo que debe extraerse.</p>
          </article>
        </body>
      </html>
    `;

    const text = extractTextFromHtml(html);

    expect(text).toContain("Contenido principal del artículo");
    expect(text).not.toContain("Menú de navegación");
  });

  test("elimina scripts y estilos", () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
          <script>alert("hola")</script>
        </head>
        <body><p>Texto visible</p></body>
      </html>
    `;

    const text = extractTextFromHtml(html);

    expect(text).toBe("Texto visible");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color: red");
  });

  test("trunca texto muy largo", () => {
    const html = `<html><body><p>${"a".repeat(200)}</p></body></html>`;
    const text = extractTextFromHtml(html, 50);

    expect(text.length).toBe(53);
    expect(text.endsWith("...")).toBe(true);
  });

  test("devuelve cadena vacía para HTML vacío", () => {
    expect(extractTextFromHtml("")).toBe("");
    expect(extractTextFromHtml(null)).toBe("");
  });
});
