const { BackendError } = require("../errors");

function createSupabaseAuthProvider(options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
  const anonKey = String(options.anonKey || "");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = typeof options.now === "function" ? options.now : () => Date.now();

  if (!baseUrl || !anonKey) {
    throw new BackendError(500, "PROVIDER_CONFIG_INVALID", "Supabase Provider 設定不完整");
  }
  if (typeof fetchImpl !== "function") {
    throw new BackendError(500, "PROVIDER_FETCH_UNAVAILABLE", "後端 HTTP Client 不可用");
  }

  function buildLocalLoginEmail(employeeCode) {
    const normalized = String(employeeCode || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized ? `${normalized}@local.invalid` : "";
  }

  async function readProviderError(response) {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error_description || parsed.error || text;
    } catch {
      return text;
    }
  }

  async function requestJson(pathname, options = {}) {
    const headers = {
      apikey: anonKey,
      Accept: "application/json",
      ...(options.headers || {})
    };
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetchImpl(`${baseUrl}${pathname}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    if (!response.ok) {
      const message = await readProviderError(response);
      if (options.invalidCredentials && (response.status === 400 || response.status === 401)) {
        throw new BackendError(401, "INVALID_CREDENTIALS", "登入帳號或密碼錯誤");
      }
      if (response.status === 401) {
        throw new BackendError(401, "AUTH_REQUIRED", "登入已失效，請重新登入");
      }
      if (response.status === 403) {
        throw new BackendError(403, "PROVIDER_FORBIDDEN", message || "權限不足");
      }
      throw new BackendError(502, "PROVIDER_REQUEST_FAILED", message);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function normalizeSession(payload) {
    if (!payload?.access_token || !payload?.user?.id) {
      throw new BackendError(502, "PROVIDER_SESSION_INVALID", "登入服務回傳格式錯誤");
    }
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || "",
      expires_at: Number(payload.expires_at || 0),
      user: {
        id: String(payload.user.id || ""),
        email: String(payload.user.email || "")
      }
    };
  }

  async function refreshSessionIfNeeded(session) {
    if (!session?.refresh_token) return session;
    if (session.expires_at && now() < (session.expires_at - 60) * 1000) {
      return session;
    }
    const payload = await requestJson("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token }
    });
    return normalizeSession(payload);
  }

  async function loadProfile(session) {
    const rows = await requestJson("/rest/v1/rpc/get_my_profile_v3", {
      method: "POST",
      accessToken: session.access_token,
      headers: { Prefer: "return=representation" },
      body: {}
    }) || [];
    const profile = Array.isArray(rows) ? rows[0] || null : null;
    if (!profile || String(profile.id || "") !== String(session.user.id || "")) {
      throw new BackendError(403, "PROFILE_NOT_BOUND", "帳號尚未綁定身份");
    }
    return profile;
  }

  function toResult(providerSession, profile) {
    return {
      providerSession,
      user: {
        id: providerSession.user.id,
        email: providerSession.user.email || ""
      },
      profile
    };
  }

  async function signIn({ loginAccount, password } = {}) {
    const email = buildLocalLoginEmail(loginAccount);
    if (!email || !String(password || "")) {
      throw new BackendError(400, "LOGIN_INPUT_REQUIRED", "請輸入登入帳號與密碼");
    }
    const payload = await requestJson("/auth/v1/token?grant_type=password", {
      method: "POST",
      invalidCredentials: true,
      body: { email, password: String(password) }
    });
    const providerSession = normalizeSession(payload);
    const profile = await loadProfile(providerSession);
    return toResult(providerSession, profile);
  }

  async function getAuthContext(providerSession) {
    if (!providerSession?.access_token) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    const refreshedSession = await refreshSessionIfNeeded(providerSession);
    const profile = await loadProfile(refreshedSession);
    return toResult(refreshedSession, profile);
  }

  async function signOut(providerSession) {
    if (!providerSession?.access_token) return { ok: true };
    try {
      await requestJson("/auth/v1/logout", {
        method: "POST",
        accessToken: providerSession.access_token
      });
    } catch {
      // 本機 Session 仍必須清除，避免遠端登出失敗讓使用者卡住。
    }
    return { ok: true };
  }

  async function changePassword(providerSession, newPassword) {
    const password = String(newPassword || "");
    if (!password) {
      throw new BackendError(400, "PASSWORD_REQUIRED", "新密碼不可空白");
    }
    const current = await refreshSessionIfNeeded(providerSession);
    await requestJson("/auth/v1/user", {
      method: "PUT",
      accessToken: current.access_token,
      body: { password }
    });
    return { ok: true, providerSession: current };
  }

  return Object.freeze({
    health: async () => ({ ready: true }),
    signIn,
    getAuthContext,
    signOut,
    changePassword
  });
}

module.exports = {
  createSupabaseAuthProvider
};
