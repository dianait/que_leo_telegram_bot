import jest from "jest-mock";
import {
  formatSummaryMessage,
  isOllamaEnabled,
  shouldNotifyOnOllamaError,
  summarizeAndRateArticle,
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
