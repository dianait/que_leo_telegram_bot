import {
  buildMetadataPatch,
  isMissingOrBadTitle,
  needsAiBackfill,
  needsMetadataBackfill,
} from "../../src/jobs/backfill-helpers.js";

describe("backfill-helpers", () => {
  test("detecta títulos inválidos", () => {
    expect(isMissingOrBadTitle("Just a moment...")).toBe(true);
    expect(isMissingOrBadTitle("Artículo real")).toBe(false);
  });

  test("needsMetadataBackfill detecta campos faltantes", () => {
    expect(
      needsMetadataBackfill({
        title: "Buen título",
        authors: ["Autor"],
        language: "en",
        topics: ["Swift"],
        featured_image: "https://example.com/img.jpg",
      })
    ).toBe(false);

    expect(
      needsMetadataBackfill({
        title: "Just a moment...",
        authors: [],
        language: null,
        topics: [],
        featured_image: null,
      })
    ).toBe(true);
  });

  test("needsAiBackfill detecta valoración o resumen faltante", () => {
    expect(needsAiBackfill({ ai_rating: 8, ai_summary: "Resumen" })).toBe(false);
    expect(needsAiBackfill({ ai_rating: null, ai_summary: null })).toBe(true);
    expect(needsAiBackfill({ ai_rating: 7, ai_summary: null })).toBe(true);
  });

  test("buildMetadataPatch solo rellena huecos", () => {
    const patch = buildMetadataPatch(
      {
        title: "Just a moment...",
        authors: [],
        language: null,
        topics: [],
        featured_image: null,
      },
      {
        title: "Título nuevo",
        authors: ["Diana"],
        language: "es",
        topics: ["Swift"],
        featured_image: "https://example.com/cover.jpg",
      }
    );

    expect(patch).toEqual({
      title: "Título nuevo",
      authors: ["Diana"],
      language: "es",
      topics: ["Swift"],
      featured_image: "https://example.com/cover.jpg",
    });
  });
});
