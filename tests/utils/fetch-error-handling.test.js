import jest from "jest-mock";
import { extractMetadataBasic } from "../../src/extractors/metadata-extractor.js";
import { isValidUrl } from "../../src/utils/validators.js";

// Mock de fetch para simular diferentes escenarios
global.fetch = jest.fn();

describe("Fetch Error Handling", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe("Manejo de errores de red", () => {
    test("maneja error de red (fetch falla)", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const url = "https://example.com/article";

      // Verificar que la URL es válida
      expect(isValidUrl(url)).toBe(true);

      try {
        const response = await fetch(url);
        const html = await response.text();
        const metadata = extractMetadataBasic(html);

        // Este código no debería ejecutarse si fetch falla
        expect(metadata).toBeDefined();
      } catch (error) {
        expect(error.message).toBe("Network error");

        // Si fetch falla, deberíamos obtener metadatos vacíos
        const metadata = extractMetadataBasic(null);
        expect(metadata).toEqual({
          title: null,
          description: null,
          language: null,
          authors: [],
          topics: [],
        });
      }
    });

    test("maneja respuesta HTTP con error (404)", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const url = "https://example.com/not-found";

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const metadata = extractMetadataBasic(html);

        expect(metadata).toBeDefined();
      } catch (error) {
        expect(error.message).toContain("HTTP error! status: 404");

        // Si hay error HTTP, deberíamos obtener metadatos vacíos
        const metadata = extractMetadataBasic(null);
        expect(metadata).toEqual({
          title: null,
          description: null,
          language: null,
          authors: [],
          topics: [],
        });
      }
    });

    test("maneja respuesta HTTP con error (500)", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const url = "https://example.com/server-error";

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const metadata = extractMetadataBasic(html);

        expect(metadata).toBeDefined();
      } catch (error) {
        expect(error.message).toContain("HTTP error! status: 500");

        // Si hay error HTTP, deberíamos obtener metadatos vacíos
        const metadata = extractMetadataBasic(null);
        expect(metadata).toEqual({
          title: null,
          description: null,
          language: null,
          authors: [],
          topics: [],
        });
      }
    });
  });

  describe("Manejo de timeouts", () => {
    test("maneja timeout de fetch", async () => {
      fetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100)
          )
      );

      const url = "https://example.com/slow";

      try {
        const response = await fetch(url);
        const html = await response.text();
        const metadata = extractMetadataBasic(html);

        expect(metadata).toBeDefined();
      } catch (error) {
        expect(error.message).toBe("Timeout");

        // Si hay timeout, deberíamos obtener metadatos vacíos
        const metadata = extractMetadataBasic(null);
        expect(metadata).toEqual({
          title: null,
          description: null,
          language: null,
          authors: [],
          topics: [],
        });
      }
    });
  });

  describe("Manejo de respuestas vacías o inválidas", () => {
    test("maneja respuesta vacía", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const url = "https://example.com/empty";
      const response = await fetch(url);
      const html = await response.text();
      const metadata = extractMetadataBasic(html);

      expect(metadata).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });

    test("maneja respuesta con solo espacios", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("   \n\t   "),
      });

      const url = "https://example.com/whitespace";
      const response = await fetch(url);
      const html = await response.text();
      const metadata = extractMetadataBasic(html);

      expect(metadata).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });

    test("maneja respuesta con HTML muy básico", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
      });

      const url = "https://example.com/basic";
      const response = await fetch(url);
      const html = await response.text();
      const metadata = extractMetadataBasic(html);

      expect(metadata).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });
  });

  describe("Manejo de URLs problemáticas", () => {
    test("maneja URLs que redirigen", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(`
          <html lang="es">
            <head>
              <title>Página Redirigida</title>
              <meta name="author" content="Autor Redirigido">
            </head>
            <body>Contenido redirigido</body>
          </html>
        `),
      });

      const url = "https://example.com/redirect";
      const response = await fetch(url);
      const html = await response.text();
      const metadata = extractMetadataBasic(html);

      expect(metadata.title).toBe("Página Redirigida");
      expect(metadata.language).toBe("es");
      expect(metadata.authors).toEqual(["Autor Redirigido"]);
    });

    test("maneja URLs con contenido no HTML", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("Este no es HTML, es texto plano"),
      });

      const url = "https://example.com/text";
      const response = await fetch(url);
      const html = await response.text();
      const metadata = extractMetadataBasic(html);

      expect(metadata).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });

    test("maneja URLs con JSON en lugar de HTML", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            '{"title": "JSON Response", "content": "This is JSON"}'
          ),
      });

      const url = "https://example.com/api";
      const response = await fetch(url);
      const html = await response.text();
      const metadata = extractMetadataBasic(html);

      expect(metadata).toEqual({
        title: null,
        description: null,
        language: null,
        authors: [],
        topics: [],
      });
    });
  });

  describe("Validación de URLs antes de fetch", () => {
    test("valida URLs antes de hacer fetch", () => {
      const validUrls = [
        "https://example.com",
        "http://example.com",
        "https://www.example.com/path",
        "https://example.com/path?param=value",
      ];

      const invalidUrls = [
        "not-a-url",
        "ftp://example.com",
        "example.com",
        "",
        null,
        undefined,
      ];

      validUrls.forEach((url) => {
        expect(isValidUrl(url)).toBe(true);
      });

      invalidUrls.forEach((url) => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });
});
