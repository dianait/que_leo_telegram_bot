import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
  fetchAndExtractMetadata,
  isValidUrl,
} from "../extractors/article-extractor.js";
import { extractFirstUrl } from "../utils/validators.js";

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_ORIGINS = [
  "https://que-leo.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
];

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? DEFAULT_ORIGINS,
    methods: ["GET", "OPTIONS"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/api/extract-metadata", async (req, res, next) => {
  try {
    let { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL es requerida",
        message: "Debes proporcionar una URL como parámetro de consulta",
      });
    }

    url = extractFirstUrl(url) || url;

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: "URL inválida",
        message: "La URL proporcionada no es válida",
      });
    }

    const metadata = await fetchAndExtractMetadata(url);

    if (!metadata.title && !metadata.description) {
      return res.status(404).json({
        success: false,
        error: "No se pudieron extraer metadatos",
        message: "No se encontraron metadatos en la URL proporcionada",
      });
    }

    res.json({
      success: true,
      data: metadata,
      url: url,
    });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    message: "Ruta no encontrada",
  });
});

app.use((err, _req, res, _next) => {
  console.error("Error no manejado:", err);
  res.status(err.status || 500).json({
    success: false,
    error: "Error interno del servidor",
    message:
      process.env.NODE_ENV === "production"
        ? "Ocurrió un error al procesar la solicitud"
        : err.message,
  });
});

export { app };

export function startWebServer() {
  const server = app.listen(PORT, () => {
    console.log(`🌐 Servidor web iniciado en puerto ${PORT}`);
    console.log(`   GET  /health`);
    console.log(`   GET  /api/extract-metadata?url=<URL>`);
  });
  return server;
}
