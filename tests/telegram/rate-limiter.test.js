import jest from "jest-mock";
import {
  checkRateLimit,
  cleanupRateLimiter,
} from "../../src/telegram/rate-limiter.js";

describe("Rate Limiter", () => {
  let dateNowSpy;

  beforeEach(() => {
    cleanupRateLimiter(60 * 1000); // Limpiar antes de cada test
    // Limpiar cualquier mock previo
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
    }
  });

  afterEach(() => {
    // Asegurar que se restaure el mock después de cada test
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
    }
  });

  test("permite hasta 5 acciones en 60 segundos", () => {
    const userId = "user1";
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(userId);
      expect(result.allowed).toBe(true);
    }
    const blocked = checkRateLimit(userId);
    expect(blocked.allowed).toBe(false);
    expect(typeof blocked.retryAfter).toBe("number");
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  test("permite de nuevo tras esperar el tiempo suficiente", () => {
    const userId = "user2";
    const now = Date.now();

    // Ejecutar 5 acciones para llenar el límite
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId);
    }

    // Verificar que está bloqueado
    expect(checkRateLimit(userId).allowed).toBe(false);

    // Mock del tiempo para simular que han pasado 61 segundos
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now + 61 * 1000);

    // Ahora debería permitir de nuevo
    const result = checkRateLimit(userId);
    expect(result.allowed).toBe(true);
  });

  test("usuarios diferentes no se afectan entre sí", () => {
    const userA = "A";
    const userB = "B";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(userA).allowed).toBe(true);
      expect(checkRateLimit(userB).allowed).toBe(true);
    }
    expect(checkRateLimit(userA).allowed).toBe(false);
    expect(checkRateLimit(userB).allowed).toBe(false);
  });

  test("cleanupRateLimiter elimina usuarios inactivos", () => {
    const userId = "user3";
    const now = Date.now();

    // Ejecutar 5 acciones para llenar el límite
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId);
    }

    // Verificar que está bloqueado
    expect(checkRateLimit(userId).allowed).toBe(false);

    // Mock del tiempo para simular que han pasado 61 segundos
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now + 61 * 1000);

    // Ejecutar cleanup
    cleanupRateLimiter(60 * 1000);

    // Ahora debería permitir de nuevo
    expect(checkRateLimit(userId).allowed).toBe(true);
  });

  test("retryAfter es correcto", () => {
    const userId = "user4";
    const now = Date.now();

    // Mock del tiempo para tener control preciso
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

    // Ejecutar 5 acciones para llenar el límite
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId);
    }

    // Verificar que está bloqueado y el tiempo de retry es correcto
    const blocked = checkRateLimit(userId);
    expect(blocked.allowed).toBe(false);
    expect(Math.abs(blocked.retryAfter - 60000)).toBeLessThan(100);
  });
});
