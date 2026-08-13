const { randomBytes } = require("crypto");

const PHONE_SESSION_IDLE_MS = 48 * 60 * 60 * 1000;
const DESKTOP_SESSION_IDLE_MS = 30 * 60 * 1000;

function normalizeDeviceType(value) {
  const deviceType = String(value || "").toLowerCase();
  if (deviceType === "phone" || deviceType === "tablet" || deviceType === "desktop") {
    return deviceType;
  }
  return "desktop";
}

function getSessionIdleMs(deviceType) {
  return normalizeDeviceType(deviceType) === "phone"
    ? PHONE_SESSION_IDLE_MS
    : DESKTOP_SESSION_IDLE_MS;
}

function createMemorySessionStore(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const idFactory = typeof options.idFactory === "function"
    ? options.idFactory
    : () => randomBytes(32).toString("base64url");
  const sessions = new Map();

  function create(payload, meta = {}) {
    const id = idFactory();
    const deviceType = normalizeDeviceType(meta.deviceType);
    const idleMs = getSessionIdleMs(deviceType);
    const currentTime = now();
    const record = {
      id,
      payload,
      deviceType,
      createdAt: currentTime,
      lastActivityAt: currentTime,
      expiresAt: currentTime + idleMs
    };
    sessions.set(id, record);
    return { ...record };
  }

  function read(id) {
    const key = String(id || "");
    const record = sessions.get(key);
    if (!record) return null;
    if (now() > record.expiresAt) {
      sessions.delete(key);
      return null;
    }
    return { ...record };
  }

  function update(id, payload) {
    const key = String(id || "");
    const record = sessions.get(key);
    if (!record) return null;
    if (now() > record.expiresAt) {
      sessions.delete(key);
      return null;
    }
    record.payload = payload;
    return { ...record };
  }

  function touch(id) {
    const key = String(id || "");
    const record = sessions.get(key);
    if (!record) return null;
    const currentTime = now();
    if (currentTime > record.expiresAt) {
      sessions.delete(key);
      return null;
    }
    record.lastActivityAt = currentTime;
    record.expiresAt = currentTime + getSessionIdleMs(record.deviceType);
    return { ...record };
  }

  function remove(id) {
    return sessions.delete(String(id || ""));
  }

  function clear() {
    sessions.clear();
  }

  function size() {
    return sessions.size;
  }

  return Object.freeze({
    create,
    read,
    update,
    touch,
    remove,
    clear,
    size
  });
}

module.exports = {
  PHONE_SESSION_IDLE_MS,
  DESKTOP_SESSION_IDLE_MS,
  normalizeDeviceType,
  getSessionIdleMs,
  createMemorySessionStore
};
