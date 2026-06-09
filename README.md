# <img src="screenshots/que-leo.icon.png" width="48" height="48" style="vertical-align: middle; margin-right: 8px;" /> ¿Qué leo? Telegram bot

Un bot de Telegram que permite a los usuarios guardar artículos para leer después. En https://que-leo.vercel.app puedes ver un artículo aleatorio de tu lista y empezar a leer sin tener que decidir ni pensar demasiado.

<img src="screenshots/que-leo-bot.png" width="600" alt="Bot de Telegram" />

## Características

- 🛡️ Rate limiting (5 artículos por minuto por usuario)
- ✅ Validación de URLs y metadatos
- 🔍 Extracción automática de metadatos de artículos
- 🤖 Resúmenes y valoración con Ollama local (opcional)
- 🌐 API HTTP para la app web (`/api/extract-metadata`)

## Inicio rápido

Crea un archivo `.env` en la raíz del proyecto:

```env
TELEGRAM_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Opcionales: `PORT` (por defecto 3000), `ALLOWED_ORIGINS`, `LOG_LEVEL`.

Para resúmenes con [Ollama](https://ollama.com) local (copia desde [`.env.example`](.env.example)):

```env
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_USER_PREFERENCES=Me interesan: ingeniería de software, productividad. Evito: clickbait.
OLLAMA_TIMEOUT_MS=120000
OLLAMA_NOTIFY_ON_ERROR=true
```

El bot llama directamente a la API de Ollama (no hace falta Open WebUI). Tras guardar un artículo, envía un segundo mensaje en Telegram con el resumen y la nota según tus gustos.

```bash
npm install
npm start
```

El bot usa polling de Telegram, así que no necesitas abrir puertos si solo lo usas desde Telegram.

## Tests

```bash
npm test
```

