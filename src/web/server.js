import express from "express";
import cors from "cors";
import {
  fetchAndExtractMetadata,
  isValidUrl,
} from "../extractors/article-extractor.js";
import { extractFirstUrl } from "../utils/validators.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: [
      "https://que-leo.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:8080",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8080",
    ],
    methods: ["GET", "OPTIONS"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/api/extract-metadata", async (req, res) => {
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
    console.error("Error extrayendo metadatos:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "Ocurrió un error al procesar la URL",
    });
  }
});

export { app };

export function startWebServer() {
  app.listen(PORT, () => {
    console.log(`🌐 Servidor web iniciado en puerto ${PORT}`);
    console.log(`   GET  /api/extract-metadata?url=<URL>`);
  });
}
