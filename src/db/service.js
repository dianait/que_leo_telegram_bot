/**
 * Servicio para operaciones de base de datos con Supabase
 */

/**
 * Busca un usuario por su chat_id de Telegram
 * @param {SupabaseClient} supabase
 * @param {number} chatId
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export async function findUserByChatId(supabase, chatId) {
  try {
    const { data, error } = await supabase
      .from("telegram_users")
      .select("user_id")
      .eq("telegram_chat_id", chatId)
      .single();

    if (error) {
      console.error("Error al buscar usuario:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error inesperado al buscar usuario:", error);
    return null;
  }
}

/**
 * Inserta un nuevo usuario de Telegram
 * @param {SupabaseClient} supabase
 * @param {Object} userData
 * @param {string} userData.user_id
 * @param {number} userData.telegram_chat_id
 * @param {string|null} userData.telegram_username
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function insertUser(supabase, userData) {
  try {
    const { data, error } = await supabase
      .from("telegram_users")
      .insert([userData])
      .select()
      .single();

    if (error) {
      console.error("Error al insertar usuario:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error inesperado al insertar usuario:", error);
    return { success: false, error };
  }
}

/**
 * Verifica si un usuario ya está vinculado
 * @param {SupabaseClient} supabase
 * @param {number} chatId
 * @returns {Promise<boolean>} True si ya está vinculado
 */
export async function isUserAlreadyLinked(supabase, chatId) {
  try {
    const { data, error } = await supabase
      .from("telegram_users")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .single();

    return !error && data;
  } catch (error) {
    console.error("Error al verificar vinculación:", error);
    return false;
  }
}

/**
 * Busca un artículo existente por URL o título para un usuario
 * @param {SupabaseClient} supabase
 * @param {string} url
 * @param {string|null} title
 * @param {string} userId
 * @returns {Promise<Object|null>} Artículo encontrado o null
 */
export async function findArticleByUrlOrTitle(supabase, url, title, userId) {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("id")
      .or(`url.eq.${url},title.eq.${title}`)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error al buscar artículo:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error inesperado al buscar artículo:", error);
    return null;
  }
}

/**
 * Inserta un nuevo artículo
 * @param {SupabaseClient} supabase
 * @param {Object} articleData
 * @param {string} articleData.url
 * @param {string} articleData.user_id
 * @param {string|null} articleData.title
 * @param {string|null} articleData.language
 * @param {Array<string>|null} articleData.authors
 * @param {Array<string>|null} articleData.topics
 * @param {string|null} articleData.description
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function insertArticle(supabase, articleData) {
  try {
    const { data, error } = await supabase
      .from("articles")
      .insert([articleData])
      .select()
      .single();

    if (error) {
      console.error("Error al insertar artículo:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error inesperado al insertar artículo:", error);
    return { success: false, error };
  }
}

/**
 * Prepara los datos de un artículo para insertar
 * @param {Object} params
 * @param {string} params.url
 * @param {string} params.userId
 * @param {string|null} params.title
 * @param {string|null} params.language
 * @param {Array<string>} params.authors
 * @param {Array<string>} params.topics
 * @param {string|null} params.description
 * @param {string|null} params.featuredImage
 * @returns {Object} Datos preparados para insertar
 */
export function prepareArticleData({
  url,
  userId,
  title,
  language,
  authors,
  topics,
  description,
  featuredImage,
}) {
  return {
    url,
    user_id: userId,
    dateAdded: new Date().toISOString(),
    title: title || null,
    language: language || null,
    authors: authors && authors.length ? authors : null,
    topics: topics && topics.length ? topics : null,
    description: description || null,
    featuredImage: featuredImage || null,
  };
}
