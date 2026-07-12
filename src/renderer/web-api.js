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

  function normalizeRole(role) {
    return role === "admin" || role === "manager" ? role : "employee";
  }

  function hasManagerAccess(role) {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === "admin" || normalizedRole === "manager";
  }

  function hasAdminAccess(role) {
    return normalizeRole(role) === "admin";
  }

  function makeFileName(prefix, payload, extension) {
    return `${prefix}_${payload.year}_${String(payload.month + 1).padStart(2, "0")}.${extension}`;
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

  function isPhoneDevice() {
    const userAgent = navigator.userAgent || "";
    const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
      || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
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
      getSessionStore().setItem(sessionStorageKey, JSON.stringify({
        session: currentSession,
        lastActivityAt: Date.now(),
        device: isPhoneDevice() ? "phone" : "desktop"
      }));
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

  function touchSession() {
    if (currentSession) {
      persistSession(currentSession);
    }
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

  async function requestFunction(functionName, payload) {
    assertSessionActive();
    const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
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
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`尚未部署 ${functionName} Edge Function`);
      }
      throw new Error(await readError(response));
    }
    touchSession();
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function buildQuery(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    });
    const query = search.toString();
    return query ? `?${query}` : "";
  }

  function quoteFilterValue(value) {
    return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }

  function buildInFilter(values) {
    return `in.(${values.map((value) => quoteFilterValue(value)).join(",")})`;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
  }

  async function restSelect(table, options = {}) {
    const { select = "*", filters = {}, order = "", limit = "", auth = false } = options;
    if (!limit) {
      return restSelectAll(table, { select, filters, order, auth });
    }
    return requestJson(
      `/rest/v1/${table}${buildQuery({
        select,
        order,
        limit,
        ...filters
      })}`,
      {
        method: "GET",
        auth,
        headers: {
          Accept: "application/json"
        }
      }
    );
  }

  async function restSelectAll(table, options = {}) {
    const { select = "*", filters = {}, order = "", auth = false } = options;
    const pageSize = 1000;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await requestJson(
        `/rest/v1/${table}${buildQuery({
          select,
          order,
          offset,
          limit: pageSize,
          ...filters
        })}`,
        {
          method: "GET",
          auth,
          headers: {
            Accept: "application/json"
          }
        }
      );
      rows.push(...(Array.isArray(page) ? page : []));
      if (!Array.isArray(page) || page.length < pageSize) {
        return rows;
      }
    }
  }

  async function restInsert(table, rows, options = {}) {
    const { auth = false, onConflict = "", prefer = "return=representation" } = options;
    return requestJson(
      `/rest/v1/${table}${buildQuery(onConflict ? { on_conflict: onConflict } : {})}`,
      {
        method: "POST",
        auth,
        headers: {
          Prefer: prefer
        },
        body: JSON.stringify(rows)
      }
    );
  }

  async function restUpdate(table, filters, payload, options = {}) {
    const { auth = false, prefer = "return=representation" } = options;
    return requestJson(
      `/rest/v1/${table}${buildQuery(filters)}`,
      {
        method: "PATCH",
        auth,
        headers: {
          Prefer: prefer
        },
        body: JSON.stringify(payload)
      }
    );
  }

  async function restDelete(table, filters, options = {}) {
    const { auth = false, prefer = "return=minimal" } = options;
    return requestJson(
      `/rest/v1/${table}${buildQuery(filters)}`,
      {
        method: "DELETE",
        auth,
        headers: {
          Prefer: prefer
        }
      }
    );
  }

  async function restRpc(functionName, payload = {}, options = {}) {
    const { auth = false, prefer = "return=representation" } = options;
    return requestJson(
      `/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        auth,
        headers: {
          Accept: "application/json",
          Prefer: prefer
        },
        body: JSON.stringify(payload || {})
      }
    );
  }

  async function getMyProfileRow() {
    const rows = await restRpc("get_my_profile_v2", {}, { auth: true }) || [];
    return rows[0] || null;
  }

  async function getScheduleDirectoryRows() {
    return await restRpc("get_schedule_directory_v2", {}, { auth: true }) || [];
  }

  async function getEmployeeAdminDirectoryRows() {
    ensureManager();
    return await restRpc("get_employee_admin_directory_v2", {}, { auth: true }) || [];
  }

  async function getDepartmentDirectoryRows() {
    return await restRpc("get_department_directory_v2", {}, { auth: true }) || [];
  }

  function ensureSignedIn() {
    if (!currentSession?.user) {
      throw new Error("請先登入");
    }
  }

  function ensureManager() {
    ensureSignedIn();
    if (!hasManagerAccess(currentProfile?.role)) {
      throw new Error("此功能需要主管權限");
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
    const normalized = String(employeeCode || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized ? `${normalized}@local.invalid` : "";
  }

  setInterval(() => {
    if (isSessionIdleExpired()) {
      expireSession();
    }
  }, 60 * 1000);

  async function signIn(loginAccount, password) {
    const employeeCode = String(loginAccount || "").trim();
    const email = buildLocalLoginEmail(employeeCode);
    if (!email) {
      throw new Error("找不到這個工號，或尚未設定登入帳號");
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
        // ponytail: logout 失敗時仍直接清本機 session，避免使用者卡住；若要更嚴謹可再補重試。
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
    // ponytail: scheduler ids do not contain commas; use a full Postgres array parser if that changes.
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
    // ponytail: 7-day buffer covers the current 6-day consecutive-work rule; widen this if rules look farther.
    return {
      startDate: addDaysToDateString(visibleStart, -7),
      endDate: addDaysToDateString(visibleStart, 62)
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

  async function fetchExistingScheduleRowsForRanges(ranges) {
    const loadedRanges = normalizeScheduleLoadedRanges(ranges);
    if (!loadedRanges.length) {
      return [];
    }
    const pages = await Promise.all(loadedRanges.map((range) => restSelect("schedule_entries", {
      select: "id,member_id,work_date",
      filters: getScheduleEntryFilters(range),
      auth: true
    })));
    const rowsByKey = new Map();
    pages.flat().forEach((row) => {
      if (row?.id) {
        rowsByKey.set(row.id, row);
      }
    });
    return [...rowsByKey.values()];
  }

  async function deleteRowsNotIn(table, ids) {
    await restDelete(table, {
      id: notInFilter(ids)
    }, {
      auth: true
    });
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

  async function getEmployeeOvertimeDates() {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "dates" });
  }

  async function getAttendanceOvertimeForDate(workDate) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "status", workDate });
  }

  async function getTodayAttendanceOvertime() {
    return getAttendanceOvertimeForDate(taipeiDateString());
  }

  async function submitAttendanceOvertime(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", {
      action: "submit",
      workDate: payload.workDate,
      earlyHours: payload.earlyHours,
      lateHours: payload.lateHours,
      note: payload.note || ""
    });
  }

  async function deleteAttendanceOvertime(workDate) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "delete", workDate });
  }

  async function getOvertimeReviewList(filters = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-list", filters);
  }

  async function reviewOvertimeRequest(payload = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-action", { action: "review", ...payload });
  }

  async function createAdminOvertimeRequest(payload = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-action", { action: "create", ...payload });
  }

  async function getMemberOrder() {
    ensureSignedIn();
    return requestFunction("member-order-v2", { action: "list" });
  }

  async function saveMemberOrder(memberIds = []) {
    ensureManager();
    return requestFunction("member-order-v2", { action: "save", memberIds });
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

  async function getPersonalRecords() {
    ensureSignedIn();
    return requestFunction("report-records", {
      action: "personal"
    });
  }

  async function getMealStatsReport() {
    ensureSignedIn();
    return requestFunction("report-records", {
      action: "meal_stats"
    });
  }

  async function getAttendanceAdminRecords(filters = {}) {
    ensureSignedIn();
    return requestFunction("report-records", {
      action: "attendance_admin_list",
      ...filters
    });
  }

  async function getAttendanceAdminHistory(recordId) {
    ensureSignedIn();
    return requestFunction("report-records", {
      action: "attendance_admin_history",
      recordId
    });
  }

  async function saveAttendanceAdminRecord(record) {
    ensureSignedIn();
    return requestFunction("report-records", {
      action: "attendance_admin_save",
      record
    });
  }

  async function getOvertimeReviewList(filters = {}) {
    ensureSignedIn();
    return requestFunction("attendance-overtime", {
      action: "admin_list",
      ...filters
    });
  }

  async function reviewOvertimeRequest(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-overtime", {
      action: "admin_review",
      ...payload
    });
  }

  async function createAdminOvertimeRequest(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-overtime", {
      action: "admin_create",
      ...payload
    });
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
    return requestFunction("report-records", {
      action: "meal_stats",
      ...filters
    });
  }

  async function fetchRowsById(table) {
    const rows = table === "set_employee"
      ? await getEmployeeAdminDirectoryRows()
      : table === "set_departments"
        ? await getDepartmentDirectoryRows()
        : await restSelect(table, {
          select: "*",
          auth: Boolean(currentSession?.access_token)
        });
    return new Map((rows || [])
      .filter((row) => row.id)
      .map((row) => [row.id, row]));
  }

  async function fetchRowById(table, id) {
    const rowId = String(id || "").trim();
    if (!rowId) {
      return null;
    }
    if (table === "set_employee") {
      return (await getEmployeeAdminDirectoryRows()).find((row) => row.id === rowId) || null;
    }
    if (table === "set_departments") {
      return (await getDepartmentDirectoryRows()).find((row) => row.id === rowId) || null;
    }
    const rows = await restSelect(table, {
      select: "*",
      filters: {
        id: `eq.${rowId}`
      },
      limit: "1",
      auth: true
    });
    return rows?.[0] || null;
  }

  function assertProfileCanLogin(profile) {
    const today = taipeiDateString();
    const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
    if ((profile.hire_date && today < profile.hire_date) || (effectiveEndDate && today > effectiveEndDate)) {
      throw new Error("此帳號目前不在有效期間，無法登入");
    }
  }

  function getRemovedRowIds(rowMap, keptRowIds) {
    const keptIds = new Set((keptRowIds || []).map((value) => String(value || "").trim()).filter(Boolean));
    return [...rowMap.entries()]
      .filter(([rowId, row]) => rowId && !keptIds.has(rowId) && row?.id)
      .map(([, row]) => row.id);
  }

  function isLegacyRequestCatalogRow(row) {
    return String(row?.id || "").startsWith("catalog:");
  }

  async function deleteRowsByForeignIds(table, column, ids) {
    const values = [...new Set((ids || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!values.length) {
      return;
    }
    await restDelete(table, {
      [column]: buildInFilter(values)
    }, {
      auth: true
    });
  }

  async function clearScheduleEntriesByForeignIds(column, ids, payload) {
    const values = [...new Set((ids || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!values.length) {
      return;
    }
    await restUpdate("schedule_entries", {
      [column]: buildInFilter(values)
    }, payload, {
      auth: true,
      prefer: "return=minimal"
    });
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
        publicIp: hasAdminAccess(currentProfile?.role) ? row.public_ip || "" : "",
        attendanceEnabled: Boolean(row.attendance_enabled)
      }));
  }

  function mapDepartmentWriteRow(department, sortOrder) {
    return {
      id: department.id,
      name: department.name || department.id,
      start_date: nullableDate(department.startDate),
      end_date: nullableDate(department.endDate),
      hidden_from_schedule: Boolean(department.hiddenFromSchedule),
      sort_order: sortOrder
    };
  }

  async function saveDepartmentAttendanceSettings(departments) {
    if (!hasAdminAccess(currentProfile?.role)) {
      return;
    }
    await restRpc("save_department_attendance_fields_bulk", {
      settings: (departments || []).map((department) => ({
        department_id: department.id,
        address: department.address || "",
        latitude: department.latitude === "" || department.latitude === null || department.latitude === undefined ? null : Number(department.latitude),
        longitude: department.longitude === "" || department.longitude === null || department.longitude === undefined ? null : Number(department.longitude),
        attendance_enabled: Boolean(department.attendanceEnabled),
        public_ip: department.publicIp || ""
      }))
    }, {
      auth: true,
      prefer: "return=minimal"
    });
  }

  async function saveDepartmentGeneralSettings(departments) {
    ensureManager();
    await restRpc("save_departments_general_v2", {
      p_departments: (departments || []).map((department, index) => ({
        ...mapDepartmentWriteRow(department, Number.isInteger(department.sortOrder) ? department.sortOrder : index)
      }))
    }, {
      auth: true,
      prefer: "return=minimal"
    });
  }

  async function loadScheduleExportRows(startDate, endDate) {
    ensureManager();
    const normalizedStart = nullableDate(startDate);
    const normalizedEnd = nullableDate(endDate);
    if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
      throw new Error("匯出日期範圍不正確");
    }
    return await restRpc("get_schedule_export_rows_v2", {
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
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
        requiredStaffCount: Math.max(0, Number(row.required_staff_count) || 0),
        applicableDeptId: row.applicable_department_id || "",
        positionRequirements: []
      }));
  }

  function mapLeaveRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .filter((row) => !isLegacyRequestCatalogRow(row))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.code || "").localeCompare(String(b.code || "")))
      .map((row) => ({
        id: row.id,
        code: row.code || "",
        name: row.name || "",
        color: row.color || "#888780",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
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
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
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
      const fallbackDeptId = row.home_department_id || "";
      const scheduleShiftIds = normalizeTextArray(row.schedule_shift_ids)
        .filter((value, index, list) => value && list.indexOf(value) === index);
      return {
        id: row.id,
        code: row.employee_code || "",
        name: row.full_name || "",
        deptId: fallbackDeptId,
        scheduleShiftIds,
        positionId: "",
        proxyMemberId: "",
        hireDate: row.hire_date || "",
        leaveDate: row.leave_date || "",
        payByDay: Boolean(row.pay_by_day),
        fixedRestWeekday: clampInteger(row.fixed_rest_weekday, 0, 6, 0),
        monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),
        role: normalizeRole(row.role)
      };
    });
  }

  async function loadEmployeeAdminDirectory() {
    ensureManager();
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
    const auth = Boolean(currentSession?.access_token);
    try {
      const [
        settingsRows,
        departmentRows,
        profileRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows
      ] = await Promise.all([
        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),
        getDepartmentDirectoryRows(),
        getScheduleDirectoryRows(),
        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })
      ]);

      const settings = settingsRows?.[0] || {};
      const scheduleRange = getScheduleLoadRange(settings);
      const scheduleEntryRows = await restSelect("schedule_entries", {
        select: "*",
        filters: getScheduleEntryFilters(scheduleRange),
        order: "work_date.asc",
        auth
      });

      let departments = mapDepartmentRows(departmentRows);
      if (currentProfile?.role === "admin") {
        const result = await requestFunction("department-attendance-v2", {});
        const byDepartment = new Map((result.settings || []).map((row) => [row.departmentId, row]));
        departments = departments.map((department) => {
          const attendance = byDepartment.get(department.id);
          return attendance ? {
            ...department,
            address: attendance.address || "",
            latitude: attendance.latitude ?? "",
            longitude: attendance.longitude ?? "",
            publicIp: attendance.publicIp || "",
            attendanceEnabled: Boolean(attendance.attendanceEnabled)
          } : department;
        });
      }

      let members = mapMemberDirectoryRows(profileRows);
      if (currentSession?.access_token) {
        try {
          const result = await requestFunction("member-order-v2", { action: "list" });
          members = applyMemberOrder(members, result.memberIds);
        } catch {
          // Keep database sort order until member-order-v2 is available.
        }
      }
      const schedule = mapScheduleRows(scheduleEntryRows, members);

      return {
        year: Number(settings.current_year) || new Date().getFullYear(),
        month: clampInteger(settings.current_month, 0, 11, new Date().getMonth()),
        selected: { type: null, id: null },
        deptFilter: settings.dept_filter || "all",
        tableView: settings.table_view === "shift" ? "shift" : "member",
        tableDeptScopeFilter: settings.table_dept_scope_filter || "all",
        tableStatsVisible: settings.table_stats_visible !== false,
        scheduleStartDate: settings.schedule_start_date || "",
        departments,
        members,
        shifts: mapShiftRows(shiftRows),
        leaves: mapLeaveRows(leaveRows),
        overtime: mapOvertimeRows(overtimeRows),
        holidays: mapHolidayRows(holidayRows),
        rules: {
          weekStart: clampInteger(settings.week_start, 0, 6, 0),
          monthStartDay: clampInteger(settings.month_start_day, 1, 31, 1),
          eightWeekStartDate: settings.eight_week_start_date || ""
        },
        schedule,
        scheduleLoadedRanges: [scheduleRange]
      };
    } catch (error) {
      if (!currentSession?.access_token && /permission denied|42501|401|403/i.test(error.message || "")) {
        throw new Error("未登入時無法讀取正式班表，請檢查正規化資料表的匿名讀取權限");
      }
      throw error;
    }
  }

  async function syncLeaveAndOvertimeCatalogs(state) {
    const leaveItems = (state.leaves || []).filter((item) => item?.id && item?.code && !String(item.id).startsWith("catalog:"));
    if (leaveItems.length) {
      await restInsert("set_leave", leaveItems.map((item, index) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.requiresTime),
        requires_reason: Boolean(item.requiresReason),
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }

    const overtimeItems = (state.overtime || []).filter((item) => item?.id && item?.name);
    if (overtimeItems.length) {
      await restInsert("set_overtime", overtimeItems.map((item, index) => ({
        id: item.id,
        name: item.name,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        start_time: nullableTime(item.startTime),
        end_time: nullableTime(item.endTime),
        use_rest_1: Boolean(item.useRest1),
        rest_1_start_time: item.useRest1 ? nullableTime(item.rest1StartTime) : null,
        rest_1_end_time: item.useRest1 ? nullableTime(item.rest1EndTime) : null,
        use_rest_2: Boolean(item.useRest2),
        rest_2_start_time: item.useRest2 ? nullableTime(item.rest2StartTime) : null,
        rest_2_end_time: item.useRest2 ? nullableTime(item.rest2EndTime) : null,
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
  }

  async function syncMemberProfile(member, previousEmployeeCode = "") {
    ensureManager();
    return requestFunction("member-auth-admin", {
      action: "upsert_member",
      member: {
        employeeCode: String(member?.code || "").trim(),
        fullName: member?.name || "",
        role: normalizeRole(member?.role),
        hireDate: member?.hireDate || null,
        leaveDate: member?.leaveDate || null,
        payByDay: Boolean(member?.payByDay),
        fixedRestWeekday: clampInteger(member?.fixedRestWeekday, 0, 6, 0),
        homeDepartmentId: member?.deptId || "",
        scheduleShiftIds: Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [],
        monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0)
      },
      previousEmployeeCode: String(previousEmployeeCode || "").trim(),
      defaultPassword: "0000"
    });
  }

  async function resetMemberPassword(employeeCode) {
    ensureManager();
    return requestFunction("member-auth-admin", {
      action: "reset_password",
      employeeCode: String(employeeCode || "").trim(),
      password: "0000"
    });
  }

  async function deleteMemberProfile(employeeCode) {
    ensureManager();
    return requestFunction("member-delete-v2", {
      employeeCode: String(employeeCode || "").trim()
    });
  }

  async function ensureMemberProfiles(state) {
    const members = Array.isArray(state.members) ? state.members.filter((member) => member?.code && member?.name) : [];
    if (!members.length) {
      return new Map();
    }
    let rows = await getEmployeeAdminDirectoryRows();
    const requestedCodes = new Set(members.map((member) => member.code));
    const existingCodes = new Set((rows || []).map((row) => row.employee_code).filter(Boolean));
    for (const member of members) {
      if (!existingCodes.has(member.code)) {
        await syncMemberProfile(member, member.code);
      }
    }
    rows = await getEmployeeAdminDirectoryRows();
    return new Map((rows || [])
      .filter((row) => requestedCodes.has(row.employee_code))
      .map((row) => [row.employee_code, row]));
  }

  async function loadScheduleEntries(range = {}) {
    const startDate = toDateObject(range.startDate) ? range.startDate : "";
    const endDate = toDateObject(range.endDate) ? range.endDate : "";
    if (!startDate || !endDate) {
      throw new Error("schedule range is required");
    }
    const auth = Boolean(currentSession?.access_token);
    const rows = await restSelect("schedule_entries", {
      select: "*",
      filters: getScheduleEntryFilters({ startDate, endDate }),
      order: "work_date.asc",
      auth
    });
    const members = Array.isArray(range.members) ? range.members : [];
    return {
      schedule: mapScheduleRows(rows, members),
      scheduleLoadedRanges: [{ startDate, endDate }]
    };
  }

  async function saveState(state) {
    ensureManager();
    const departments = Array.isArray(state.departments) ? state.departments : [];
    const shifts = Array.isArray(state.shifts) ? state.shifts : [];
    const leaves = Array.isArray(state.leaves) ? state.leaves : [];
    const overtime = Array.isArray(state.overtime) ? state.overtime : [];
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    if (departments.length) {
      await saveDepartmentGeneralSettings(departments.map((department, index) => ({ ...department, sortOrder: index })));
      await saveDepartmentAttendanceSettings(departments);
    }
    const departmentMap = await fetchRowsById("set_departments");

    if (leaves.length) {
      await restInsert("set_leave", leaves.map((item, index) => ({
        id: item.id,
        code: item.code || item.id,
        name: item.name || item.code || item.id,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.requiresTime),
        requires_reason: Boolean(item.requiresReason),
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    const keptLeaveIds = leaves.map((item) => item.id).filter((id) => !String(id).startsWith("catalog:"));
    const existingLeaveMap = await fetchRowsById("set_leave");
    const removedLeaveRowIds = getRemovedRowIds(existingLeaveMap, keptLeaveIds);
    await clearScheduleEntriesByForeignIds("leave_type_id", removedLeaveRowIds, {
      leave_type_id: null,
      leave_all_day: true,
      leave_start_time: null,
      leave_end_time: null,
      leave_reason: null
    });
    await deleteRowsNotIn("set_leave", keptLeaveIds);
    const leaveMap = await fetchRowsById("set_leave");

    if (overtime.length) {
      await restInsert("set_overtime", overtime.map((item, index) => ({
        id: item.id,
        name: item.name || "加班",
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        start_time: nullableTime(item.startTime),
        end_time: nullableTime(item.endTime),
        use_rest_1: Boolean(item.useRest1),
        rest_1_start_time: item.useRest1 ? nullableTime(item.rest1StartTime) : null,
        rest_1_end_time: item.useRest1 ? nullableTime(item.rest1EndTime) : null,
        use_rest_2: Boolean(item.useRest2),
        rest_2_start_time: item.useRest2 ? nullableTime(item.rest2StartTime) : null,
        rest_2_end_time: item.useRest2 ? nullableTime(item.rest2EndTime) : null,
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    const keptOvertimeIds = overtime.map((item) => item.id);
    const existingOvertimeMap = await fetchRowsById("set_overtime");
    const removedOvertimeRowIds = getRemovedRowIds(existingOvertimeMap, keptOvertimeIds);
    await clearScheduleEntriesByForeignIds("overtime_type_id", removedOvertimeRowIds, {
      overtime_type_id: null,
      overtime_start_time: null,
      overtime_end_time: null,
      overtime_use_rest_1: false,
      overtime_rest_1_start_time: null,
      overtime_rest_1_end_time: null,
      overtime_use_rest_2: false,
      overtime_rest_2_start_time: null,
      overtime_rest_2_end_time: null,
      overtime_reason: null
    });
    await deleteRowsNotIn("set_overtime", keptOvertimeIds);
    const overtimeMap = await fetchRowsById("set_overtime");

    if (shifts.length) {
      await restInsert("set_shift", shifts.map((shift, index) => ({
        id: shift.id,
        name: shift.name || shift.id,
        applicable_department_id: departmentMap.has(shift.applicableDeptId) ? shift.applicableDeptId : null,
        color: shift.color || null,
        text_color: shift.textColor || null,
        auto_text_color: shift.autoTextColor !== false,
        hidden_from_toolbar: Boolean(shift.hiddenFromToolbar),
        start_time: nullableTime(shift.startTime),
        end_time: nullableTime(shift.endTime),
        required_staff_count: Math.max(0, Number(shift.requiredStaffCount) || 0),
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteRowsNotIn("set_shift", shifts.map((shift) => shift.id));
    const shiftMap = await fetchRowsById("set_shift");
    const shiftIds = new Set(shifts.map((shift) => shift.id));

    if (holidays.length) {
      await restInsert("holidays", holidays
        .filter((holiday) => nullableDate(holiday.date))
        .map((holiday, index) => ({
          id: holiday.id,
          holiday_date: nullableDate(holiday.date),
          name: holiday.name || "假日",
          sort_order: index
        })), {
        auth: true,
        onConflict: "holiday_date",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteRowsNotIn("holidays", holidays.map((holiday) => holiday.id));

    const profileMap = await ensureMemberProfiles(state);
    for (const member of state.members || []) {
      const profile = profileMap.get(member.code);
      if (!profile?.id) {
        continue;
      }
      const scheduleShiftIds = (Array.isArray(member.scheduleShiftIds) ? member.scheduleShiftIds : [])
        .filter((shiftId, index, list) => shiftIds.has(shiftId) && list.indexOf(shiftId) === index);
      const homeDeptId = member.deptId || "";
      await restUpdate("set_employee", {
        id: `eq.${profile.id}`
      }, {
        employee_code: member.code,
        full_name: member.name,
        role: normalizeRole(member.role),
        hire_date: nullableDate(member.hireDate),
        leave_date: nullableDate(member.leaveDate),
        pay_by_day: Boolean(member.payByDay),
        fixed_rest_weekday: clampInteger(member.fixedRestWeekday, 0, 6, 0),
        monthly_rest_days: clampInteger(member.monthlyRestDays, 0, 31, 0),
        home_department_id: departmentMap.get(homeDeptId)?.id || null,
        schedule_shift_ids: scheduleShiftIds,
      }, {
        auth: true,
        prefer: "return=minimal"
      });
    }

    await restInsert("scheduler_settings", [{
      id: documentId,
      current_year: Number(state.year) || new Date().getFullYear(),
      current_month: clampInteger(state.month, 0, 11, new Date().getMonth()),
      dept_filter: state.deptFilter || "all",
      table_view: state.tableView === "shift" ? "shift" : "member",
      table_dept_scope_filter: state.tableDeptScopeFilter || "all",
      table_stats_visible: state.tableStatsVisible !== false,
      schedule_start_date: nullableDate(state.scheduleStartDate),
      week_start: clampInteger(state.rules?.weekStart, 0, 6, 0),
      month_start_day: clampInteger(state.rules?.monthStartDay, 1, 31, 1),
      eight_week_start_date: nullableDate(state.rules?.eightWeekStartDate),
      updated_at: new Date().toISOString()
    }], {
      auth: true,
      onConflict: "id",
      prefer: "resolution=merge-duplicates,return=minimal"
    });

    const scheduleEntries = [];
    Object.entries(state.schedule || {}).forEach(([key, slot]) => {
      const parsed = parseScheduleKey(key);
      if (!parsed || !slot) {
        return;
      }
      const member = (state.members || []).find((item) => item.id === parsed.memberId);
      const profile = member ? profileMap.get(member.code) : null;
      if (!profile?.id) {
        return;
      }
      scheduleEntries.push({ parsed, slot, profile });
    });
    const scheduleRows = scheduleEntries.map(({ parsed, slot, profile }) => {
      return {
        member_id: profile.id,
        work_date: parsed.workDate,
        shift_type_id: shiftMap.get(slot.shift)?.id || null,
        leave_type_id: leaveMap.get(slot.leave)?.id || null,
        leave_all_day: slot.leaveMeta?.allDay !== false,
        leave_start_time: slot.leaveMeta?.allDay === false ? nullableTime(slot.leaveMeta?.startTime) : null,
        leave_end_time: slot.leaveMeta?.allDay === false ? nullableTime(slot.leaveMeta?.endTime) : null,
        leave_reason: slot.leaveMeta?.reason || null,
        overtime_type_id: overtimeMap.get(slot.overtime)?.id || null,
        overtime_start_time: nullableTime(slot.overtimeMeta?.startTime),
        overtime_end_time: nullableTime(slot.overtimeMeta?.endTime),
        overtime_use_rest_1: Boolean(slot.overtimeMeta?.useRest1),
        overtime_rest_1_start_time: slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,
        overtime_rest_1_end_time: slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,
        overtime_use_rest_2: Boolean(slot.overtimeMeta?.useRest2),
        overtime_rest_2_start_time: slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,
        overtime_rest_2_end_time: slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,
        overtime_reason: slot.overtimeMeta?.reason || null
      };
    }).filter((row) => row && (row.shift_type_id || row.leave_type_id || row.overtime_type_id));
    const savedScheduleKeys = new Set(scheduleRows.map((row) => makeScheduleEntryKey(row.member_id, row.work_date)));
    const existingScheduleRows = await fetchExistingScheduleRowsForRanges(state.scheduleLoadedRanges);
    const obsoleteScheduleRows = (existingScheduleRows || [])
      .filter((row) => row?.id && !savedScheduleKeys.has(makeScheduleEntryKey(row.member_id, row.work_date)))
      .map((row) => ({
        member_id: row.member_id,
        work_date: row.work_date,
        delete_entry: true
      }));
    await saveScheduleEntryRows([...scheduleRows, ...obsoleteScheduleRows]);

    await syncLeaveAndOvertimeCatalogs(state);
    return { ok: true, savedAt: new Date().toISOString() };
  }

  async function syncCatalogs(state) {
    ensureManager();
    await syncLeaveAndOvertimeCatalogs(state);
  }

  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureManager();
    await saveDepartmentGeneralSettings([{ ...department, sortOrder }]);
    await saveDepartmentAttendanceSettings([department]);
    return { ok: true };
  }

  async function deleteDepartmentItem(departmentId) {
    ensureManager();
    await restRpc("delete_department_general_v2", {
      p_department_id: String(departmentId || "").trim()
    }, {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function saveShiftItem(shift, sortOrder = 0) {
    ensureManager();
    await restInsert("set_shift", [{
      id: shift.id,
      name: shift.name || shift.id,
      applicable_department_id: shift.applicableDeptId || null,
      color: shift.color || null,
      text_color: shift.textColor || null,
      auto_text_color: shift.autoTextColor !== false,
      hidden_from_toolbar: Boolean(shift.hiddenFromToolbar),
      start_time: nullableTime(shift.startTime),
      end_time: nullableTime(shift.endTime),
      required_staff_count: Math.max(0, Number(shift.requiredStaffCount) || 0),
      sort_order: sortOrder
    }], {
      auth: true,
      onConflict: "id",
      prefer: "resolution=merge-duplicates,return=minimal"
    });
    return { ok: true };
  }

  async function saveCatalogItem(category, item, sortOrder = 0) {
    ensureManager();
    if (category === "leave") {
      await restInsert("set_leave", [{
        id: item.id,
        code: item.code || item.id,
        name: item.name || item.code || item.id,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.requiresTime),
        requires_reason: Boolean(item.requiresReason),
        sort_order: sortOrder
      }], {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      return { ok: true };
    }
    if (category === "overtime") {
      await restInsert("set_overtime", [{
        id: item.id,
        name: item.name || "加班",
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        start_time: nullableTime(item.startTime),
        end_time: nullableTime(item.endTime),
        use_rest_1: Boolean(item.useRest1),
        rest_1_start_time: item.useRest1 ? nullableTime(item.rest1StartTime) : null,
        rest_1_end_time: item.useRest1 ? nullableTime(item.rest1EndTime) : null,
        use_rest_2: Boolean(item.useRest2),
        rest_2_start_time: item.useRest2 ? nullableTime(item.rest2StartTime) : null,
        rest_2_end_time: item.useRest2 ? nullableTime(item.rest2EndTime) : null,
        sort_order: sortOrder
      }], {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      return { ok: true };
    }
    throw new Error(`不支援的設定類型：${category}`);
  }

  async function deleteCatalogItem(category, itemId) {
    ensureManager();
    return requestFunction("catalog-admin", {
      action: "delete",
      category: String(category || ""),
      itemId: String(itemId || "")
    });
  }

  async function resolveManagerMemberProfileId(memberId, memberCode) {
    const normalizedMemberId = String(memberId || "").trim();
    if (isUuid(normalizedMemberId)) {
      return normalizedMemberId;
    }
    const normalizedMemberCode = String(memberCode || "").trim();
    if (!normalizedMemberCode) {
      throw new Error("找不到人員工號");
    }
    const profile = (await getEmployeeAdminDirectoryRows())
      .find((row) => String(row.employee_code || "").trim() === normalizedMemberCode);
    if (!profile?.id) {
      throw new Error(`找不到對應的人員資料：${normalizedMemberCode}`);
    }
    return profile.id;
  }

  async function pruneEmptyScheduleEntry(rowOrId) {
    const rowId = typeof rowOrId === "string" ? rowOrId : rowOrId?.id;
    if (!rowId) {
      return;
    }
    const rows = typeof rowOrId === "string"
      ? await restSelect("schedule_entries", {
        select: "id,shift_type_id,leave_type_id,overtime_type_id",
        filters: { id: `eq.${rowId}` },
        limit: "1",
        auth: true
      })
      : [rowOrId];
    const row = rows?.[0];
    if (row && !row.shift_type_id && !row.leave_type_id && !row.overtime_type_id) {
      await restDelete("schedule_entries", { id: `eq.${row.id}` }, { auth: true });
    }
  }

  async function saveScheduleEntryRows(rows) {
    const entries = (Array.isArray(rows) ? rows : [])
      .filter((row) => row?.member_id && row?.work_date);
    if (!entries.length) {
      return [];
    }
    return await restRpc("save_schedule_entries_bulk", { entries }, { auth: true }) || [];
  }

  async function saveScheduleCells(payloads) {
    ensureManager();
    const rowCache = new Map();
    const resolveCatalogRow = async (table, id) => {
      const rowId = String(id || "").trim();
      if (!rowId) {
        return null;
      }
      const cacheKey = `${table}:${rowId}`;
      if (!rowCache.has(cacheKey)) {
        rowCache.set(cacheKey, fetchRowById(table, rowId));
      }
      return await rowCache.get(cacheKey);
    };
    const rows = [];
    for (const payload of Array.isArray(payloads) ? payloads : []) {
      const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
      const workDate = nullableDate(payload.dateString || payload.workDate);
      if (!profileMemberId || !workDate) {
        throw new Error("schedule cell member and date are required");
      }
      const slot = payload.slot || {};
      const [shiftType, leaveType, overtimeType] = await Promise.all([
        resolveCatalogRow("set_shift", slot.shift),
        resolveCatalogRow("set_leave", slot.leave),
        resolveCatalogRow("set_overtime", slot.overtime)
      ]);
      if (!shiftType?.id && !leaveType?.id && !overtimeType?.id) {
        rows.push({
          member_id: profileMemberId,
          work_date: workDate,
          delete_entry: true
        });
        continue;
      }
      const leaveAllDay = slot.leaveMeta?.allDay !== false;
      rows.push({
        member_id: profileMemberId,
        work_date: workDate,
        shift_type_id: shiftType?.id || null,
        leave_type_id: leaveType?.id || null,
        leave_all_day: leaveAllDay,
        leave_start_time: leaveType?.id && !leaveAllDay ? nullableTime(slot.leaveMeta?.startTime) : null,
        leave_end_time: leaveType?.id && !leaveAllDay ? nullableTime(slot.leaveMeta?.endTime) : null,
        leave_reason: leaveType?.id ? slot.leaveMeta?.reason || null : null,
        overtime_type_id: overtimeType?.id || null,
        overtime_start_time: overtimeType?.id ? nullableTime(slot.overtimeMeta?.startTime) : null,
        overtime_end_time: overtimeType?.id ? nullableTime(slot.overtimeMeta?.endTime) : null,
        overtime_use_rest_1: overtimeType?.id ? Boolean(slot.overtimeMeta?.useRest1) : false,
        overtime_rest_1_start_time: overtimeType?.id && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,
        overtime_rest_1_end_time: overtimeType?.id && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,
        overtime_use_rest_2: overtimeType?.id ? Boolean(slot.overtimeMeta?.useRest2) : false,
        overtime_rest_2_start_time: overtimeType?.id && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,
        overtime_rest_2_end_time: overtimeType?.id && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,
        overtime_reason: overtimeType?.id ? slot.overtimeMeta?.reason || null : null
      });
    }
    const savedRows = await saveScheduleEntryRows(rows);
    return { ok: true, rows: savedRows };
  }

  async function saveScheduleCell(payload) {
    const result = await saveScheduleCells([payload]);
    return { ok: true, row: result.rows?.[0] || null };
  }

  async function exportSapCsv(payload) {
    if (!exporter.getSapLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = new Blob(
      [exporter.buildSapLeaveCsvContent(payload)],
      { type: "text/csv;charset=utf-8" }
    );
    const fileName = makeFileName("sap請假", payload, "csv");
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportOvertime(payload) {
    if (!exporter.getOvertimeExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload));
    const fileName = makeFileName("匯出加班", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportLeave(payload) {
    if (!exporter.getLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload));
    const fileName = makeFileName("匯出請假", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportMealReport(report) {
    const details = Array.isArray(report?.details) ? report.details : [];
    if (!details.length) {
      return { canceled: true, empty: true };
    }
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet("每日備餐統計");
    summarySheet.addRow(["日期", "單位", "品項", "數量", "金額"]);
    (report.summary || []).forEach((row) => {
      summarySheet.addRow([row.date, row.departmentName, row.productName, Number(row.quantity || 0), Number(row.amount || 0)]);
    });
    const detailSheet = workbook.addWorksheet("員工訂餐明細");
    detailSheet.addRow(["日期", "單位", "員工", "品項", "數量", "單價", "小計", "備註", "下訂時間"]);
    details.forEach((row) => {
      detailSheet.addRow([row.date, row.departmentName, row.employeeName, row.productName, Number(row.quantity || 0), Number(row.unitPrice || 0), Number(row.amount || 0), row.note || "", row.submittedAt || ""]);
    });
    [summarySheet, detailSheet].forEach((sheet) => {
      sheet.columns.forEach((column) => {
        column.width = 16;
      });
    });
    const blob = await exporter.workbookToBlob(workbook);
    const fileName = `訂餐報表_${report.fromDate || ""}_${report.toDate || ""}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
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
    getTodayAttendance,
    clockAttendance,
    getEmployeeOvertimeDates,
    getAttendanceOvertimeForDate,
    getTodayAttendanceOvertime,
    submitAttendanceOvertime,
    deleteAttendanceOvertime,
    getTodayMealOrder,
    saveTodayMealOrder,
    getPersonalRecords,
    getMealStatsReport,
    getAttendanceAdminRecords,
    getAttendanceAdminHistory,
    saveAttendanceAdminRecord,
    getOvertimeReviewList,
    reviewOvertimeRequest,
    createAdminOvertimeRequest,
    getMemberOrder,
    saveMemberOrder,
    getMealAdminSettings,
    saveMealAdminSettings,
    deleteMealProduct,
    getMealReport,
    deleteMemberProfile,
    loadState,
    loadEmployeeAdminDirectory,
    loadScheduleEntries,
    loadScheduleExportRows,
    saveState,
    syncCatalogs,
    saveDepartmentItem,
    deleteDepartmentItem,
    saveShiftItem,
    saveCatalogItem,
    deleteCatalogItem,
    saveScheduleCells,
    saveScheduleCell,
    syncMemberProfile,
    resetMemberPassword,
    exportSapCsv,
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
