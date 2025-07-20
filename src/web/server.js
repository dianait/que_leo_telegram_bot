import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
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

// Eliminar importaciones y lógica de Google Cloud Vision y endpoints /api/ocr y /api/ocr-base64
import { ImageAnnotatorClient } from "@google-cloud/vision";

let openai;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
} else {
  console.warn(
    "OPENAI_API_KEY no configurada. El servicio de OpenAI Vision no estará disponible."
  );
}

app.post("/api/openai-book-title", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Imagen requerida",
        message: "Debes enviar una imagen en el campo 'image'",
      });
    }
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "¿Cuál es el título del libro en esta imagen? Solo responde el título.",
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 50,
    });
    res.json({
      success: true,
      title: response.choices[0].message.content,
    });
  } catch (error) {
    console.error(
      "Error llamando a OpenAI Vision:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Error llamando a OpenAI Vision" });
  }
});

export { app };

export function startWebServer() {
  app.listen(PORT, () => {
    console.log(`🌐 Servidor web iniciado en puerto ${PORT}`);
    console.log(`📡 Endpoints disponibles:`);
    console.log(`   GET  /api/extract-metadata?url=<URL>`);
    console.log(`   POST /api/openai-book-title (con archivo de imagen)`);
  });
}
