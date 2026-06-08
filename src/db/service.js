/**
 * Supabase database service layer.
 */

/**
 * Finds a user by Telegram chat ID.
 * @param {SupabaseClient} supabase
 * @param {number} chatId
 * @returns {Promise<Object|null>}
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
 * Finds previous Telegram linkings for an app user ID.
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Array>}
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
 * Removes obsolete Telegram linkings for an app user ID.
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Object>}
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
 * Inserts a Telegram user after clearing previous linkings for the same user ID.
 * @param {SupabaseClient} supabase
 * @param {Object} userData
 * @returns {Promise<Object>}
 */
async function insertUserWithCleanup(supabase, userData) {
  const cleanupResult = await removeObsoleteLinkings(supabase, userData.user_id);
  if (!cleanupResult.success) {
    console.warn(
      "No se pudieron limpiar vinculaciones anteriores:",
      cleanupResult.error
    );
  }

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
}

/**
 * Links a Telegram account to an app user.
 * @param {SupabaseClient} supabase
 * @param {Object} userData
 * @param {string} userData.user_id
 * @param {number} userData.telegram_chat_id
 * @param {string|null} userData.telegram_username
 * @returns {Promise<Object>}
 */
export async function insertUser(supabase, userData) {
  try {
    const { data, error } = await supabase
      .from("telegram_users")
      .upsert(userData, { onConflict: "user_id" })
      .select()
      .single();

    if (!error) {
      return { success: true, data };
    }

    // No unique index on user_id: fall back to delete-then-insert
    if (error.code === "42P10") {
      return insertUserWithCleanup(supabase, userData);
    }

    console.error("Error al vincular usuario:", error);
    return { success: false, error };
  } catch (error) {
    console.error("Error inesperado al insertar usuario:", error);
    return { success: false, error };
  }
}

/**
 * Checks whether a Telegram chat is already linked.
 * @param {SupabaseClient} supabase
 * @param {number} chatId
 * @returns {Promise<boolean>}
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
 * Finds, inserts, or updates an article by URL (legacy fallback).
 * @param {SupabaseClient} supabase
 * @param {Object} articleData
 * @param {string} user_id
 * @returns {Promise<{ success: boolean, article?: object, relation?: object, error?: any }>}
 */
async function upsertArticleLegacy(supabase, articleData, user_id) {
  const { data: existingArticles, error: findError } = await supabase
    .from("articles")
    .select("id")
    .eq("url", articleData.url)
    .limit(1);

  if (findError) {
    return { success: false, error: findError };
  }

  const now = new Date().toISOString();
  let articleResult;

  if (existingArticles?.length > 0) {
    const articleId = existingArticles[0].id;
    const { data: updated, error: updateError } = await supabase
      .from("articles")
      .update({ ...articleData, updated_at: now })
      .eq("id", articleId)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError };
    articleResult = updated;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("articles")
      .insert({
        ...articleData,
        created_at: now,
        added_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) return { success: false, error: insertError };
    articleResult = inserted;
  }

  return upsertUserArticleRelation(
    supabase,
    user_id,
    articleResult.id,
    articleResult
  );
}

/**
 * Inserts or updates a user-article relation.
 * @param {SupabaseClient} supabase
 * @param {string} user_id
 * @param {string} articleId
 * @param {Object} articleResult
 * @returns {Promise<{ success: boolean, article?: object, relation?: object, error?: any }>}
 */
async function upsertUserArticleRelation(
  supabase,
  user_id,
  articleId,
  articleResult
) {
  const now = new Date().toISOString();
  const { data: userArticle, error: relError } = await supabase
    .from("user_articles")
    .upsert(
      {
        user_id,
        article_id: articleId,
        added_at: now,
        updated_at: now,
        is_read: false,
      },
      { onConflict: ["user_id", "article_id"] }
    )
    .select()
    .single();

  if (relError) return { success: false, error: relError };

  return { success: true, article: articleResult, relation: userArticle };
}

/**
 * Sets creation timestamps when the database has no defaults for new rows.
 * @param {SupabaseClient} supabase
 * @param {Object} article
 * @returns {Promise<Object>}
 */
async function ensureArticleTimestamps(supabase, article) {
  if (article.created_at && article.added_at) {
    return article;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("articles")
    .update({
      created_at: article.created_at ?? now,
      added_at: article.added_at ?? now,
    })
    .eq("id", article.id)
    .select()
    .single();

  if (error || !data) {
    return article;
  }

  return data;
}

/**
 * Saves or updates an article and its relation to a user.
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
  const now = new Date().toISOString();

  const { data: articleResult, error: articleError } = await supabase
    .from("articles")
    .upsert(
      {
        ...articleData,
        updated_at: now,
      },
      { onConflict: "url" }
    )
    .select()
    .single();

  if (articleError) {
    if (articleError.code === "42P10") {
      return upsertArticleLegacy(supabase, articleData, user_id);
    }
    return { success: false, error: articleError };
  }

  const article = await ensureArticleTimestamps(supabase, articleResult);

  return upsertUserArticleRelation(
    supabase,
    user_id,
    article.id,
    article
  );
}
