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
      });
    });

    test("extrae metadatos de HTML con múltiples autores", () => {
      const mockHtml = `
        <html lang="en">
          <head>
            <title>Multiple Authors Article</title>
            <meta name="author" content="Author 1, Author 2, Author 3">
            <meta name="keywords" content="multiple, authors, test">
          </head>
          <body>Content</body>
        </html>
      `;

      const result = extractMetadataBasic(mockHtml);

      expect(result.title).toBe("Multiple Authors Article");
      expect(result.language).toBe("en");
      expect(result.authors).toEqual(["Author 1, Author 2, Author 3"]);
      expect(result.topics).toEqual(["multiple", "authors", "test"]);
    });

    test("maneja HTML sin metadatos", () => {
      const mockHtml =
        "<html><head><title>Solo Título</title></head><body></body></html>";

      const result = extractMetadataBasic(mockHtml);

      expect(result.title).toBe("Solo Título");
      expect(result.language).toBeNull();
      expect(result.authors).toEqual([]);
      expect(result.topics).toEqual([]);
    });

    test("maneja HTML vacío o inválido", () => {
      const result = extractMetadataBasic("");

      expect(result).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });

    test("maneja HTML malformado", () => {
      const badHtml = "<html><head><title>Bad HTML</head><body>";
      const result = extractMetadataBasic(badHtml);

      expect(result.title).toBeNull();
      expect(result.language).toBeNull();
      expect(result.authors).toEqual([]);
      expect(result.topics).toEqual([]);
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
      expect(translateLanguage("ar")).toBe("ar");
    });

    test("maneja valores nulos o vacíos", () => {
      expect(translateLanguage(null)).toBeNull();
      expect(translateLanguage("")).toBeNull();
      expect(translateLanguage(undefined)).toBeNull();
    });

    test("maneja códigos de idioma en mayúsculas", () => {
      expect(translateLanguage("EN")).toBe("Inglés");
      expect(translateLanguage("ES")).toBe("Castellano");
      expect(translateLanguage("FR")).toBe("FR");
    });
  });
});
