import {
  authorsNeedCleanup,
  isPlaceholderAuthor,
  normalizeAuthor,
  normalizeAuthors,
} from "../../src/utils/author-normalizer.js";

describe("author-normalizer", () => {
  test("convierte URL de Medium en @handle", () => {
    expect(normalizeAuthor("https://medium.com/@tripadvisor-tech")).toBe(
      "@tripadvisor-tech"
    );
  });

  test("mantiene handles ya normalizados", () => {
    expect(normalizeAuthor("@tripadvisor-tech")).toBe("@tripadvisor-tech");
    expect(normalizeAuthor("Diana García")).toBe("Diana García");
  });

  test("normalizeAuthors elimina duplicados y URLs inválidas", () => {
    expect(
      normalizeAuthors([
        "https://medium.com/@tripadvisor-tech",
        "@tripadvisor-tech",
        "https://example.com/no-handle",
      ])
    ).toEqual(["@tripadvisor-tech"]);
  });

  test("descarta autores placeholder como desconocido", () => {
    expect(isPlaceholderAuthor("desconocido")).toBe(true);
    expect(normalizeAuthor("desconocido")).toBeNull();
    expect(normalizeAuthors(["desconocido", "Diana"])).toEqual(["Diana"]);
  });

  test("authorsNeedCleanup detecta autores en formato URL o placeholder", () => {
    expect(
      authorsNeedCleanup(["https://medium.com/@tripadvisor-tech"])
    ).toBe(true);
    expect(authorsNeedCleanup(["desconocido"])).toBe(true);
    expect(authorsNeedCleanup(["@tripadvisor-tech"])).toBe(false);
    expect(authorsNeedCleanup([])).toBe(false);
  });
});
