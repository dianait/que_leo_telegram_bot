import express from "express";
import cors from "cors";
import {
  fetchAndExtractMetadata,
  isValidUrl,
} from "../extractors/article-extractor.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Permitir cualquier origen temporalmente para pruebas
app.use(express.json());

// Endpoint GET para extraer metadatos
app.get("/api/extract-metadata", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL es requerida",
        message: "Debes proporcionar una URL como parámetro de consulta",
      });
    }

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

export function startWebServer() {
  app.listen(PORT, () => {
    console.log(`🌐 Servidor web iniciado en puerto ${PORT}`);
    console.log(`📡 Endpoint: GET /api/extract-metadata?url=<URL>`);
  });
}
