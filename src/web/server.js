import express from "express";
import cors from "cors";
import multer from "multer";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import {
  fetchAndExtractMetadata,
  isValidUrl,
} from "../extractors/article-extractor.js";
import { extractFirstUrl } from "../utils/validators.js";

// Inicialización flexible de Google Cloud Vision
import fs from "fs";
import path from "path";

let visionClient;
const credentialsEnv =
  process.env.GOOGLE_CLOUD_KEY_FILE ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (credentialsEnv && credentialsEnv.trim().startsWith("{")) {
  // Es un JSON, lo guardamos temporalmente
  const tempPath = path.join("/tmp", "google-credentials.json");
  fs.writeFileSync(tempPath, credentialsEnv);
  visionClient = new ImageAnnotatorClient({ keyFilename: tempPath });
} else {
  // Es una ruta a un archivo
  visionClient = new ImageAnnotatorClient({ keyFilename: credentialsEnv });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar multer para manejar archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  },
});

// Middleware
app.use(
  cors({
    origin: [
      "https://que-leo.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173", // Vite default
      "http://localhost:8080", // Otros puertos comunes
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8080",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Endpoint GET para extraer metadatos
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

    // Extraer la primera URL válida del texto recibido
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

// Endpoint POST para OCR con Google Cloud Vision
app.post("/api/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Imagen requerida",
        message: "Debes enviar una imagen en el campo 'image'",
      });
    }

    // Verificar si las credenciales están configuradas
    if (
      !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      !process.env.GOOGLE_CLOUD_KEY_FILE
    ) {
      return res.status(503).json({
        success: false,
        error: "Credenciales de Google Cloud Vision no configuradas",
        message:
          "El servicio de OCR no está disponible. Contacta al administrador.",
      });
    }

    // Convertir la imagen a base64
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");

    // Configurar la solicitud para Google Cloud Vision
    const request = {
      image: {
        content: base64Image,
      },
      features: [
        {
          type: "TEXT_DETECTION",
        },
      ],
    };

    // Realizar la solicitud a Google Cloud Vision
    const [result] = await visionClient.annotateImage(request);
    const textAnnotations = result.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No se detectó texto",
        message: "No se encontró texto en la imagen proporcionada",
      });
    }

    // Extraer el texto completo (el primer elemento contiene todo el texto)
    const extractedText = textAnnotations[0].description;

    res.json({
      success: true,
      data: {
        text: extractedText,
        confidence: textAnnotations[0].confidence || null,
        language: textAnnotations[0].locale || null,
      },
      message: "Texto extraído exitosamente",
    });
  } catch (error) {
    console.error("Error en OCR:", error);

    // Manejar errores específicos de Google Cloud Vision
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error: "Servicio de OCR no disponible",
        message: "No se pudo conectar con el servicio de Google Cloud Vision",
      });
    }

    // Manejar errores de credenciales
    if (
      error.message &&
      error.message.includes("Could not load the default credentials")
    ) {
      return res.status(503).json({
        success: false,
        error: "Credenciales de Google Cloud Vision inválidas",
        message:
          "Las credenciales configuradas no son válidas. Verifica la configuración.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "Ocurrió un error al procesar la imagen",
    });
  }
});

// Endpoint alternativo para OCR con imagen en base64
app.post("/api/ocr-base64", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: "Imagen en base64 requerida",
        message: "Debes proporcionar una imagen en formato base64",
      });
    }

    // Verificar si las credenciales están configuradas
    if (
      !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      !process.env.GOOGLE_CLOUD_KEY_FILE
    ) {
      return res.status(503).json({
        success: false,
        error: "Credenciales de Google Cloud Vision no configuradas",
        message:
          "El servicio de OCR no está disponible. Contacta al administrador.",
      });
    }

    // Configurar la solicitud para Google Cloud Vision
    const request = {
      image: {
        content: imageBase64,
      },
      features: [
        {
          type: "TEXT_DETECTION",
        },
      ],
    };

    // Realizar la solicitud a Google Cloud Vision
    const [result] = await visionClient.annotateImage(request);
    const textAnnotations = result.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No se detectó texto",
        message: "No se encontró texto en la imagen proporcionada",
      });
    }

    // Extraer el texto completo
    const extractedText = textAnnotations[0].description;

    res.json({
      success: true,
      data: {
        text: extractedText,
        confidence: textAnnotations[0].confidence || null,
        language: textAnnotations[0].locale || null,
      },
      message: "Texto extraído exitosamente",
    });
  } catch (error) {
    console.error("Error en OCR base64:", error);

    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        error: "Servicio de OCR no disponible",
        message: "No se pudo conectar con el servicio de Google Cloud Vision",
      });
    }

    // Manejar errores de credenciales
    if (
      error.message &&
      error.message.includes("Could not load the default credentials")
    ) {
      return res.status(503).json({
        success: false,
        error: "Credenciales de Google Cloud Vision inválidas",
        message:
          "Las credenciales configuradas no son válidas. Verifica la configuración.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: "Ocurrió un error al procesar la imagen",
    });
  }
});

export { app };

export function startWebServer() {
  app.listen(PORT, () => {
    console.log(`🌐 Servidor web iniciado en puerto ${PORT}`);
    console.log(`📡 Endpoints disponibles:`);
    console.log(`   GET  /api/extract-metadata?url=<URL>`);
    console.log(`   POST /api/ocr (con archivo de imagen)`);
    console.log(`   POST /api/ocr-base64 (con imagen en base64)`);
  });
}
