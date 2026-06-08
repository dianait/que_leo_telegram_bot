# Guía de instalación en Windows

Pasos para ejecutar el bot **¿Qué leo?** en un PC Windows que ya tienes siempre encendido (por ejemplo, con Jellyfin o Stremio).

El bot usa **polling** de Telegram: no necesitas abrir puertos en el router si solo usas el bot por Telegram. El servidor web (`/api/extract-metadata`) solo hace falta exponerlo si la app web en Vercel lo llama directamente a tu PC.

---

## Requisitos

- Windows 10 u 11
- Conexión a internet estable
- PC sin suspensión automática (o configurado para no dormir)
- Cuenta de [Supabase](https://supabase.com) con el proyecto configurado
- Bot de Telegram creado con [@BotFather](https://t.me/BotFather)

### Software a instalar

1. **Node.js LTS** (v20 o v22): https://nodejs.org  
   - Durante la instalación, marca la opción **"Add to PATH"**.
2. **Git** (opcional pero recomendado): https://git-scm.com/download/win

Comprueba la instalación en **PowerShell** o **CMD**:

```powershell
node -v
npm -v
git --version
```

---

## 1. Descargar el proyecto

### Opción A — Con Git

```powershell
cd C:\Servicios
git clone https://github.com/dianait/que_leo_telegram_bot.git
cd que_leo_telegram_bot
```

### Opción B — Sin Git

1. Descarga el ZIP desde GitHub.
2. Descomprímelo en `C:\Servicios\que_leo_telegram_bot`.
3. Abre PowerShell en esa carpeta.

---

## 2. Instalar dependencias

```powershell
cd C:\Servicios\que_leo_telegram_bot
npm install
```

---

## 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (junto a `index.js`).

```env
TELEGRAM_TOKEN=tu_token_de_botfather
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase

# Opcionales
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=https://que-leo.vercel.app
```

### Dónde obtener cada valor

| Variable | Dónde encontrarla |
|----------|-------------------|
| `TELEGRAM_TOKEN` | BotFather → `/mybots` → tu bot → **API Token** |
| `SUPABASE_URL` | Supabase → Project Settings → **API** → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → **API** → `anon` `public` key |

> **Importante:** no subas el archivo `.env` a GitHub ni lo compartas.

### Conflicto de puerto con Jellyfin u otros servicios

Si el puerto `3000` ya está en uso, cambia en `.env`:

```env
PORT=3001
```

---

## 4. Probar que funciona

```powershell
npm start
```

Deberías ver algo similar a:

```
🚀 Bot de Telegram iniciado
🌐 Servidor web iniciado en puerto 3000
   GET  /health
   GET  /api/extract-metadata?url=<URL>
```

### Comprobar el servidor web (en otro PowerShell)

```powershell
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{"status":"OK","timestamp":"..."}
```

### Probar el bot en Telegram

1. Abre la app web [que-leo.vercel.app](https://que-leo.vercel.app) y vincula tu cuenta con el botón de Telegram.
2. En Telegram, envía un enlace a un artículo al bot.
3. Deberías recibir: `✅ Guardado: <título>`.

Para detener el bot manualmente: `Ctrl + C` en la ventana donde corre.

---

## 5. Dejarlo corriendo siempre (recomendado)

Para que el bot se reinicie solo si falla y arranque al encender Windows, usa **PM2**.

### Instalar PM2

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### Arrancar el bot con PM2

```powershell
cd C:\Servicios\que_leo_telegram_bot
pm2 start index.js --name que-leo-bot
pm2 save
```

### Configurar inicio automático con Windows

```powershell
pm2-startup install
```

Sigue las instrucciones que aparezcan en pantalla (puede pedir ejecutar un comando como administrador). Después:

```powershell
pm2 save
```

### Comandos útiles de PM2

```powershell
pm2 status              # Ver si está corriendo
pm2 logs que-leo-bot    # Ver logs en tiempo real
pm2 restart que-leo-bot # Reiniciar tras cambiar .env o código
pm2 stop que-leo-bot    # Parar
pm2 delete que-leo-bot  # Eliminar del gestor
```

---

## 6. Evitar que Windows suspenda el PC

Si ya usas Jellyfin 24/7, probablemente ya lo tienes resuelto. Si no:

1. **Configuración** → **Sistema** → **Energía**
2. Pon **Pantalla y suspensión** en **Nunca** (al menos cuando está enchufado).
3. En portátiles: **Cuando cierre la tapa** → **No hacer nada** (si quieres que siga corriendo).

---

## 7. Actualizar el bot

Cuando haya cambios nuevos en GitHub:

```powershell
cd C:\Servicios\que_leo_telegram_bot
git pull
npm install
pm2 restart que-leo-bot
```

---

## 8. (Opcional) Exponer la API fuera de casa

Solo necesario si quieres que **que-leo.vercel.app** llame a tu PC en lugar de un hosting en la nube.

### Opción recomendada: Cloudflare Tunnel

No abres puertos en el router ni expones tu IP directamente.

1. Crea cuenta en [Cloudflare](https://dash.cloudflare.com).
2. Instala `cloudflared` en Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
3. Crea un túnel que apunte a `http://localhost:3000` (o el `PORT` de tu `.env`).
4. Asigna un subdominio, por ejemplo `https://api.tudominio.com`.
5. En Vercel, configura la URL del backend para que apunte a ese dominio.
6. En `.env`:

```env
ALLOWED_ORIGINS=https://que-leo.vercel.app
```

### Si solo usas el bot por Telegram

**No hace falta este paso.** El bot solo necesita conexión saliente a internet.

---

## 9. Firewall de Windows

- **Solo bot de Telegram:** no necesitas reglas de entrada.
- **API accesible en la red local:** permite el puerto TCP configurado en `PORT` (por ejemplo 3000).
- **API pública con túnel Cloudflare:** tampoco necesitas abrir puertos en el router.

---

## 10. Solución de problemas

### `Faltan variables de entorno`

- Comprueba que `.env` está en la raíz del proyecto.
- Reinicia el proceso tras editar `.env`: `pm2 restart que-leo-bot`.

### El bot no responde en Telegram

```powershell
pm2 logs que-leo-bot
```

- Verifica que `TELEGRAM_TOKEN` es correcto.
- Comprueba que el PC tiene internet.
- Asegúrate de que no hay **otra instancia** del mismo bot corriendo en otro sitio (Railway, otro PC, etc.). Telegram solo permite un polling activo por bot.

### Error de puerto en uso (`EADDRINUSE`)

Cambia `PORT` en `.env` a otro valor libre (3001, 3002, etc.) y reinicia.

### `npm` no se reconoce como comando

Cierra y vuelve a abrir PowerShell tras instalar Node.js, o reinicia Windows.

### Los artículos se guardan sin título

- El enlace puede estar caído o bloquear el fetch.
- Revisa logs: `pm2 logs que-leo-bot` (busca `Failed to fetch article metadata`).

---

## Resumen rápido

```powershell
# Instalación inicial
cd C:\Servicios
git clone https://github.com/dianait/que_leo_telegram_bot.git
cd que_leo_telegram_bot
npm install
# Crear .env con TELEGRAM_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY

# Prueba manual
npm start

# Producción 24/7
npm install -g pm2 pm2-windows-startup
pm2 start index.js --name que-leo-bot
pm2-startup install
pm2 save
```

---

## Qué corre en tu PC

| Servicio | Puerto por defecto | ¿Necesita puerto abierto al exterior? |
|----------|-------------------|----------------------------------------|
| Bot Telegram (polling) | — | No |
| API `/health` | 3000 | Solo si la expones (túnel o red local) |
| API `/api/extract-metadata` | 3000 | Solo si Vercel la llama a tu PC |

Con Jellyfin en el mismo PC no hay problema: el bot consume muy pocos recursos.
