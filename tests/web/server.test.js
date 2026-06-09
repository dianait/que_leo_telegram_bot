import request from "supertest";
import { app, isOriginAllowed } from "../../src/web/server.js";

describe("Servidor web", () => {
  test("GET /health responde OK", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.timestamp).toBeDefined();
  });

  test("ruta desconocida responde 404", async () => {
    const res = await request(app).get("/ruta-inexistente");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Not found");
  });

  test("CORS permite producción, previews de Vercel y localhost en desarrollo", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    expect(isOriginAllowed("https://que-leo.vercel.app")).toBe(true);
    expect(isOriginAllowed("https://que-leo-git-main-dianait.vercel.app")).toBe(
      true
    );
    expect(isOriginAllowed("https://evil.example.com")).toBe(false);

    process.env.NODE_ENV = "development";
    expect(isOriginAllowed("http://localhost:5173")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:9999")).toBe(true);

    process.env.NODE_ENV = "production";
    expect(isOriginAllowed("http://localhost:5173")).toBe(false);

    process.env.NODE_ENV = originalNodeEnv;
  });

  test("GET /api/extract-metadata sin url responde 400", async () => {
    const res = await request(app).get("/api/extract-metadata");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("URL es requerida");
  });
});
