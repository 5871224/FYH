import { withSupabase } from "npm:@supabase/server@^1";

function dateText(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(value: string, count: number) {
  const [y, m, d] = String(value || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + count);
  return dateText(date);
}

function effective(profile: any, today = dateText()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean((!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

function validDate(value: unknown, fallback = dateText()) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function hours(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || Math.round(number * 2) !== number * 2) {
    throw new Error("加班時數必須為 0.5 的倍數且不可為負數");
  }
  return number;
}

async function requireAdmin(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,full_name,role,hire_date,leave_date").eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data) || result.data.role !== "admin") throw new Error("此功能限管理員使用");
  return result.data;
}

async function review(ctx: any, body: any) {
  const operator = await requireAdmin(ctx);
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map(String).filter(Boolean))]
    : [String(body?.id || "")].filter(Boolean);
  const status = String(body?.status || "");
  if (!ids.length) throw new Error("缺少加班申請");
  if (!["approved", "returned", "pending"].includes(status)) throw new Error("不支援的審核狀態");

  const earlyInput = body?.earlyHours === undefined ? null : hours(body.earlyHours);
  const lateInput = body?.lateHours === undefined ? null : hours(body.lateHours);
  const employeeNoteInput = body?.employeeNote === undefined
    ? undefined
    : String(body.employeeNote || "").trim();

  const result = await ctx.supabaseAdmin.rpc("admin_review_overtime_requests_v2", {
    p_ids: ids,
    p_status: status,
    p_early_hours: earlyInput,
    p_late_hours: lateInput,
    p_operator_user_id: operator.id,
    p_review_note: String(body?.returnReason || body?.reviewNote || "").trim()
  });
  if (result.error) throw result.error;

  if (employeeNoteInput !== undefined) {
    const noteResult = await ctx.supabaseAdmin
      .from("attendance_overtime_requests")
      .update({ employee_note: employeeNoteInput })
      .in("id", ids);
    if (noteResult.error) throw noteResult.error;
  }
  return result.data;
}

async function createRequest(ctx: any, body: any) {
  const operator = await requireAdmin(ctx);
  const userId = String(body?.userId || "");
  const workDate = validDate(body?.workDate);
  const early = hours(body?.earlyHours);
  const late = hours(body?.lateHours);
  const status = body?.approve === true || body?.status === "approved" ? "approved" : "pending";
  if (!userId) throw new Error("缺少加班人員");
  if (early + late <= 0) throw new Error("加班時數必須大於 0");
  const now = new Date().toISOString();
  const result = await ctx.supabaseAdmin.from("attendance_overtime_requests").insert({
    user_id: userId,
    work_date: workDate,
    status,
    early_overtime_hours: early,
    late_overtime_hours: late,
    total_overtime_hours: early + late,
    employee_note: String(body?.note || "").trim(),
    is_deleted_by_employee: false,
    created_by_type: "admin",
    created_by_user_id: operator.id,
    reviewed_at: status === "approved" ? now : null,
    reviewed_by: status === "approved" ? operator.id : null,
    review_note: String(body?.reviewNote || "").trim() || null
  }).select("*").single();
  if (result.error) throw result.error;
  return { ok: true, request: result.data };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      if (body?.action === "review") return Response.json(await review(ctx, body));
      if (body?.action === "create") return Response.json(await createRequest(ctx, body));
      return Response.json({ message: "不支援的加班管理操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "加班管理失敗" }, { status: 400 });
    }
  })
};
