import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger.js";
import {
  fetchAndExtractMetadata,
  isValidUrl,
} from "../extractors/article-extractor.js";
import { extractFirstUrl } from "../utils/validators.js";

const app = express();
const PORT = process.env.PORT || 3000;

const PRODUCTION_ORIGIN = "https://que-leo.vercel.app";

/**
 * @param {string} [origin]
 * @returns {boolean}
 */
function isLocalDevOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/**
 * Preview deployments on Vercel (e.g. que-leo-git-main-*.vercel.app).
 * @param {string} origin
 * @returns {boolean}
 */
function isVercelPreviewOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function getExtraOrigins() {
  if (!process.env.ALLOWED_ORIGINS) {
    return [];
  }

  return process.env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * @param {string|undefined} origin
 * @returns {boolean}
 */
export function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  const allowed = new Set([PRODUCTION_ORIGIN, ...getExtraOrigins()]);
  if (allowed.has(origin)) {
    return true;
  }

  if (isVercelPreviewOrigin(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
    return true;
  }

  return false;
}

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      logger.warn({ origin }, "CORS request blocked");
      callback(new Error(`Origin not allowed: ${origin}`));
    },
    methods: ["GET", "OPTIONS"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));

const metadataRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests",
    message: "Rate limit exceeded. Try again later.",
  },
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      },
      "HTTP request completed"
    );
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/api/extract-metadata", metadataRateLimiter, async (req, res, next) => {
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
  logger.error({ err }, "Unhandled HTTP error");
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
