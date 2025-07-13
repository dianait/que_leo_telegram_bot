import { jest } from "@jest/globals";

export const fetchAndExtractMetadata = jest.fn().mockResolvedValue({
  title: "Título de prueba",
  description: "Descripción de prueba",
  language: "es",
  authors: ["Autor Prueba"],
  topics: ["tema1", "tema2"],
});

export const isValidUrl = jest.fn().mockImplementation((url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
});
