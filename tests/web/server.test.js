import request from "supertest";
import { app } from "../../src/web/server.js";

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

  test("GET /api/extract-metadata sin url responde 400", async () => {
    const res = await request(app).get("/api/extract-metadata");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("URL es requerida");
  });
});
