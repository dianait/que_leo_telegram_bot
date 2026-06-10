export const INTEREST_OPTIONS = [
  { id: "music", label: "Música" },
  { id: "cinema", label: "Cine" },
  { id: "art", label: "Arte" },
  { id: "dev", label: "Desarrollo" },
  { id: "lean", label: "Lean" },
  { id: "devops", label: "DevOps" },
  { id: "science", label: "Ciencia" },
  { id: "history", label: "Historia" },
  { id: "culture", label: "Cultura" },
  { id: "tech", label: "Tecnología" },
];

export const AVOID_OPTIONS = [
  { id: "clickbait", label: "Clickbait" },
  { id: "superficial", label: "Contenido superficial" },
  { id: "listicles", label: "Listicles vacíos" },
  { id: "sensational", label: "Sensacionalismo" },
  { id: "promo", label: "Contenido promocional" },
];

export const STYLE_OPTIONS = [
  { id: "intro", label: "Introductorio" },
  { id: "intermediate", label: "Intermedio" },
  { id: "deep", label: "Profundo" },
  { id: "mixed", label: "Mezcla de niveles" },
];

const OPTION_LABELS = new Map(
  [...INTEREST_OPTIONS, ...AVOID_OPTIONS, ...STYLE_OPTIONS].map((option) => [
    option.id,
    option.label,
  ])
);

/**
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function truncatePreview(text, max = 250) {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max)}…`;
}

/**
 * @param {string[]} selectedIds
 * @param {{ id: string, label: string }[]} options
 * @param {string} prefix
 * @returns {import("node-telegram-bot-api").InlineKeyboardButton[][]}
 */
export function buildToggleKeyboard(selectedIds, options, prefix) {
  const rows = [];
  let row = [];

  for (const option of options) {
    const selected = selectedIds.includes(option.id);
    const text = selected ? `✓ ${option.label}` : option.label;

    row.push({ text, callback_data: `${prefix}:${option.id}` });

    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }

  if (row.length > 0) {
    rows.push(row);
  }

  return rows;
}

/**
 * @param {string} step
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {import("node-telegram-bot-api").InlineKeyboardButton[][]}
 */
export function buildKeyboardForStep(step, data) {
  if (step === "existing") {
    return [
      [{ text: "🔄 Sobrescribir (empezar de cero)", callback_data: "g:replace" }],
      [{ text: "🔀 Mezclar con los actuales", callback_data: "g:merge" }],
      [{ text: "👁️ Ver gustos completos", callback_data: "g:view" }],
      [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
    ];
  }

  if (step === "interests") {
    if (data.textMode) {
      return [
        [{ text: "➡️ Siguiente", callback_data: "g:next" }],
        [{ text: "🔘 Usar botones", callback_data: "g:buttons" }],
        [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
      ];
    }

    return [
      [{ text: "✍️ Prefiero escribir", callback_data: "g:textmode" }],
      ...buildToggleKeyboard(data.interests, INTEREST_OPTIONS, "g:i"),
      [{ text: "➡️ Siguiente", callback_data: "g:next" }],
      [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
    ];
  }

  if (step === "avoid") {
    if (data.textMode) {
      return [
        [{ text: "➡️ Siguiente", callback_data: "g:next" }],
        [{ text: "🔘 Usar botones", callback_data: "g:buttons" }],
        [{ text: "⬅️ Atrás", callback_data: "g:back" }],
        [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
      ];
    }

    return [
      [{ text: "✍️ Prefiero escribir", callback_data: "g:textmode" }],
      ...buildToggleKeyboard(data.avoid, AVOID_OPTIONS, "g:a"),
      [{ text: "➡️ Siguiente", callback_data: "g:next" }],
      [{ text: "⬅️ Atrás", callback_data: "g:back" }],
      [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
    ];
  }

  if (step === "style") {
    if (data.textMode) {
      return [
        [{ text: "➡️ Ver resumen", callback_data: "g:next" }],
        [{ text: "🔘 Usar botones", callback_data: "g:buttons" }],
        [{ text: "⬅️ Atrás", callback_data: "g:back" }],
        [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
      ];
    }

    const rows = STYLE_OPTIONS.map((option) => [
      {
        text: data.style === option.id ? `✓ ${option.label}` : option.label,
        callback_data: `g:s:${option.id}`,
      },
    ]);

    return [
      [{ text: "✍️ Prefiero escribir", callback_data: "g:textmode" }],
      ...rows,
      [{ text: "➡️ Ver resumen", callback_data: "g:next" }],
      [{ text: "⬅️ Atrás", callback_data: "g:back" }],
      [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
    ];
  }

  return [
    [{ text: "✅ Guardar gustos", callback_data: "g:ok" }],
    [{ text: "⬅️ Editar", callback_data: "g:back" }],
    [{ text: "❌ Cancelar", callback_data: "g:cancel" }],
  ];
}

/**
 * @param {string} step
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {string}
 */
export function buildStepMessage(step, data) {
  if (step === "existing") {
    const preview = truncatePreview(data.existingPreferences ?? "");
    const newTextNote = data.pendingInlineText
      ? `\n\nNuevo texto que quieres guardar:\n${truncatePreview(data.pendingInlineText)}`
      : "";

    return `📋 Ya tienes gustos guardados

${preview}${newTextNote}

¿Qué quieres hacer con ellos?`;
  }

  if (step === "interests") {
    if (data.textMode) {
      const answer = data.interestsText
        ? truncatePreview(data.interestsText)
        : "ninguna aún";

      return `🎯 Configuración de gustos — Paso 1/4

¿Qué temas te interesan?

Escribe tu respuesta en un mensaje con tus palabras. No hace falta usar los botones.

Tu respuesta: ${answer}`;
    }

    const selected = formatInterestsAnswer(data);

    return `🎯 Configuración de gustos — Paso 1/4

¿Qué temas te interesan?

Pulsa las opciones o pulsa «Prefiero escribir» para responder con texto libre. También puedes escribir temas sueltos separados por comas.

Seleccionados: ${selected}`;
  }

  if (step === "avoid") {
    if (data.textMode) {
      const answer = data.avoidText
        ? truncatePreview(data.avoidText)
        : "ninguna aún";

      return `🎯 Configuración de gustos — Paso 2/4

¿Qué prefieres evitar?

Escribe tu respuesta en un mensaje con tus palabras. No hace falta usar los botones.

Tu respuesta: ${answer}`;
    }

    const selected = formatAvoidAnswer(data);

    return `🎯 Configuración de gustos — Paso 2/4

¿Qué prefieres evitar?

Pulsa las opciones o pulsa «Prefiero escribir» para responder con texto libre. También puedes escribir temas sueltos separados por comas.

Seleccionados: ${selected}`;
  }

  if (step === "style") {
    if (data.textMode) {
      const answer = data.styleText
        ? truncatePreview(data.styleText)
        : "ninguna aún";

      return `🎯 Configuración de gustos — Paso 3/4

¿Qué profundidad prefieres en los artículos?

Escribe tu respuesta en un mensaje con tus palabras. No hace falta usar los botones.

Tu respuesta: ${answer}`;
    }

    const selected = formatStyleAnswer(data);

    return `🎯 Configuración de gustos — Paso 3/4

¿Qué profundidad prefieres en los artículos?

Elige una opción o pulsa «Prefiero escribir». También puedes añadir una nota en un mensaje.

Seleccionado: ${selected}`;
  }

  const mergeNote =
    data.saveMode === "merge" && data.existingPreferences
      ? "\n\nSe combinarán con tus gustos anteriores."
      : "";

  return `🎯 Configuración de gustos — Paso 4/4

Resumen de tus gustos:

${formatWizardSummary(data)}${mergeNote}

¿Guardamos este perfil?`;
}

/**
 * @param {string[]} ids
 * @returns {string}
 */
function formatSelectedLabels(ids) {
  if (!ids.length) {
    return "ninguno aún";
  }

  return ids.map((id) => OPTION_LABELS.get(id) ?? id).join(", ");
}

/**
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {string}
 */
function formatInterestsAnswer(data) {
  if (data.interestsText) {
    return truncatePreview(data.interestsText);
  }

  return formatSelectedLabels(data.interests);
}

/**
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {string}
 */
function formatAvoidAnswer(data) {
  if (data.avoidText) {
    return truncatePreview(data.avoidText);
  }

  return formatSelectedLabels(data.avoid);
}

/**
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {string}
 */
function formatStyleAnswer(data) {
  if (data.styleText) {
    return truncatePreview(data.styleText);
  }

  if (data.style) {
    return OPTION_LABELS.get(data.style) ?? data.style;
  }

  if (data.notes) {
    return truncatePreview(data.notes);
  }

  return "ninguno aún";
}

/**
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {string}
 */
export function formatWizardSummary(data) {
  const lines = [
    `• Intereses: ${formatInterestsAnswer(data)}`,
    `• Evitar: ${formatAvoidAnswer(data)}`,
    `• Profundidad: ${formatStyleAnswer(data)}`,
  ];

  if (data.notes && !data.styleText) {
    lines.push(`• Notas: ${data.notes}`);
  }

  return lines.join("\n");
}

/**
 * @param {import("./preferences-state.js").WizardState} data
 * @returns {string}
 */
export function buildPreferencesText(data) {
  const parts = [];

  if (data.interestsText) {
    parts.push(`Me interesan: ${data.interestsText}.`);
  } else if (data.interests.length) {
    parts.push(
      `Me interesan: ${data.interests
        .map((id) => OPTION_LABELS.get(id) ?? id)
        .join(", ")}.`
    );
  }

  if (data.avoidText) {
    parts.push(`Evito: ${data.avoidText}.`);
  } else if (data.avoid.length) {
    parts.push(
      `Evito: ${data.avoid
        .map((id) => OPTION_LABELS.get(id) ?? id)
        .join(", ")}.`
    );
  }

  if (data.styleText) {
    parts.push(`Prefiero artículos: ${data.styleText}.`);
  } else if (data.style) {
    parts.push(
      `Prefiero artículos con nivel ${OPTION_LABELS.get(data.style) ?? data.style}.`
    );
  }

  if (data.notes && !data.styleText) {
    parts.push(data.notes);
  }

  return parts.join(" ").trim();
}

/**
 * @param {import("./preferences-state.js").WizardState} state
 * @returns {string}
 */
export function buildFinalPreferencesText(state) {
  const newText = buildPreferencesText(state);

  if (state.saveMode === "merge" && state.existingPreferences) {
    return `${state.existingPreferences.trim()}\n${newText}`.trim();
  }

  return newText;
}

/**
 * @param {string[]} items
 * @param {string} id
 * @returns {string[]}
 */
export function toggleSelection(items, id) {
  if (items.includes(id)) {
    return items.filter((item) => item !== id);
  }

  return [...items, id];
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function parseCustomItems(text) {
  return text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isFreeformAnswer(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.includes("\n")) {
    return true;
  }

  const parts = parseCustomItems(trimmed);
  if (parts.length !== 1) {
    return false;
  }

  const [answer] = parts;
  if (answer.split(/\s+/).length >= 4) {
    return true;
  }

  return answer.length > 35;
}

/**
 * @param {import("./preferences-state.js").WizardStep} step
 * @returns {"interestsText"|"avoidText"|"styleText"|null}
 */
export function getTextFieldForStep(step) {
  if (step === "interests") return "interestsText";
  if (step === "avoid") return "avoidText";
  if (step === "style") return "styleText";
  return null;
}

/**
 * @param {import("./preferences-state.js").WizardStep} step
 * @returns {"interests"|"avoid"|"style"|null}
 */
export function getSelectionFieldForStep(step) {
  if (step === "interests") return "interests";
  if (step === "avoid") return "avoid";
  if (step === "style") return "style";
  return null;
}

/**
 * @param {string} step
 * @returns {string|null}
 */
export function getNextStep(step) {
  if (step === "existing") return "interests";
  if (step === "interests") return "avoid";
  if (step === "avoid") return "style";
  if (step === "style") return "confirm";
  return null;
}

/**
 * @param {string} step
 * @param {import("./preferences-state.js").WizardState} state
 * @returns {string|null}
 */
export function getPreviousStep(step, state) {
  if (step === "confirm") return "style";
  if (step === "style") return "avoid";
  if (step === "avoid") return "interests";
  if (step === "interests" && state.existingPreferences) return "existing";
  return null;
}
