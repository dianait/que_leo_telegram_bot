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
 * @param {string|null} params.featuredimage
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
  featuredimage,
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
    featuredimage: featuredimage || null,
  };
}

/**
 * Guarda o actualiza un artículo y la relación con el usuario.
 * @param {SupabaseClient} supabase
 * @param {Object} articleData - { url, title, language, authors, topics, featured_image, less_15 }
 * @param {string} user_id
 * @returns {Promise<{ success: boolean, article: object, relation: object, error?: any }>}
 */
export async function upsertArticleAndUserRelation(
  supabase,
  articleData,
  user_id
) {
  // 1. Buscar el artículo por URL
  const { data: existingArticles, error: findError } = await supabase
    .from("articles")
    .select("*")
    .eq("url", articleData.url)
    .limit(1);

  let articleId;
  let articleResult;

  if (findError) {
    return { success: false, error: findError };
  }

  if (existingArticles && existingArticles.length > 0) {
    // 2. Si existe, actualizarlo
    articleId = existingArticles[0].id;
    const { data: updated, error: updateError } = await supabase
      .from("articles")
      .update({
        ...articleData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError };
    articleResult = updated;
  } else {
    // 3. Si no existe, insertarlo
    const { data: inserted, error: insertError } = await supabase
      .from("articles")
      .insert({
        ...articleData,
        created_at: new Date().toISOString(),
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) return { success: false, error: insertError };
    articleId = inserted.id;
    articleResult = inserted;
  }

  // 4. Insertar o actualizar la relación en user_articles
  // (Si ya existe, no hace nada; si no, la crea)
  const { data: userArticle, error: relError } = await supabase
    .from("user_articles")
    .upsert(
      {
        user_id,
        article_id: articleId,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_read: false,
      },
      { onConflict: ["user_id", "article_id"] }
    )
    .select()
    .single();

  if (relError) return { success: false, error: relError };

  return { success: true, article: articleResult, relation: userArticle };
}
