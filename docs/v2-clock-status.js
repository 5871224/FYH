(function installV2ClockStatusReader() {
  const api = window.schedulerApi;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  if (!api || !baseUrl || !anonKey) return;

  async function callAttendanceToday() {
    const session = api.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/attendance-clock`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "today" })
    });
    const text = await response.text();
    let result = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = { message: text };
    }
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
    return result;
  }

  // Read today's record through the authenticated Edge Function instead of a
  // browser-side REST select. This keeps desktop and mobile behavior identical
  // and avoids RLS/browser-session differences hiding an existing clock record.
  api.getTodayAttendance = callAttendanceToday;
})();
