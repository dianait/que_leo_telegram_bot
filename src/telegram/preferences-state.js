const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** @typedef {"existing"|"interests"|"avoid"|"style"|"confirm"} WizardStep */
/** @typedef {"replace"|"merge"|null} SaveMode */

/**
 * @typedef {Object} WizardState
 * @property {string} userId
 * @property {number} expiresAt
 * @property {"wizard"} mode
 * @property {WizardStep} step
 * @property {string[]} interests
 * @property {string[]} avoid
 * @property {string|null} style
 * @property {string|null} notes
 * @property {string|null} interestsText
 * @property {string|null} avoidText
 * @property {string|null} styleText
 * @property {boolean} textMode
 * @property {string|null} existingPreferences
 * @property {SaveMode} saveMode
 * @property {string|null} pendingInlineText
 * @property {number|null} [messageId]
 */

/** @type {Map<number, WizardState>} */
const pendingPreferences = new Map();

/**
 * @param {number} chatId
 * @param {string} userId
 * @param {{ existingPreferences?: string|null, pendingInlineText?: string|null }} [options]
 * @param {number} [ttlMs]
 * @returns {WizardState}
 */
export function startWizard(chatId, userId, options = {}, ttlMs = DEFAULT_TTL_MS) {
  const existingPreferences = options.existingPreferences?.trim() || null;

  const state = {
    userId,
    expiresAt: Date.now() + ttlMs,
    mode: "wizard",
    step: existingPreferences ? "existing" : "interests",
    interests: [],
    avoid: [],
    style: null,
    notes: null,
    interestsText: null,
    avoidText: null,
    styleText: null,
    textMode: false,
    existingPreferences,
    saveMode: null,
    pendingInlineText: options.pendingInlineText?.trim() || null,
    messageId: null,
  };

  pendingPreferences.set(chatId, state);
  return state;
}

/**
 * @param {number} chatId
 * @returns {WizardState|null}
 */
export function getWizardState(chatId) {
  const state = pendingPreferences.get(chatId);
  if (!state) {
    return null;
  }

  if (Date.now() > state.expiresAt) {
    pendingPreferences.delete(chatId);
    return null;
  }

  return state;
}

/**
 * @param {number} chatId
 * @param {Partial<WizardState>} updates
 * @returns {WizardState|null}
 */
export function updateWizardState(chatId, updates) {
  const state = getWizardState(chatId);
  if (!state) {
    return null;
  }

  const nextState = { ...state, ...updates };
  pendingPreferences.set(chatId, nextState);
  return nextState;
}

/**
 * @param {number} chatId
 */
export function clearAwaitingPreferences(chatId) {
  pendingPreferences.delete(chatId);
}

/**
 * @param {number} [ttlMs]
 */
export function cleanupPreferencesState(ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  for (const [chatId, state] of pendingPreferences.entries()) {
    if (now > state.expiresAt) {
      pendingPreferences.delete(chatId);
    }
  }
}

export const PREFERENCES_MAX_CHARS = 2000;
