import {
  buildTasteProfileFromHistory,
  formatTasteProfileForPrompt,
} from "../../src/ai/user-taste-profile.js";

describe("user-taste-profile", () => {
  test("agrega autores, temas y dominios frecuentes", () => {
    const profile = buildTasteProfileFromHistory([
      {
        ai_rating: 9,
        title: "SwiftUI body",
        url: "https://dianait.blog/swiftui-body",
        authors: ["Diana"],
        topics: ["SwiftUI", "Swift"],
      },
      {
        ai_rating: 8,
        title: "CoW en Swift",
        url: "https://dianait.blog/copy-on-write",
        authors: ["Diana"],
        topics: ["Swift", "Performance"],
      },
      {
        ai_rating: 7,
        title: "Medium post",
        url: "https://medium.com/post",
        authors: ["Otro"],
        topics: ["Swift"],
      },
    ]);

    expect(profile.totalArticles).toBe(3);
    expect(profile.authors[0]).toEqual({ name: "Diana", count: 2 });
    expect(profile.topics[0]).toEqual({ name: "Swift", count: 3 });
    expect(profile.domains.map((item) => item.name)).toContain("dianait.blog");
  });

  test("formatTasteProfileForPrompt devuelve null sin historial", () => {
    expect(formatTasteProfileForPrompt(buildTasteProfileFromHistory([]))).toBeNull();
  });

  test("formatTasteProfileForPrompt incluye ejemplos recientes", () => {
    const text = formatTasteProfileForPrompt(
      buildTasteProfileFromHistory([
        {
          ai_rating: 9,
          title: "Universal Links",
          url: "https://dianait.blog/universal-links",
          authors: ["Diana"],
          topics: ["iOS"],
        },
      ])
    );

    expect(text).toContain("Artículos de referencia analizados");
    expect(text).toContain("Universal Links");
    expect(text).toContain("9/10");
  });
});
