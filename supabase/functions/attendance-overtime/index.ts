import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function taipeiMinutes(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function overtimeHours(minutes: number) {
  return Math.max(0, Math.floor(minutes / 30) * 0.5);
}

function normalizeHours(value: unknown) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours) || hours < 0 || Math.round(hours * 2) !== hours * 2) {
    throw new Error("加班時數必須為 0.5 的倍數且不可為負數");
  }
  return hours;
}

async function getProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id, full_name, is_active, hire_date, leave_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const today = taipeiDateString();
  if (!data?.is_active || (data.hire_date && today < data.hire_date) || (data.leave_date && today > data.leave_date)) {
    throw new Error("此帳號目前不在有效期間，無法申請加班");
  }
  return data;
}

async function getTodayContext(ctx: any, userId: string) {
  const workDate = taipeiDateString();
  const [{ data: attendance, error: attendanceError }, { data: request, error: requestError }, { data: schedule, error: scheduleError }] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", userId).eq("work_date", workDate).maybeSingle(),
    ctx.supabaseAdmin.from("attendance_overtime_requests").select("*").eq("user_id", userId).eq("work_date", workDate).maybeSingle(),
    ctx.supabaseAdmin.from("schedule_entries").select("shift_type_id").eq("member_id", userId).eq("work_date", workDate).maybeSingle()
  ]);
  if (attendanceError) throw attendanceError;
  if (requestError) throw requestError;
  if (scheduleError) throw scheduleError;

  let shift = null;
  if (schedule?.shift_type_id) {
    const { data, error } = await ctx.supabaseAdmin
      .from("set_shift")
      .select("id, name, start_time, end_time")
      .eq("id", schedule.shift_type_id)
      .maybeSingle();
    if (error) throw error;
    shift = data || null;
  }
  return { workDate, attendance: attendance || null, request: request || null, shift };
}

function buildEligibility(context: any) {
  const reasons = [];
  const attendance = context.attendance;
  const shift = context.shift;
  if (!attendance?.clock_in_at) reasons.push("今日尚無上班打卡");
  if (!attendance?.clock_out_at) reasons.push("今日尚無下班打卡");
  if (!shift) reasons.push("今日沒有可計算的班別");

  const shiftStart = timeToMinutes(shift?.start_time);
  const shiftEnd = timeToMinutes(shift?.end_time);
  if (shift && (shiftStart === null || shiftEnd === null)) {
    reasons.push("班別缺少上下班時間，無法計算加班");
  }

  let earlyHours = 0;
  let lateHours = 0;
  if (!reasons.length) {
    earlyHours = overtimeHours(shiftStart - taipeiMinutes(attendance.clock_in_at));
    lateHours = overtimeHours(taipeiMinutes(attendance.clock_out_at) - shiftEnd);
    if (earlyHours + lateHours <= 0) {
      reasons.push("提早或延後時間未達 30 分鐘");
    }
  }

  return {
    eligible: reasons.length === 0 && !context.request,
    reasons,
    earlyHours,
    lateHours,
    totalHours: earlyHours + lateHours
  };
}

async function todayStatus(ctx: any) {
  const profile = await getProfile(ctx);
  const context = await getTodayContext(ctx, profile.id);
  return {
    ok: true,
    workDate: context.workDate,
    attendance: context.attendance,
    shift: context.shift,
    request: context.request,
    eligibility: buildEligibility(context)
  };
}

async function submitRequest(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  const context = await getTodayContext(ctx, profile.id);
  const eligibility = buildEligibility(context);
  if (context.request) {
    throw new Error("今日已有加班申請，請先刪除待審或退回申請後再重新送出");
  }
  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] || "今日不可申請加班");
  }
  const earlyHours = normalizeHours(body?.earlyHours);
  const lateHours = normalizeHours(body?.lateHours);
  if (earlyHours > eligibility.earlyHours || lateHours > eligibility.lateHours) {
    throw new Error("員工申請時數不可高於系統計算值");
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("attendance_overtime_requests")
    .insert({
      user_id: profile.id,
      work_date: context.workDate,
      status: "pending",
      early_overtime_hours: earlyHours,
      late_overtime_hours: lateHours,
      total_overtime_hours: earlyHours + lateHours,
      employee_note: String(body?.note || "").trim(),
      created_by_type: "employee",
      created_by_user_id: profile.id
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, request: data };
}

async function deleteRequest(ctx: any) {
  const profile = await getProfile(ctx);
  const context = await getTodayContext(ctx, profile.id);
  if (!context.request) {
    return { ok: true, deleted: false };
  }
  if (!["pending", "returned"].includes(context.request.status)) {
    throw new Error("已核准的加班申請不可由員工刪除");
  }
  const { error } = await ctx.supabaseAdmin
    .from("attendance_overtime_requests")
    .delete()
    .eq("id", context.request.id);
  if (error) throw error;
  return { ok: true, deleted: true };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await req.json();
      if (body?.action === "today_status") return Response.json(await todayStatus(ctx));
      if (body?.action === "submit") return Response.json(await submitRequest(ctx, body));
      if (body?.action === "delete") return Response.json(await deleteRequest(ctx));
      return Response.json({ message: "不支援的加班操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "加班操作失敗" }, { status: 400 });
    }
  })
};
