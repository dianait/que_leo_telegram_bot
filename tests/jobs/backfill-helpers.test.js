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
        topics: ["Swift", "iOS", "Mobile"],
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

  test("needsAiBackfill detecta valoración, resumen o razón faltante", () => {
    expect(
      needsAiBackfill({
        ai_rating: 8,
        ai_summary: "Resumen",
        ai_rating_reason: "Encaja bien.",
      })
    ).toBe(false);
    expect(needsAiBackfill({ ai_rating: null, ai_summary: null })).toBe(true);
    expect(needsAiBackfill({ ai_rating: 7, ai_summary: null })).toBe(true);
    expect(
      needsAiBackfill({
        ai_rating: 8,
        ai_summary: "Resumen",
        ai_rating_reason: null,
      })
    ).toBe(true);
  });

  test("buildMetadataPatch limpia autores desconocido dejando array vacío", () => {
    const patch = buildMetadataPatch(
      {
        title: "Buen título",
        authors: ["desconocido"],
        language: "es",
        topics: ["Swift", "iOS", "Mobile"],
        featured_image: "https://example.com/cover.jpg",
      },
      { authors: ["desconocido"] }
    );

    expect(patch).toEqual({ authors: [] });
  });

  test("needsMetadataBackfill detecta menos de 3 topics", () => {
    expect(
      needsMetadataBackfill({
        title: "Buen título",
        authors: ["@autor"],
        language: "en",
        topics: ["Swift", "iOS"],
        featured_image: "https://example.com/img.jpg",
      })
    ).toBe(true);
  });

  test("buildMetadataPatch normaliza autores con URL de Medium", () => {
    const patch = buildMetadataPatch(
      {
        title: "Buen título",
        authors: ["https://medium.com/@tripadvisor-tech"],
        language: "en",
        topics: ["Swift", "iOS", "Mobile"],
        featured_image: "https://example.com/cover.jpg",
      },
      { authors: [] }
    );

    expect(patch).toEqual({ authors: ["@tripadvisor-tech"] });
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
        topics: ["Swift", "iOS", "Mobile"],
        featured_image: "https://example.com/cover.jpg",
      }
    );

    expect(patch).toEqual({
      title: "Título nuevo",
      authors: ["Diana"],
      language: "es",
      topics: ["Swift", "iOS", "Mobile"],
      featured_image: "https://example.com/cover.jpg",
    });
  });
});
