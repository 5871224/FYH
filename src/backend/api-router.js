const { CONTRACT_VERSION, ROUTES, findRoute } = require("./api-contract");
const { BackendError, normalizeBackendError } = require("./errors");
const { getSessionIdleMs, normalizeDeviceType } = require("./session-store");

const SESSION_COOKIE_NAME = "fyh_session";
const MAX_JSON_BYTES = 64 * 1024;

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
      try {
        result[key] = decodeURIComponent(value);
      } catch {
        // Ignore malformed cookie values instead of turning an unauthenticated request into HTTP 500.
      }
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

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
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
  const secureCookies = Boolean(options.secureCookies);

  if (!provider || !sessionStore) {
    throw new Error("createApiRouter requires provider and sessionStore");
  }

  function getSessionId(request) {
    return parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME] || "";
  }

  function requireSession(request) {
    const sessionId = getSessionId(request);
    const record = sessionStore.read(sessionId);
    if (!sessionId || !record) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    return { sessionId, record };
  }

  async function refreshContext(sessionId, record) {
    const context = await provider.getAuthContext(record.payload.providerSession);
    sessionStore.update(sessionId, {
      providerSession: context.providerSession,
      user: context.user,
      profile: context.profile
    });
    sessionStore.touch(sessionId);
    return context;
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
    const record = sessionStore.create({
      providerSession: context.providerSession,
      user: context.user,
      profile: context.profile
    }, { deviceType });
    sendJson(response, 200, sanitizeAuthContext(context), {
      "Set-Cookie": formatSessionCookie(record.id, { deviceType, secure: secureCookies })
    });
  }

  async function handleContext(request, response) {
    const { sessionId, record } = requireSession(request);
    const context = await refreshContext(sessionId, record);
    sendJson(response, 200, sanitizeAuthContext(context), {
      "Set-Cookie": formatSessionCookie(sessionId, {
        deviceType: record.deviceType,
        secure: secureCookies
      })
    });
  }

  async function handleSignOut(request, response) {
    const { sessionId, record } = requireSession(request);
    try {
      await provider.signOut(record.payload.providerSession);
    } finally {
      sessionStore.remove(sessionId);
    }
    sendJson(response, 200, sanitizeAuthContext(null), {
      "Set-Cookie": formatSessionCookie("", { clear: true, secure: secureCookies })
    });
  }

  async function handlePassword(request, response) {
    const { sessionId, record } = requireSession(request);
    const body = await readJson(request);
    const result = await provider.changePassword(record.payload.providerSession, body.newPassword);
    if (result?.providerSession) {
      sessionStore.update(sessionId, {
        ...record.payload,
        providerSession: result.providerSession
      });
    }
    sessionStore.touch(sessionId);
    sendJson(response, 200, { ok: true }, {
      "Set-Cookie": formatSessionCookie(sessionId, {
        deviceType: record.deviceType,
        secure: secureCookies
      })
    });
  }

  const handlers = {
    health: handleHealth,
    authSignIn: handleSignIn,
    authContext: handleContext,
    authSignOut: handleSignOut,
    authPassword: handlePassword
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
      await handlers[name](request, response);
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
