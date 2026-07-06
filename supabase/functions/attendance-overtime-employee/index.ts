import { withSupabase } from "npm:@supabase/server@^1";

const APPLY_DAYS = 5;

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

function validDate(value: unknown, fallback = dateText()) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function effective(profile: any, today = dateText()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

function minutes(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function shiftMinutes(value: string) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function halfHours(value: number) {
  return Math.max(0, Math.floor(value / 30) * 0.5);
}

function hours(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || Math.round(number * 2) !== number * 2) {
    throw new Error("加班時數必須為 0.5 的倍數且不可為負數");
  }
  return number;
}

async function profile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const { data, error } = await ctx.supabaseAdmin.from("set_employee")
    .select("id,full_name,role,is_active,hire_date,leave_date").eq("id", userId).single();
  if (error) throw error;
  if (!effective(data)) throw new Error("此帳號目前不在有效期間，無法申請加班");
  return data;
}

function checkDeadline(workDate: string, today = dateText()) {
  if (workDate > today) throw new Error("不可申請未來日期的加班");
  if (today > addDays(workDate, APPLY_DAYS)) throw new Error("已超過工作日起五個日曆日的申請期限");
}

async function context(ctx: any, userId: string, workDate: string) {
  const [attendanceResult, requestResult, scheduleResult] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", userId).eq("work_date", workDate).maybeSingle(),
    ctx.supabaseAdmin.from("attendance_overtime_requests").select("*").eq("user_id", userId).eq("work_date", workDate).eq("is_deleted_by_employee", false).maybeSingle(),
    ctx.supabaseAdmin.from("schedule_entries").select("shift_type_id").eq("member_id", userId).eq("work_date", workDate).maybeSingle()
  ]);
  if (attendanceResult.error) throw attendanceResult.error;
  if (requestResult.error) throw requestResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  let shift = null;
  if (scheduleResult.data?.shift_type_id) {
    const result = await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id")
      .eq("id", scheduleResult.data.shift_type_id).maybeSingle();
    if (result.error) throw result.error;
    shift = result.data || null;
  }
  return { workDate, attendance: attendanceResult.data || null, request: requestResult.data || null, shift };
}

function eligibility(item: any, today = dateText()) {
  const reasons: string[] = [];
  if (item.workDate > today) reasons.push("不可申請未來日期的加班");
  if (today > addDays(item.workDate, APPLY_DAYS)) reasons.push("已超過申請期限");
  if (!item.attendance?.clock_in_at) reasons.push("尚無上班打卡");
  if (!item.attendance?.clock_out_at) reasons.push("尚無下班打卡");
  if (!item.shift) reasons.push("沒有可計算的班別");
  const start = shiftMinutes(item.shift?.start_time);
  const end = shiftMinutes(item.shift?.end_time);
  if (item.shift && (start === null || end === null)) reasons.push("班別缺少上下班時間");
  let earlyHours = 0;
  let lateHours = 0;
  if (!reasons.length) {
    const clockIn = minutes(item.attendance.clock_in_at);
    const clockOut = minutes(item.attendance.clock_out_at);
    if (clockIn === null || clockOut === null) reasons.push("打卡時間格式異常");
    else {
      earlyHours = halfHours((start as number) - clockIn);
      lateHours = halfHours(clockOut - (end as number));
      if (earlyHours + lateHours <= 0) reasons.push("提早或延後時間未達 30 分鐘");
    }
  }
  return { eligible: !reasons.length && !item.request, reasons, deadlineDate: addDays(item.workDate, APPLY_DAYS), earlyHours, lateHours, totalHours: earlyHours + lateHours };
}

async function status(ctx: any, body: any) {
  const user = await profile(ctx);
  const workDate = validDate(body?.workDate);
  const item = await context(ctx, user.id, workDate);
  return { ok: true, serverDate: dateText(), ...item, eligibility: eligibility(item) };
}

async function dates(ctx: any) {
  const user = await profile(ctx);
  const today = dateText();
  const result = await ctx.supabaseAdmin.from("attendance_records").select("work_date")
    .eq("user_id", user.id).gte("work_date", addDays(today, -APPLY_DAYS)).lte("work_date", today)
    .order("work_date", { ascending: false });
  if (result.error) throw result.error;
  const output = [];
  for (const workDate of [...new Set((result.data || []).map((row: any) => row.work_date))]) {
    const item = await context(ctx, user.id, workDate as string);
    output.push({ workDate, request: item.request, eligibility: eligibility(item) });
  }
  return { ok: true, dates: output };
}

async function submit(ctx: any, body: any) {
  const user = await profile(ctx);
  const workDate = validDate(body?.workDate);
  checkDeadline(workDate);
  const item = await context(ctx, user.id, workDate);
  const allowed = eligibility(item);
  if (item.request) throw new Error("當日已有加班申請，請先刪除待審或退回申請");
  if (!allowed.eligible) throw new Error(allowed.reasons[0] || "當日不可申請加班");
  const early = hours(body?.earlyHours);
  const late = hours(body?.lateHours);
  if (early + late <= 0) throw new Error("加班申請時數必須大於 0");
  const result = await ctx.supabaseAdmin.from("attendance_overtime_requests").insert({
    user_id: user.id, work_date: workDate, status: "pending",
    early_overtime_hours: early, late_overtime_hours: late, total_overtime_hours: early + late,
    employee_note: String(body?.note || "").trim(), is_deleted_by_employee: false,
    created_by_type: "employee", created_by_user_id: user.id
  }).select("*").single();
  if (result.error) throw result.error;
  return { ok: true, request: result.data };
}

async function remove(ctx: any, body: any) {
  const user = await profile(ctx);
  const workDate = validDate(body?.workDate);
  checkDeadline(workDate);
  const item = await context(ctx, user.id, workDate);
  if (!item.request) return { ok: true, deleted: false };
  if (!["pending", "returned"].includes(item.request.status)) throw new Error("已核准的加班申請不可由員工刪除");
  const result = await ctx.supabaseAdmin.from("attendance_overtime_requests").update({
    is_deleted_by_employee: true, deleted_at: new Date().toISOString(), deleted_by: user.id, updated_at: new Date().toISOString()
  }).eq("id", item.request.id);
  if (result.error) throw result.error;
  return { ok: true, deleted: true };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      if (body?.action === "dates") return Response.json(await dates(ctx));
      if (body?.action === "status") return Response.json(await status(ctx, body));
      if (body?.action === "submit") return Response.json(await submit(ctx, body));
      if (body?.action === "delete") return Response.json(await remove(ctx, body));
      return Response.json({ message: "不支援的加班操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "加班操作失敗" }, { status: 400 });
    }
  })
};
