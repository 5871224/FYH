import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return taipeiDateString(date);
}

function isManagerRole(role: string) {
  return role === "admin" || role === "manager";
}

function isAdminRole(role: string) {
  return role === "admin";
}

function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean((!profile.hire_date || today >= profile.hire_date) && (!effectiveEndDate || today <= effectiveEndDate));
}

function validDate(value: unknown, fallback: string) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

function timeToMinutes(value: string) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function taipeiMinutes(value: string) {
  if (!value) return null;
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

function localDateTime(date: string, time: string) {
  if (!date || !time) return null;
  return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).toISOString();
}

function errorMessage(error: any, fallback: string) {
  return error?.message || error?.error_description || (typeof error === "string" ? error : fallback);
}

async function getProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id, employee_code, full_name, role, hire_date, leave_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const today = taipeiDateString();
  if (!isProfileEffective(data, today)) {
    throw new Error("此帳號目前不在有效期間，無法查看記錄");
  }
  return data;
}

function requireManager(profile: any) {
  if (!isManagerRole(profile.role)) throw new Error("此功能限主管或管理員使用");
}

function requireAdmin(profile: any) {
  if (!isAdminRole(profile.role)) throw new Error("此功能限管理員使用");
}

async function personalRecords(ctx: any, body: any = {}) {
  const profile = await getProfile(ctx);
  const today = taipeiDateString();
  const toDate = validDate(body?.toDate, today);
  const fromDate = validDate(body?.fromDate, addDays(toDate, -49));
  const [attendanceResult, overtimeResult, mealResult, scheduleResult] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", profile.id).gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("attendance_overtime_requests").select("*").eq("user_id", profile.id).eq("is_deleted_by_employee", false).gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", profile.id).gte("order_date", fromDate).lte("order_date", toDate),
    ctx.supabaseAdmin.from("schedule_entries").select("work_date, shift_type_id").eq("member_id", profile.id).gte("work_date", fromDate).lte("work_date", toDate)
  ]);
  for (const result of [attendanceResult, overtimeResult, mealResult, scheduleResult]) {
    if (result.error) throw result.error;
  }
  const shiftIds = [...new Set((scheduleResult.data || []).map((row: any) => row.shift_type_id).filter(Boolean))];
  const { data: shifts, error: shiftsError } = shiftIds.length
    ? await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time").in("id", shiftIds)
    : { data: [], error: null };
  if (shiftsError) throw shiftsError;
  const shiftMap = new Map((shifts || []).map((shift: any) => [shift.id, shift]));

  const byDate = new Map<string, any>();
  for (let date = toDate, count = 0; date >= fromDate && count < 366; date = addDays(date, -1), count += 1) {
    byDate.set(date, {
      date,
      shiftName: "",
      shiftTime: "",
      clockIn: null,
      clockInDepartment: "",
      clockOut: null,
      clockOutDepartment: "",
      overtimeStatus: "",
      overtimeHours: 0,
      attendanceNote: "",
      overtimeNote: "",
      mealText: ""
    });
  }
  (scheduleResult.data || []).forEach((row: any) => {
    const record = byDate.get(row.work_date);
    const shift = shiftMap.get(row.shift_type_id);
    if (record && shift) {
      record.shiftName = shift.name || "";
      record.shiftTime = `${String(shift.start_time || "").slice(0, 5)}-${String(shift.end_time || "").slice(0, 5)}`;
    }
  });
  (attendanceResult.data || []).forEach((row: any) => {
    const record = byDate.get(row.work_date);
    if (record) {
      record.clockIn = row.clock_in_at;
      record.clockInDepartment = row.clock_in_department_name_snapshot || "";
      record.clockOut = row.clock_out_at;
      record.clockOutDepartment = row.clock_out_department_name_snapshot || "";
      record.attendanceNote = row.attendance_note || "";
    }
  });
  (overtimeResult.data || []).forEach((row: any) => {
    const record = byDate.get(row.work_date);
    if (record) {
      record.overtimeStatus = row.status || "";
      record.overtimeHours = Number(row.total_overtime_hours || 0);
      record.overtimeNote = row.employee_note || "";
    }
  });
  const mealsByDate = new Map<string, string[]>();
  (mealResult.data || []).forEach((row: any) => {
    const list = mealsByDate.get(row.order_date) || [];
    list.push(`${row.product_name_snapshot}x${row.quantity}`);
    mealsByDate.set(row.order_date, list);
  });
  mealsByDate.forEach((list, date) => {
    const record = byDate.get(date);
    if (record) record.mealText = list.join("、");
  });

  return {
    ok: true,
    records: Array.from(byDate.values()).slice(0, 50)
  };
}

function buildAttendanceIssues(record: any, schedule: any, nowDate = taipeiDateString()) {
  const issues: string[] = [];
  const shift = schedule?.shift || null;
  const hasClockIn = Boolean(record?.clock_in_at);
  const hasClockOut = Boolean(record?.clock_out_at);
  if (!shift && (hasClockIn || hasClockOut)) issues.push("無排班但有打卡");
  if (!shift) return issues;

  const shiftStart = timeToMinutes(shift.start_time);
  const shiftEnd = timeToMinutes(shift.end_time);
  if (shiftStart === null || shiftEnd === null) {
    issues.push("班別缺少完整上下班時間");
    return issues;
  }

  const today = nowDate;
  const clockInDeadlinePassed = record.work_date < today || taipeiMinutes(new Date().toISOString())! > shiftStart;
  const clockOutDeadlinePassed = record.work_date < today || taipeiMinutes(new Date().toISOString())! > shiftEnd;
  if (!hasClockIn && clockInDeadlinePassed) issues.push("未打上班");
  if (!hasClockOut && clockOutDeadlinePassed) issues.push("未打下班");
  if (hasClockIn && taipeiMinutes(record.clock_in_at)! > shiftStart) issues.push("遲到");
  if (hasClockOut && taipeiMinutes(record.clock_out_at)! < shiftEnd) issues.push("早退");
  if (hasClockIn && hasClockOut && new Date(record.clock_in_at).getTime() > new Date(record.clock_out_at).getTime()) {
    issues.push("上班晚於下班");
  }
  if (hasClockIn && record.clock_in_department_id && shift.applicable_department_id && record.clock_in_department_id !== shift.applicable_department_id) {
    issues.push("上班地點不符");
  }
  if (hasClockOut && record.clock_out_department_id && shift.applicable_department_id && record.clock_out_department_id !== shift.applicable_department_id) {
    issues.push("下班地點不符");
  }
  return issues;
}

async function listMembers(ctx: any) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id, employee_code, full_name, role")
    .order("employee_code", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function attendanceAdminList(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  requireAdmin(profile);
  const today = taipeiDateString();
  const fromDate = validDate(body?.fromDate, today);
  const toDate = validDate(body?.toDate, today);
  const page = pageNumber(body?.page);
  const pageSize = 50;
  const memberId = String(body?.memberId || "");
  const abnormalOnly = body?.abnormalOnly !== false;
  const issueType = String(body?.issueType || "");

  const [members, attendanceResult, scheduleResult] = await Promise.all([
    listMembers(ctx),
    ctx.supabaseAdmin.from("attendance_records").select("*").gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin
      .from("schedule_entries")
      .select("member_id, work_date, shift_type_id")
      .gte("work_date", fromDate)
      .lte("work_date", toDate)
  ]);
  if (attendanceResult.error) throw attendanceResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  const shiftIds = [...new Set((scheduleResult.data || []).map((row: any) => row.shift_type_id).filter(Boolean))];
  const { data: shifts, error: shiftsError } = shiftIds.length
    ? await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id").in("id", shiftIds)
    : { data: [], error: null };
  if (shiftsError) throw shiftsError;
  const shiftMap = new Map((shifts || []).map((shift: any) => [shift.id, shift]));

  const memberMap = new Map(members.map((item: any) => [item.id, item]));
  const scheduleMap = new Map((scheduleResult.data || []).map((row: any) => [`${row.member_id}:${row.work_date}`, { ...row, shift: shiftMap.get(row.shift_type_id) || null }]));
  const attendanceMap = new Map((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));
  const rows: any[] = [];

  // ponytail: O(members * days) is fine for admin date ranges; upgrade to a SQL view/RPC if this grows past office-scale data.
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    for (const member of members) {
      if (memberId && member.id !== memberId) continue;
      const key = `${member.id}:${date}`;
      const attendance = attendanceMap.get(key) || {
        id: "",
        user_id: member.id,
        work_date: date,
        employee_code_snapshot: member.employee_code,
        employee_name_snapshot: member.full_name
      };
      const schedule = scheduleMap.get(key) || null;
      const issues = buildAttendanceIssues(attendance, schedule, today);
      if (abnormalOnly && !issues.length) continue;
      if (issueType && !issues.includes(issueType)) continue;
      rows.push({
        ...attendance,
        employee_code_snapshot: attendance.employee_code_snapshot || member.employee_code || "",
        employee_name_snapshot: attendance.employee_name_snapshot || member.full_name || "",
        shift_name: schedule?.shift?.name || "",
        shift_start_time: schedule?.shift?.start_time || "",
        shift_end_time: schedule?.shift?.end_time || "",
        shift_department_id: schedule?.shift?.applicable_department_id || "",
        issues
      });
    }
  }

  rows.sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || String(a.employee_code_snapshot).localeCompare(String(b.employee_code_snapshot)));
  const offset = (page - 1) * pageSize;
  return {
    ok: true,
    members,
    issueTypes: ["未打上班", "未打下班", "無排班但有打卡", "遲到", "早退", "上班晚於下班", "上班地點不符", "下班地點不符"],
    rows: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize
  };
}

async function attendanceHistory(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  requireAdmin(profile);
  const recordId = String(body?.recordId || "");
  if (!recordId) return { ok: true, logs: [] };
  const { data, error } = await ctx.supabaseAdmin
    .from("attendance_action_logs")
    .select("*")
    .eq("attendance_record_id", recordId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { ok: true, logs: data || [] };
}

async function attendanceAdminSave(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  requireAdmin(profile);
  const row = body?.record || {};
  const workDate = validDate(row.workDate || row.work_date, taipeiDateString());
  const { data, error } = await ctx.supabaseAdmin.rpc("admin_update_attendance_record", {
    p_record_id: row.id || null,
    p_user_id: row.userId || row.user_id || null,
    p_work_date: workDate,
    p_clock_in_at: row.clockInTime ? localDateTime(workDate, row.clockInTime) : null,
    p_clock_in_department_id: row.clockInDepartmentId || null,
    p_clock_out_at: row.clockOutTime ? localDateTime(workDate, row.clockOutTime) : null,
    p_clock_out_department_id: row.clockOutDepartmentId || null,
    p_attendance_note: row.attendanceNote || "",
    p_operator_user_id: profile.id
  });
  if (error) throw error;
  return { ok: true, record: data };
}

async function mealStats(ctx: any, body: any = {}) {
  const profile = await getProfile(ctx);
  requireManager(profile);
  const today = taipeiDateString();
  const fromDate = validDate(body?.fromDate, today);
  const toDate = validDate(body?.toDate, today);
  const departmentId = String(body?.departmentId || "");
  const memberId = String(body?.memberId || "");
  let query = ctx.supabaseAdmin.from("meal_orders").select("*").gte("order_date", fromDate).lte("order_date", toDate);
  if (departmentId) query = query.eq("department_id", departmentId);
  if (memberId) query = query.eq("user_id", memberId);
  const { data, error } = await query.order("order_date", { ascending: false });
  if (error) throw error;

  const byProductDate = new Map<string, any>();
  const totals = { quantity: 0, amount: 0 };
  const details = (data || []).map((row: any) => {
    const quantity = Number(row.quantity || 0);
    const amount = quantity * Number(row.unit_price || 0);
    totals.quantity += quantity;
    totals.amount += amount;
    const key = `${row.order_date}:${row.department_name_snapshot}:${row.product_name_snapshot}`;
    const summary = byProductDate.get(key) || {
      date: row.order_date,
      departmentName: row.department_name_snapshot,
      productName: row.product_name_snapshot,
      quantity: 0,
      amount: 0
    };
    summary.quantity += quantity;
    summary.amount += amount;
    byProductDate.set(key, summary);
    return {
      id: row.id,
      date: row.order_date,
      employeeName: row.employee_name_snapshot,
      departmentName: row.department_name_snapshot,
      productName: row.product_name_snapshot,
      quantity,
      unitPrice: Number(row.unit_price || 0),
      amount,
      note: row.note || "",
      submittedAt: row.submitted_at,
      clockDeletedWarning: false
    };
  });
  return {
    ok: true,
    fromDate,
    toDate,
    summary: Array.from(byProductDate.values()),
    details,
    totals
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await req.json();
      if (body?.action === "personal") return Response.json(await personalRecords(ctx, body));
      if (body?.action === "meal_stats") return Response.json(await mealStats(ctx, body));
      if (body?.action === "attendance_admin_list") return Response.json(await attendanceAdminList(ctx, body));
      if (body?.action === "attendance_admin_history") return Response.json(await attendanceHistory(ctx, body));
      if (body?.action === "attendance_admin_save") return Response.json(await attendanceAdminSave(ctx, body));
      return Response.json({ message: "不支援的報表操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: errorMessage(error, "讀取報表失敗") }, { status: 400 });
    }
  })
};
