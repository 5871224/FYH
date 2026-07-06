import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDaysToDateString(dateString: string, count: number) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return taipeiDateString(date);
}

function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!effectiveEndDate || today <= effectiveEndDate));
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
    .select("id, full_name, role, is_active, hire_date, leave_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const today = taipeiDateString();
  if (!isProfileEffective(data, today)) {
    throw new Error("此帳號目前不在有效期間，無法申請加班");
  }
  return data;
}

function requireAdmin(profile: any) {
  if (profile?.role !== "admin") {
    throw new Error("此功能限管理員使用");
  }
}

async function getTodayContext(ctx: any, userId: string) {
  const workDate = taipeiDateString();
  const [{ data: attendance, error: attendanceError }, { data: request, error: requestError }, { data: schedule, error: scheduleError }] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", userId).eq("work_date", workDate).maybeSingle(),
    ctx.supabaseAdmin.from("attendance_overtime_requests").select("*").eq("user_id", userId).eq("work_date", workDate).eq("is_deleted_by_employee", false).maybeSingle(),
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
  if (earlyHours + lateHours <= 0) {
    throw new Error("加班申請時數必須大於 0");
  }
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
      is_deleted_by_employee: false,
      deleted_at: null,
      deleted_by: null,
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
    .update({
      is_deleted_by_employee: true,
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", context.request.id);
  if (error) throw error;
  return { ok: true, deleted: true };
}

function validDate(value: unknown, fallback = taipeiDateString()) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

async function adminListRequests(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  requireAdmin(profile);
  const today = taipeiDateString();
  const fromDate = validDate(body?.fromDate, addDaysToDateString(today, -30));
  const toDate = validDate(body?.toDate, today);
  const status = String(body?.status || "pending");
  let query = ctx.supabaseAdmin
    .from("attendance_overtime_requests")
    .select("*, employee:user_id(employee_code,full_name,department_id)")
    .eq("is_deleted_by_employee", false)
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("work_date", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return { ok: true, requests: data || [] };
}

async function adminReviewRequest(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  requireAdmin(profile);
  const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [String(body?.id || "")].filter(Boolean);
  const nextStatus = String(body?.status || "");
  if (!ids.length) throw new Error("缺少加班申請");
  if (!["approved", "returned", "pending"].includes(nextStatus)) throw new Error("不支援的審核狀態");
  const earlyHours = body?.earlyHours === undefined ? null : normalizeHours(body.earlyHours);
  const lateHours = body?.lateHours === undefined ? null : normalizeHours(body.lateHours);
  const reviewedAt = new Date().toISOString();
  const updated: any[] = [];

  for (const id of ids) {
    const { data: oldRow, error: readError } = await ctx.supabaseAdmin
      .from("attendance_overtime_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    const nextEarly = earlyHours === null ? Number(oldRow.early_overtime_hours || 0) : earlyHours;
    const nextLate = lateHours === null ? Number(oldRow.late_overtime_hours || 0) : lateHours;
    const { data: newRow, error: updateError } = await ctx.supabaseAdmin
      .from("attendance_overtime_requests")
      .update({
        status: nextStatus,
        early_overtime_hours: nextEarly,
        late_overtime_hours: nextLate,
        total_overtime_hours: nextEarly + nextLate,
        attendance_changed_warning: false,
        reviewed_at: reviewedAt,
        reviewed_by: profile.id,
        updated_at: reviewedAt
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    const { error: logError } = await ctx.supabaseAdmin.from("overtime_review_logs").insert({
      overtime_request_id: id,
      old_status: oldRow.status,
      new_status: nextStatus,
      old_early_hours: oldRow.early_overtime_hours,
      new_early_hours: nextEarly,
      old_late_hours: oldRow.late_overtime_hours,
      new_late_hours: nextLate,
      operator_user_id: profile.id
    });
    if (logError) throw logError;
    updated.push(newRow);
  }

  return { ok: true, requests: updated };
}

async function adminCreateRequest(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  requireAdmin(profile);
  const userId = String(body?.userId || "");
  const workDate = validDate(body?.workDate);
  const earlyHours = normalizeHours(body?.earlyHours);
  const lateHours = normalizeHours(body?.lateHours);
  if (!userId) throw new Error("缺少加班人員");
  if (earlyHours + lateHours <= 0) throw new Error("加班時數必須大於 0");
  const { data, error } = await ctx.supabaseAdmin
    .from("attendance_overtime_requests")
    .insert({
      user_id: userId,
      work_date: workDate,
      status: "pending",
      early_overtime_hours: earlyHours,
      late_overtime_hours: lateHours,
      total_overtime_hours: earlyHours + lateHours,
      employee_note: String(body?.note || "").trim(),
      is_deleted_by_employee: false,
      created_by_type: "admin",
      created_by_user_id: profile.id
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, request: data };
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
      if (body?.action === "admin_list") return Response.json(await adminListRequests(ctx, body));
      if (body?.action === "admin_review") return Response.json(await adminReviewRequest(ctx, body));
      if (body?.action === "admin_create") return Response.json(await adminCreateRequest(ctx, body));
      return Response.json({ message: "不支援的加班操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "加班操作失敗" }, { status: 400 });
    }
  })
};
