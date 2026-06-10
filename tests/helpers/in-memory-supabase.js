let nextId = 1;

function createId() {
  return `id-${nextId++}`;
}

function matchFilter(row, column, value) {
  return row[column] === value;
}

/**
 * In-memory Supabase client for integration-style tests without credentials.
 * @returns {object}
 */
export function createInMemorySupabase() {
  const articlesByUrl = new Map();
  const articlesById = new Map();
  const userArticles = new Map();
  const telegramUsersByUserId = new Map();
  const userPreferencesByUserId = new Map();

  function getArticleRows() {
    return [...articlesByUrl.values()];
  }

  function getTelegramUserRows() {
    return [...telegramUsersByUserId.values()];
  }

  function articlesTable() {
    return {
      upsert(payload, { onConflict }) {
        const conflictKey = onConflict === "url" ? payload.url : null;
        if (!conflictKey) {
          return articlesTable();
        }

        return {
          select: () => ({
            single: async () => {
              const existing = articlesByUrl.get(conflictKey);
              if (existing) {
                const updated = { ...existing, ...payload };
                articlesByUrl.set(conflictKey, updated);
                articlesById.set(updated.id, updated);
                return { data: updated, error: null };
              }

              const created = {
                id: createId(),
                created_at: payload.created_at ?? new Date().toISOString(),
                added_at: payload.added_at ?? new Date().toISOString(),
                ...payload,
              };
              articlesByUrl.set(conflictKey, created);
              articlesById.set(created.id, created);
              return { data: created, error: null };
            },
          }),
        };
      },

      select: () => ({
        eq: (column, value) => ({
          limit: async () => {
            const rows = getArticleRows().filter((row) =>
              matchFilter(row, column, value)
            );
            return { data: rows, error: null };
          },
        }),
      }),

      insert: (rows) => ({
        select: () => ({
          single: async () => {
            const payload = rows[0];
            const created = {
              id: createId(),
              created_at: payload.created_at ?? new Date().toISOString(),
              added_at: payload.added_at ?? new Date().toISOString(),
              ...payload,
            };
            articlesByUrl.set(created.url, created);
            articlesById.set(created.id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (payload) => ({
        eq: (column, value) => ({
          select: () => ({
            single: async () => {
              const rows =
                column === "id"
                  ? [articlesById.get(value)].filter(Boolean)
                  : getArticleRows().filter((row) =>
                      matchFilter(row, column, value)
                    );

              if (rows.length === 0) {
                return { data: null, error: { message: "not found" } };
              }

              const updated = { ...rows[0], ...payload };
              articlesByUrl.set(updated.url, updated);
              articlesById.set(updated.id, updated);
              return { data: updated, error: null };
            },
          }),
        }),
      }),
    };
  }

  function userArticlesTable() {
    return {
      upsert(payload) {
        return {
          select: () => ({
            single: async () => {
              const key = `${payload.user_id}:${payload.article_id}`;
              const existing = userArticles.get(key);
              const relation = { ...existing, ...payload };
              userArticles.set(key, relation);
              return { data: relation, error: null };
            },
          }),
        };
      },

      update(payload) {
        const filters = [];

        const query = {
          eq(column, value) {
            filters.push([column, value]);
            return query;
          },
          select: () => ({
            single: async () => {
              const row = [...userArticles.values()].find((candidate) =>
                filters.every(([column, value]) =>
                  matchFilter(candidate, column, value)
                )
              );

              if (!row) {
                return { data: null, error: { message: "not found" } };
              }

              const key = `${row.user_id}:${row.article_id}`;
              const updated = { ...row, ...payload };
              userArticles.set(key, updated);
              return { data: updated, error: null };
            },
          }),
        };

        return query;
      },

      delete: () => ({
        eq: async (column, value) => {
          for (const [key, row] of userArticles.entries()) {
            if (matchFilter(row, column, value)) {
              userArticles.delete(key);
            }
          }
          return { error: null };
        },
      }),
    };
  }

  function telegramUsersTable() {
    return {
      upsert(payload) {
        return {
          select: () => ({
            single: async () => {
              telegramUsersByUserId.set(payload.user_id, { ...payload });
              return { data: payload, error: null };
            },
          }),
        };
      },

      insert: (rows) => ({
        select: () => ({
          single: async () => {
            const payload = rows[0];
            telegramUsersByUserId.set(payload.user_id, { ...payload });
            return { data: payload, error: null };
          },
        }),
      }),

      select: (columns) => ({
        eq: (column, value) => {
          const rows = getTelegramUserRows().filter((row) =>
            matchFilter(row, column, value)
          );

          if (typeof columns === "string" && columns !== "*") {
            const fields = columns.split(",").map((field) => field.trim());
            const projected = rows.map((row) =>
              Object.fromEntries(fields.map((field) => [field, row[field]]))
            );

            return {
              single: async () => ({
                data: projected[0] ?? null,
                error: projected[0] ? null : { message: "not found" },
              }),
              then: (resolve) => resolve({ data: projected, error: null }),
            };
          }

          return {
            single: async () => ({
              data: rows[0] ?? null,
              error: rows[0] ? null : { message: "not found" },
            }),
            then: (resolve) => resolve({ data: rows, error: null }),
          };
        },
      }),

      delete: () => ({
        eq: async (column, value) => {
          for (const [key, row] of telegramUsersByUserId.entries()) {
            if (matchFilter(row, column, value)) {
              telegramUsersByUserId.delete(key);
            }
          }
          return { error: null };
        },
      }),
    };
  }

  function userPreferencesTable() {
    return {
      upsert(payload) {
        return {
          then: (resolve) => {
            userPreferencesByUserId.set(payload.user_id, { ...payload });
            resolve({ error: null });
          },
        };
      },

      select: (columns) => ({
        eq: (column, value) => ({
          single: async () => {
            const rows = [...userPreferencesByUserId.values()].filter((row) =>
              matchFilter(row, column, value)
            );

            if (rows.length === 0) {
              return { data: null, error: { message: "not found" } };
            }

            if (typeof columns === "string" && columns !== "*") {
              const fields = columns.split(",").map((field) => field.trim());
              const projected = Object.fromEntries(
                fields.map((field) => [field, rows[0][field]])
              );
              return { data: projected, error: null };
            }

            return { data: rows[0], error: null };
          },
        }),
      }),

      delete: () => ({
        eq: async (column, value) => {
          for (const [key, row] of userPreferencesByUserId.entries()) {
            if (matchFilter(row, column, value)) {
              userPreferencesByUserId.delete(key);
            }
          }
          return { error: null };
        },
      }),
    };
  }

  return {
    from(table) {
      if (table === "articles") return articlesTable();
      if (table === "user_articles") return userArticlesTable();
      if (table === "telegram_users") return telegramUsersTable();
      if (table === "user_preferences") return userPreferencesTable();
      throw new Error(`Unexpected table access: ${table}`);
    },

    reset() {
      articlesByUrl.clear();
      articlesById.clear();
      userArticles.clear();
      telegramUsersByUserId.clear();
      userPreferencesByUserId.clear();
      nextId = 1;
    },
  };
}
