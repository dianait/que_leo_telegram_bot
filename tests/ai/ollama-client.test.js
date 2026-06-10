import jest from "jest-mock";
import {
  buildOllamaResponseText,
  buildPreferencesConsolidationPrompt,
  buildSystemPrompt,
  consolidateUserPreferences,
  formatSummaryMessage,
  isOllamaEnabled,
  parseArticleMetadataResponse,
  parseOllamaResponse,
  shouldNotifyOnOllamaError,
  summarizeAndRateArticle,
  truncateText,
} from "../../src/ai/ollama-client.js";

global.fetch = jest.fn();

describe("Ollama Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    fetch.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isOllamaEnabled", () => {
    test("está deshabilitado por defecto", () => {
      delete process.env.OLLAMA_ENABLED;
      expect(isOllamaEnabled()).toBe(false);
    });

    test("requiere URL y modelo cuando está habilitado", () => {
      process.env.OLLAMA_ENABLED = "true";
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
      process.env.OLLAMA_MODEL = "llama3.2";

      expect(isOllamaEnabled()).toBe(true);
    });

    test("falla si falta el modelo", () => {
      process.env.OLLAMA_ENABLED = "true";
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
      delete process.env.OLLAMA_MODEL;

      expect(isOllamaEnabled()).toBe(false);
    });
  });

  describe("summarizeAndRateArticle", () => {
    beforeEach(() => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
      process.env.OLLAMA_MODEL = "llama3.2";
      delete process.env.OLLAMA_USER_PREFERENCES;
    });

    test("envía preferencias del usuario en el system prompt", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              "RESUMEN:\nBuen artículo.\n\nVALORACIÓN: 8/10\nRAZÓN:\nEncaja bien.",
          },
        }),
      });

      const result = await summarizeAndRateArticle(
        {
          title: "Mi artículo",
          description: "Una descripción",
          text: "Contenido del artículo",
          url: "https://example.com/post",
        },
        { userPreferences: "Me interesan los ensayos técnicos largos." }
      );

      expect(result).toContain("VALORACIÓN: 8/10");
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Me interesan los ensayos técnicos largos."),
        })
      );

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.model).toBe("llama3.2");
      expect(body.stream).toBe(false);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].content).toContain("https://example.com/post");
      expect(body.messages[1].content).toContain("Metadatos del artículo:");
      expect(body.messages[1].content).toContain("Fuente: example.com");
    });

    test("incluye historial del usuario en el system prompt si existe", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: "RESUMEN:\nOk.\n\nVALORACIÓN: 8/10\nRAZÓN:\nBien." },
        }),
      });

      await summarizeAndRateArticle(
        {
          title: "Artículo",
          description: null,
          text: "Contenido",
          url: "https://example.com/post",
        },
        { tasteProfile: "- Temas recurrentes: Swift (2)" }
      );

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain("Historial real del usuario");
      expect(body.messages[0].content).toContain("Temas recurrentes: Swift (2)");
    });

    test("pide valorar por contenido y no por paywalls o membresías", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: "RESUMEN:\nOk.\n\nVALORACIÓN: 7/10\nRAZÓN:\nProfundo." },
        }),
      });

      await summarizeAndRateArticle({
        title: "Artículo",
        description: null,
        text: "Contenido",
        url: "https://medium.com/post",
      });

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      const systemPrompt = body.messages[0].content;

      expect(systemPrompt).toContain("NO uses como motivo");
      expect(systemPrompt).toContain("membresías");
      expect(systemPrompt).toContain("solo calidad y encaje temático");
    });

    test("lanza error si Ollama responde con error HTTP", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        summarizeAndRateArticle({
          title: "Título",
          description: null,
          text: "",
          url: "https://example.com",
        })
      ).rejects.toThrow("Ollama respondió con 500");
    });
  });

  describe("buildSystemPrompt", () => {
    test("omite historial si no hay perfil de gustos", () => {
      const prompt = buildSystemPrompt();

      expect(prompt).not.toContain("Historial real del usuario");
    });

    test("ignora OLLAMA_USER_PREFERENCES del entorno", () => {
      process.env.OLLAMA_USER_PREFERENCES = "Preferencias globales";

      const prompt = buildSystemPrompt({
        userPreferences: "Me interesan cine y música",
      });

      expect(prompt).toContain("Me interesan cine y música");
      expect(prompt).not.toContain("Preferencias globales");
    });

    test("usa texto por defecto si no hay preferencias del usuario", () => {
      const prompt = buildSystemPrompt();

      expect(prompt).toContain("Sin preferencias específicas definidas.");
    });
  });

  describe("truncateText", () => {
    test("no trunca texto corto", () => {
      expect(truncateText("Hola mundo", 20)).toBe("Hola mundo");
    });

    test("trunca en el último espacio y añade elipsis", () => {
      const longText =
        "Esta es una frase bastante larga que debería cortarse antes de llegar al final del límite configurado para el resumen del artículo.";

      const result = truncateText(longText, 60);

      expect(result.endsWith("…")).toBe(true);
      expect(result.length).toBeLessThanOrEqual(61);
    });
  });

  describe("buildOllamaResponseText", () => {
    test("reconstruye el formato esperado", () => {
      const text = buildOllamaResponseText({
        summary: "Resumen breve.",
        rating: 8,
        reason: "Encaja bien.",
      });

      expect(text).toBe(
        "RESUMEN:\nResumen breve.\n\nVALORACIÓN: 8/10\n\nRAZÓN:\nEncaja bien."
      );
    });
  });

  describe("parseOllamaResponse", () => {
    test("extrae resumen, valoración y razón", () => {
      const parsed = parseOllamaResponse(
        "RESUMEN:\nMuy interesante.\n\nVALORACIÓN: 9/10\nRAZÓN:\nEncaja con tus gustos."
      );

      expect(parsed).toEqual({
        summary: "Muy interesante.",
        rating: 9,
        reason: "Encaja con tus gustos.",
      });
    });

    test("devuelve nulls si el formato no coincide", () => {
      expect(parseOllamaResponse("texto libre sin formato")).toEqual({
        summary: null,
        rating: null,
        reason: null,
      });
    });

    test("rechaza valoraciones fuera de rango", () => {
      const parsed = parseOllamaResponse(
        "RESUMEN:\nOk.\n\nVALORACIÓN: 11/10\nRAZÓN:\nDemasiado alto."
      );

      expect(parsed.summary).toBe("Ok.");
      expect(parsed.rating).toBeNull();
      expect(parsed.reason).toBe("Demasiado alto.");
    });

    test("tolera un solo salto de línea entre secciones", () => {
      const parsed = parseOllamaResponse(
        "RESUMEN:\nMuy interesante.\nVALORACIÓN: 8/10\nRAZÓN:\nEncaja con tus gustos."
      );

      expect(parsed).toEqual({
        summary: "Muy interesante.",
        rating: 8,
        reason: "Encaja con tus gustos.",
      });
    });

    test("tolera markdown y VALORACION sin tilde", () => {
      const parsed = parseOllamaResponse(
        "**RESUMEN:**\nBuen artículo.\n**VALORACION:** 7/10\n**RAZON:**\nÚtil."
      );

      expect(parsed.summary).toBe("Buen artículo.");
      expect(parsed.rating).toBe(7);
      expect(parsed.reason).toBe("Útil.");
    });

    test("trunca resúmenes demasiado largos", () => {
      process.env.OLLAMA_SUMMARY_MAX_CHARS = "40";
      const longSummary = "a".repeat(80);

      const parsed = parseOllamaResponse(
        `RESUMEN:\n${longSummary}\n\nVALORACIÓN: 7/10\nRAZÓN:\nBien.`
      );

      expect(parsed.summary?.length).toBeLessThanOrEqual(41);
      expect(parsed.summary?.endsWith("…")).toBe(true);
    });
  });

  describe("formatSummaryMessage", () => {
    test("formatea la respuesta para Telegram", () => {
      const message = formatSummaryMessage("RESUMEN:\nHola");

      expect(message).toContain("📖 Resumen y valoración");
      expect(message).toContain("RESUMEN:\nHola");
    });
  });

  describe("parseArticleMetadataResponse", () => {
    test("extrae título, autores y topics", () => {
      const parsed = parseArticleMetadataResponse(
        "TITULO:\nCómo escalar microservicios\n\nAUTORES:\nhttps://medium.com/@tripadvisor-tech\n\nTEMAS:\nDevOps, arquitectura, escalabilidad"
      );

      expect(parsed.title).toBe("Cómo escalar microservicios");
      expect(parsed.authors).toEqual(["@tripadvisor-tech"]);
    });

    test("ignora autores desconocido", () => {
      const parsed = parseArticleMetadataResponse(
        "TITULO:\nArtículo\n\nAUTORES:\ndesconocido\n\nTEMAS:\na, b, c"
      );

      expect(parsed.authors).toEqual([]);
      expect(parsed.topics).toEqual(["a", "b", "c"]);
    });
  });

  describe("consolidateUserPreferences", () => {
    test("devuelve el texto sin cambios si cabe y no se fuerza", async () => {
      const text = "Me interesan ensayos técnicos.";

      await expect(consolidateUserPreferences(text)).resolves.toBe(text);
      expect(fetch).not.toHaveBeenCalled();
    });

    test("usa Ollama al mezclar aunque el texto sea corto", async () => {
      process.env.OLLAMA_ENABLED = "true";
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
      process.env.OLLAMA_MODEL = "llama3.2";

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: "Me interesan cine, música y desarrollo." },
        }),
      });

      const result = await consolidateUserPreferences(
        "Me interesan cine.\nMe interesan música y desarrollo.",
        { force: true }
      );

      expect(result).toBe("Me interesan cine, música y desarrollo.");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("trunca sin IA si el texto es largo y Ollama está deshabilitado", async () => {
      delete process.env.OLLAMA_ENABLED;

      const longText = "a".repeat(2500);
      const result = await consolidateUserPreferences(longText, { maxChars: 2000 });

      expect(result.length).toBeLessThanOrEqual(2001);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("buildPreferencesConsolidationPrompt", () => {
    test("incluye el límite de caracteres", () => {
      expect(buildPreferencesConsolidationPrompt(2000)).toContain("2000");
    });
  });

  describe("shouldNotifyOnOllamaError", () => {
    test("notifica por defecto", () => {
      delete process.env.OLLAMA_NOTIFY_ON_ERROR;
      expect(shouldNotifyOnOllamaError()).toBe(true);
    });

    test("puede desactivarse", () => {
      process.env.OLLAMA_NOTIFY_ON_ERROR = "false";
      expect(shouldNotifyOnOllamaError()).toBe(false);
    });
  });
});
