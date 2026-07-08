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

  function stripAttendanceFields(value) {
    if (Array.isArray(value)) return value.map(stripAttendanceFields);
    if (!value || typeof value !== "object") return value;
    const next = { ...value };
    delete next.address;
    delete next.latitude;
    delete next.longitude;
    delete next.attendance_enabled;
    delete next.public_ip;
    return next;
  }

  async function runManagerSafeWrite(operation) {
    if (api.getAuthContext?.().profile?.role !== "manager") return operation();
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function managerSafeFetch(input, init = {}) {
      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const url = new URL(rawUrl, window.location.href);
        const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

        if (url.pathname.endsWith("/rest/v1/set_departments") && method !== "GET" && typeof init?.body === "string") {
          const body = stripAttendanceFields(JSON.parse(init.body));
          return originalFetch(input, { ...init, body: JSON.stringify(body) });
        }
      } catch {
        // Fall back to the original request when it is not a JSON REST write.
      }
      return originalFetch(input, init);
    };

    try {
      return await operation();
    } finally {
      window.fetch = originalFetch;
    }
  }

  const originalLoadState = api.loadState;
  api.loadState = async function loadSafeState() {
    const originalFetch = window.fetch.bind(window);
    const safeDepartmentColumns = "id,name,start_date,end_date,hidden_from_schedule,sort_order,created_at,updated_at";
    window.fetch = async function safeFetch(input, init) {
      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const url = new URL(rawUrl, window.location.href);
        if (url.pathname.endsWith("/rest/v1/set_departments")) {
          const selected = url.searchParams.get("select") || "";
          if (/address|latitude|longitude|attendance_enabled/i.test(selected)) {
            url.searchParams.set("select", safeDepartmentColumns);
            const nextInput = input instanceof Request ? new Request(url.toString(), input) : url.toString();
            return originalFetch(nextInput, init);
          }
        }
      } catch {
        // Use the original request when the URL cannot be parsed.
      }
      return originalFetch(input, init);
    };

    let state;
    try {
      state = await originalLoadState();
    } finally {
      window.fetch = originalFetch;
    }

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
        // Keep the legacy employee-code order until migration 038 and member-order-v2 are deployed.
      }
    }
    return state;
  };

  const originalSaveState = api.saveState;
  if (typeof originalSaveState === "function") {
    api.saveState = (payload) => runManagerSafeWrite(() => originalSaveState(payload));
  }

  const originalSaveDepartmentItem = api.saveDepartmentItem;
  if (typeof originalSaveDepartmentItem === "function") {
    api.saveDepartmentItem = (...args) => runManagerSafeWrite(() => originalSaveDepartmentItem(...args));
  }

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

  window.addEventListener("load", () => {
    ["v2-overtime-admin.js", "v2-meal.js", "v2-attendance-admin.js"].forEach((file) => {
      if (document.querySelector(`script[data-v2-module="${file}"]`)) return;
      const script = document.createElement("script");
      script.src = `./${file}?v=20260708v1`;
      script.dataset.v2Module = file;
      document.body.appendChild(script);
    });
  }, { once: true });
})();
