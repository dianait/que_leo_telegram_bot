/**
 * Builds a minimal Supabase client mock for unit tests.
 * @param {Record<string, object>} tableHandlers - Handlers keyed by table name
 * @returns {object}
 */
export function createMockSupabase(tableHandlers) {
  return {
    from(table) {
      const handler = tableHandlers[table];
      if (!handler) {
        throw new Error(`Unexpected table access: ${table}`);
      }
      return handler;
    },
  };
}

/**
 * @param {() => Promise<{ data?: unknown, error?: unknown }>} singleResult
 * @returns {object}
 */
export function upsertChain(singleResult) {
  return {
    upsert: () => ({
      select: () => ({
        single: singleResult,
      }),
    }),
  };
}

/**
 * @param {() => Promise<{ data?: unknown, error?: unknown }>} singleResult
 * @returns {object}
 */
export function selectEqLimitChain(limitResult) {
  return {
    select: () => ({
      eq: () => ({
        limit: limitResult,
      }),
    }),
  };
}

/**
 * @param {() => Promise<{ data?: unknown, error?: unknown }>} singleResult
 * @returns {object}
 */
export function insertChain(singleResult) {
  return {
    insert: () => ({
      select: () => ({
        single: singleResult,
      }),
    }),
  };
}

/**
 * @param {() => Promise<{ error?: unknown }>} deleteResult
 * @returns {object}
 */
export function deleteEqChain(deleteResult) {
  return {
    delete: () => ({
      eq: deleteResult,
    }),
  };
}
