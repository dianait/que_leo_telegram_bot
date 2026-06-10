import {
  consolidateUserPreferences,
  isOllamaEnabled,
} from "../ai/ollama-client.js";
import {
  deleteUserPreferences,
  findUserByChatId,
  getUserPreferences,
  upsertUserPreferences,
} from "../db/service.js";
import { handleDatabaseError } from "../utils/error-handler.js";
import {
  buildFinalPreferencesText,
  buildKeyboardForStep,
  buildPreferencesText,
  buildStepMessage,
  getNextStep,
  getPreviousStep,
  getSelectionFieldForStep,
  getTextFieldForStep,
  isFreeformAnswer,
  parseCustomItems,
  toggleSelection,
} from "./gustos-wizard.js";
import {
  clearAwaitingPreferences,
  getWizardState,
  PREFERENCES_MAX_CHARS,
  startWizard,
  updateWizardState,
} from "./preferences-state.js";

export const GUSTOS_COMMAND_REGEX =
  /^\/gustos(?:@[\w_]+)?(?:\s+([\s\S]+))?$/i;

/**
 * @param {string|null|undefined} arg
 * @returns {"ver"|"borrar"|"cancelar"|"inline"|"wizard"}
 */
export function parseGustosCommand(arg) {
  if (!arg || !arg.trim()) {
    return "wizard";
  }

  const normalized = arg.trim().toLowerCase();

  if (normalized === "ver") {
    return "ver";
  }

  if (normalized === "borrar") {
    return "borrar";
  }

  if (normalized === "cancelar") {
    return "cancelar";
  }

  return "inline";
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function validatePreferencesText(text) {
  const trimmed = text?.trim();
  if (!trimmed) {
    return "El texto de gustos no puede estar vacío.";
  }

  if (trimmed.length > PREFERENCES_MAX_CHARS) {
    return `El texto es demasiado largo (máximo ${PREFERENCES_MAX_CHARS} caracteres).`;
  }

  return null;
}

/**
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} chatId
 * @param {object} supabase
 * @param {string} userId
 * @param {string} preferencesText
 * @param {{ forceConsolidate?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
async function savePreferences(
  bot,
  chatId,
  supabase,
  userId,
  preferencesText,
  { forceConsolidate = false } = {}
) {
  let textToSave = preferencesText.trim();
  const needsConsolidate =
    forceConsolidate || textToSave.length > PREFERENCES_MAX_CHARS;

  if (needsConsolidate) {
    if (isOllamaEnabled()) {
      await bot.sendMessage(chatId, "🤖 Consolidando tus gustos con IA...");
    }

    textToSave = await consolidateUserPreferences(textToSave, {
      maxChars: PREFERENCES_MAX_CHARS,
      force: forceConsolidate,
    });
  }

  const validationError = validatePreferencesText(textToSave);
  if (validationError) {
    await bot.sendMessage(chatId, `❌ ${validationError}`);
    return false;
  }

  const result = await upsertUserPreferences(
    supabase,
    userId,
    textToSave
  );

  if (!result.success) {
    handleDatabaseError(result.error, chatId, bot, "user-preferences-save");
    return false;
  }

  clearAwaitingPreferences(chatId);
  await bot.sendMessage(
    chatId,
    "✅ Tus gustos se han guardado. Se usarán en las próximas valoraciones."
  );
  return true;
}

/**
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} chatId
 * @param {import("./preferences-state.js").WizardState} state
 * @returns {Promise<void>}
 */
async function sendWizardStep(bot, chatId, state) {
  const text = buildStepMessage(state.step, state);
  const keyboard = buildKeyboardForStep(state.step, state);

  if (state.messageId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: state.messageId,
        reply_markup: { inline_keyboard: keyboard },
      });
      return;
    } catch {
      // Si no se puede editar, enviamos un mensaje nuevo.
    }
  }

  const sent = await bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: keyboard },
  });

  updateWizardState(chatId, { messageId: sent.message_id });
}

/**
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} chatId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function startGuidedWizard(bot, chatId, userId, supabase) {
  clearAwaitingPreferences(chatId);
  const existingPreferences = await getUserPreferences(supabase, userId);
  const state = startWizard(chatId, userId, { existingPreferences });
  await sendWizardStep(bot, chatId, state);
}

/**
 * @param {import("node-telegram-bot-api")} bot
 * @param {object} supabase
 * @param {number} chatId
 * @param {import("./preferences-state.js").WizardState} state
 * @returns {Promise<void>}
 */
async function finishWizard(bot, supabase, chatId, state) {
  const newText = buildPreferencesText(state);

  if (!newText) {
    await bot.sendMessage(
      chatId,
      "❌ No has seleccionado ningún gusto. Usa /gustos para empezar de nuevo."
    );
    clearAwaitingPreferences(chatId);
    return;
  }

  const preferencesText = buildFinalPreferencesText(state);
  const forceConsolidate =
    state.saveMode === "merge" && Boolean(state.existingPreferences);

  await savePreferences(bot, chatId, supabase, state.userId, preferencesText, {
    forceConsolidate,
  });
}

/**
 * @param {import("node-telegram-bot-api")} bot
 * @param {object} supabase
 */
export function registerGustosHandler(bot, supabase) {
  bot.onText(GUSTOS_COMMAND_REGEX, async (msg, match) => {
    const chatId = msg.chat.id;
    const arg = match[1]?.trim() ?? null;

    const user = await findUserByChatId(supabase, chatId);
    if (!user) {
      await bot.sendMessage(
        chatId,
        "❌ Debes vincular tu cuenta primero usando el botón de la app web."
      );
      return;
    }

    const action = parseGustosCommand(arg);

    if (action === "ver") {
      const preferences = await getUserPreferences(supabase, user.user_id);
      if (!preferences) {
        await bot.sendMessage(
          chatId,
          "Aún no tienes gustos definidos.\n\nUsa /gustos para configurarlos con el asistente guiado."
        );
        return;
      }

      await bot.sendMessage(chatId, `📋 Tus gustos actuales:\n\n${preferences}`);
      return;
    }

    if (action === "borrar") {
      const result = await deleteUserPreferences(supabase, user.user_id);
      clearAwaitingPreferences(chatId);

      if (!result.success) {
        handleDatabaseError(result.error, chatId, bot, "user-preferences-delete");
        return;
      }

      await bot.sendMessage(chatId, "🗑️ Tus gustos se han eliminado.");
      return;
    }

    if (action === "cancelar") {
      clearAwaitingPreferences(chatId);
      await bot.sendMessage(chatId, "Configuración de gustos cancelada.");
      return;
    }

    if (action === "inline") {
      const existingPreferences = await getUserPreferences(
        supabase,
        user.user_id
      );

      if (existingPreferences) {
        const state = startWizard(chatId, user.user_id, {
          existingPreferences,
          pendingInlineText: arg,
        });
        await sendWizardStep(bot, chatId, state);
        return;
      }

      clearAwaitingPreferences(chatId);
      await savePreferences(bot, chatId, supabase, user.user_id, arg);
      return;
    }

    await startGuidedWizard(bot, chatId, user.user_id, supabase);
  });

  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data?.startsWith("g:")) {
      return;
    }

    const chatId = query.message?.chat?.id;
    if (!chatId) {
      return;
    }

    const state = getWizardState(chatId);
    if (!state) {
      await bot.answerCallbackQuery(query.id, {
        text: "La sesión expiró. Usa /gustos para empezar de nuevo.",
        show_alert: true,
      });
      return;
    }

    try {
      if (data === "g:cancel") {
        clearAwaitingPreferences(chatId);
        await bot.answerCallbackQuery(query.id, { text: "Cancelado" });
        await bot.sendMessage(chatId, "Configuración de gustos cancelada.");
        return;
      }

      if (data === "g:view") {
        await bot.answerCallbackQuery(query.id);
        if (state.existingPreferences) {
          await bot.sendMessage(
            chatId,
            `📋 Tus gustos actuales:\n\n${state.existingPreferences}`
          );
        }
        return;
      }

      if (data === "g:replace") {
        if (state.pendingInlineText) {
          await bot.answerCallbackQuery(query.id, { text: "Sobrescribiendo..." });
          await savePreferences(
            bot,
            chatId,
            supabase,
            state.userId,
            state.pendingInlineText
          );
          return;
        }

        const nextState = updateWizardState(chatId, {
          saveMode: "replace",
          step: "interests",
          messageId: null,
        });
        await bot.answerCallbackQuery(query.id, { text: "Empezamos de cero" });
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data === "g:merge") {
        if (state.pendingInlineText) {
          const mergedText = `${state.existingPreferences?.trim() ?? ""}\n${state.pendingInlineText}`.trim();
          await bot.answerCallbackQuery(query.id, { text: "Mezclando..." });
          await savePreferences(bot, chatId, supabase, state.userId, mergedText, {
            forceConsolidate: true,
          });
          return;
        }

        const nextState = updateWizardState(chatId, {
          saveMode: "merge",
          step: "interests",
          messageId: null,
        });
        await bot.answerCallbackQuery(query.id, { text: "Mezclaremos al final" });
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data === "g:back") {
        const previousStep = getPreviousStep(state.step, state);
        if (!previousStep) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const nextState = updateWizardState(chatId, { step: previousStep });
        await bot.answerCallbackQuery(query.id);
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data === "g:next") {
        if (state.step === "existing") {
          await bot.answerCallbackQuery(query.id);
          return;
        }
        const nextStep = getNextStep(state.step);
        if (!nextStep) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const nextState = updateWizardState(chatId, {
          step: nextStep,
          textMode: false,
        });
        await bot.answerCallbackQuery(query.id);
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data === "g:textmode") {
        const nextState = updateWizardState(chatId, { textMode: true });
        await bot.answerCallbackQuery(query.id, { text: "Escribe tu respuesta" });
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data === "g:buttons") {
        /** @type {Partial<import("./preferences-state.js").WizardState>} */
        const updates = { textMode: false };

        if (state.step === "interests") {
          updates.interestsText = null;
        } else if (state.step === "avoid") {
          updates.avoidText = null;
        } else if (state.step === "style") {
          updates.styleText = null;
        }

        const nextState = updateWizardState(chatId, updates);
        await bot.answerCallbackQuery(query.id);
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data === "g:ok") {
        const latestState = getWizardState(chatId) ?? state;
        await bot.answerCallbackQuery(query.id, { text: "Guardando..." });
        await finishWizard(bot, supabase, chatId, latestState);
        return;
      }

      if (data.startsWith("g:i:")) {
        const id = data.slice(4);
        const interests = toggleSelection(state.interests, id);
        const nextState = updateWizardState(chatId, {
          interests,
          interestsText: null,
          textMode: false,
        });
        await bot.answerCallbackQuery(query.id, {
          text: interests.includes(id) ? "Añadido" : "Quitado",
        });
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data.startsWith("g:a:")) {
        const id = data.slice(4);
        const avoid = toggleSelection(state.avoid, id);
        const nextState = updateWizardState(chatId, {
          avoid,
          avoidText: null,
          textMode: false,
        });
        await bot.answerCallbackQuery(query.id, {
          text: avoid.includes(id) ? "Añadido" : "Quitado",
        });
        await sendWizardStep(bot, chatId, nextState);
        return;
      }

      if (data.startsWith("g:s:")) {
        const style = data.slice(4);
        const nextState = updateWizardState(chatId, {
          style,
          styleText: null,
          textMode: false,
        });
        await bot.answerCallbackQuery(query.id, { text: "Seleccionado" });
        await sendWizardStep(bot, chatId, nextState);
      }
    } catch {
      await bot.answerCallbackQuery(query.id, {
        text: "No pude procesar la acción. Inténtalo de nuevo.",
        show_alert: true,
      });
    }
  });
}

/**
 * @param {import("node-telegram-bot-api")} bot
 * @param {object} supabase
 * @param {number} chatId
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function handlePendingPreferencesMessage(
  bot,
  supabase,
  chatId,
  text
) {
  if (!text || text.startsWith("/")) {
    return false;
  }

  const state = getWizardState(chatId);
  if (!state) {
    return false;
  }

  const trimmed = text.trim();

  if (state.step === "existing") {
    if (!trimmed) {
      await bot.sendMessage(
        chatId,
        "Escribe el texto de gustos o elige sobrescribir o mezclar."
      );
      return true;
    }

    const nextState = updateWizardState(chatId, { pendingInlineText: trimmed });
    await bot.sendMessage(
      chatId,
      "✓ Texto recibido. ¿Quieres sobrescribir tus gustos o mezclarlos con los nuevos?"
    );
    await sendWizardStep(bot, chatId, nextState);
    return true;
  }

  const textField = getTextFieldForStep(state.step);
  if (!textField) {
    return false;
  }

  if (!trimmed) {
    await bot.sendMessage(
      chatId,
      "No entendí ese texto. Escribe tu respuesta o pulsa los botones."
    );
    return true;
  }

  if (state.textMode || isFreeformAnswer(trimmed)) {
    /** @type {Partial<import("./preferences-state.js").WizardState>} */
    const updates = {
      [textField]: trimmed,
      textMode: true,
    };

    const selectionField = getSelectionFieldForStep(state.step);
    if (selectionField === "interests") {
      updates.interests = [];
    } else if (selectionField === "avoid") {
      updates.avoid = [];
    } else if (selectionField === "style") {
      updates.style = null;
      updates.notes = null;
    }

    const nextState = updateWizardState(chatId, updates);
    await bot.sendMessage(
      chatId,
      "✓ Respuesta guardada. Pulsa Siguiente cuando quieras continuar."
    );
    await sendWizardStep(bot, chatId, nextState);
    return true;
  }

  const customItems = parseCustomItems(trimmed);
  if (!customItems.length) {
    await bot.sendMessage(
      chatId,
      "No entendí ese texto. Escribe tu respuesta o pulsa los botones."
    );
    return true;
  }

  if (state.step === "interests") {
    const interests = [...new Set([...state.interests, ...customItems])];
    const nextState = updateWizardState(chatId, {
      interests,
      interestsText: null,
      textMode: false,
    });
    await bot.sendMessage(
      chatId,
      `✓ Añadido a intereses: ${customItems.join(", ")}`
    );
    await sendWizardStep(bot, chatId, nextState);
    return true;
  }

  if (state.step === "avoid") {
    const avoid = [...new Set([...state.avoid, ...customItems])];
    const nextState = updateWizardState(chatId, {
      avoid,
      avoidText: null,
      textMode: false,
    });
    await bot.sendMessage(
      chatId,
      `✓ Añadido a evitar: ${customItems.join(", ")}`
    );
    await sendWizardStep(bot, chatId, nextState);
    return true;
  }

  if (state.step === "style") {
    const notes = state.notes ? `${state.notes} ${trimmed}` : trimmed;
    const nextState = updateWizardState(chatId, { notes, styleText: null });
    await bot.sendMessage(chatId, "✓ Nota añadida.");
    await sendWizardStep(bot, chatId, nextState);
    return true;
  }

  return false;
}

/**
 * @param {number} chatId
 * @returns {boolean}
 */
export function isWizardActive(chatId) {
  return Boolean(getWizardState(chatId));
}
