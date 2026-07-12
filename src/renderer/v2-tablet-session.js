(function installTabletSessionCompatibility() {
  const api = window.schedulerApi;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  if (!api || !baseUrl) return;

  const userAgent = navigator.userAgent || "";
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const isIPad = /iPad/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && touchPoints > 1);
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  const isTablet = isIPad || isAndroidTablet || /Tablet|Silk/i.test(userAgent);
  if (!isTablet) return;

  const sessionKey = `scheduler.supabase.session.${baseUrl}`;
  const maxIdleMs = 30 * 60 * 1000;
  const originalAsyncMethods = new Map();

  function parse(value) {
    try { return JSON.parse(value || "null"); } catch { return null; }
  }

  function isExpired(meta) {
    const session = meta?.session || meta;
    const lastActivityAt = Number(meta?.lastActivityAt || 0);
    return Boolean(session?.access_token
      && (!lastActivityAt || Date.now() - lastActivityAt > maxIdleMs));
  }

  function prepareSession() {
    const meta = parse(sessionStorage.getItem(sessionKey));
    if (isExpired(meta)) {
      sessionStorage.removeItem(sessionKey);
      localStorage.removeItem(sessionKey);
      return;
    }
    const stored = sessionStorage.getItem(sessionKey);
    if (stored) localStorage.setItem(sessionKey, stored);
  }

  function keepSessionInTab() {
    const stored = localStorage.getItem(sessionKey);
    if (!stored) return;
    const meta = parse(stored);
    if (!meta) return;
    meta.device = "desktop";
    const serialized = JSON.stringify(meta);
    sessionStorage.setItem(sessionKey, serialized);
    // web-api.js still classifies some tablets as phones. Keep an in-page mirror
    // so its own idle timer does not expire the session, then remove the mirror
    // on pagehide. The authoritative tablet copy remains in sessionStorage.
    localStorage.setItem(sessionKey, serialized);
  }

  const oldLocalSession = localStorage.getItem(sessionKey);
  if (oldLocalSession && !sessionStorage.getItem(sessionKey)) {
    sessionStorage.setItem(sessionKey, oldLocalSession);
  }
  prepareSession();

  Object.entries(api).forEach(([name, original]) => {
    if (typeof original !== "function" || original.constructor?.name !== "AsyncFunction") return;
    originalAsyncMethods.set(name, original);
    api[name] = async function tabletSessionWrapper(...args) {
      prepareSession();
      try {
        return await original.apply(this, args);
      } finally {
        keepSessionInTab();
      }
    };
  });

  let lastTouchWrite = 0;
  function touchSession() {
    const now = Date.now();
    if (now - lastTouchWrite < 15000) return;
    const meta = parse(sessionStorage.getItem(sessionKey));
    const session = meta?.session || meta;
    if (!session?.access_token) return;
    meta.lastActivityAt = now;
    meta.device = "desktop";
    const serialized = JSON.stringify(meta);
    sessionStorage.setItem(sessionKey, serialized);
    localStorage.setItem(sessionKey, serialized);
    lastTouchWrite = now;
  }

  let expiring = false;
  async function enforceIdleTimeout() {
    const meta = parse(sessionStorage.getItem(sessionKey));
    if (!isExpired(meta) || expiring) return;
    expiring = true;
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionKey);
    try {
      const originalSignOut = originalAsyncMethods.get("signOut");
      if (originalSignOut) await originalSignOut.call(api);
    } catch {
      // Local session has already been cleared.
    }
    window.dispatchEvent(new CustomEvent("scheduler-session-expired"));
    window.location.reload();
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, touchSession, { capture: true, passive: true });
  });
  window.addEventListener("focus", touchSession);
  window.addEventListener("pagehide", () => localStorage.removeItem(sessionKey));
  setInterval(() => { void enforceIdleTimeout(); }, 60 * 1000);
  void enforceIdleTimeout();
})();
