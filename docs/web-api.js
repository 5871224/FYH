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

  if (!baseUrl || !anonKey || !exporter) {
    throw new Error("缺少 Supabase 設定");
  }

  let currentSession = null;
  let currentProfile = null;

  function makeFileName(prefix, payload, extension) {
    if (payload.viewStartDate && payload.viewEndDate) {
      return `${prefix}_${payload.viewStartDate}_${payload.viewEndDate}.${extension}`;
    }
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

  function readStoredSession() {
    try {
      return normalizeSession(JSON.parse(localStorage.getItem(sessionStorageKey) || "null"));
    } catch {
      return null;
    }
  }

  function persistSession(session) {
    currentSession = normalizeSession(session);
    if (currentSession) {
      localStorage.setItem(sessionStorageKey, JSON.stringify(currentSession));
    } else {
      localStorage.removeItem(sessionStorageKey);
    }
  }

  function clearSession() {
    currentSession = null;
    currentProfile = null;
    localStorage.removeItem(sessionStorageKey);
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
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function isMissingSchemaError(error, pattern) {
    const message = String(error?.message || "");
    return /schema cache|does not exist|Could not find/i.test(message) && pattern.test(message);
  }

  function isMissingScheduleMonthsError(error) {
    return isMissingSchemaError(error, /schedule_months/i);
  }

  function isMissingScheduleMonthIdError(error) {
    return isMissingSchemaError(error, /schedule_month_id/i);
  }

  function isMissingLoginRpcError(error) {
    return isMissingSchemaError(error, /login_email_by_employee_code/i);
  }

  function buildLoginEmail(employeeCode) {
    const normalized = String(employeeCode || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized ? `${normalized}@local.invalid` : "";
  }

  async function requestFunction(functionName, payload) {
    const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
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

  async function loadScheduleMonthsIfAvailable(auth) {
    try {
      return await restSelect("schedule_months", { select: "*", auth });
    } catch (error) {
      if (isMissingScheduleMonthsError(error)) {
        return [];
      }
      throw error;
    }
  }

  function ensureSignedIn() {
    if (!currentSession?.user) {
      throw new Error("請先登入");
    }
  }

  function ensureManager() {
    ensureSignedIn();
    if (currentProfile?.role !== "manager") {
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
    const rows = await restSelect("profiles", {
      select: "*",
      filters: {
        id: `eq.${userId}`
      },
      auth: true
    });
    return rows?.[0] || null;
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

  async function getLoginEmailByEmployeeCode(employeeCode) {
    try {
      const email = await requestJson("/rest/v1/rpc/login_email_by_employee_code", {
        method: "POST",
        body: JSON.stringify({
          p_employee_code: String(employeeCode || "").trim()
        })
      });
      return typeof email === "string" ? email.trim() : "";
    } catch (error) {
      if (isMissingLoginRpcError(error)) {
        return buildLoginEmail(employeeCode);
      }
      throw error;
    }
  }

  async function signIn(loginAccount, password) {
    const employeeCode = String(loginAccount || "").trim();
    const email = await getLoginEmailByEmployeeCode(employeeCode);
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
        // ponytail: logout失敗時仍直接清本機session，避免使用者卡住；若要更嚴謹可再補重試。
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

  async function deleteSchedulerRowsNotIn(table, schedulerIds) {
    await restDelete(table, {
      scheduler_item_id: notInFilter(schedulerIds)
    }, {
      auth: true
    });
  }

  async function fetchRowsBySchedulerId(table) {
    const rows = await restSelect(table, {
      select: "*",
      auth: Boolean(currentSession?.access_token)
    });
    return new Map((rows || [])
      .filter((row) => row.scheduler_item_id)
      .map((row) => [row.scheduler_item_id, row]));
  }

  function getRowSchedulerId(row, fallbackPrefix) {
    return row.scheduler_item_id || `${fallbackPrefix}:${row.id}`;
  }

  function mapDepartmentRows(rows = []) {
    return (rows || [])
      .filter((row) => row.scheduler_item_id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.scheduler_item_id,
        name: row.name || "",
        startDate: row.start_date || "",
        endDate: row.end_date || "",
        hiddenFromLeave: Boolean(row.hidden_from_leave)
      }));
  }

  function mapShiftRows(rows = [], departmentIdByUuid = new Map()) {
    return (rows || [])
      .filter((row) => row.scheduler_item_id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.scheduler_item_id,
        name: row.name || "",
        color: row.color || "#378ADD",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        startTime: (row.start_time || "").slice(0, 5),
        endTime: (row.end_time || "").slice(0, 5),
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
        requiredStaffCount: Math.max(0, Number(row.required_staff_count) || 0),
        applicableDeptIds: [departmentIdByUuid.get(row.applicable_department_id)].filter(Boolean),
        positionRequirements: []
      }));
  }

  function mapLeaveRows(rows = []) {
    return (rows || [])
      .filter((row) => row.scheduler_item_id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.code || "").localeCompare(String(b.code || "")))
      .map((row) => ({
        id: row.scheduler_item_id,
        code: row.code || "",
        name: row.name || "",
        color: row.color || "#888780",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
        defaultAllDay: Boolean(row.requires_time),
        requireReason: Boolean(row.requires_reason)
      }));
  }

  function mapOvertimeRows(rows = []) {
    return (rows || [])
      .filter((row) => row.scheduler_item_id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.scheduler_item_id,
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
        id: row.scheduler_item_id || `h:${row.id}`,
        date: row.holiday_date || "",
        name: row.name || ""
      }));
  }

  async function loadState() {
    const auth = Boolean(currentSession?.access_token);
    try {
      const [
        settingsRows,
        departmentRows,
        profileRows,
        memberDepartmentRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows,
        scheduleMonthRows,
        scheduleEntryRows
      ] = await Promise.all([
        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),
        restSelect("departments", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("profiles", { select: "*", filters: { is_active: "eq.true" }, order: "employee_code.asc", auth }),
        restSelect("member_departments", { select: "*", order: "sort_order.asc", auth }),
        restSelect("shift_types", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("leave_types", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("overtime_types", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth }),
        loadScheduleMonthsIfAvailable(auth),
        restSelect("schedule_entries", { select: "*", order: "work_date.asc", auth })
      ]);

      const settings = settingsRows?.[0] || {};
      const departmentIdByUuid = new Map((departmentRows || []).map((row) => [row.id, row.scheduler_item_id || ""]));
      const shiftIdByUuid = new Map((shiftRows || []).map((row) => [row.id, getRowSchedulerId(row, "shift")]));
      const leaveIdByUuid = new Map((leaveRows || []).map((row) => [row.id, getRowSchedulerId(row, "leave")]));
      const overtimeIdByUuid = new Map((overtimeRows || []).map((row) => [row.id, getRowSchedulerId(row, "overtime")]));
      const memberDepartmentMap = new Map();
      (memberDepartmentRows || []).forEach((row) => {
        const departmentId = departmentIdByUuid.get(row.department_id);
        if (!row.member_id || !departmentId) {
          return;
        }
        if (!memberDepartmentMap.has(row.member_id)) {
          memberDepartmentMap.set(row.member_id, []);
        }
        memberDepartmentMap.get(row.member_id).push({
          departmentId,
          sortOrder: Number(row.sort_order || 0)
        });
      });
      memberDepartmentMap.forEach((items, memberId) => {
        memberDepartmentMap.set(memberId, items
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => item.departmentId)
          .filter((value, index, list) => value && list.indexOf(value) === index));
      });

      const members = (profileRows || []).map((row) => {
        const relationDeptIds = memberDepartmentMap.get(row.id) || [];
        const fallbackDeptId = departmentIdByUuid.get(row.home_department_id) || "";
        const storedDeptIds = Array.isArray(row.schedule_department_ids) ? row.schedule_department_ids : [];
        const scheduleDeptIds = (relationDeptIds.length ? relationDeptIds : storedDeptIds)
          .filter((value, index, list) => value && list.indexOf(value) === index);
        if (fallbackDeptId && !scheduleDeptIds.includes(fallbackDeptId)) {
          scheduleDeptIds.unshift(fallbackDeptId);
        }
        return {
          id: row.id,
          code: row.employee_code || "",
          name: row.full_name || "",
          deptId: scheduleDeptIds[0] || fallbackDeptId,
          scheduleDeptIds,
          positionId: "",
          proxyMemberId: "",
          hireDate: row.hire_date || "",
          leaveDate: row.leave_date || "",
          payByDay: Boolean(row.pay_by_day),
          fixedRestWeekday: clampInteger(row.fixed_rest_weekday, 0, 6, 0),
          monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),
          role: row.role === "manager" ? "manager" : "employee"
        };
      });
      const memberByUuid = new Map(members.map((member) => [member.id, member]));
      const scheduleMonthById = new Map((scheduleMonthRows || []).map((row) => [row.id, row]));
      const schedule = {};
      (scheduleEntryRows || []).forEach((row) => {
        const member = memberByUuid.get(row.member_id);
        const key = makeScheduleKey(member?.id, row.work_date);
        if (!key) {
          return;
        }
        const shift = shiftIdByUuid.get(row.shift_type_id) || null;
        const leave = leaveIdByUuid.get(row.leave_type_id) || null;
        const overtime = overtimeIdByUuid.get(row.overtime_type_id) || null;
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

      const currentMonth = scheduleMonthById.size
        ? [...scheduleMonthById.values()].find((row) => row.year === settings.current_year && row.month === Number(settings.current_month || 0) + 1)
        : null;

      return {
        year: Number(settings.current_year) || new Date().getFullYear(),
        month: clampInteger(settings.current_month, 0, 11, new Date().getMonth()),
        selected: { type: null, id: null },
        deptFilter: settings.dept_filter || "all",
        tableView: settings.table_view === "shift" ? "shift" : "member",
        tableDeptScopeFilter: settings.table_dept_scope_filter || "all",
        tableStatsVisible: settings.table_stats_visible !== false,
        scheduleStartDate: settings.schedule_start_date || "",
        departments: mapDepartmentRows(departmentRows),
        members,
        shifts: mapShiftRows(shiftRows, departmentIdByUuid),
        leaves: mapLeaveRows(leaveRows),
        overtime: mapOvertimeRows(overtimeRows),
        holidays: mapHolidayRows(holidayRows),
        rules: {
          maxConsecutiveWorkDays: Math.max(1, Number(settings.max_consecutive_work_days) || 6),
          weekStart: clampInteger(settings.week_start, 0, 6, 0),
          monthStartDay: clampInteger(currentMonth?.month_start_day ?? settings.month_start_day, 1, 31, 1),
          eightWeekStartDate: settings.eight_week_start_date || "",
          forbidProxyLeaveConflict: settings.forbid_proxy_leave_conflict !== false,
          requireEmploymentWindow: settings.require_employment_window !== false
        },
        schedule
      };
    } catch (error) {
      if (!currentSession?.access_token && /permission denied|42501|401|403/i.test(error.message || "")) {
        throw new Error("請先登入後再載入班表");
      }
      throw error;
    }
  }

  async function syncLeaveAndOvertimeCatalogs(state) {
    const requestLeaveItems = (state.requestLeaveCatalog || [])
      .filter((item) => item?.code && item?.name)
      .map((item) => ({
        id: `catalog:${item.code}`,
        code: item.code,
        name: item.name,
        color: null,
        defaultAllDay: false,
        requireReason: false
      }));
    const leaveItems = (state.leaves || []).filter((item) => item?.id && item?.code);
    const allLeaveItems = [...requestLeaveItems, ...leaveItems];
    if (allLeaveItems.length) {
      await restInsert("leave_types", allLeaveItems.map((item, index) => ({
        scheduler_item_id: item.id,
        code: item.code,
        name: item.name,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.defaultAllDay),
        requires_reason: Boolean(item.requireReason),
        sort_order: index
      })), {
        auth: true,
        onConflict: "scheduler_item_id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }

    const overtimeItems = (state.overtime || []).filter((item) => item?.id && item?.name);
    if (overtimeItems.length) {
      await restInsert("overtime_types", overtimeItems.map((item, index) => ({
        scheduler_item_id: item.id,
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
        onConflict: "scheduler_item_id",
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
        role: member?.role === "manager" ? "manager" : "employee",
        hireDate: member?.hireDate || null,
        leaveDate: member?.leaveDate || null,
        payByDay: Boolean(member?.payByDay),
        fixedRestWeekday: clampInteger(member?.fixedRestWeekday, 0, 6, 0),
        scheduleDepartmentIds: Array.isArray(member?.scheduleDeptIds) ? member.scheduleDeptIds : [],
        monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0)
      },
      previousEmployeeCode: String(previousEmployeeCode || member?.code || "").trim(),
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

  async function getLeaveTypeByCode(code) {
    const rows = await restSelect("leave_types", {
      select: "id,code,name",
      order: "updated_at.desc,created_at.desc",
      limit: "1",
      filters: {
        code: `eq.${code}`
      },
      auth: true
    });
    if (!rows?.length) {
      throw new Error("找不到對應的假別，請先同步假別設定");
    }
    return rows[0];
  }

  async function getLeaveTypeByReference(payload = {}) {
    const leaveItemId = String(payload.leaveItemId || "").trim();
    if (leaveItemId) {
      try {
        const rows = await restSelect("leave_types", {
          select: "id,code,name,scheduler_item_id",
          filters: {
            scheduler_item_id: `eq.${leaveItemId}`
          },
          auth: true
        });
        if (rows?.length) {
          return rows[0];
        }
      } catch (error) {
        if (!/scheduler_item_id/i.test(error.message || "")) {
          throw error;
        }
      }
    }
    return getLeaveTypeByCode(payload.leaveCode);
  }

  async function ensureMemberProfiles(state) {
    const members = Array.isArray(state.members) ? state.members.filter((member) => member?.code && member?.name) : [];
    if (!members.length) {
      return new Map();
    }
    let rows = await restSelect("profiles", {
      select: "id,employee_code",
      filters: {
        employee_code: buildInFilter(members.map((member) => member.code))
      },
      auth: true
    });
    const existingCodes = new Set((rows || []).map((row) => row.employee_code));
    for (const member of members) {
      if (!existingCodes.has(member.code)) {
        await syncMemberProfile(member, member.code);
      }
    }
    rows = await restSelect("profiles", {
      select: "*",
      filters: {
        employee_code: buildInFilter(members.map((member) => member.code))
      },
      auth: true
    });
    return new Map((rows || []).map((row) => [row.employee_code, row]));
  }

  async function saveState(state) {
    ensureManager();
    const departments = Array.isArray(state.departments) ? state.departments : [];
    const shifts = Array.isArray(state.shifts) ? state.shifts : [];
    const leaves = Array.isArray(state.leaves) ? state.leaves : [];
    const overtime = Array.isArray(state.overtime) ? state.overtime : [];
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    if (departments.length) {
      await restInsert("departments", departments.map((department, index) => ({
        scheduler_item_id: department.id,
        code: department.id,
        name: department.name || department.id,
        start_date: nullableDate(department.startDate),
        end_date: nullableDate(department.endDate),
        hidden_from_leave: Boolean(department.hiddenFromLeave),
        sort_order: index
      })), {
        auth: true,
        onConflict: "scheduler_item_id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteSchedulerRowsNotIn("departments", departments.map((department) => department.id));
    const departmentMap = await fetchRowsBySchedulerId("departments");

    if (leaves.length) {
      await restInsert("leave_types", leaves.map((item, index) => ({
        scheduler_item_id: item.id,
        code: item.code || item.id,
        name: item.name || item.code || item.id,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.defaultAllDay),
        requires_reason: Boolean(item.requireReason),
        sort_order: index
      })), {
        auth: true,
        onConflict: "scheduler_item_id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteSchedulerRowsNotIn("leave_types", leaves.map((item) => item.id));
    const leaveMap = await fetchRowsBySchedulerId("leave_types");

    if (overtime.length) {
      await restInsert("overtime_types", overtime.map((item, index) => ({
        scheduler_item_id: item.id,
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
        onConflict: "scheduler_item_id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteSchedulerRowsNotIn("overtime_types", overtime.map((item) => item.id));
    const overtimeMap = await fetchRowsBySchedulerId("overtime_types");

    if (shifts.length) {
      await restInsert("shift_types", shifts.map((shift, index) => ({
        scheduler_item_id: shift.id,
        name: shift.name || shift.id,
        applicable_department_id: departmentMap.get(shift.applicableDeptIds?.[0])?.id || null,
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
        onConflict: "scheduler_item_id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteSchedulerRowsNotIn("shift_types", shifts.map((shift) => shift.id));
    const shiftMap = await fetchRowsBySchedulerId("shift_types");

    if (holidays.length) {
      await restInsert("holidays", holidays
        .filter((holiday) => nullableDate(holiday.date))
        .map((holiday, index) => ({
          scheduler_item_id: holiday.id,
          holiday_date: nullableDate(holiday.date),
          name: holiday.name || "國定假日",
          sort_order: index
        })), {
        auth: true,
        onConflict: "holiday_date",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteSchedulerRowsNotIn("holidays", holidays.map((holiday) => holiday.id));

    const profileMap = await ensureMemberProfiles(state);
    const memberCodes = (state.members || []).map((member) => member.code).filter(Boolean);
    if (memberCodes.length) {
      await restUpdate("profiles", {
        employee_code: `not.${buildInFilter(memberCodes)}`
      }, {
        is_active: false
      }, {
        auth: true,
        prefer: "return=minimal"
      });
    }
    for (const member of state.members || []) {
      const profile = profileMap.get(member.code);
      if (!profile?.id) {
        continue;
      }
      const scheduleDeptIds = Array.isArray(member.scheduleDeptIds) && member.scheduleDeptIds.length
        ? member.scheduleDeptIds
        : [member.deptId].filter(Boolean);
      await restUpdate("profiles", {
        id: `eq.${profile.id}`
      }, {
        employee_code: member.code,
        full_name: member.name,
        role: member.role === "manager" ? "manager" : "employee",
        home_department_id: departmentMap.get(scheduleDeptIds[0])?.id || null,
        hire_date: nullableDate(member.hireDate),
        leave_date: nullableDate(member.leaveDate),
        pay_by_day: Boolean(member.payByDay),
        fixed_rest_weekday: clampInteger(member.fixedRestWeekday, 0, 6, 0),
        monthly_rest_days: clampInteger(member.monthlyRestDays, 0, 31, 0),
        schedule_department_ids: scheduleDeptIds,
        is_active: true
      }, {
        auth: true,
        prefer: "return=minimal"
      });
    }

    await restDelete("member_departments", { id: "not.is.null" }, { auth: true });
    const memberDepartmentRows = [];
    (state.members || []).forEach((member) => {
      const profile = profileMap.get(member.code);
      const scheduleDeptIds = Array.isArray(member.scheduleDeptIds) && member.scheduleDeptIds.length
        ? member.scheduleDeptIds
        : [member.deptId].filter(Boolean);
      scheduleDeptIds.forEach((departmentId, index) => {
        const department = departmentMap.get(departmentId);
        if (profile?.id && department?.id) {
          memberDepartmentRows.push({
            member_id: profile.id,
            department_id: department.id,
            sort_order: index
          });
        }
      });
    });
    if (memberDepartmentRows.length) {
      await restInsert("member_departments", memberDepartmentRows, {
        auth: true,
        onConflict: "member_id,department_id",
        prefer: "resolution=merge-duplicates,return=minimal"
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
      max_consecutive_work_days: Math.max(1, Number(state.rules?.maxConsecutiveWorkDays) || 6),
      week_start: clampInteger(state.rules?.weekStart, 0, 6, 0),
      month_start_day: clampInteger(state.rules?.monthStartDay, 1, 31, 1),
      eight_week_start_date: nullableDate(state.rules?.eightWeekStartDate),
      forbid_proxy_leave_conflict: state.rules?.forbidProxyLeaveConflict !== false,
      require_employment_window: state.rules?.requireEmploymentWindow !== false,
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
    const monthRows = new Map();
    monthRows.set(`${state.year}-${Number(state.month) + 1}`, {
      year: Number(state.year) || new Date().getFullYear(),
      month: Number(state.month) + 1
    });
    scheduleEntries.forEach(({ parsed }) => {
      monthRows.set(`${parsed.year}-${parsed.month}`, {
        year: parsed.year,
        month: parsed.month
      });
    });
    await restDelete("schedule_entries", { id: "not.is.null" }, { auth: true });

    let scheduleRows;
    try {
      await restInsert("schedule_months", [...monthRows.values()].map((item) => ({
        year: item.year,
        month: item.month,
        month_start_day: clampInteger(state.rules?.monthStartDay, 1, 31, 1),
        name: `${item.year}-${String(item.month).padStart(2, "0")}`
      })), {
        auth: true,
        onConflict: "year,month",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      const scheduleMonths = await restSelect("schedule_months", {
        select: "*",
        auth: true
      });
      const scheduleMonthMap = new Map((scheduleMonths || []).map((row) => [`${row.year}-${row.month}`, row]));

      scheduleRows = scheduleEntries.map(({ parsed, slot, profile }) => {
        const scheduleMonth = scheduleMonthMap.get(`${parsed.year}-${parsed.month}`);
        return scheduleMonth?.id ? {
          schedule_month_id: scheduleMonth.id,
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
        } : null;
      }).filter((row) => row && (row.shift_type_id || row.leave_type_id || row.overtime_type_id));
    } catch (error) {
      if (!isMissingScheduleMonthsError(error) && !isMissingScheduleMonthIdError(error)) {
        throw error;
      }
      scheduleRows = scheduleEntries.map(({ parsed, slot, profile }) => ({
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
      })).filter((row) => row.shift_type_id || row.leave_type_id || row.overtime_type_id);
    }

    const prefer = "resolution=merge-duplicates,return=minimal";
    const onConflict = scheduleRows.some((row) => row.schedule_month_id)
      ? "schedule_month_id,member_id,work_date"
      : "";
    if (scheduleRows.length) {
      await restInsert("schedule_entries", scheduleRows, {
        auth: true,
        onConflict,
        prefer: onConflict ? prefer : "return=minimal"
      });
    }

    await syncLeaveAndOvertimeCatalogs(state);
    return { ok: true, savedAt: new Date().toISOString() };
  }

  async function syncCatalogs(state) {
    ensureManager();
    await syncLeaveAndOvertimeCatalogs(state);
  }

  async function getOvertimeTypeByName(name) {
    const rows = await restSelect("overtime_types", {
      select: "id,name",
      filters: {
        name: `eq.${name}`
      },
      auth: true
    });
    if (!rows?.length) {
      throw new Error("找不到對應的加班別，請先同步加班設定");
    }
    return rows[0];
  }

  async function getDefaultOvertimeType() {
    const rows = await restSelect("overtime_types", {
      select: "id,name",
      order: "created_at.asc",
      limit: "1",
      auth: true
    });
    if (!rows?.length) {
      throw new Error("找不到可用的加班設定");
    }
    return rows[0];
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
    const rows = await restSelect("profiles", {
      select: "id,employee_code",
      filters: {
        employee_code: `eq.${normalizedMemberCode}`
      },
      auth: true
    });
    if (!rows?.length || !rows[0]?.id) {
      throw new Error(`找不到對應的人員資料：${normalizedMemberCode}`);
    }
    return rows[0].id;
  }

  async function createManagerLeaveRequest(payload) {
    ensureManager();
    const leaveType = await getLeaveTypeByReference(payload);
    const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
    await restInsert("leave_requests", [{
      member_id: profileMemberId,
      leave_type_id: leaveType.id,
      start_date: payload.startDate,
      end_date: payload.endDate,
      is_all_day: payload.isAllDay,
      start_time: payload.isAllDay ? null : payload.startTime,
      end_time: payload.isAllDay ? null : payload.endTime,
      reason: payload.reason || ""
    }], {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function updateManagerLeaveRequest(payload) {
    ensureManager();
    const leaveType = await getLeaveTypeByReference(payload);
    const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
    await restUpdate("leave_requests", {
      id: `eq.${payload.id}`
    }, {
      member_id: profileMemberId,
      leave_type_id: leaveType.id,
      start_date: payload.startDate,
      end_date: payload.endDate,
      is_all_day: payload.isAllDay,
      start_time: payload.isAllDay ? null : payload.startTime,
      end_time: payload.isAllDay ? null : payload.endTime,
      reason: payload.reason || ""
    }, {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function deleteManagerLeaveRequest(requestId) {
    ensureManager();
    await restDelete("leave_requests", {
      id: `eq.${requestId}`
    }, {
      auth: true
    });
    return { ok: true };
  }

  async function createManagerOvertimeRequest(payload) {
    ensureManager();
    const overtimeType = payload.overtimeName
      ? await getOvertimeTypeByName(payload.overtimeName).catch(() => getDefaultOvertimeType())
      : await getDefaultOvertimeType();
    const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
    await restInsert("overtime_requests", [{
      member_id: profileMemberId,
      overtime_type_id: overtimeType.id,
      work_date: payload.workDate,
      start_time: payload.startTime || null,
      end_time: payload.endTime || null,
      use_rest_1: Boolean(payload.useRest1),
      rest_1_start_time: payload.useRest1 ? payload.rest1StartTime || null : null,
      rest_1_end_time: payload.useRest1 ? payload.rest1EndTime || null : null,
      use_rest_2: Boolean(payload.useRest2),
      rest_2_start_time: payload.useRest2 ? payload.rest2StartTime || null : null,
      rest_2_end_time: payload.useRest2 ? payload.rest2EndTime || null : null,
      reason: payload.reason || ""
    }], {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function updateManagerOvertimeRequest(payload) {
    ensureManager();
    const overtimeType = payload.overtimeName
      ? await getOvertimeTypeByName(payload.overtimeName).catch(() => getDefaultOvertimeType())
      : await getDefaultOvertimeType();
    const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
    await restUpdate("overtime_requests", {
      id: `eq.${payload.id}`
    }, {
      member_id: profileMemberId,
      overtime_type_id: overtimeType.id,
      work_date: payload.workDate,
      start_time: payload.startTime || null,
      end_time: payload.endTime || null,
      use_rest_1: Boolean(payload.useRest1),
      rest_1_start_time: payload.useRest1 ? payload.rest1StartTime || null : null,
      rest_1_end_time: payload.useRest1 ? payload.rest1EndTime || null : null,
      use_rest_2: Boolean(payload.useRest2),
      rest_2_start_time: payload.useRest2 ? payload.rest2StartTime || null : null,
      rest_2_end_time: payload.useRest2 ? payload.rest2EndTime || null : null,
      reason: payload.reason || ""
    }, {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function deleteManagerOvertimeRequest(requestId) {
    ensureManager();
    await restDelete("overtime_requests", {
      id: `eq.${requestId}`
    }, {
      auth: true
    });
    return { ok: true };
  }

  async function fetchProfilesByIds(ids) {
    if (!ids.length) {
      return new Map();
    }
    const rows = await restSelect("profiles", {
      select: "id,employee_code,full_name,role",
      filters: {
        id: buildInFilter(ids)
      },
      auth: true
    });
    return new Map((rows || []).map((item) => [item.id, item]));
  }

  async function fetchLeaveTypesByIds(ids) {
    if (!ids.length) {
      return new Map();
    }
    let rows = [];
    try {
      rows = await restSelect("leave_types", {
        select: "id,code,name,scheduler_item_id",
        filters: {
          id: buildInFilter(ids)
        },
        auth: true
      });
    } catch (error) {
      if (!/scheduler_item_id/i.test(error.message || "")) {
        throw error;
      }
      rows = await restSelect("leave_types", {
        select: "id,code,name",
        filters: {
          id: buildInFilter(ids)
        },
        auth: true
      });
    }
    return new Map((rows || []).map((item) => [item.id, item]));
  }

  async function fetchOvertimeTypesByIds(ids) {
    if (!ids.length) {
      return new Map();
    }
    const rows = await restSelect("overtime_types", {
      select: "id,name",
      filters: {
        id: buildInFilter(ids)
      },
      auth: true
    });
    return new Map((rows || []).map((item) => [item.id, item]));
  }

  async function listLeaveRequests(options = {}) {
    ensureSignedIn();
    const filters = {};
    if (!options.manager) {
      filters.member_id = `eq.${currentSession.user.id}`;
    }
    const rows = await restSelect("leave_requests", {
      select: "*",
      filters,
      order: "created_at.desc",
      auth: true
    });

    const memberIds = [...new Set((rows || []).map((item) => item.member_id).filter(Boolean))];
    const leaveTypeIds = [...new Set((rows || []).map((item) => item.leave_type_id).filter(Boolean))];
    const profileMap = await fetchProfilesByIds(memberIds);
    const leaveTypeMap = await fetchLeaveTypesByIds(leaveTypeIds);

    return (rows || []).map((item) => ({
      id: item.id,
      memberId: item.member_id,
      memberCode: profileMap.get(item.member_id)?.employee_code || "",
      memberName: profileMap.get(item.member_id)?.full_name || "",
      leaveItemId: leaveTypeMap.get(item.leave_type_id)?.scheduler_item_id || "",
      leaveCode: leaveTypeMap.get(item.leave_type_id)?.code || "",
      leaveName: leaveTypeMap.get(item.leave_type_id)?.name || "",
      startDate: item.start_date,
      endDate: item.end_date,
      isAllDay: item.is_all_day !== false,
      startTime: item.start_time || "",
      endTime: item.end_time || "",
      reason: item.reason || "",
      createdAt: item.created_at
    }));
  }

  async function listOvertimeRequests(options = {}) {
    ensureSignedIn();
    const filters = {};
    if (!options.manager) {
      filters.member_id = `eq.${currentSession.user.id}`;
    }
    const rows = await restSelect("overtime_requests", {
      select: "*",
      filters,
      order: "created_at.desc",
      auth: true
    });

    const memberIds = [...new Set((rows || []).map((item) => item.member_id).filter(Boolean))];
    const overtimeTypeIds = [...new Set((rows || []).map((item) => item.overtime_type_id).filter(Boolean))];
    const profileMap = await fetchProfilesByIds(memberIds);
    const overtimeTypeMap = await fetchOvertimeTypesByIds(overtimeTypeIds);

    return (rows || []).map((item) => ({
      id: item.id,
      memberId: item.member_id,
      memberCode: profileMap.get(item.member_id)?.employee_code || "",
      memberName: profileMap.get(item.member_id)?.full_name || "",
      overtimeName: overtimeTypeMap.get(item.overtime_type_id)?.name || "",
      workDate: item.work_date,
      startTime: item.start_time || "",
      endTime: item.end_time || "",
      useRest1: Boolean(item.use_rest_1),
      rest1StartTime: item.rest_1_start_time || "",
      rest1EndTime: item.rest_1_end_time || "",
      useRest2: Boolean(item.use_rest_2),
      rest2StartTime: item.rest_2_start_time || "",
      rest2EndTime: item.rest_2_end_time || "",
      reason: item.reason || "",
      createdAt: item.created_at
    }));
  }

  async function listPublicScheduleRequests() {
    const rows = await restRpc("get_public_schedule_requests", {}, { auth: true });
    const leaveRequests = [];
    const overtimeRequests = [];
    (rows || []).forEach((item) => {
      if (item.kind === "leave") {
        leaveRequests.push({
          id: item.request_id,
          memberCode: item.member_code || "",
          memberName: item.member_name || "",
          leaveItemId: item.leave_item_id || "",
          leaveCode: item.leave_code || "",
          leaveName: item.leave_name || "",
          startDate: item.start_date,
          endDate: item.end_date,
          isAllDay: item.is_all_day !== false,
          startTime: item.start_time || "",
          endTime: item.end_time || "",
          reason: "",
          createdAt: item.created_at || ""
        });
        return;
      }
      if (item.kind === "overtime") {
        overtimeRequests.push({
          id: item.request_id,
          memberCode: item.member_code || "",
          memberName: item.member_name || "",
          overtimeName: item.overtime_name || "",
          workDate: item.work_date,
          startTime: item.start_time || "",
          endTime: item.end_time || "",
          useRest1: Boolean(item.use_rest_1),
          rest1StartTime: item.rest_1_start_time || "",
          rest1EndTime: item.rest_1_end_time || "",
          useRest2: Boolean(item.use_rest_2),
          rest2StartTime: item.rest_2_start_time || "",
          rest2EndTime: item.rest_2_end_time || "",
          reason: "",
          createdAt: item.created_at || ""
        });
      }
    });
    return { leaveRequests, overtimeRequests };
  }

  async function updateOvertimeRequestDetails(payload) {
    ensureManager();
    await restUpdate("overtime_requests", {
      id: `eq.${payload.id}`
    }, {
      start_time: payload.startTime || null,
      end_time: payload.endTime || null,
      use_rest_1: Boolean(payload.useRest1),
      rest_1_start_time: payload.useRest1 ? payload.rest1StartTime || null : null,
      rest_1_end_time: payload.useRest1 ? payload.rest1EndTime || null : null,
      use_rest_2: Boolean(payload.useRest2),
      rest_2_start_time: payload.useRest2 ? payload.rest2StartTime || null : null,
      rest_2_end_time: payload.useRest2 ? payload.rest2EndTime || null : null
    }, {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function exportSapCsv(payload) {
    if (!exporter.getSapLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = new Blob(
      [exporter.buildSapLeaveCsvContent(payload)],
      { type: "text/csv;charset=utf-8" }
    );
    const fileName = makeFileName("sap休例假", payload, "csv");
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
    loadState,
    saveState,
    syncCatalogs,
    syncMemberProfile,
    resetMemberPassword,
    createManagerLeaveRequest,
    updateManagerLeaveRequest,
    deleteManagerLeaveRequest,
    createManagerOvertimeRequest,
    updateManagerOvertimeRequest,
    deleteManagerOvertimeRequest,
    listLeaveRequests,
    listOvertimeRequests,
    listPublicScheduleRequests,
    updateOvertimeRequestDetails,
    exportSapCsv,
    exportOvertime,
    exportLeave,
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
