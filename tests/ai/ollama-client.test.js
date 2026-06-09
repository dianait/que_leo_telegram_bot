import jest from "jest-mock";
import {
  buildOllamaResponseText,
  formatSummaryMessage,
  isOllamaEnabled,
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
      process.env.OLLAMA_USER_PREFERENCES =
        "Me interesan los ensayos técnicos largos.";
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

      const result = await summarizeAndRateArticle({
        title: "Mi artículo",
        description: "Una descripción",
        text: "Contenido del artículo",
        url: "https://example.com/post",
      });

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
