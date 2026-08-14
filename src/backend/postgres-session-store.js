const { createHash, randomBytes } = require("crypto");
const { BackendError } = require("./errors");
const { getSessionIdleMs, normalizeDeviceType } = require("./session-store");

function hashSessionId(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function createPostgresSessionStore(database, options = {}) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function") {
    throw new BackendError(500, "SESSION_DATABASE_REQUIRED", "Session Store 尚未設定資料庫");
  }

  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const idFactory = typeof options.idFactory === "function"
    ? options.idFactory
    : () => randomBytes(32).toString("base64url");

  function rowToRecord(row, rawId = "") {
    if (!row) return null;
    return {
      id: rawId,
      payload: row.payload || {},
      deviceType: normalizeDeviceType(row.device_type),
      createdAt: new Date(row.created_at).getTime(),
      lastActivityAt: new Date(row.last_activity_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime()
    };
  }

  async function create(payload, meta = {}) {
    const employeeId = String(payload?.user?.id || payload?.providerSession?.employeeId || "").trim();
    if (!employeeId) {
      throw new BackendError(500, "SESSION_EMPLOYEE_REQUIRED", "Session 缺少人員識別碼");
    }

    const id = idFactory();
    const sessionHash = hashSessionId(id);
    const deviceType = normalizeDeviceType(meta.deviceType);
    const currentTime = now();
    const expiresAt = currentTime + getSessionIdleMs(deviceType);

    const row = await database.one(`
      insert into public.auth_sessions (
        session_hash,
        employee_id,
        device_type,
        payload,
        created_at,
        last_activity_at,
        expires_at
      ) values ($1, $2::uuid, $3, $4::jsonb, $5::timestamptz, $5::timestamptz, $6::timestamptz)
      returning session_hash, employee_id, device_type, payload, created_at, last_activity_at, expires_at
    `, [
      sessionHash,
      employeeId,
      deviceType,
      JSON.stringify(payload || {}),
      new Date(currentTime).toISOString(),
      new Date(expiresAt).toISOString()
    ]);

    return rowToRecord(row, id);
  }

  async function read(id) {
    const rawId = String(id || "");
    if (!rawId) return null;
    const currentTime = now();
    const row = await database.one(`
      select session_hash, employee_id, device_type, payload, created_at, last_activity_at, expires_at
      from public.auth_sessions
      where session_hash = $1
        and expires_at > $2::timestamptz
      limit 1
    `, [hashSessionId(rawId), new Date(currentTime).toISOString()]);
    return rowToRecord(row, rawId);
  }

  async function update(id, payload) {
    const rawId = String(id || "");
    if (!rawId) return null;
    const currentTime = now();
    const row = await database.one(`
      update public.auth_sessions
      set payload = $2::jsonb
      where session_hash = $1
        and expires_at > $3::timestamptz
      returning session_hash, employee_id, device_type, payload, created_at, last_activity_at, expires_at
    `, [hashSessionId(rawId), JSON.stringify(payload || {}), new Date(currentTime).toISOString()]);
    return rowToRecord(row, rawId);
  }

  async function touch(id) {
    const rawId = String(id || "");
    if (!rawId) return null;
    const currentTime = now();
    const existing = await read(rawId);
    if (!existing) return null;
    const expiresAt = currentTime + getSessionIdleMs(existing.deviceType);
    const row = await database.one(`
      update public.auth_sessions
      set last_activity_at = $2::timestamptz,
          expires_at = $3::timestamptz
      where session_hash = $1
      returning session_hash, employee_id, device_type, payload, created_at, last_activity_at, expires_at
    `, [
      hashSessionId(rawId),
      new Date(currentTime).toISOString(),
      new Date(expiresAt).toISOString()
    ]);
    return rowToRecord(row, rawId);
  }

  async function remove(id) {
    const rawId = String(id || "");
    if (!rawId) return false;
    const result = await database.query(
      "delete from public.auth_sessions where session_hash = $1",
      [hashSessionId(rawId)]
    );
    return result.rowCount > 0;
  }

  async function clearExpired() {
    const result = await database.query(
      "delete from public.auth_sessions where expires_at <= $1::timestamptz",
      [new Date(now()).toISOString()]
    );
    return result.rowCount;
  }

  return Object.freeze({
    isPersistent: true,
    create,
    read,
    update,
    touch,
    remove,
    clearExpired
  });
}

module.exports = {
  hashSessionId,
  createPostgresSessionStore
};