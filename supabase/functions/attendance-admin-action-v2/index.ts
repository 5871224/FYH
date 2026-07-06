import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(value: string, count: number) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return taipeiDate(date);
}

function effective(profile: any, today = taipeiDate()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

function validDate(value: unknown, fallback = taipeiDate()) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function localDateTime(date: string, time: string) {
  if (!time) return null;
  const value = new Date(`${date}T${String(time).slice(0, 8)}+08:00`);
  if (Number.isNaN(value.getTime())) throw new Error("打卡時間格式錯誤");
  return value.toISOString();
}

async function requireAdmin(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,role,is_active,hire_date,leave_date").eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data) || result.data.role !== "admin") throw new Error("此功能限管理員使用");
  return result.data;
}

async function save(ctx: any, body: any) {
  const operator = await requireAdmin(ctx);
  const row = body?.record || {};
  const reason = String(row.reason || "").trim();
  const workDate = validDate(row.workDate || row.work_date);
  const result = await ctx.supabaseAdmin.rpc("admin_update_attendance_record", {
    p_record_id: row.id || null,
    p_user_id: row.userId || row.user_id || null,
    p_work_date: workDate,
    p_clock_in_at: row.clockInTime ? localDateTime(workDate, row.clockInTime) : null,
    p_clock_in_department_id: row.clockInDepartmentId || null,
    p_clock_out_at: row.clockOutTime ? localDateTime(workDate, row.clockOutTime) : null,
    p_clock_out_department_id: row.clockOutDepartmentId || null,
    p_attendance_note: row.attendanceNote || "",
    p_operator_user_id: operator.id,
    p_reason: reason
  });
  if (result.error) throw result.error;
  return { ok: true, record: result.data };
}

async function history(ctx: any, body: any) {
  await requireAdmin(ctx);
  const recordId = String(body?.recordId || "");
  if (!recordId) return { ok: true, logs: [] };
  const result = await ctx.supabaseAdmin.from("attendance_action_logs").select("*")
    .eq("attendance_record_id", recordId).order("created_at", { ascending: false });
  if (result.error) throw result.error;
  return { ok: true, logs: result.data || [] };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      if (body?.action === "save") return Response.json(await save(ctx, body));
      if (body?.action === "history") return Response.json(await history(ctx, body));
      return Response.json({ message: "不支援的打卡管理操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "打卡管理失敗" }, { status: 400 });
    }
  })
};
