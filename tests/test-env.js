import dotenv from "dotenv";
dotenv.config();

console.log("🔍 Verificando variables de entorno...");
console.log(
  "TELEGRAM_TOKEN:",
  process.env.TELEGRAM_TOKEN ? "✅ Configurado" : "❌ No encontrado"
);
console.log(
  "SUPABASE_URL:",
  process.env.SUPABASE_URL ? "✅ Configurado" : "❌ No encontrado"
);
console.log(
  "SUPABASE_ANON_KEY:",
  process.env.SUPABASE_ANON_KEY ? "✅ Configurado" : "❌ No encontrado"
);
console.log(
  "FIRECRAWL_API_KEY:",
  process.env.FIRECRAWL_API_KEY ? "✅ Configurado" : "❌ No encontrado"
);

if (process.env.FIRECRAWL_API_KEY) {
  console.log("\n🚀 Firecrawl estará disponible en el bot");
} else {
  console.log("\n⚠️ Firecrawl no estará disponible - usando extracción básica");
}
