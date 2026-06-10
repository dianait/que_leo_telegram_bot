import {
  buildFinalPreferencesText,
  buildKeyboardForStep,
  buildPreferencesText,
  buildStepMessage,
  getNextStep,
  getPreviousStep,
  isFreeformAnswer,
  parseCustomItems,
  toggleSelection,
} from "../../src/telegram/gustos-wizard.js";

describe("gustos wizard", () => {
  test("toggleSelection añade y quita opciones", () => {
    expect(toggleSelection([], "music")).toEqual(["music"]);
    expect(toggleSelection(["music"], "music")).toEqual([]);
  });

  test("parseCustomItems separa por comas", () => {
    expect(parseCustomItems("fotografía, diseño")).toEqual([
      "fotografía",
      "diseño",
    ]);
  });

  test("isFreeformAnswer detecta respuestas en frase completa", () => {
    expect(isFreeformAnswer("fotografía, diseño")).toBe(false);
    expect(
      isFreeformAnswer(
        "Me interesan ensayos largos sobre arquitectura de software"
      )
    ).toBe(true);
  });

  test("buildPreferencesText usa texto libre cuando existe", () => {
    const text = buildPreferencesText({
      interests: ["music"],
      avoid: [],
      style: null,
      notes: null,
      interestsText: "ensayos técnicos y filosofía",
      avoidText: null,
      styleText: null,
      existingPreferences: null,
      saveMode: null,
      textMode: false,
    });

    expect(text).toBe("Me interesan: ensayos técnicos y filosofía.");
    expect(text).not.toContain("Música");
  });

  test("buildPreferencesText compone el prompt final", () => {
    const text = buildPreferencesText({
      interests: ["music", "cinema"],
      avoid: ["clickbait"],
      style: "deep",
      notes: "Prefiero ensayos largos.",
      interestsText: null,
      avoidText: null,
      styleText: null,
      existingPreferences: null,
      saveMode: null,
      textMode: false,
    });

    expect(text).toContain("Me interesan: Música, Cine.");
    expect(text).toContain("Evito: Clickbait.");
    expect(text).toContain("Prefiero artículos con nivel Profundo.");
    expect(text).toContain("Prefiero ensayos largos.");
  });

  test("buildFinalPreferencesText mezcla con gustos anteriores", () => {
    const text = buildFinalPreferencesText({
      interests: ["dev"],
      avoid: [],
      style: null,
      notes: null,
      existingPreferences: "Me interesan: arte.",
      saveMode: "merge",
    });

    expect(text).toContain("Me interesan: arte.");
    expect(text).toContain("Me interesan: Desarrollo.");
  });

  test("buildKeyboardForStep ofrece escribir en modo botones", () => {
    const keyboard = buildKeyboardForStep("interests", {
      interests: [],
      avoid: [],
      style: null,
      notes: null,
      interestsText: null,
      avoidText: null,
      styleText: null,
      textMode: false,
      existingPreferences: null,
      saveMode: null,
      pendingInlineText: null,
    });

    expect(keyboard[0][0].callback_data).toBe("g:textmode");
  });

  test("buildStepMessage en modo texto pide escribir la respuesta", () => {
    const message = buildStepMessage("interests", {
      interests: [],
      avoid: [],
      style: null,
      notes: null,
      interestsText: "ensayos sobre sistemas distribuidos",
      avoidText: null,
      styleText: null,
      textMode: true,
      existingPreferences: null,
      saveMode: null,
      pendingInlineText: null,
    });

    expect(message).toContain("Escribe tu respuesta");
    expect(message).toContain("sistemas distribuidos");
  });

  test("buildStepMessage muestra gustos existentes", () => {
    const message = buildStepMessage("existing", {
      interests: [],
      avoid: [],
      style: null,
      notes: null,
      interestsText: null,
      avoidText: null,
      styleText: null,
      textMode: false,
      existingPreferences: "Me interesan: cine y música.",
      saveMode: null,
      pendingInlineText: null,
    });

    expect(message).toContain("Ya tienes gustos guardados");
    expect(message).toContain("cine y música");
  });

  test("buildStepMessage muestra texto inline pendiente", () => {
    const message = buildStepMessage("existing", {
      interests: [],
      avoid: [],
      style: null,
      notes: null,
      existingPreferences: "Me interesan: cine.",
      saveMode: null,
      pendingInlineText: "Me interesan Swift.",
    });

    expect(message).toContain("Nuevo texto que quieres guardar");
    expect(message).toContain("Swift");
  });

  test("buildStepMessage incluye ejemplos genéricos en intereses", () => {
    const message = buildStepMessage("interests", {
      interests: [],
      avoid: [],
      style: null,
      notes: null,
      interestsText: null,
      avoidText: null,
      styleText: null,
      textMode: false,
      existingPreferences: null,
      saveMode: null,
      pendingInlineText: null,
    });

    expect(message).toContain("Paso 1/4");
    expect(message).toContain("Prefiero escribir");
  });

  test("navegación entre pasos", () => {
    const withExisting = {
      existingPreferences: "Gustos previos",
      saveMode: null,
    };

    expect(getNextStep("existing")).toBe("interests");
    expect(getNextStep("interests")).toBe("avoid");
    expect(getPreviousStep("interests", withExisting)).toBe("existing");
    expect(getPreviousStep("interests", { existingPreferences: null })).toBeNull();
  });
});
