# Bot de Telegram para Guardar Artículos

Un bot de Telegram que permite a los usuarios guardar artículos web en una base de datos Supabase. El bot extrae metadatos automáticamente de las páginas web usando Firecrawl (recomendado) o extracción básica como fallback.

## Características

- ✅ Vinculación de usuarios de Telegram con cuentas web
- 🔍 Extracción automática de metadatos de artículos web
- 📚 Almacenamiento en Supabase con información rica
- 🤖 Interfaz conversacional en Telegram
- 🔄 Detección de artículos duplicados
- 🌐 Soporte para múltiples idiomas

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Telegram Bot Token (obtén de @BotFather)
TELEGRAM_TOKEN=tu_token_aqui

# Supabase
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase

# Firecrawl (opcional pero recomendado)
FIRECRAWL_API_KEY=tu_api_key_de_firecrawl
```

### Firecrawl (Recomendado)

Firecrawl es una herramienta avanzada para extraer metadatos de páginas web que:

- 🚀 Maneja JavaScript dinámico
- 📊 Extrae metadatos más ricos (descripción, autores, temas, etc.)
- 🎯 Mejor precisión en la extracción
- 🔄 Funciona con sitios web modernos

Para obtener una API key de Firecrawl:

1. Ve a [firecrawl.dev](https://firecrawl.dev)
2. Regístrate para obtener una cuenta gratuita
3. Genera tu API key
4. Agrega la key a tu archivo `.env`

**Nota**: Si no configuras Firecrawl, el bot usará extracción básica como fallback.

### Instalación

```bash
npm install
```

### Ejecución

```bash
npm start
```

## Uso

1. **Vincular cuenta**: El usuario debe usar el botón de la app web para obtener un enlace de vinculación
2. **Enviar enlace**: Una vez vinculado, el usuario puede enviar cualquier enlace web al bot
3. **Guardado automático**: El bot extrae metadatos y guarda el artículo en Supabase

## Estructura de la Base de Datos

### Tabla `telegram_users`

- `id`: ID único
- `user_id`: ID del usuario de la app web
- `telegram_chat_id`: ID del chat de Telegram
- `telegram_username`: Username de Telegram (opcional)
- `linked_at`: Fecha de vinculación

### Tabla `articles`

- `id`: ID único
- `url`: URL del artículo
- `user_id`: ID del usuario propietario
- `dateAdded`: Fecha de guardado
- `title`: Título del artículo
- `description`: Descripción del artículo (nuevo con Firecrawl)
- `language`: Idioma del artículo
- `authors`: Array de autores
- `topics`: Array de temas/keywords

## Mejoras con Firecrawl

Al usar Firecrawl, el bot puede extraer:

- ✅ **Títulos** más precisos
- 📝 **Descripciones** completas del artículo
- 👥 **Autores** de múltiples fuentes
- 🏷️ **Temas y keywords** más relevantes
- 🌍 **Idioma** detectado automáticamente
- 📅 **Fechas de publicación** (si están disponibles)
- 🖼️ **Imágenes destacadas** (opcional)

## Fallback

Si Firecrawl no está disponible, el bot usa extracción básica con:

- Regex para extraer título, idioma, autor y keywords
- Funcionalidad limitada pero funcional
- Compatibilidad con la mayoría de sitios web estáticos

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm start

# Ver logs en tiempo real
npm start | tee bot.log
```
