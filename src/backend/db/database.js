const { BackendError } = require("../errors");

function assertQueryExecutor(executor) {
  if (!executor || typeof executor.query !== "function") {
    throw new BackendError(500, "DATABASE_EXECUTOR_REQUIRED", "資料庫執行器未設定");
  }
}

function normalizeParams(params) {
  if (params === undefined) return [];
  if (!Array.isArray(params)) {
    throw new BackendError(500, "DATABASE_PARAMS_INVALID", "資料庫參數必須為陣列");
  }
  return params;
}

function createDatabase(executor, options = {}) {
  assertQueryExecutor(executor);
  const ownsExecutor = Boolean(options.ownsExecutor);

  async function query(text, params = []) {
    const sql = String(text || "").trim();
    if (!sql) {
      throw new BackendError(500, "DATABASE_QUERY_REQUIRED", "資料庫查詢不可空白");
    }
    const result = await executor.query(sql, normalizeParams(params));
    return {
      rows: Array.isArray(result?.rows) ? result.rows : [],
      rowCount: Number(result?.rowCount || 0)
    };
  }

  async function one(text, params = []) {
    const result = await query(text, params);
    return result.rows[0] || null;
  }

  async function transaction(callback) {
    if (typeof callback !== "function") {
      throw new BackendError(500, "DATABASE_TRANSACTION_CALLBACK_REQUIRED", "交易處理函式未設定");
    }
    if (typeof executor.connect !== "function") {
      throw new BackendError(500, "DATABASE_TRANSACTION_UNAVAILABLE", "資料庫連線不支援交易");
    }

    const client = await executor.connect();
    assertQueryExecutor(client);
    try {
      await client.query("BEGIN");
      const transactionalDatabase = createDatabase(client);
      const value = await callback(transactionalDatabase);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // 保留原始交易錯誤。
      }
      throw error;
    } finally {
      if (typeof client.release === "function") client.release();
    }
  }

  async function close() {
    if (ownsExecutor && typeof executor.end === "function") {
      await executor.end();
    }
  }

  return Object.freeze({ query, one, transaction, close });
}

module.exports = { createDatabase };
