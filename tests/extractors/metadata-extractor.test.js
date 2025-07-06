import {
  extractMetadataBasic,
  translateLanguage,
} from "../../src/extractors/metadata-extractor.js";

describe("Metadata Extractor", () => {
  describe("extractMetadataBasic", () => {
    test("extrae metadatos básicos de HTML válido", () => {
      const mockHtml = `
        <html lang="es">
          <head>
            <title>Artículo Básico</title>
            <meta name="author" content="María García">
            <meta name="keywords" content="básico, html, test">
          </head>
          <body>Contenido</body>
        </html>
      `;

      const result = extractMetadataBasic(mockHtml);

      expect(result).toEqual({
        title: "Artículo Básico",
        description: null,
        language: "es",
        authors: ["María García"],
        topics: ["básico", "html", "test"],
        featuredimage: null,
      });
    });

    test("extrae imagen destacada de Open Graph", () => {
      const html = `
        <html>
          <head>
            <title>Test Article</title>
            <meta property="og:image" content="https://example.com/image.jpg">
          </head>
          <body>Content</body>
        </html>
      `;
      const result = extractMetadataBasic(html, "https://example.com");
      expect(result.featuredimage).toBe("https://example.com/image.jpg");
    });

    test("extrae imagen destacada de Twitter Cards", () => {
      const html = `
        <html>
          <head>
            <title>Test Article</title>
            <meta name="twitter:image" content="https://example.com/twitter-image.jpg">
          </head>
          <body>Content</body>
        </html>
      `;
      const result = extractMetadataBasic(html, "https://example.com");
      expect(result.featuredimage).toBe(
        "https://example.com/twitter-image.jpg"
      );
    });

    test("extrae imagen destacada de meta tag genérico", () => {
      const html = `
        <html>
          <head>
            <title>Test Article</title>
            <meta name="image" content="https://example.com/meta-image.jpg">
          </head>
          <body>Content</body>
        </html>
      `;
      const result = extractMetadataBasic(html, "https://example.com");
      expect(result.featuredimage).toBe("https://example.com/meta-image.jpg");
    });

    test("extrae imagen destacada del contenido HTML", () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <img src="https://example.com/content-image.jpg" width="800" height="600" alt="Content Image">
            <img src="https://example.com/small-icon.png" width="16" height="16" alt="Icon">
          </body>
        </html>
      `;
      const result = extractMetadataBasic(html, "https://example.com");
      expect(result.featuredimage).toBe(
        "https://example.com/content-image.jpg"
      );
    });

    test("resuelve URLs relativas correctamente", () => {
      const html = `
        <html>
          <head>
            <title>Test Article</title>
            <meta property="og:image" content="/images/featured.jpg">
          </head>
          <body>Content</body>
        </html>
      `;
      const result = extractMetadataBasic(html, "https://example.com");
      expect(result.featuredimage).toBe(
        "https://example.com/images/featured.jpg"
      );
    });

    test("filtra imágenes pequeñas e iconos", () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <img src="https://example.com/icon.png" width="32" height="32" alt="Icon">
            <img src="https://example.com/logo.png" alt="Logo">
            <img src="https://example.com/featured.jpg" width="800" height="600" alt="Featured">
          </body>
        </html>
      `;
      const result = extractMetadataBasic(html, "https://example.com");
      expect(result.featuredimage).toBe("https://example.com/featured.jpg");
    });

    test("decodifica entidades HTML en el título", () => {
      const html =
        "<html><head><title>In Praise of &#8220;Normal&#8221; Engineers &#8211; charity.wtf</title></head><body></body></html>";
      const result = extractMetadataBasic(html);
      expect(result.title).toBe(
        'In Praise of "Normal" Engineers – charity.wtf'
      );
    });

    test("decodifica entidades HTML en autores", () => {
      const html =
        '<html><head><meta name="author" content="John &#8217;Smith"></head><body></body></html>';
      const result = extractMetadataBasic(html);
      expect(result.authors).toEqual(["John 'Smith"]);
    });

    test("decodifica entidades HTML en keywords", () => {
      const html =
        '<html><head><meta name="keywords" content="engineering, &#8220;best practices&#8221;"></head><body></body></html>';
      const result = extractMetadataBasic(html);
      expect(result.topics).toEqual(["engineering", '"best practices"']);
    });

    test("maneja HTML sin metadatos", () => {
      const mockHtml =
        "<html><head><title>Solo Título</title></head><body></body></html>";

      const result = extractMetadataBasic(mockHtml);

      expect(result.title).toBe("Solo Título");
      expect(result.language).toBeNull();
      expect(result.authors).toEqual([]);
      expect(result.topics).toEqual([]);
      expect(result.featuredimage).toBeNull();
    });

    test("maneja HTML vacío o inválido", () => {
      const result = extractMetadataBasic("");

      expect(result).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
        featuredimage: null,
      });
    });

    test("maneja HTML malformado", () => {
      const badHtml = "<html><head><title>Bad HTML</head><body>";
      const result = extractMetadataBasic(badHtml);

      expect(result.title).toBeNull();
      expect(result.language).toBeNull();
      expect(result.authors).toEqual([]);
      expect(result.topics).toEqual([]);
      expect(result.featuredimage).toBeNull();
    });

    test("extrae metadatos con diferentes formatos de lang", () => {
      const html1 = '<html lang="en-US">';
      const html2 = '<html lang="es-ES">';
      const html3 = '<html lang="fr">';

      const result1 = extractMetadataBasic(html1);
      const result2 = extractMetadataBasic(html2);
      const result3 = extractMetadataBasic(html3);

      expect(result1.language).toBe("en-US");
      expect(result2.language).toBe("es-ES");
      expect(result3.language).toBe("fr");
    });

    test("extrae keywords con diferentes separadores", () => {
      const html1 = '<meta name="keywords" content="tag1, tag2, tag3">';
      const html2 = '<meta name="keywords" content="tag1,tag2,tag3">';
      const html3 = '<meta name="keywords" content="tag1,  tag2  , tag3">';

      const result1 = extractMetadataBasic(html1);
      const result2 = extractMetadataBasic(html2);
      const result3 = extractMetadataBasic(html3);

      expect(result1.topics).toEqual(["tag1", "tag2", "tag3"]);
      expect(result2.topics).toEqual(["tag1", "tag2", "tag3"]);
      expect(result3.topics).toEqual(["tag1", "tag2", "tag3"]);
    });

    test("maneja keywords vacías o con espacios", () => {
      const html1 = '<meta name="keywords" content="">';
      const html2 = '<meta name="keywords" content="   ">';
      const html3 = '<meta name="keywords" content="tag1, , tag2, , tag3">';

      const result1 = extractMetadataBasic(html1);
      const result2 = extractMetadataBasic(html2);
      const result3 = extractMetadataBasic(html3);

      expect(result1.topics).toEqual([]);
      expect(result2.topics).toEqual([]);
      expect(result3.topics).toEqual(["tag1", "tag2", "tag3"]);
    });
  });

  describe("translateLanguage", () => {
    test("traduce códigos de idioma correctamente", () => {
      expect(translateLanguage("en")).toBe("Inglés");
      expect(translateLanguage("en-US")).toBe("Inglés");
      expect(translateLanguage("en-GB")).toBe("Inglés");
      expect(translateLanguage("es")).toBe("Castellano");
      expect(translateLanguage("es-ES")).toBe("Castellano");
      expect(translateLanguage("es-MX")).toBe("Castellano");
    });

    test("devuelve el código original para idiomas no reconocidos", () => {
      expect(translateLanguage("fr")).toBe("fr");
      expect(translateLanguage("de")).toBe("de");
      expect(translateLanguage("it")).toBe("it");
      expect(translateLanguage("pt")).toBe("pt");
      expect(translateLanguage("ru")).toBe("ru");
      expect(translateLanguage("ja")).toBe("ja");
      expect(translateLanguage("zh")).toBe("zh");
    });

    test("maneja valores nulos o vacíos", () => {
      expect(translateLanguage(null)).toBeNull();
      expect(translateLanguage("")).toBeNull();
    });

    test("acepta mayúsculas y minúsculas", () => {
      expect(translateLanguage("EN")).toBe("Inglés");
      expect(translateLanguage("ES")).toBe("Castellano");
      expect(translateLanguage("FR")).toBe("FR");
    });
  });
});
