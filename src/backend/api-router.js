const { CONTRACT_VERSION, ROUTES, findRoute } = require("./api-contract");
const { BackendError, normalizeBackendError } = require("./errors");
const { getSessionIdleMs, normalizeDeviceType } = require("./session-store");

const SESSION_COOKIE_NAME = "fyh_session";
const MAX_JSON_BYTES = 64 * 1024;
const MAX_SCHEDULE_JSON_BYTES = 2 * 1024 * 1024;

function parseCookies(headerValue) {
  return String(headerValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) return result;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      result[key] = decodeURIComponent(value);
      return result;
    }, {});
}

function formatSessionCookie(sessionId, options = {}) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId || "")}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (options.secure) parts.push("Secure");
  if (options.clear) {
    parts.push("Max-Age=0");
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  } else if (normalizeDeviceType(options.deviceType) === "phone") {
    parts.push(`Max-Age=${Math.floor(getSessionIdleMs("phone") / 1000)}`);
  }
  return parts.join("; ");
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request, maxBytes = MAX_JSON_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new BackendError(413, "REQUEST_TOO_LARGE", "請求內容過大");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BackendError(400, "INVALID_JSON", "JSON 格式錯誤");
  }
}

function sanitizeAuthContext(context) {
  const source = context && typeof context === "object" ? context : {};
  const rawUser = source.user && typeof source.user === "object" ? source.user : null;
  const user = rawUser?.id
    ? { id: String(rawUser.id), email: String(rawUser.email || "") }
    : null;
  const profile = source.profile && typeof source.profile === "object"
    ? { ...source.profile }
    : null;
  return {
    authenticated: Boolean(user?.id),
    user,
    profile: user ? profile : null
  };
}

function detectDeviceType(request, body = {}) {
  const explicit = normalizeDeviceType(body.deviceType || request.headers["x-fyh-device"]);
  if (body.deviceType || request.headers["x-fyh-device"]) return explicit;
  const userAgent = String(request.headers["user-agent"] || "");
  const tablet = /iPad|Tablet|Silk|Android(?!.*Mobile)/i.test(userAgent);
  if (tablet) return "tablet";
  return /iPhone|iPod|Android.*Mobile|Windows Phone|Mobi|Mobile/i.test(userAgent)
    ? "phone"
    : "desktop";
}

function createApiRouter(options = {}) {
  const provider = options.provider;
  const sessionStore = options.sessionStore;
  const services = options.services || {};
  const secureCookies = Boolean(options.secureCookies);

  if (!provider || !sessionStore) {
    throw new Error("createApiRouter requires provider and sessionStore");
  }

  function getSessionId(request) {
    return parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME] || "";
  }

  function sessionCookieHeaders(sessionId, record) {
    return {
      "Set-Cookie": formatSessionCookie(sessionId, {
        deviceType: record.deviceType,
        secure: secureCookies
      })
    };
  }

  function requireScheduleService(methods = ["getBootstrap", "getEntries"]) {
    const service = services.schedule;
    const ready = service && methods.every((method) => typeof service[method] === "function");
    if (!ready) {
      throw new BackendError(503, "SCHEDULE_SERVICE_UNAVAILABLE", "班表 Backend Service 尚未啟用");
    }
    return service;
  }

  async function requireSession(request) {
    const sessionId = getSessionId(request);
    const record = sessionId ? await sessionStore.read(sessionId) : null;
    if (!sessionId || !record) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    return { sessionId, record };
  }

  async function refreshContext(sessionId, record) {
    const context = await provider.getAuthContext(record.payload.providerSession);
    await sessionStore.update(sessionId, {
      providerSession: context.providerSession,
      user: context.user,
      profile: context.profile
    });
    await sessionStore.touch(sessionId);
    return context;
  }

  async function requireActiveContext(request) {
    const { sessionId, record } = await requireSession(request);
    const context = await refreshContext(sessionId, record);
    if (!context?.user?.id) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    return { sessionId, record, context };
  }

  async function handleHealth(_request, response) {
    let providerHealth = { ready: false };
    try {
      providerHealth = await provider.health();
    } catch {
      providerHealth = { ready: false };
    }
    sendJson(response, 200, {
      ok: true,
      service: "fyh-api",
      contractVersion: CONTRACT_VERSION,
      ready: providerHealth?.ready === true
    });
  }

  async function handleSignIn(request, response) {
    const body = await readJson(request);
    const context = await provider.signIn({
      loginAccount: body.loginAccount,
      password: body.password
    });
    const deviceType = detectDeviceType(request, body);
    const record = await sessionStore.create({
      providerSession: context.providerSession,
      user: context.user,
      profile: context.profile
    }, { deviceType });
    sendJson(response, 200, sanitizeAuthContext(context), {
      "Set-Cookie": formatSessionCookie(record.id, { deviceType, secure: secureCookies })
    });
  }

  async function handleContext(request, response) {
    const { sessionId, record, context } = await requireActiveContext(request);
    sendJson(response, 200, sanitizeAuthContext(context), sessionCookieHeaders(sessionId, record));
  }

  async function handleSignOut(request, response) {
    const { sessionId, record } = await requireSession(request);
    try {
      await provider.signOut(record.payload.providerSession);
    } finally {
      await sessionStore.remove(sessionId);
    }
    sendJson(response, 200, sanitizeAuthContext(null), {
      "Set-Cookie": formatSessionCookie("", { clear: true, secure: secureCookies })
    });
  }

  async function handlePassword(request, response) {
    const { sessionId, record } = await requireSession(request);
    const body = await readJson(request);
    const result = await provider.changePassword(record.payload.providerSession, body.newPassword);
    if (result?.providerSession) {
      await sessionStore.update(sessionId, {
        ...record.payload,
        providerSession: result.providerSession
      });
    }
    await sessionStore.touch(sessionId);
    sendJson(response, 200, { ok: true }, sessionCookieHeaders(sessionId, record));
  }

  async function handleScheduleBootstrap(request, response, url) {
    const service = requireScheduleService(["getBootstrap"]);
    const { sessionId, record, context } = await requireActiveContext(request);
    const payload = await service.getBootstrap(
      context.user.id,
      url.searchParams.get("documentId") || "default"
    );
    sendJson(response, 200, payload, sessionCookieHeaders(sessionId, record));
  }

  async function handleScheduleEntries(request, response, url) {
    const service = requireScheduleService(["getEntries"]);
    const { sessionId, record, context } = await requireActiveContext(request);
    const rows = await service.getEntries(
      context.user.id,
      url.searchParams.get("startDate"),
      url.searchParams.get("endDate"),
      {
        offset: url.searchParams.get("offset"),
        limit: url.searchParams.get("limit")
      }
    );
    sendJson(response, 200, rows, sessionCookieHeaders(sessionId, record));
  }

  async function handleScheduleEntriesSave(request, response) {
    const service = requireScheduleService(["saveEntries"]);
    const { sessionId, record, context } = await requireActiveContext(request);
    const body = await readJson(request, MAX_SCHEDULE_JSON_BYTES);
    const rows = await service.saveEntries(context.user.id, body.entries);
    sendJson(response, 200, rows, sessionCookieHeaders(sessionId, record));
  }

  const handlers = {
    health: handleHealth,
    authSignIn: handleSignIn,
    authContext: handleContext,
    authSignOut: handleSignOut,
    authPassword: handlePassword,
    scheduleBootstrap: handleScheduleBootstrap,
    scheduleEntries: handleScheduleEntries,
    scheduleEntriesSave: handleScheduleEntriesSave
  };

  async function handle(request, response, url) {
    const match = findRoute(request.method, url.pathname);
    if (!match) {
      if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, {
          error: { code: "API_ROUTE_NOT_FOUND", message: "API 路徑不存在" }
        });
        return true;
      }
      return false;
    }

    const [name] = match;
    try {
      await handlers[name](request, response, url);
    } catch (error) {
      const normalized = normalizeBackendError(error);
      sendJson(response, normalized.statusCode, {
        error: {
          code: normalized.code,
          message: normalized.message
        }
      }, normalized.statusCode === 401 ? {
        "Set-Cookie": formatSessionCookie("", { clear: true, secure: secureCookies })
      } : {});
    }
    return true;
  }

  return Object.freeze({
    handle,
    routes: ROUTES
  });
}

module.exports = {
  SESSION_COOKIE_NAME,
  parseCookies,
  formatSessionCookie,
  sanitizeAuthContext,
  detectDeviceType,
  createApiRouter
};
