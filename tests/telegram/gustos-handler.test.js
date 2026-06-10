import jest from "jest-mock";
import {
  handlePendingPreferencesMessage,
  parseGustosCommand,
  registerGustosHandler,
  validatePreferencesText,
} from "../../src/telegram/gustos-handler.js";
import {
  clearAwaitingPreferences,
  startWizard,
} from "../../src/telegram/preferences-state.js";
import { createInMemorySupabase } from "../helpers/in-memory-supabase.js";
import { getUserPreferences, insertUser, upsertUserPreferences } from "../../src/db/service.js";

describe("gustos handler", () => {
  describe("parseGustosCommand", () => {
    test("sin argumento inicia el asistente guiado", () => {
      expect(parseGustosCommand(null)).toBe("wizard");
      expect(parseGustosCommand("")).toBe("wizard");
      expect(parseGustosCommand("   ")).toBe("wizard");
    });

    test("reconoce subcomandos ver, borrar y cancelar", () => {
      expect(parseGustosCommand("ver")).toBe("ver");
      expect(parseGustosCommand("VER")).toBe("ver");
      expect(parseGustosCommand("borrar")).toBe("borrar");
      expect(parseGustosCommand("cancelar")).toBe("cancelar");
    });

    test("cualquier otro texto es inline", () => {
      expect(parseGustosCommand("Me interesan ensayos técnicos")).toBe("inline");
    });
  });

  describe("validatePreferencesText", () => {
    test("rechaza texto vacío", () => {
      expect(validatePreferencesText("")).toBeTruthy();
      expect(validatePreferencesText("   ")).toBeTruthy();
    });

    test("rechaza texto demasiado largo", () => {
      const longText = "a".repeat(2001);
      expect(validatePreferencesText(longText)).toContain("demasiado largo");
    });

    test("acepta texto válido", () => {
      expect(validatePreferencesText("Me gusta Swift")).toBeNull();
    });
  });

  describe("registerGustosHandler", () => {
    let bot;
    let supabase;
    let gustosHandler;

    beforeEach(async () => {
      supabase = createInMemorySupabase();
      bot = {
        onText: jest.fn((pattern, handler) => {
          gustosHandler = handler;
        }),
        on: jest.fn(),
        sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
        editMessageText: jest.fn().mockResolvedValue(undefined),
        answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      };

      await insertUser(supabase, {
        user_id: "user-1",
        telegram_chat_id: 123,
        telegram_username: "tester",
      });

      registerGustosHandler(bot, supabase);
    });

    afterEach(() => {
      clearAwaitingPreferences(123);
    });

    test("rechaza usuarios no vinculados", async () => {
      await gustosHandler({ chat: { id: 999 }, from: {} }, ["/gustos"]);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        999,
        expect.stringContaining("vincular tu cuenta")
      );
    });

    test("/gustos ver muestra preferencias actuales", async () => {
      await upsertUserPreferences(
        supabase,
        "user-1",
        "Me interesan ensayos técnicos"
      );

      await gustosHandler({ chat: { id: 123 }, from: {} }, ["/gustos", "ver"]);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Me interesan ensayos técnicos")
      );
    });

    test("/gustos <texto> guarda inline", async () => {
      await gustosHandler(
        { chat: { id: 123 }, from: {} },
        ["/gustos", "Me interesan Swift"]
      );

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("guardado")
      );
    });

    test("/gustos@bot <texto> pregunta si sobrescribir cuando ya hay gustos", async () => {
      await upsertUserPreferences(
        supabase,
        "user-1",
        "Me interesan cine y música."
      );

      await gustosHandler(
        { chat: { id: 123 }, from: {} },
        ["/gustos@queleobot", "Me interesan Swift"]
      );

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Ya tienes gustos guardados"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: "g:replace" }),
              ]),
            ]),
          }),
        })
      );
    });

    test("/gustos <texto> pregunta si sobrescribir cuando ya hay gustos", async () => {
      await upsertUserPreferences(
        supabase,
        "user-1",
        "Me interesan cine y música."
      );

      await gustosHandler(
        { chat: { id: 123 }, from: {} },
        ["/gustos", "Me interesan Swift"]
      );

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Ya tienes gustos guardados"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: "g:merge" }),
              ]),
            ]),
          }),
        })
      );
      expect(bot.sendMessage).not.toHaveBeenCalledWith(
        123,
        expect.stringContaining("guardado")
      );
    });

    test("/gustos sin texto inicia el asistente guiado", async () => {
      await gustosHandler({ chat: { id: 123 }, from: {} }, ["/gustos"]);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Paso 1/4"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    test("/gustos sin texto pregunta si sobrescribir cuando ya hay gustos", async () => {
      await upsertUserPreferences(
        supabase,
        "user-1",
        "Me interesan cine y música."
      );

      await gustosHandler({ chat: { id: 123 }, from: {} }, ["/gustos"]);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Ya tienes gustos guardados"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: "g:replace" }),
              ]),
            ]),
          }),
        })
      );
    });

    test("/gustos borrar elimina preferencias", async () => {
      await upsertUserPreferences(supabase, "user-1", "Gustos a borrar");

      await gustosHandler(
        { chat: { id: 123 }, from: {} },
        ["/gustos", "borrar"]
      );

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("eliminado")
      );
    });
  });

  describe("handlePendingPreferencesMessage", () => {
    let bot;
    let supabase;

    beforeEach(async () => {
      supabase = createInMemorySupabase();
      bot = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 99 }),
        editMessageText: jest.fn().mockResolvedValue(undefined),
      };

      await insertUser(supabase, {
        user_id: "user-1",
        telegram_chat_id: 123,
        telegram_username: "tester",
      });
    });

    afterEach(() => {
      clearAwaitingPreferences(123);
    });

    test("añade temas personalizados durante el paso de intereses", async () => {
      startWizard(123, "user-1");

      const handled = await handlePendingPreferencesMessage(
        bot,
        supabase,
        123,
        "Kotlin, sistemas distribuidos"
      );

      expect(handled).toBe(true);
      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Añadido a intereses")
      );
    });

    test("en paso existing acepta texto y pregunta sobrescribir o mezclar", async () => {
      startWizard(123, "user-1", {
        existingPreferences: "Me interesan cine.",
      });

      const handled = await handlePendingPreferencesMessage(
        bot,
        supabase,
        123,
        "Me interesan ensayos técnicos sobre Swift"
      );

      expect(handled).toBe(true);
      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("sobrescribir tus gustos o mezclarlos")
      );
    });

    test("acepta respuesta libre en lugar de botones", async () => {
      startWizard(123, "user-1");

      const handled = await handlePendingPreferencesMessage(
        bot,
        supabase,
        123,
        "Me interesan ensayos largos sobre arquitectura de software y filosofía"
      );

      expect(handled).toBe(true);
      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Respuesta guardada")
      );
    });

    test("ignora comandos mientras el wizard está activo", async () => {
      startWizard(123, "user-1");

      const handled = await handlePendingPreferencesMessage(
        bot,
        supabase,
        123,
        "/start algo"
      );

      expect(handled).toBe(false);
    });
  });
});
