import dotenv from "dotenv";
import FirecrawlApp from "firecrawl";

dotenv.config();

async function testFirecrawl() {
  console.log("🧪 Probando Firecrawl...");

  if (!process.env.FIRECRAWL_API_KEY) {
    console.log("❌ No hay API key de Firecrawl configurada");
    return;
  }

  try {
    const firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY,
    });
    console.log("✅ Firecrawl inicializado correctamente");

    // Test con una URL diferente
    const testUrl = "https://www.google.com";
    console.log(`🔍 Probando extracción de: ${testUrl}`);

    const result = await firecrawl.scrapeUrl({
      url: testUrl,
      pageOptions: {
        onlyMainContent: false,
        includeHtml: false,
        includeMarkdown: false,
        includeScreenshot: false,
        includeAllMetadata: true,
      },
    });

    console.log("📊 Resultado completo:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("✅ Firecrawl funciona correctamente");
      console.log("📊 Metadatos extraídos:");
      console.log("- Título:", result.data.title || "No encontrado");
      console.log(
        "- Descripción:",
        result.data.metadata?.description || "No encontrada"
      );
      console.log(
        "- Idioma:",
        result.data.metadata?.language || "No encontrado"
      );
    } else {
      console.log("❌ Error en Firecrawl:", result.error);
    }
  } catch (error) {
    console.log("❌ Error al inicializar Firecrawl:", error.message);
    console.log("🔍 Detalles del error:", error);
  }
}

testFirecrawl();
