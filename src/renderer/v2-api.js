(function installV2ApiOverrides() {
  const api = window.schedulerApi;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  if (!api || !baseUrl || !anonKey) return;

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

  window.addEventListener("load", () => {
    ["v2-overtime-admin.js", "v2-meal.js"].forEach((file) => {
      if (document.querySelector(`script[data-v2-module="${file}"]`)) return;
      const script = document.createElement("script");
      script.src = `./${file}?v=20260706v2`;
      script.dataset.v2Module = file;
      document.body.appendChild(script);
    });
  }, { once: true });
})();
