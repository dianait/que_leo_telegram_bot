import jest from "jest-mock";
import {
  handleDatabaseError,
  handleNetworkError,
  handleValidationError,
  handleUnexpectedError,
  handleTelegramError,
  handleError,
  logError,
} from "../../src/utils/error-handler.js";

// Mock del bot de Telegram
const mockBot = {
  sendMessage: jest.fn(),
};

// Mock de console.error para capturar logs
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
  mockBot.sendMessage.mockClear();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe("Error Handler", () => {
  describe("handleDatabaseError", () => {
    test("maneja error de duplicado (23505)", () => {
      const error = new Error("Duplicate entry");
      error.code = "23505";

      handleDatabaseError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "⚠️ Ya existe un registro con estos datos. Intenta con información diferente."
      );
    });

    test("maneja error de foreign key (23503)", () => {
      const error = new Error("Foreign key constraint");
      error.code = "23503";

      handleDatabaseError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error de referencia en la base de datos. Contacta al administrador."
      );
    });

    test("maneja error de tabla no existe (42P01)", () => {
      const error = new Error("Table does not exist");
      error.code = "42P01";

      handleDatabaseError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error de configuración de la base de datos. Contacta al administrador."
      );
    });

    test("maneja error genérico de base de datos", () => {
      const error = new Error("Database error");
      error.code = "99999";

      handleDatabaseError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error al acceder a la base de datos. Intenta de nuevo en unos momentos."
      );
    });
  });

  describe("handleNetworkError", () => {
    test("maneja error de fetch", () => {
      const error = new Error("fetch failed");

      handleNetworkError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ No se pudo acceder a la URL. Verifica que el enlace sea válido y esté disponible."
      );
    });

    test("maneja error de timeout", () => {
      const error = new Error("timeout");

      handleNetworkError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "⏰ La página tardó demasiado en responder. Intenta de nuevo más tarde."
      );
    });

    test("maneja error ENOTFOUND", () => {
      const error = new Error("ENOTFOUND");

      handleNetworkError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ No se pudo encontrar la página. Verifica que la URL sea correcta."
      );
    });

    test("maneja error genérico de red", () => {
      const error = new Error("Connection failed");

      handleNetworkError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error de conexión. Intenta de nuevo en unos momentos."
      );
    });
  });

  describe("handleValidationError", () => {
    test("maneja error de URL inválida", () => {
      const error = new Error("Invalid URL");

      handleValidationError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ La URL no es válida. Asegúrate de que comience con http:// o https://"
      );
    });

    test("maneja error de user_id inválido", () => {
      const error = new Error("Invalid user_id");

      handleValidationError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ ID de usuario inválido. Usa el botón de la app web para vincular tu cuenta."
      );
    });

    test("maneja error de datos requeridos", () => {
      const error = new Error("Required field missing");

      handleValidationError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error de validación. Verifica los datos e intenta de nuevo."
      );
    });

    test("maneja error genérico de validación", () => {
      const error = new Error("Validation failed");

      handleValidationError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error de validación. Verifica los datos e intenta de nuevo."
      );
    });
  });

  describe("handleTelegramError", () => {
    test("maneja error 403 (sin permisos)", () => {
      const error = new Error("Forbidden");
      error.code = 403;

      handleTelegramError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ No tengo permisos para enviar mensajes en este chat."
      );
    });

    test("maneja error 400 (formato inválido)", () => {
      const error = new Error("Bad Request");
      error.code = 400;

      handleTelegramError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error en el formato del mensaje. Intenta de nuevo."
      );
    });

    test("maneja error 429 (rate limit)", () => {
      const error = new Error("Too Many Requests");
      error.code = 429;

      handleTelegramError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "⏰ Demasiadas solicitudes. Espera un momento antes de intentar de nuevo."
      );
    });

    test("maneja error genérico de Telegram", () => {
      const error = new Error("Telegram API error");
      error.code = 500;

      handleTelegramError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error al enviar el mensaje. Intenta de nuevo."
      );
    });
  });

  describe("handleUnexpectedError", () => {
    test("maneja error inesperado", () => {
      const error = new Error("Unexpected error");

      handleUnexpectedError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error inesperado. Nuestro equipo ha sido notificado. Intenta de nuevo más tarde."
      );
    });
  });

  describe("handleError", () => {
    test("redirige errores de red a handleNetworkError", () => {
      const error = new Error("fetch failed");

      handleError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ No se pudo acceder a la URL. Verifica que el enlace sea válido y esté disponible."
      );
    });

    test("redirige errores de validación a handleValidationError", () => {
      const error = new Error("Invalid URL");

      handleError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ La URL no es válida. Asegúrate de que comience con http:// o https://"
      );
    });

    test("redirige errores de base de datos a handleDatabaseError", () => {
      const error = new Error("Database error");
      error.code = "23505";

      handleError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "⚠️ Ya existe un registro con estos datos. Intenta con información diferente."
      );
    });

    test("redirige errores de Telegram a handleTelegramError", () => {
      const error = new Error("Telegram error");
      error.code = 403; // Los códigos de Telegram son números

      handleError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ No tengo permisos para enviar mensajes en este chat."
      );
    });

    test("redirige errores inesperados a handleUnexpectedError", () => {
      const error = new Error("Unknown error");

      handleError(error, 123456, mockBot, "test");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        "❌ Error inesperado. Nuestro equipo ha sido notificado. Intenta de nuevo más tarde."
      );
    });
  });

  describe("logError", () => {
    test("registra error con contexto completo", () => {
      const error = new Error("Test error");
      error.code = "TEST001";
      const context = { context: "test", chatId: 123456, type: "test" };

      logError(error, context);

      expect(console.error).toHaveBeenCalledWith(
        "🚨 ERROR:",
        expect.stringContaining("Test error")
      );
    });

    test("incluye timestamp en el log", () => {
      const error = new Error("Test error");

      logError(error, {});

      expect(console.error).toHaveBeenCalledWith(
        "🚨 ERROR:",
        expect.stringContaining("timestamp")
      );
    });

    test("incluye stack trace en el log", () => {
      const error = new Error("Test error");

      logError(error, {});

      expect(console.error).toHaveBeenCalledWith(
        "🚨 ERROR:",
        expect.stringContaining("stack")
      );
    });
  });
});
