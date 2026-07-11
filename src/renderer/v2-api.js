(function installV2ApiOverrides() {
  const api = window.schedulerApi;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  if (!api || !baseUrl || !anonKey) return;

  function installTabletSessionPolicy() {
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
  }

  installTabletSessionPolicy();

  async function callFunction(name, payload = {}) {
    const session = api.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { message: text }; }
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
    return result;
  }

  function applyMemberOrder(members, orderedIds) {
    const list = Array.isArray(members) ? members : [];
    const ids = Array.isArray(orderedIds) ? orderedIds.map(String).filter(Boolean) : [];
    if (!ids.length) return list;
    const byId = new Map(list.map((member) => [String(member.id || ""), member]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const orderedSet = new Set(ids);
    return [...ordered, ...list.filter((member) => !orderedSet.has(String(member.id || "")))];
  }

  const originalLoadState = api.loadState;
  api.loadState = async function loadV2State() {
    const state = await originalLoadState();

    if (api.getAuthContext?.().profile?.role === "admin") {
      const result = await callFunction("department-attendance-v2", {});
      const byDepartment = new Map((result.settings || []).map((row) => [row.departmentId, row]));
      state.departments = (state.departments || []).map((department) => {
        const settings = byDepartment.get(department.id);
        return settings ? {
          ...department,
          address: settings.address || "",
          latitude: settings.latitude ?? "",
          longitude: settings.longitude ?? "",
          publicIp: settings.publicIp || "",
          attendanceEnabled: Boolean(settings.attendanceEnabled)
        } : department;
      });
    }

    if (api.getAuthContext?.().session?.access_token) {
      try {
        const result = await callFunction("member-order-v2", { action: "list" });
        state.members = applyMemberOrder(state.members, result.memberIds);
      } catch {
        // Keep database sort order until member-order-v2 is available.
      }
    }
    return state;
  };

  api.getEmployeeOvertimeDates = () => callFunction("attendance-overtime-employee", { action: "dates" });
  api.getAttendanceOvertimeForDate = (workDate) => callFunction("attendance-overtime-employee", { action: "status", workDate });
  api.getTodayAttendanceOvertime = () => api.getAttendanceOvertimeForDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date()));
  api.submitAttendanceOvertime = (payload = {}) => callFunction("attendance-overtime-employee", {
    action: "submit",
    workDate: payload.workDate,
    earlyHours: payload.earlyHours,
    lateHours: payload.lateHours,
    note: payload.note || ""
  });
  api.deleteAttendanceOvertime = (workDate) => callFunction("attendance-overtime-employee", { action: "delete", workDate });
  api.getOvertimeReviewList = (filters = {}) => callFunction("attendance-overtime-admin-list", filters);
  api.reviewOvertimeRequest = (payload = {}) => callFunction("attendance-overtime-admin-action", { action: "review", ...payload });
  api.createAdminOvertimeRequest = (payload = {}) => callFunction("attendance-overtime-admin-action", { action: "create", ...payload });
  api.getMemberOrder = () => callFunction("member-order-v2", { action: "list" });
  api.saveMemberOrder = (memberIds = []) => callFunction("member-order-v2", { action: "save", memberIds });
})();
