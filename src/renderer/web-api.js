(function installWebSchedulerApi() {
  if (window.schedulerApi) {
    return;
  }

  const config = window.SCHEDULER_CONFIG || {};
  const exporter = window.schedulerBrowserExporter;
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const documentId = String(config.documentId || "default");
  const sessionStorageKey = `scheduler.supabase.session.${baseUrl}`;
  const mobileSessionMaxIdleMs = 48 * 60 * 60 * 1000;
  const desktopSessionMaxIdleMs = 30 * 60 * 1000;

  if (!baseUrl || !anonKey || !exporter) {
    throw new Error("缺少 Supabase 設定");
  }

  let currentSession = null;
  let currentProfile = null;

      function compactExportDate(value) {
    return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
  }

  function makeRangeExportFileName(prefix, payload, extension) {
    return `${prefix}_${compactExportDate(payload.startDate)}-${compactExportDate(payload.endDate)}.${extension}`;
  }

  function formatOvertimeHoursAsTime(value) {
  const totalMinutes = Math.round(Number(value) * 60);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "";
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function subtractOvertimeHoursFromClockTime(value, hours) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!match) return { time: "", previousDay: 0 };
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const overtimeMinutes = Math.round(Number(hours || 0) * 60);
  if (!Number.isFinite(overtimeMinutes) || overtimeMinutes <= 0) {
    return { time: `${match[1]}:${match[2]}`, previousDay: 0 };
  }
  const shiftedMinutes = startMinutes - overtimeMinutes;
  const normalizedMinutes = ((shiftedMinutes % 1440) + 1440) % 1440;
  return {
    time: `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`,
    previousDay: shiftedMinutes < 0 ? 1 : 0
  };
}

  function addMinutesToClockTime(value, minutesToAdd) {
    const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)/);
    if (!match) return "";
    const baseMinutes = Number(match[1]) * 60 + Number(match[2]);
    const delta = Number(minutesToAdd || 0);
    if (!Number.isFinite(delta)) return `${match[1]}:${match[2]}`;
    const normalizedMinutes = ((baseMinutes + Math.round(delta)) % 1440 + 1440) % 1440;
    return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
  }

  function downloadBlob(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        resolve(file);
      }, { once: true });
      input.click();
    });
  }

  function normalizeSession(payload) {
    if (!payload?.access_token || !payload?.user) {
      return null;
    }
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || "",
      token_type: payload.token_type || "bearer",
      expires_in: Number(payload.expires_in || 0),
      expires_at: Number(payload.expires_at || 0),
      user: payload.user
    };
  }

  function isTabletDevice() {
    const userAgent = navigator.userAgent || "";
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const isIPad = /iPad/i.test(userAgent)
      || (/Macintosh/i.test(userAgent) && touchPoints > 1);
    const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent);
    return Boolean(isIPad || isAndroidTablet || /Tablet|Silk/i.test(userAgent));
  }

  function isPhoneDevice() {
    const userAgent = navigator.userAgent || "";
    const isTablet = isTabletDevice();
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
    return Boolean(
      navigator.userAgentData?.mobile
        || narrowTouch
        || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent))
    );
  }

  function getSessionStore() {
    return isPhoneDevice() ? localStorage : sessionStorage;
  }

  function getSessionMaxIdleMs() {
    return isPhoneDevice() ? mobileSessionMaxIdleMs : desktopSessionMaxIdleMs;
  }

  function readStoredSession() {
    try {
      const stored = JSON.parse(getSessionStore().getItem(sessionStorageKey) || "null");
      const session = normalizeSession(stored?.session || stored);
      const lastActivityAt = Number(stored?.lastActivityAt || 0);
      if (!session || !lastActivityAt || Date.now() - lastActivityAt > getSessionMaxIdleMs()) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function persistSession(session) {
    currentSession = normalizeSession(session);
    if (currentSession) {
      const store = getSessionStore();
      const otherStore = store === localStorage ? sessionStorage : localStorage;
      store.setItem(sessionStorageKey, JSON.stringify({
        session: currentSession,
        lastActivityAt: Date.now(),
        device: isTabletDevice() ? "tablet" : isPhoneDevice() ? "phone" : "desktop"
      }));
      otherStore.removeItem(sessionStorageKey);
    } else {
      localStorage.removeItem(sessionStorageKey);
      sessionStorage.removeItem(sessionStorageKey);
    }
  }

  function clearSession() {
    currentSession = null;
    currentProfile = null;
    localStorage.removeItem(sessionStorageKey);
    sessionStorage.removeItem(sessionStorageKey);
  }

  function readSessionMeta() {
    try {
      return JSON.parse(getSessionStore().getItem(sessionStorageKey) || "null");
    } catch {
      return null;
    }
  }

  function isSessionIdleExpired() {
    const stored = readSessionMeta();
    const lastActivityAt = Number(stored?.lastActivityAt || 0);
    return Boolean(currentSession && (!lastActivityAt || Date.now() - lastActivityAt > getSessionMaxIdleMs()));
  }

  function expireSession() {
    clearSession();
    window.dispatchEvent(new CustomEvent("scheduler-session-expired"));
  }

  function assertSessionActive() {
    if (isSessionIdleExpired()) {
      expireSession();
      throw new Error("登入已逾時，請重新登入");
    }
  }

  let lastActivityWriteAt = 0;

  function touchSession(force = false) {
    if (!currentSession) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastActivityWriteAt < 15000) {
      return;
    }
    persistSession(currentSession);
    lastActivityWriteAt = now;
  }

  function buildHeaders(options = {}) {
    const { auth = false, contentType = true, extra = {} } = options;
    const headers = {
      apikey: anonKey,
      ...extra
    };
    if (auth && currentSession?.access_token) {
      headers.Authorization = `Bearer ${currentSession.access_token}`;
    }
    if (contentType) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  async function readError(response) {
    const text = await response.text();
    if (!text) {
      return `HTTP ${response.status}`;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error_description || parsed.error || text;
    } catch {
      return text;
    }
  }

  async function requestJson(pathname, options = {}) {
    if (options.auth) {
      assertSessionActive();
    }
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers: buildHeaders({
        auth: options.auth,
        contentType: options.contentType !== false,
        extra: options.headers || {}
      })
    });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    if (options.auth) {
      touchSession();
    }
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function requestFunction(functionName, payload, { retryTransientOnce = false } = {}) {
    for (let attempt = 0; ; attempt += 1) {
      assertSessionActive();
      let response;
      try {
        response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
          method: "POST",
          cache: "no-store",
          headers: buildHeaders({
            auth: true,
            extra: {
              Accept: "application/json"
            }
          }),
          body: JSON.stringify(payload || {})
        });
      } catch (error) {
        if (retryTransientOnce && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw error;
      }
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`尚未部署 ${functionName} Edge Function`);
        }
        const message = await readError(response);
        if (retryTransientOnce && attempt === 0 && [502, 503, 504].includes(response.status)) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw new Error(message);
      }
      touchSession();
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
  }

  function optionalUuid(value, label) {
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }
    if (!isUuid(text)) {
      throw new Error(`${label}識別碼格式錯誤`);
    }
    return text;
  }

  async function callRpc(functionName, payload = {}, options = {}) {
    const { prefer = "return=representation" } = options;
    return requestJson(`/rest/v1/rpc/${functionName}`, {
      method: "POST",
      auth: true,
      headers: {
        Accept: "application/json",
        Prefer: prefer
      },
      body: JSON.stringify(payload || {})
    });
  }

  const RPC_PAGE_SIZE = 1000;

  async function callRpcAllRows(functionName, payload = {}) {
    const rows = [];
    let offset = 0;
    while (true) {
      const page = await callRpc(functionName, {
        ...payload,
        p_offset: offset,
        p_limit: RPC_PAGE_SIZE
      }) || [];
      if (!Array.isArray(page)) {
        throw new Error(`${functionName} 回傳格式錯誤`);
      }
      rows.push(...page);
      if (page.length < RPC_PAGE_SIZE) {
        break;
      }
      offset += page.length;
    }
    return rows;
  }

  async function getMyProfileRow() {
    const rows = await callRpc("get_my_profile_v3", {}, { auth: true }) || [];
    return rows[0] || null;
  }

      async function getEmployeeAdminDirectoryRows() {
    ensureSignedIn();
    return callRpc("get_employee_admin_directory_v3", {}) || [];
  }


  
  function ensureSignedIn() {
    if (!currentSession?.user) {
      throw new Error("請先登入");
    }
  }

    async function refreshSessionIfNeeded() {
    if (!currentSession?.refresh_token) {
      return currentSession;
    }
    if (currentSession.expires_at && Date.now() < (currentSession.expires_at - 60) * 1000) {
      return currentSession;
    }
    const payload = await requestJson("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({
        refresh_token: currentSession.refresh_token
      })
    });
    persistSession(payload);
    return currentSession;
  }

  async function fetchProfile(userId) {
    const profile = await getMyProfileRow();
    return profile?.id === userId ? profile : null;
  }

  async function refreshAuthContext() {
    currentProfile = null;
    if (!currentSession?.user) {
      return {
        session: null,
        profile: null
      };
    }
    await refreshSessionIfNeeded();
    currentProfile = await fetchProfile(currentSession.user.id);
    if (!currentProfile) {
      throw new Error("帳號尚未綁定身份");
    }
    assertProfileCanLogin(currentProfile);
    return {
      session: currentSession,
      profile: currentProfile
    };
  }

  async function initializeAuth() {
    persistSession(readStoredSession());
    if (!currentSession?.user) {
      return { session: null, profile: null };
    }
    try {
      return await refreshAuthContext();
    } catch {
      clearSession();
      return { session: null, profile: null };
    }
  }

  function buildLocalLoginEmail(employeeCode) {
    const exactCode = String(employeeCode ?? "");
    if (!exactCode || exactCode !== exactCode.trim() || !/^[A-Za-z0-9._-]+$/.test(exactCode)) {
      return "";
    }
    return `${exactCode.toLowerCase()}@local.invalid`;
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, () => touchSession(), {
      capture: true,
      passive: eventName === "touchstart"
    });
  });
  window.addEventListener("focus", () => touchSession());

  setInterval(() => {
    if (isSessionIdleExpired()) {
      expireSession();
    }
  }, 60 * 1000);

  async function signIn(loginAccount, password) {
    const employeeCode = String(loginAccount ?? "");
    const email = buildLocalLoginEmail(employeeCode);
    if (!email) {
      throw new Error("工號格式錯誤");
    }
    const payload = await requestJson("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });
    persistSession(payload);
    try {
      return await refreshAuthContext();
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function signOut() {
    if (currentSession?.access_token) {
      try {
        await requestJson("/auth/v1/logout", {
          method: "POST",
          auth: true,
          contentType: false
        });
      } catch {
        // logout 失敗時仍直接清本機 session，避免使用者卡住；若要更嚴謹可再補重試。
      }
    }
    clearSession();
    return { session: null, profile: null };
  }

  async function changePassword(newPassword) {
    ensureSignedIn();
    await requestJson("/auth/v1/user", {
      method: "PUT",
      auth: true,
      body: JSON.stringify({
        password: String(newPassword || "")
      })
    });
    return { ok: true };
  }

  function nullableDate(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function nullableTime(value) {
    const text = String(value || "").trim();
    return /^\d{2}:\d{2}$/.test(text) ? text : null;
  }

  function clampInteger(value, min, max, fallback = min) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }

  function normalizeTextArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const text = String(value || "").trim();
    if (!text) {
      return [];
    }
    const body = text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1) : text;
    // scheduler ids do not contain commas; use a full Postgres array parser if that changes.
    return body
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, "").replace(/\\"/g, "\""))
      .filter(Boolean);
  }

  function notInFilter(values) {
    const list = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
    return list.length ? `not.${buildInFilter(list)}` : "not.is.null";
  }

  function makeScheduleKey(memberId, workDate) {
    const [yearText, monthText, dayText] = String(workDate || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return "";
    }
    return `${memberId}_${year}_${month - 1}_${day}`;
  }

  function parseScheduleKey(key) {
    const parts = String(key || "").split("_");
    if (parts.length < 4) {
      return null;
    }
    const memberId = parts.slice(0, -3).join("_");
    const year = Number(parts[parts.length - 3]);
    const month = Number(parts[parts.length - 2]);
    const day = Number(parts[parts.length - 1]);
    if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }
    return {
      memberId,
      workDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      year,
      month: month + 1
    };
  }

  function makeScheduleEntryKey(memberId, workDate) {
    return `${memberId || ""}|${workDate || ""}`;
  }

  function toDateObject(dateString) {
    const [year, month, day] = String(dateString || "").split("-").map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  function toDateStringFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function taipeiDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function addDaysToDateString(dateString, count) {
    const date = toDateObject(dateString);
    if (!date) {
      return "";
    }
    date.setDate(date.getDate() + count);
    return toDateStringFromDate(date);
  }

  function diffDays(startDateString, endDateString) {
    const start = toDateObject(startDateString);
    const end = toDateObject(endDateString);
    if (!start || !end) {
      return 0;
    }
    return Math.floor((end - start) / (24 * 60 * 60 * 1000));
  }

  function getScheduleLoadRange(settings = {}) {
    const today = toDateStringFromDate(new Date());
    const anchorDate = toDateObject(settings.eight_week_start_date) ? settings.eight_week_start_date : today;
    const periods = Math.floor(diffDays(anchorDate, today) / 56);
    const visibleStart = addDaysToDateString(anchorDate, periods * 56) || today;
    return {
      startDate: visibleStart,
      endDate: addDaysToDateString(visibleStart, 55)
    };
  }

  function getScheduleEntryFilters(range = {}) {
    const filters = {};
    const startDate = toDateObject(range.startDate) ? range.startDate : "";
    const endDate = toDateObject(range.endDate) ? range.endDate : "";
    if (startDate && endDate) {
      filters.and = `(work_date.gte.${startDate},work_date.lte.${endDate})`;
    } else if (startDate) {
      filters.work_date = `gte.${startDate}`;
    } else if (endDate) {
      filters.work_date = `lte.${endDate}`;
    }
    return filters;
  }

  function mapScheduleRows(scheduleEntryRows = [], members = []) {
    const memberIds = new Set((members || []).map((member) => member.id).filter(Boolean));
    const schedule = {};
    (scheduleEntryRows || []).forEach((row) => {
      if (memberIds.size && !memberIds.has(row.member_id)) {
        return;
      }
      const key = makeScheduleKey(row.member_id, row.work_date);
      if (!key) {
        return;
      }
      const shift = row.shift_type_id || null;
      const leave = row.leave_type_id || null;
      const overtime = row.overtime_type_id || null;
      if (!shift && !leave && !overtime) {
        return;
      }
      schedule[key] = {
        shift,
        leave,
        overtime,
        leaveMeta: leave ? {
          allDay: row.leave_all_day !== false,
          startTime: (row.leave_start_time || "").slice(0, 5),
          endTime: (row.leave_end_time || "").slice(0, 5),
          reasonEnabled: Boolean(row.leave_reason),
          reason: row.leave_reason || ""
        } : null,
        overtimeMeta: overtime ? {
          startTime: (row.overtime_start_time || "").slice(0, 5),
          endTime: (row.overtime_end_time || "").slice(0, 5),
          useRest1: Boolean(row.overtime_use_rest_1),
          rest1StartTime: (row.overtime_rest_1_start_time || "").slice(0, 5),
          rest1EndTime: (row.overtime_rest_1_end_time || "").slice(0, 5),
          useRest2: Boolean(row.overtime_use_rest_2),
          rest2StartTime: (row.overtime_rest_2_start_time || "").slice(0, 5),
          rest2EndTime: (row.overtime_rest_2_end_time || "").slice(0, 5),
          reason: row.overtime_reason || ""
        } : null
      };
    });
    return schedule;
  }

  function normalizeScheduleLoadedRanges(ranges = []) {
    return (Array.isArray(ranges) ? ranges : [])
      .map((range) => ({
        startDate: toDateObject(range?.startDate) ? range.startDate : "",
        endDate: toDateObject(range?.endDate) ? range.endDate : ""
      }))
      .filter((range) => range.startDate && range.endDate && range.startDate <= range.endDate);
  }

  
  
  async function getDepartmentAttendanceSettings() {
    ensureSignedIn();
    const rows = await callRpc("get_department_attendance_settings_v3", {}) || [];
    return rows.map((row) => ({
      departmentId: row.department_id,
      address: row.address || "",
      latitude: row.latitude,
      longitude: row.longitude,
      attendanceEnabled: Boolean(row.attendance_enabled),
      publicIp: row.public_ip || ""
    }));
  }

  async function getTodayAttendance() {
    ensureSignedIn();
    return requestFunction("attendance-clock", {
      action: "today"
    });
  }

  async function clockAttendance(action, position = {}) {
    ensureSignedIn();
    return requestFunction("attendance-clock", {
      action,
      deviceType: isPhoneDevice() ? "phone" : "desktop",
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      geolocationError: position.geolocationError || ""
    });
  }

  async function getPersonalRecords(filters = {}) {
    ensureSignedIn();
    return requestFunction("attendance-ledger", { action: "personal_list", ...filters });
  }

  async function savePersonalAttendanceDay(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-ledger", { action: "personal_save", ...payload });
  }

    async function getAttendanceReviewList(filters = {}) {
    ensureSignedIn();
    return requestFunction(
      "attendance-review-groups",
      { action: "review_list", ...filters },
      { retryTransientOnce: true }
    );
  }

  async function saveAttendanceCommonNotes(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "common_notes_save", ...payload });
  }

  async function saveAttendanceReviewRecord(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_save", ...payload });
  }

  async function setAttendanceReviewed(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_set", ...payload });
  }

  async function getAttendanceHistory(recordId) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "history", recordId });
  }

      async function getTodayMealOrder() {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "today_status"
    });
  }

  async function saveTodayMealOrder(payload = {}) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "save",
      items: Array.isArray(payload.items) ? payload.items : [],
      note: payload.note || ""
    });
  }

  async function getMealStatsReport(filters = {}) {
    return getMealReport(filters);
  }

        async function cancelTodayMealOrder() {
    ensureSignedIn();
    return requestFunction("meal-cancel-v2", {});
  }

  async function getMealAdminSettings() {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "admin_settings"
    });
  }

  async function saveMealAdminSettings(payload = {}) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "save_admin_settings",
      products: Array.isArray(payload.products) ? payload.products : [],
      dailyCutoffTime: payload.dailyCutoffTime || "10:30",
      companySubsidy: Number(payload.companySubsidy)
    });
  }

  async function deleteMealProduct(productId) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "delete_admin_product",
      productId: String(productId || "")
    });
  }

  async function getMealReport(filters = {}) {
    ensureSignedIn();
    return requestFunction("meal-report-v2", filters);
  }

  
  
  function assertProfileCanLogin(profile) {
    const today = taipeiDateString();
    const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
    if ((profile.hire_date && today < profile.hire_date) || (effectiveEndDate && today > effectiveEndDate)) {
      throw new Error("此帳號目前不在有效期間，無法登入");
    }
  }

  
  
  function mapDepartmentRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.id,
        name: row.name || "",
        startDate: row.start_date || "",
        endDate: row.end_date || "",
        hiddenFromSchedule: Boolean(row.hidden_from_schedule),
        address: row.address || "",
        latitude: row.latitude ?? "",
        longitude: row.longitude ?? "",
        publicIp: row.public_ip || "",
        attendanceEnabled: Boolean(row.attendance_enabled),
        groupId: row.group_id || "",
        deleted: Boolean(row.deleted_at)
      }));
  }

    
  
  async function loadScheduleExportRows(startDate, endDate) {
    ensureSignedIn();
    const normalizedStart = nullableDate(startDate);
    const normalizedEnd = nullableDate(endDate);
    if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
      throw new Error("匯出日期範圍不正確");
    }
    return callRpc("get_schedule_export_rows_v2", {
      p_start_date: normalizedStart,
      p_end_date: normalizedEnd
    }, { auth: true }) || [];
  }

  function mapShiftRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.id,
        name: row.name || "",
        color: row.color || "#378ADD",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        startTime: (row.start_time || "").slice(0, 5),
        endTime: (row.end_time || "").slice(0, 5),
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar) || Boolean(row.deleted_at),
        deleted: Boolean(row.deleted_at),
        requiredStaffCount: Math.max(0, Number(row.required_staff_count) || 0),
        applicableDeptId: row.applicable_department_id || "",
        positionRequirements: [],
        groupId: row.group_id || ""
      }));
  }

  function mapLeaveRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.code || "").localeCompare(String(b.code || "")))
      .map((row) => ({
        id: row.id,
        code: row.code || "",
        name: row.name || "",
        color: row.color || "#888780",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar) || Boolean(row.deleted_at),
        deleted: Boolean(row.deleted_at),
        requiresTime: Boolean(row.requires_time),
        requiresReason: Boolean(row.requires_reason)
      }));
  }

  function mapOvertimeRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.id,
        name: row.name || "加班",
        color: row.color || "#D85A30",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar) || Boolean(row.deleted_at),
        deleted: Boolean(row.deleted_at),
        startTime: (row.start_time || "").slice(0, 5),
        endTime: (row.end_time || "").slice(0, 5),
        useRest1: Boolean(row.use_rest_1),
        rest1StartTime: (row.rest_1_start_time || "").slice(0, 5),
        rest1EndTime: (row.rest_1_end_time || "").slice(0, 5),
        useRest2: Boolean(row.use_rest_2),
        rest2StartTime: (row.rest_2_start_time || "").slice(0, 5),
        rest2EndTime: (row.rest_2_end_time || "").slice(0, 5)
      }));
  }

  function mapHolidayRows(rows = []) {
    return (rows || [])
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.holiday_date || "").localeCompare(String(b.holiday_date || "")))
      .map((row) => ({
        id: row.id,
        date: row.holiday_date || "",
        name: row.name || ""
      }));
  }

  function mapMemberDirectoryRows(profileRows = []) {
    return (profileRows || []).map((row) => {
      const departmentId = row.home_department_id || "";
      const scheduleShiftIds = normalizeTextArray(row.schedule_shift_ids)
        .filter((value, index, list) => value && list.indexOf(value) === index);
      return {
        id: row.id,
        code: row.employee_code || "",
        name: row.full_name || "",
        deptId: departmentId,
        scheduleShiftIds,
        positionId: "",
        proxyMemberId: "",
        hireDate: row.hire_date || "",
        leaveDate: row.leave_date || "",
        payByDay: Boolean(row.pay_by_day),
        fixedRestWeekday: clampInteger(row.fixed_rest_weekday, 0, 6, 0),
        monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),
        roleId: row.access_role_id || "",
        groupId: row.group_id || "",
        deleted: Boolean(row.deleted_at)
      };
    });
  }

  async function loadEmployeeAdminDirectory() {
    ensureSignedIn();
    return mapMemberDirectoryRows(await getEmployeeAdminDirectoryRows());
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

    async function loadState() {
    ensureSignedIn();
    const bootstrap = await callRpc("get_scheduler_bootstrap_v3", { p_document_id: documentId });
    if (!bootstrap || typeof bootstrap !== "object") {
      throw new Error("無法載入班表基礎資料");
    }
    const settings = bootstrap.settings || {};
    const scheduleRange = getScheduleLoadRange(settings);
    const visibleStartDate = scheduleRange.startDate || taipeiDateString();
    const visibleStart = toDateObject(visibleStartDate);
    const scheduleEntryRows = await callRpcAllRows("get_schedule_entries_v3", {
      p_start_date: scheduleRange.startDate,
      p_end_date: scheduleRange.endDate
    });

    const departments = mapDepartmentRows(bootstrap.departments || []);
    const members = mapMemberDirectoryRows(bootstrap.members || []);
    return {
      year: visibleStart?.getFullYear() || new Date().getFullYear(),
      month: visibleStart?.getMonth() ?? new Date().getMonth(),
      selected: { type: null, id: null },
      deptFilter: "all",
      tableView: settings.table_view === "shift" ? "shift" : "member",
      tableDeptScopeFilter: "all",
      tableStatsVisible: settings.table_stats_visible !== false,
      scheduleStartDate: visibleStartDate,
      departments,
      members,
      shifts: mapShiftRows(bootstrap.shifts || []),
      leaves: mapLeaveRows(bootstrap.leaves || []),
      overtime: mapOvertimeRows(bootstrap.overtime || []),
      holidays: mapHolidayRows(bootstrap.holidays || []),
      rules: {
        weekStart: clampInteger(settings.week_start, 0, 6, 0),
        monthStartDay: clampInteger(settings.month_start_day, 1, 31, 1),
        eightWeekStartDate: settings.eight_week_start_date || ""
      },
      schedule: mapScheduleRows(scheduleEntryRows, members),
      scheduleLoadedRanges: [scheduleRange],
      accessBundle: bootstrap.accessBundle || { actor: {}, groups: [], roles: [] },
      archiveRanges: Array.isArray(bootstrap.archiveRanges) ? bootstrap.archiveRanges : []
    };
  }


  
    async function syncMemberProfile(member, previousEmployeeCode = "") {
    ensureSignedIn();
    return requestFunction("member-auth-admin", {
      action: "upsert_member",
      member: {
        employeeCode: String(member?.code || "").trim(),
        fullName: member?.name || "",
        groupId: member?.groupId || "",
        accessRoleId: member?.roleId || "",
        hireDate: member?.hireDate || null,
        leaveDate: member?.leaveDate || null,
        payByDay: Boolean(member?.payByDay),
        fixedRestWeekday: clampInteger(member?.fixedRestWeekday, 0, 6, 0),
        homeDepartmentId: member?.deptId || "",
        scheduleShiftIds: Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [],
        monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0)
      },
      previousEmployeeCode: String(previousEmployeeCode || "").trim()
    });
  }


  async function resetMemberPassword(employeeCode) {
    ensureSignedIn();
    return requestFunction("member-auth-admin", {
      action: "reset_password",
      employeeCode: String(employeeCode || "").trim(),
      password: "0000"
    });
  }

  async function deleteMemberProfile(employeeCode, currentPassword = "") {
    ensureSignedIn();
    return requestFunction("member-auth-admin", {
      action: "delete_member",
      employeeCode: String(employeeCode || "").trim(),
      currentPassword: String(currentPassword || "")
    });
  }

  
    async function loadScheduleEntries(range = {}) {
    ensureSignedIn();
    const startDate = toDateObject(range.startDate) ? range.startDate : "";
    const endDate = toDateObject(range.endDate) ? range.endDate : "";
    if (!startDate || !endDate) throw new Error("schedule range is required");
    const rows = await callRpcAllRows("get_schedule_entries_v3", {
      p_start_date: startDate,
      p_end_date: endDate
    });
    const members = Array.isArray(range.members) ? range.members : [];
    return {
      schedule: mapScheduleRows(rows, members),
      scheduleLoadedRanges: [{ startDate, endDate }]
    };
  }

  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureSignedIn();
    return callRpc("save_department_v3", {
      p_department: { ...department, sortOrder }
    });
  }


    async function deleteDepartmentItem(departmentId) {
    ensureSignedIn();
    return callRpc("delete_department_v3", {
      p_department_id: String(departmentId || "").trim()
    });
  }


    async function saveShiftItem(shift, sortOrder = 0) {
    ensureSignedIn();
    return callRpc("save_shift_v3", {
      p_shift: {
        ...shift,
        applicableDepartmentId: shift?.applicableDeptId || shift?.applicableDepartmentId || "",
        sortOrder
      }
    });
  }


    async function saveCatalogItem(category, item, sortOrder = 0) {
    ensureSignedIn();
    return callRpc("save_catalog_item_v3", {
      p_category: String(category || ""),
      p_item: { ...item, sortOrder }
    });
  }


    async function deleteCatalogItem(category, itemId) {
    ensureSignedIn();
    return callRpc("delete_catalog_item_v3", {
      p_category: String(category || ""),
      p_item_id: String(itemId || "")
    });
  }


    async function saveScheduleEntryRows(rows) {
    const entries = (Array.isArray(rows) ? rows : []).filter((row) => row?.member_id && row?.work_date);
    if (!entries.length) return [];
    return callRpc("save_schedule_entries_v3", { entries }) || [];
  }


    async function saveScheduleCells(payloads) {
    ensureSignedIn();
    const rows = [];
    for (const payload of Array.isArray(payloads) ? payloads : []) {
      const profileMemberId = String(payload.memberId || "").trim();
      const workDate = nullableDate(payload.dateString || payload.workDate);
      if (!isUuid(profileMemberId) || !workDate) throw new Error("schedule cell member UUID and date are required");
      const deleteEntry = payload.deleteEntry === true;
      const slot = payload.slot && typeof payload.slot === "object" ? payload.slot : {};
      const shiftId = optionalUuid(slot.shift, "班別");
      const leaveId = optionalUuid(slot.leave, "假別");
      const overtimeId = optionalUuid(slot.overtime, "加班");
      if (deleteEntry) {
        rows.push({ member_id: profileMemberId, work_date: workDate, delete_entry: true });
        continue;
      }
      if (!shiftId && !leaveId && !overtimeId) {
        throw new Error("班表儲存內容不可空白");
      }
      const leaveAllDay = slot.leaveMeta?.allDay !== false;
      rows.push({
        member_id: profileMemberId,
        work_date: workDate,
        delete_entry: false,
        shift_type_id: shiftId,
        leave_type_id: leaveId,
        leave_all_day: leaveAllDay,
        leave_start_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.startTime) : null,
        leave_end_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.endTime) : null,
        leave_reason: leaveId ? slot.leaveMeta?.reason || null : null,
        overtime_type_id: overtimeId,
        overtime_start_time: overtimeId ? nullableTime(slot.overtimeMeta?.startTime) : null,
        overtime_end_time: overtimeId ? nullableTime(slot.overtimeMeta?.endTime) : null,
        overtime_use_rest_1: overtimeId ? Boolean(slot.overtimeMeta?.useRest1) : false,
        overtime_rest_1_start_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,
        overtime_rest_1_end_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,
        overtime_use_rest_2: overtimeId ? Boolean(slot.overtimeMeta?.useRest2) : false,
        overtime_rest_2_start_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,
        overtime_rest_2_end_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,
        overtime_reason: overtimeId ? slot.overtimeMeta?.reason || null : null
      });
    }
    const savedRows = await saveScheduleEntryRows(rows);
    const expectedKeys = new Set(rows
      .filter((row) => !row.delete_entry)
      .map((row) => makeScheduleEntryKey(row.member_id, row.work_date)));
    const savedKeys = new Set((Array.isArray(savedRows) ? savedRows : [])
      .map((row) => makeScheduleEntryKey(row.member_id, row.work_date)));
    const missingKeys = [...expectedKeys].filter((key) => !savedKeys.has(key));
    if (missingKeys.length) {
      throw new Error("班表資料未成功寫入，請重新操作");
    }
    return { ok: true, rows: savedRows };
  }


  async function reorderSettings(category, ids = []) {
    ensureSignedIn();
    return callRpc("reorder_settings_v3", {
      p_category: String(category || ""),
      p_ids: (Array.isArray(ids) ? ids : []).filter(isUuid)
    });
  }

  async function saveSchedulerPreferences(state) {
    ensureSignedIn();
    return callRpc("save_scheduler_preferences_v3", {
      p_document_id: documentId,
      p_settings: {
        currentYear: Number(state?.year) || new Date().getFullYear(),
        currentMonth: clampInteger(state?.month, 0, 11, new Date().getMonth()),
        deptFilter: state?.deptFilter || "all",
        tableView: state?.tableView === "shift" ? "shift" : "member",
        tableDeptScopeFilter: state?.tableDeptScopeFilter || "all",
        tableStatsVisible: state?.tableStatsVisible !== false,
        scheduleStartDate: nullableDate(state?.scheduleStartDate),
        weekStart: clampInteger(state?.rules?.weekStart, 0, 6, 0),
        monthStartDay: clampInteger(state?.rules?.monthStartDay, 1, 31, 1),
        eightWeekStartDate: nullableDate(state?.rules?.eightWeekStartDate)
      }
    });
  }

  async function saveHolidays(holidays = []) {
    ensureSignedIn();
    return callRpc("save_holidays_v3", {
      p_holidays: (Array.isArray(holidays) ? holidays : []).map((holiday) => ({
        id: holiday.id,
        date: holiday.date,
        name: holiday.name || "假日"
      }))
    });
  }

  async function saveScheduleCell(payload) {
    const result = await saveScheduleCells([payload]);
    return { ok: true, row: result.rows?.[0] || null };
  }

  async function getGroupAccessBundle() { return callRpc("get_group_access_bundle_v1", {}) || {}; }
  async function getScheduleConditions(groupId) { return callRpc("get_schedule_conditions_v1", { p_group_id: groupId }) || []; }
  async function saveScheduleCondition(item) { return callRpc("save_schedule_condition_v1", { p_item: item }); }
  async function deleteScheduleCondition(conditionId) { return callRpc("delete_schedule_condition_v1", { p_condition_id: conditionId }); }
  async function getScheduleArchiveRanges() { return callRpc("get_schedule_archive_ranges_v1", {}) || []; }
  async function saveScheduleGroup(group) { return callRpc("save_schedule_group_v1", { p_group: group }); }
  async function deleteScheduleGroup(groupId, confirmName) { return callRpc("delete_schedule_group_v1", { p_group_id: groupId, p_confirm_name: confirmName }); }
  async function reorderScheduleGroups(groupIds) { return callRpc("reorder_schedule_groups_v1", { p_group_ids: groupIds }); }
  async function saveAccessRole(role) { return callRpc("save_access_role_v1", { p_role: role }); }
  async function deleteAccessRole(roleId) { return callRpc("delete_access_role_v1", { p_role_id: roleId }); }
  async function validateMemberGroupChange(employeeCode, groupId) { return callRpc("validate_member_group_change_v1", { p_employee_code: employeeCode, p_new_group_id: groupId }); }
  async function getScheduleArchives(groupId = null) { return callRpc("get_schedule_archives_v1", { p_group_id: groupId }); }
  async function archiveSchedule(groupId, startDate, endDate) { return callRpc("archive_schedule_v1", { p_group_id: groupId, p_start_date: startDate, p_end_date: endDate }); }
  async function unarchiveSchedule(archiveId) { return callRpc("unarchive_schedule_v1", { p_archive_id: archiveId }); }
  async function getScheduleArchiveDetail(archiveId) { return callRpc("get_schedule_archive_detail_v1", { p_archive_id: archiveId }); }

  async function exportSapCsv(payload) {
    if (!exporter.getSapLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = new Blob(
      [exporter.buildSapLeaveCsvContent(payload)],
      { type: "text/csv;charset=utf-8" }
    );
    const fileName = makeRangeExportFileName("sap例休假", payload, "csv");
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  async function exportOvertime(payload) {
    if (!exporter.getOvertimeExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload));
    const fileName = makeRangeExportFileName("匯出加班", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  async function exportLeave(payload) {
    if (!exporter.getLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload));
    const fileName = makeRangeExportFileName("匯出請假", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  async function exportMealReport(report = {}) {
    const workbook = await exporter.createMealReportWorkbook(report);
    if (!workbook) return { canceled: true, empty: true };
    const reportDate = compactExportDate(report.toDate);
    const blob = await exporter.workbookToBlob(workbook);
    const fileName = `訂餐統計_${compactExportDate(report.fromDate)}-${reportDate}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportAttendanceReview(filters = {}) {
    ensureSignedIn();
    const result = await requestFunction("attendance-ledger-export", {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId || "",
      groupId: filters.groupId || ""
    });
    const exportRows = (Array.isArray(result.rows) ? result.rows : []).flatMap((row) => {
      const scheduledStart = row.restDayScheduled ? String(row.scheduledShiftStartTime || "") : "";
      const scheduledEnd = row.restDayScheduled ? String(row.scheduledShiftEndTime || "") : "";
      if (scheduledStart && scheduledEnd) {
        const adjustedStart = subtractOvertimeHoursFromClockTime(scheduledStart, row.overtimeHours);
        const overtimeStart = adjustedStart.time || scheduledStart;
        const rest1Start = addMinutesToClockTime(overtimeStart, 4 * 60);
        const rest1End = addMinutesToClockTime(overtimeStart, 5 * 60);
        return [{
          employee_code: row.employee_code || "",
          work_date: row.work_date || "",
          overtime_type_id: "attendance-rest-day",
          overtime_start_time: adjustedStart.time || scheduledStart,
          overtime_end_time: scheduledEnd,
          overtime_previous_day: adjustedStart.previousDay,
          overtime_subsidy_type: 1,
          overtime_use_rest_1: true,
          overtime_rest_1_start_time: rest1Start,
          overtime_rest_1_end_time: rest1End,
          overtime_rest_1_paid: 0,
          overtime_use_rest_2: false
        }];
      }
      if (!(Number(row.overtimeHours) > 0)) return [];
      return [{
        employee_code: row.employee_code || "",
        work_date: row.work_date || "",
        overtime_type_id: "attendance-ledger",
        overtime_start_time: "00:00",
        overtime_end_time: formatOvertimeHoursAsTime(row.overtimeHours),
        overtime_previous_day: 0,
        overtime_subsidy_type: 1,
        overtime_use_rest_1: false,
        overtime_use_rest_2: false
      }];
    });
    return exportOvertime({
      startDate: filters.fromDate,
      endDate: filters.toDate,
      exportRows
    });
  }

  async function exportMembers(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createMemberWorkbook(payload));
    const fileName = "人員資料.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importMembers() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, rows: [] };
    }
    return {
      canceled: false,
      rows: await exporter.parseMemberWorkbook(await file.arrayBuffer())
    };
  }

  async function exportDepartments(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createDepartmentWorkbook(payload));
    const fileName = "單位設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importDepartments() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, rows: [] };
    }
    return {
      canceled: false,
      rows: await exporter.parseDepartmentWorkbook(await file.arrayBuffer())
    };
  }

  async function exportShifts(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createShiftWorkbook(payload));
    const fileName = "班別設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importShifts() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, rows: [] };
    }
    return {
      canceled: false,
      rows: await exporter.parseShiftWorkbook(await file.arrayBuffer())
    };
  }

  async function exportLeaveSettings(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createLeaveSettingsWorkbook(payload));
    const fileName = "假別設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importLeaveSettings() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, result: null };
    }
    return {
      canceled: false,
      result: await exporter.parseLeaveSettingsWorkbook(await file.arrayBuffer())
    };
  }

  async function exportOvertimeSettings(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createOvertimeSettingsWorkbook(payload));
    const fileName = "加班設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importOvertimeSettings() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, result: null };
    }
    return {
      canceled: false,
      result: await exporter.parseOvertimeSettingsWorkbook(await file.arrayBuffer())
    };
  }

  window.schedulerApi = {
    initializeAuth,
    getAuthContext: () => ({ session: currentSession, profile: currentProfile }),
    signIn,
    signOut,
    changePassword,
    getDepartmentAttendanceSettings,
    getTodayAttendance,
    clockAttendance,
    getTodayMealOrder,
    saveTodayMealOrder,
    getPersonalRecords,
    savePersonalAttendanceDay,
    getAttendanceReviewList,
    saveAttendanceCommonNotes,
    saveAttendanceReviewRecord,
    setAttendanceReviewed,
    getAttendanceHistory,
    getMealStatsReport,
    getMealAdminSettings,
    saveMealAdminSettings,
    deleteMealProduct,
    getMealReport,
    cancelTodayMealOrder,
    deleteMemberProfile,
    loadState,
    loadEmployeeAdminDirectory,
    loadScheduleEntries,
    loadScheduleExportRows,
    saveDepartmentItem,
    deleteDepartmentItem,
    saveShiftItem,
    saveCatalogItem,
    deleteCatalogItem,
    saveScheduleCells,
    saveScheduleCell,
    reorderSettings,
    saveSchedulerPreferences,
    saveHolidays,
    getGroupAccessBundle,
    getScheduleConditions,
    saveScheduleCondition,
    deleteScheduleCondition,
    getScheduleArchiveRanges,
    saveScheduleGroup,
    deleteScheduleGroup,
    reorderScheduleGroups,
    saveAccessRole,
    deleteAccessRole,
    validateMemberGroupChange,
    getScheduleArchives,
    archiveSchedule,
    unarchiveSchedule,
    getScheduleArchiveDetail,
    syncMemberProfile,
    resetMemberPassword,
    exportSapCsv,
    exportAttendanceReview,
    exportOvertime,
    exportLeave,
    exportMealReport,
    exportMembers,
    importMembers,
    exportDepartments,
    importDepartments,
    exportShifts,
    importShifts,
    exportLeaveSettings,
    importLeaveSettings,
    exportOvertimeSettings,
    importOvertimeSettings,
    getAppInfo: async () => ({
      databasePath: `Supabase / normalized scheduler tables / ${documentId}`,
      backend: "supabase-static",
      updatedAt: null
    }),
    showMessage: async (_title, message) => {
      window.alert(message);
    },
    confirmAction: async (_title, message) => window.confirm(message)
  };
})();
