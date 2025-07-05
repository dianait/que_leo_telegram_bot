import {
  extractMetadataFromFirecrawl,
  extractMetadataBasic,
  translateLanguage,
} from "../src/metadata-extractor.js";

describe("Metadata Extractor", () => {
  describe("extractMetadataFromFirecrawl", () => {
    test("extrae metadatos correctamente de una respuesta válida de Firecrawl", () => {
      const mockFirecrawlResult = {
        success: true,
        data: {
          title: "Artículo de Prueba",
          metadata: {
            description: "Una descripción de prueba del artículo",
            language: "es",
            author: "Juan Pérez",
            keywords: "prueba, test, artículo",
          },
        },
      };

      const result = extractMetadataFromFirecrawl(mockFirecrawlResult);

      expect(result).toEqual({
        title: "Artículo de Prueba",
        description: "Una descripción de prueba del artículo",
        language: "es",
        authors: ["Juan Pérez"],
        topics: ["prueba", "test", "artículo"],
      });
    });

    test("maneja respuesta de Firecrawl con autores múltiples", () => {
      const mockFirecrawlResult = {
        success: true,
        data: {
          title: "Artículo Múltiple",
          metadata: {
            authors: ["Autor 1", "Autor 2", "Autor 3"],
            tags: ["tag1", "tag2"],
          },
        },
      };

      const result = extractMetadataFromFirecrawl(mockFirecrawlResult);

      expect(result.authors).toEqual(["Autor 1", "Autor 2", "Autor 3"]);
      expect(result.topics).toEqual(["tag1", "tag2"]);
    });

    test("maneja respuesta de Firecrawl vacía o inválida", () => {
      const result = extractMetadataFromFirecrawl(null);

      expect(result).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });

    test("maneja respuesta de Firecrawl sin metadatos", () => {
      const mockFirecrawlResult = {
        success: true,
        data: {
          title: "Solo Título",
        },
      };

      const result = extractMetadataFromFirecrawl(mockFirecrawlResult);

      expect(result.title).toBe("Solo Título");
      expect(result.description).toBeNull();
      expect(result.authors).toEqual([]);
      expect(result.topics).toEqual([]);
    });
  });

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
  });

  describe("translateLanguage", () => {
    test("traduce códigos de idioma correctamente", () => {
      expect(translateLanguage("en")).toBe("Inglés");
      expect(translateLanguage("en-US")).toBe("Inglés");
      expect(translateLanguage("es")).toBe("Castellano");
      expect(translateLanguage("es-ES")).toBe("Castellano");
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
      expect(translateLanguage(undefined)).toBeNull();
    });
  });
});
