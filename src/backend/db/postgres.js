const { BackendError } = require("../errors");
const { createDatabase } = require("./database");

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function buildPostgresPoolConfig(env = process.env) {
  const connectionString = String(env.DATABASE_URL || env.POSTGRES_URL || "").trim();
  if (!connectionString) {
    throw new BackendError(503, "DATABASE_URL_REQUIRED", "尚未設定 PostgreSQL 連線字串");
  }

  const sslEnabled = parseBoolean(env.POSTGRES_SSL, true);
  const rejectUnauthorized = parseBoolean(env.POSTGRES_SSL_REJECT_UNAUTHORIZED, true);
  const max = Math.max(1, Number(env.POSTGRES_POOL_MAX || 10) || 10);
  const idleTimeoutMillis = Math.max(1000, Number(env.POSTGRES_IDLE_TIMEOUT_MS || 30000) || 30000);
  const connectionTimeoutMillis = Math.max(1000, Number(env.POSTGRES_CONNECTION_TIMEOUT_MS || 10000) || 10000);

  return {
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl: sslEnabled ? { rejectUnauthorized } : false
  };
}

function loadPgModule(pgModule) {
  if (pgModule) return pgModule;
  try {
    return require("pg");
  } catch {
    throw new BackendError(500, "POSTGRES_DRIVER_MISSING", "後端尚未安裝 PostgreSQL Driver（pg）");
  }
}

function createPostgresDatabase(options = {}) {
  if (options.pool) {
    return createDatabase(options.pool, { ownsExecutor: Boolean(options.ownsPool) });
  }

  const pg = loadPgModule(options.pgModule);
  if (typeof pg.Pool !== "function") {
    throw new BackendError(500, "POSTGRES_DRIVER_INVALID", "PostgreSQL Driver 缺少 Pool");
  }
  const pool = new pg.Pool(options.poolConfig || buildPostgresPoolConfig(options.env || process.env));
  return createDatabase(pool, { ownsExecutor: true });
}

module.exports = {
  buildPostgresPoolConfig,
  createPostgresDatabase
};
