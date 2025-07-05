import {
  isValidUrl,
  parseStartCommand,
  isLinkMessage,
  isValidUserId,
} from "../src/validators.js";

describe("Validators", () => {
  describe("isValidUrl", () => {
    test("valida URLs HTTP válidas", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("http://www.example.com")).toBe(true);
      expect(isValidUrl("http://example.com/path")).toBe(true);
      expect(isValidUrl("http://example.com/path?param=value")).toBe(true);
    });

    test("valida URLs HTTPS válidas", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://www.example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path")).toBe(true);
    });

    test("rechaza URLs inválidas", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("example.com")).toBe(false);
      expect(isValidUrl("")).toBe(false);
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });
  });

  describe("parseStartCommand", () => {
    test("parsea comando /start sin user_id", () => {
      const result = parseStartCommand("/start");

      expect(result).toEqual({
        isStart: true,
        userId: null,
      });
    });

    test("parsea comando /start con user_id", () => {
      const result = parseStartCommand("/start abc123");

      expect(result).toEqual({
        isStart: true,
        userId: "abc123",
      });
    });

    test("parsea comando /start con user_id con guiones", () => {
      const result = parseStartCommand("/start user-123");

      expect(result).toEqual({
        isStart: true,
        userId: "user-123",
      });
    });

    test("rechaza comandos que no son /start", () => {
      expect(parseStartCommand("/help")).toBeNull();
      expect(parseStartCommand("start")).toBeNull();
      expect(parseStartCommand("")).toBeNull();
      expect(parseStartCommand(null)).toBeNull();
    });
  });

  describe("isLinkMessage", () => {
    test("identifica mensajes que son enlaces HTTP", () => {
      expect(isLinkMessage("http://example.com")).toBe(true);
      expect(isLinkMessage("http://www.example.com")).toBe(true);
      expect(isLinkMessage("http://example.com/path")).toBe(true);
    });

    test("identifica mensajes que son enlaces HTTPS", () => {
      expect(isLinkMessage("https://example.com")).toBe(true);
      expect(isLinkMessage("https://www.example.com")).toBe(true);
      expect(isLinkMessage("https://example.com/path")).toBe(true);
    });

    test("rechaza mensajes que no son enlaces", () => {
      expect(isLinkMessage("Hola mundo")).toBe(false);
      expect(isLinkMessage("example.com")).toBe(false);
      expect(isLinkMessage("ftp://example.com")).toBe(false);
      expect(isLinkMessage("")).toBe(false);
      expect(isLinkMessage(null)).toBe(false);
    });
  });

  describe("isValidUserId", () => {
    test("valida user_ids alfanuméricos", () => {
      expect(isValidUserId("abc123")).toBe(true);
      expect(isValidUserId("user123")).toBe(true);
      expect(isValidUserId("123456")).toBe(true);
    });

    test("valida user_ids con guiones", () => {
      expect(isValidUserId("user-123")).toBe(true);
      expect(isValidUserId("abc-def")).toBe(true);
      expect(isValidUserId("123-456")).toBe(true);
    });

    test("rechaza user_ids inválidos", () => {
      expect(isValidUserId("user@123")).toBe(false);
      expect(isValidUserId("user 123")).toBe(false);
      expect(isValidUserId("user_123")).toBe(false);
      expect(isValidUserId("")).toBe(false);
      expect(isValidUserId(null)).toBe(false);
      expect(isValidUserId(undefined)).toBe(false);
    });
  });
});
