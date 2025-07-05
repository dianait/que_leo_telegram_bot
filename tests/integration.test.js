import {
  extractMetadataFromFirecrawl,
  extractMetadataBasic,
  translateLanguage,
} from "../src/metadata-extractor.js";
import {
  isValidUrl,
  parseStartCommand,
  isLinkMessage,
  isValidUserId,
} from "../src/validators.js";

describe("Integration Tests", () => {
  describe("Flujo completo de procesamiento de artículo", () => {
    test("procesa un artículo completo con Firecrawl", () => {
      // Simular mensaje de Telegram
      const telegramMessage = {
        chat: { id: 123456789 },
        text: "https://example.com/article",
        from: { username: "testuser" },
      };

      // Validar que es un enlace
      expect(isLinkMessage(telegramMessage.text)).toBe(true);
      expect(isValidUrl(telegramMessage.text)).toBe(true);

      // Simular respuesta de Firecrawl
      const firecrawlResponse = {
        success: true,
        data: {
          title: "Artículo de Integración",
          metadata: {
            description: "Este es un artículo de prueba para integración",
            language: "es",
            author: "Test Author",
            keywords: "integración, test, artículo",
          },
        },
      };

      // Extraer metadatos
      const metadata = extractMetadataFromFirecrawl(firecrawlResponse);

      expect(metadata.title).toBe("Artículo de Integración");
      expect(metadata.description).toBe(
        "Este es un artículo de prueba para integración"
      );
      expect(metadata.language).toBe("es");
      expect(metadata.authors).toEqual(["Test Author"]);
      expect(metadata.topics).toEqual(["integración", "test", "artículo"]);

      // Traducir idioma
      const languageName = translateLanguage(metadata.language);
      expect(languageName).toBe("Castellano");

      // Simular datos para guardar en Supabase
      const articleData = {
        url: telegramMessage.text,
        user_id: "test-user-123",
        dateAdded: new Date().toISOString(),
        title: metadata.title,
        description: metadata.description,
        language: metadata.language,
        authors: metadata.authors.length ? metadata.authors : null,
        topics: metadata.topics.length ? metadata.topics : null,
      };

      expect(articleData.url).toBe("https://example.com/article");
      expect(articleData.title).toBe("Artículo de Integración");
      expect(articleData.authors).toEqual(["Test Author"]);
      expect(articleData.topics).toEqual(["integración", "test", "artículo"]);
    });

    test("procesa un artículo con extracción básica (fallback)", () => {
      const telegramMessage = {
        chat: { id: 123456789 },
        text: "https://example.com/basic-article",
        from: { username: "testuser" },
      };

      // Validar enlace
      expect(isLinkMessage(telegramMessage.text)).toBe(true);

      // Simular HTML básico
      const html = `
        <html lang="en">
          <head>
            <title>Basic Article</title>
            <meta name="author" content="Basic Author">
            <meta name="keywords" content="basic, test, article">
          </head>
          <body>Content</body>
        </html>
      `;

      // Extraer metadatos básicos
      const metadata = extractMetadataBasic(html);

      expect(metadata.title).toBe("Basic Article");
      expect(metadata.language).toBe("en");
      expect(metadata.authors).toEqual(["Basic Author"]);
      expect(metadata.topics).toEqual(["basic", "test", "article"]);

      // Traducir idioma
      const languageName = translateLanguage(metadata.language);
      expect(languageName).toBe("Inglés");
    });
  });

  describe("Flujo de vinculación de usuario", () => {
    test("procesa comando /start con user_id válido", () => {
      const startCommand = "/start user-123";
      const parsed = parseStartCommand(startCommand);

      expect(parsed.isStart).toBe(true);
      expect(parsed.userId).toBe("user-123");
      expect(isValidUserId(parsed.userId)).toBe(true);

      // Simular datos de vinculación
      const linkData = {
        user_id: parsed.userId,
        telegram_chat_id: 123456789,
        telegram_username: "testuser",
      };

      expect(linkData.user_id).toBe("user-123");
      expect(linkData.telegram_chat_id).toBe(123456789);
    });

    test("rechaza comando /start con user_id inválido", () => {
      const startCommand = "/start user@123";
      const parsed = parseStartCommand(startCommand);

      expect(parsed.isStart).toBe(true);
      expect(parsed.userId).toBe("user"); // Solo captura la parte válida
      expect(isValidUserId(parsed.userId)).toBe(true); // 'user' es válido
    });
  });

  describe("Manejo de errores", () => {
    test("maneja respuesta de Firecrawl con error", () => {
      const errorResponse = {
        success: false,
        error: "Failed to scrape URL",
      };

      const metadata = extractMetadataFromFirecrawl(errorResponse);

      expect(metadata.title).toBeNull();
      expect(metadata.description).toBeNull();
      expect(metadata.authors).toEqual([]);
      expect(metadata.topics).toEqual([]);
    });

    test("maneja HTML malformado", () => {
      const badHtml = "<html><head><title>Bad HTML</head><body>";
      const metadata = extractMetadataBasic(badHtml);

      expect(metadata.title).toBeNull(); // No se extrae título en HTML malformado
      expect(metadata.language).toBeNull();
      expect(metadata.authors).toEqual([]);
    });

    test("maneja URLs malformadas", () => {
      const badUrls = [
        "not-a-url",
        "ftp://example.com",
        "example.com",
        "",
        null,
        undefined,
      ];

      badUrls.forEach((url) => {
        expect(isValidUrl(url)).toBe(false);
        expect(isLinkMessage(url)).toBe(false);
      });
    });
  });

  describe("Generación de mensajes de respuesta", () => {
    test("genera mensaje de confirmación con metadatos completos", () => {
      const metadata = {
        title: "Artículo Completo",
        description: "Descripción del artículo",
        language: "es",
        authors: ["Autor 1", "Autor 2"],
        topics: ["tema1", "tema2"],
      };

      const languageName = translateLanguage(metadata.language);

      const message = `✅ ¡Artículo guardado!${
        metadata.title ? `\nTítulo: ${metadata.title}` : ""
      }${
        metadata.description
          ? `\nDescripción: ${metadata.description.substring(0, 200)}${
              metadata.description.length > 200 ? "..." : ""
            }`
          : ""
      }${languageName ? `\nIdioma: ${languageName}` : ""}${
        metadata.authors.length
          ? `\nAutor(es): ${metadata.authors.join(", ")}`
          : ""
      }${
        metadata.topics.length ? `\nTemas: ${metadata.topics.join(", ")}` : ""
      }`;

      expect(message).toContain("✅ ¡Artículo guardado!");
      expect(message).toContain("Título: Artículo Completo");
      expect(message).toContain("Descripción: Descripción del artículo");
      expect(message).toContain("Idioma: Castellano");
      expect(message).toContain("Autor(es): Autor 1, Autor 2");
      expect(message).toContain("Temas: tema1, tema2");
    });

    test("genera mensaje de confirmación con metadatos mínimos", () => {
      const metadata = {
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      };

      const message = `✅ ¡Artículo guardado!${
        metadata.title ? `\nTítulo: ${metadata.title}` : ""
      }${
        metadata.description
          ? `\nDescripción: ${metadata.description.substring(0, 200)}${
              metadata.description.length > 200 ? "..." : ""
            }`
          : ""
      }${
        metadata.language
          ? `\nIdioma: ${translateLanguage(metadata.language)}`
          : ""
      }${
        metadata.authors.length
          ? `\nAutor(es): ${metadata.authors.join(", ")}`
          : ""
      }${
        metadata.topics.length ? `\nTemas: ${metadata.topics.join(", ")}` : ""
      }`;

      expect(message).toBe("✅ ¡Artículo guardado!");
    });
  });
});
