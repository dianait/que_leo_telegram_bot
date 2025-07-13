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
 * Busca vinculaciones anteriores por user_id
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Array>} Array de vinculaciones anteriores
 */
export async function findPreviousLinkings(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from("telegram_users")
      .select("id, user_id, telegram_chat_id, telegram_username, linked_at")
      .eq("user_id", userId);

    if (error) {
      console.error("Error al buscar vinculaciones anteriores:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(
      "Error inesperado al buscar vinculaciones anteriores:",
      error
    );
    return [];
  }
}

/**
 * Elimina vinculaciones obsoletas por user_id
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function removeObsoleteLinkings(supabase, userId) {
  try {
    const { error } = await supabase
      .from("telegram_users")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Error al eliminar vinculaciones obsoletas:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error(
      "Error inesperado al eliminar vinculaciones obsoletas:",
      error
    );
    return { success: false, error };
  }
}

/**
 * Inserta un nuevo usuario de Telegram (con limpieza de vinculaciones anteriores)
 * @param {SupabaseClient} supabase
 * @param {Object} userData
 * @param {string} userData.user_id
 * @param {number} userData.telegram_chat_id
 * @param {string|null} userData.telegram_username
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function insertUser(supabase, userData) {
  try {
    // Primero, eliminar vinculaciones anteriores del mismo user_id
    const cleanupResult = await removeObsoleteLinkings(
      supabase,
      userData.user_id
    );
    if (!cleanupResult.success) {
      console.warn(
        "No se pudieron limpiar vinculaciones anteriores:",
        cleanupResult.error
      );
      // Continuamos de todas formas, no es crítico
    }

    // Luego, insertar la nueva vinculación
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
