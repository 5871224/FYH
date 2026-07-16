import { withSupabase } from "npm:@supabase/server@^1";

const PAGE_SIZE = 20;

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

function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

function effective(profile: any, today = dateText()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean((!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

async function requireAdmin(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,role,hire_date,leave_date").eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data) || result.data.role !== "admin") throw new Error("此功能限管理員使用");
}

async function listRequests(ctx: any, body: any) {
  await requireAdmin(ctx);
  const today = dateText();
  const fromDate = validDate(body?.fromDate, addDays(today, -30));
  const toDate = validDate(body?.toDate, today);
  const status = String(body?.status || "pending");
  const memberId = String(body?.memberId || "");
  const page = pageNumber(body?.page);

  let query = ctx.supabaseAdmin.from("attendance_overtime_requests").select("*")
    .eq("is_deleted_by_employee", false)
    .gte("work_date", fromDate).lte("work_date", toDate)
    .order("work_date", { ascending: false }).order("submitted_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);
  if (memberId) query = query.eq("user_id", memberId);
  const requestResult = await query;
  if (requestResult.error) throw requestResult.error;
  const rows = requestResult.data || [];
  const userIds = [...new Set(rows.map((row: any) => row.user_id).filter(Boolean))];
  const workDates = [...new Set(rows.map((row: any) => row.work_date).filter(Boolean))];

  const [employeeResult, attendanceResult, scheduleResult, memberResult] = await Promise.all([
    userIds.length ? ctx.supabaseAdmin.from("set_employee").select("id,employee_code,full_name,home_department_id").in("id", userIds) : { data: [], error: null },
    userIds.length && workDates.length ? ctx.supabaseAdmin.from("attendance_records").select("user_id,work_date,clock_in_at,clock_out_at").in("user_id", userIds).in("work_date", workDates) : { data: [], error: null },
    userIds.length && workDates.length ? ctx.supabaseAdmin.from("schedule_entries").select("member_id,work_date,shift_type_id").in("member_id", userIds).in("work_date", workDates) : { data: [], error: null },
    ctx.supabaseAdmin.from("set_employee").select("id,employee_code,full_name,home_department_id,hire_date,leave_date").order("employee_code", { ascending: true })
  ]);
  for (const item of [employeeResult, attendanceResult, scheduleResult, memberResult]) if (item.error) throw item.error;

  const shiftIds = [...new Set((scheduleResult.data || []).map((row: any) => row.shift_type_id).filter(Boolean))];
  const shiftResult = shiftIds.length
    ? await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time").in("id", shiftIds)
    : { data: [], error: null };
  if (shiftResult.error) throw shiftResult.error;

  const employees = new Map((employeeResult.data || []).map((row: any) => [row.id, row]));
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));
  const schedules = new Map((scheduleResult.data || []).map((row: any) => [`${row.member_id}:${row.work_date}`, row]));
  const shifts = new Map((shiftResult.data || []).map((row: any) => [row.id, row]));
  const enriched = rows.map((row: any) => {
    const key = `${row.user_id}:${row.work_date}`;
    const schedule = schedules.get(key);
    return {
      ...row,
      employee: employees.get(row.user_id) || null,
      attendance: attendance.get(key) || null,
      shift: schedule?.shift_type_id ? shifts.get(schedule.shift_type_id) || null : null
    };
  });
  const offset = (page - 1) * PAGE_SIZE;
  return {
    ok: true,
    requests: enriched.slice(offset, offset + PAGE_SIZE),
    total: enriched.length,
    page,
    pageSize: PAGE_SIZE,
    members: (memberResult.data || []).filter((row: any) => effective(row, today))
  };
}

async function exportApprovedRequests(ctx: any, body: any) {
  await requireAdmin(ctx);
  const today = dateText();
  const fromDate = validDate(body?.fromDate, addDays(today, -30));
  const toDate = validDate(body?.toDate, today);
  if (fromDate > toDate) throw new Error("開始日期必須早於或等於結束日期");

  const requestResult = await ctx.supabaseAdmin.from("attendance_overtime_requests")
    .select("user_id,work_date,total_overtime_hours")
    .eq("is_deleted_by_employee", false)
    .eq("status", "approved")
    .gte("work_date", fromDate).lte("work_date", toDate)
    .order("work_date", { ascending: true });
  if (requestResult.error) throw requestResult.error;

  const requests = requestResult.data || [];
  const userIds = [...new Set(requests.map((row: any) => row.user_id).filter(Boolean))];
  const employeeResult = userIds.length
    ? await ctx.supabaseAdmin.from("set_employee").select("id,employee_code").in("id", userIds)
    : { data: [], error: null };
  if (employeeResult.error) throw employeeResult.error;
  const employeeCodes = new Map((employeeResult.data || []).map((row: any) => [row.id, row.employee_code || ""]));
  const rows = requests.map((row: any) => ({
    employee_code: employeeCodes.get(row.user_id) || "",
    work_date: row.work_date,
    total_overtime_hours: Number(row.total_overtime_hours || 0)
  })).sort((left: any, right: any) => (
    left.employee_code.localeCompare(right.employee_code) || left.work_date.localeCompare(right.work_date)
  ));

  return { ok: true, rows };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      return Response.json(body?.action === "export_approved"
        ? await exportApprovedRequests(ctx, body)
        : await listRequests(ctx, body));
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "讀取加班審核失敗" }, { status: 400 });
    }
  })
};
