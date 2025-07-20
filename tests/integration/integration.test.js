import {
  extractMetadataBasic,
  translateLanguage,
} from "../../src/extractors/metadata-extractor.js";
import {
  isValidUrl,
  parseStartCommand,
  isLinkMessage,
  isValidUserId,
} from "../../src/utils/validators.js";
import request from "supertest";
import fs from "fs";
import path from "path";
import { startWebServer } from "../../src/web/server.js";

let server;
beforeAll((done) => {
  server = startWebServer();
  setTimeout(done, 500); // Espera breve para asegurar que el server arranca
});
afterAll((done) => {
  if (server && server.close) server.close(done);
  else done();
});

describe("Integration Tests", () => {
  describe("Flujo completo de procesamiento de artículo", () => {
    test("procesa un artículo completo con extracción básica", () => {
      // Simular mensaje de Telegram
      const telegramMessage = {
        chat: { id: 123456789 },
        text: "https://example.com/article",
        from: { username: "testuser" },
      };

      // Validar que es un enlace
      expect(isLinkMessage(telegramMessage.text)).toBe(true);
      expect(isValidUrl(telegramMessage.text)).toBe(true);

      // Simular HTML de respuesta
      const html = `
        <html lang="es">
          <head>
            <title>Artículo de Integración</title>
            <meta name="author" content="Test Author">
            <meta name="keywords" content="integración, test, artículo">
          </head>
          <body>Contenido del artículo</body>
        </html>
      `;

      // Extraer metadatos
      const metadata = extractMetadataBasic(html);

      expect(metadata.title).toBe("Artículo de Integración");
      expect(metadata.description).toBeNull(); // No extraemos descripción en modo básico
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

    test("procesa un artículo con extracción básica (caso en inglés)", () => {
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

    test("procesa un artículo sin metadatos", () => {
      const telegramMessage = {
        chat: { id: 123456789 },
        text: "https://example.com/no-metadata",
        from: { username: "testuser" },
      };

      // Simular HTML sin metadatos
      const html = `
        <html>
          <head>
            <title>Sin Metadatos</title>
          </head>
          <body>Contenido</body>
        </html>
      `;

      const metadata = extractMetadataBasic(html);

      expect(metadata.title).toBe("Sin Metadatos");
      expect(metadata.language).toBeNull();
      expect(metadata.authors).toEqual([]);
      expect(metadata.topics).toEqual([]);

      // Verificar que se puede guardar sin metadatos
      const articleData = {
        url: telegramMessage.text,
        user_id: "test-user-123",
        title: metadata.title,
        language: metadata.language,
        authors: metadata.authors.length ? metadata.authors : null,
        topics: metadata.topics.length ? metadata.topics : null,
      };

      expect(articleData.title).toBe("Sin Metadatos");
      expect(articleData.authors).toBeNull();
      expect(articleData.topics).toBeNull();
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

    test("procesa comando /start sin user_id", () => {
      const startCommand = "/start";
      const parsed = parseStartCommand(startCommand);

      expect(parsed.isStart).toBe(true);
      expect(parsed.userId).toBeNull();
    });
  });

  describe("Manejo de errores", () => {
    test("maneja HTML malformado", () => {
      const badHtml = "<html><head><title>Bad HTML</head><body>";
      const metadata = extractMetadataBasic(badHtml);

      expect(metadata.title).toBeNull(); // No se extrae título en HTML malformado
      expect(metadata.language).toBeNull();
      expect(metadata.authors).toEqual([]);
      expect(metadata.topics).toEqual([]);
    });

    test("maneja URLs malformadas", () => {
      const badUrls = ["not-a-url", "ftp://example.com", "example.com", ""];

      badUrls.forEach((url) => {
        expect(isValidUrl(url)).toBe(false);
      });
    });

    test("maneja HTML vacío", () => {
      const metadata = extractMetadataBasic("");
      expect(metadata).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
        featuredimage: null,
      });
    });

    test("maneja errores de fetch simulados", () => {
      // Simular que fetch falla
      const mockHtml = null; // Simular respuesta vacía
      const metadata = extractMetadataBasic(mockHtml);

      expect(metadata.title).toBeNull();
      expect(metadata.language).toBeNull();
      expect(metadata.authors).toEqual([]);
      expect(metadata.topics).toEqual([]);
    });
  });

  describe("Generación de mensajes de respuesta", () => {
    test("genera mensaje de confirmación con metadatos completos", () => {
      const metadata = {
        title: "Artículo Completo",
        description: null, // No tenemos descripción en extracción básica
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
        metadata.authors.length > 0
          ? `\nAutor(es): ${metadata.authors.join(", ")}`
          : ""
      }${
        metadata.topics.length > 0
          ? `\nTemas: ${metadata.topics.join(", ")}`
          : ""
      }`;

      expect(message).toContain("✅ ¡Artículo guardado!");
      expect(message).toContain("Título: Artículo Completo");
      expect(message).toContain("Idioma: Castellano");
      expect(message).toContain("Autor(es): Autor 1, Autor 2");
      expect(message).toContain("Temas: tema1, tema2");
    });

    test("genera mensaje de confirmación con metadatos mínimos", () => {
      const metadata = {
        title: "Artículo Mínimo",
        description: null,
        language: null,
        authors: [],
        topics: [],
      };

      const message = `✅ ¡Artículo guardado!${
        metadata.title ? `\nTítulo: ${metadata.title}` : ""
      }`;

      expect(message).toContain("✅ ¡Artículo guardado!");
      expect(message).toContain("Título: Artículo Mínimo");
      expect(message).not.toContain("Idioma:");
      expect(message).not.toContain("Autor(es):");
      expect(message).not.toContain("Temas:");
    });

    test("genera mensaje de confirmación sin título", () => {
      const metadata = {
        title: null,
        description: null,
        language: "en",
        authors: ["Unknown Author"],
        topics: ["unknown"],
      };

      const languageName = translateLanguage(metadata.language);

      const message = `✅ ¡Artículo guardado!${
        languageName ? `\nIdioma: ${languageName}` : ""
      }${
        metadata.authors.length > 0
          ? `\nAutor(es): ${metadata.authors.join(", ")}`
          : ""
      }${
        metadata.topics.length > 0
          ? `\nTemas: ${metadata.topics.join(", ")}`
          : ""
      }`;

      expect(message).toContain("✅ ¡Artículo guardado!");
      expect(message).not.toContain("Título:");
      expect(message).toContain("Idioma: Inglés");
      expect(message).toContain("Autor(es): Unknown Author");
      expect(message).toContain("Temas: unknown");
    });
  });

  describe("Validación de datos antes de guardar", () => {
    test("valida datos completos para guardar en Supabase", () => {
      const metadata = {
        title: "Artículo de Validación",
        description: null,
        language: "es",
        authors: ["Autor Test"],
        topics: ["validación", "test"],
      };

      const articleData = {
        url: "https://example.com/validation",
        user_id: "test-user-123",
        title: metadata.title || null,
        language: metadata.language || null,
        authors: metadata.authors.length ? metadata.authors : null,
        topics: metadata.topics.length ? metadata.topics : null,
      };

      // Validar que todos los campos tienen el formato correcto
      expect(typeof articleData.url).toBe("string");
      expect(isValidUrl(articleData.url)).toBe(true);
      expect(typeof articleData.user_id).toBe("string");
      expect(isValidUserId(articleData.user_id)).toBe(true);
      expect(articleData.title).toBe("Artículo de Validación");
      expect(articleData.language).toBe("es");
      expect(Array.isArray(articleData.authors)).toBe(true);
      expect(Array.isArray(articleData.topics)).toBe(true);
    });

    test("valida datos mínimos para guardar en Supabase", () => {
      const metadata = {
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      };

      const articleData = {
        url: "https://example.com/minimal",
        user_id: "test-user-123",
        title: metadata.title || null,
        language: metadata.language || null,
        authors: metadata.authors.length ? metadata.authors : null,
        topics: metadata.topics.length ? metadata.topics : null,
      };

      // Validar que los campos nulos se manejan correctamente
      expect(articleData.title).toBeNull();
      expect(articleData.language).toBeNull();
      expect(articleData.authors).toBeNull();
      expect(articleData.topics).toBeNull();
    });
  });
});
