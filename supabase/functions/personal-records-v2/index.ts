import { withSupabase } from "npm:@supabase/server@^1";

const PAGE_SIZE = 50;

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

function validDate(value: unknown, fallback: string) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function effective(profile: any, today = taipeiDate()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

function shiftMinutes(value: string) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function punchMinutes(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function currentMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function attendanceIssues(record: any, shift: any, workDate: string, today: string) {
  const output: string[] = [];
  const hasIn = Boolean(record?.clock_in_at);
  const hasOut = Boolean(record?.clock_out_at);
  if (!shift) {
    if (hasIn || hasOut) output.push("無排班但有打卡");
    return output;
  }
  const start = shiftMinutes(shift.start_time);
  const end = shiftMinutes(shift.end_time);
  if (start === null || end === null) return ["班別缺少完整上下班時間"];
  const inMinutes = hasIn ? punchMinutes(record.clock_in_at) : null;
  const outMinutes = hasOut ? punchMinutes(record.clock_out_at) : null;
  if ((hasIn && inMinutes === null) || (hasOut && outMinutes === null)) output.push("打卡時間不完整或格式異常");
  const past = workDate < today;
  const sameDay = workDate === today;
  const now = currentMinutes();
  if (!hasIn && (past || (sameDay && now >= start + 1))) output.push("未打上班");
  if (!hasOut && (past || (sameDay && now >= end + 1))) output.push("未打下班");
  if (inMinutes !== null && inMinutes >= start + 1) output.push("遲到");
  if (outMinutes !== null && outMinutes < end) output.push("早退");
  if (hasIn && hasOut && new Date(record.clock_in_at).getTime() > new Date(record.clock_out_at).getTime()) output.push("上班晚於下班");
  if (hasIn && record.clock_in_department_id && shift.applicable_department_id && record.clock_in_department_id !== shift.applicable_department_id) output.push("上班地點不符");
  if (hasOut && record.clock_out_department_id && shift.applicable_department_id && record.clock_out_department_id !== shift.applicable_department_id) output.push("下班地點不符");
  return output;
}

async function profile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,is_active,hire_date,leave_date").eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data)) throw new Error("此帳號目前不在有效期間");
  return result.data;
}

async function list(ctx: any, body: any) {
  const user = await profile(ctx);
  const today = taipeiDate();
  const toDate = validDate(body?.toDate, today);
  const fromDate = validDate(body?.fromDate, "2000-01-01");
  const page = pageNumber(body?.page);

  const [attendanceResult, overtimeResult, mealResult, scheduleResult, mealSettingResult] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", user.id).gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("attendance_overtime_requests").select("*").eq("user_id", user.id).eq("is_deleted_by_employee", false).gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", user.id).gte("order_date", fromDate).lte("order_date", toDate),
    ctx.supabaseAdmin.from("schedule_entries").select("work_date,shift_type_id").eq("member_id", user.id).gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("meal_settings").select("daily_cutoff_time").eq("id", "default").maybeSingle()
  ]);
  for (const result of [attendanceResult, overtimeResult, mealResult, scheduleResult, mealSettingResult]) if (result.error) throw result.error;

  const shiftIds = [...new Set((scheduleResult.data || []).map((row: any) => row.shift_type_id).filter(Boolean))];
  const shiftResult = shiftIds.length
    ? await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id").in("id", shiftIds)
    : { data: [], error: null };
  if (shiftResult.error) throw shiftResult.error;

  const attendance = new Map((attendanceResult.data || []).map((row: any) => [row.work_date, row]));
  const overtime = new Map((overtimeResult.data || []).map((row: any) => [row.work_date, row]));
  const schedules = new Map((scheduleResult.data || []).map((row: any) => [row.work_date, row]));
  const shifts = new Map((shiftResult.data || []).map((row: any) => [row.id, row]));
  const meals = new Map<string, any[]>();
  for (const row of mealResult.data || []) {
    const list = meals.get(row.order_date) || [];
    list.push(row);
    meals.set(row.order_date, list);
  }

  const dates = new Set<string>();
  for (const row of attendanceResult.data || []) dates.add(row.work_date);
  for (const row of overtimeResult.data || []) dates.add(row.work_date);
  for (const row of mealResult.data || []) dates.add(row.order_date);
  for (const row of scheduleResult.data || []) dates.add(row.work_date);

  const cutoff = String(mealSettingResult.data?.daily_cutoff_time || "10:30").slice(0, 5);
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const records = [...dates].sort((a, b) => b.localeCompare(a)).map((date) => {
    const attendanceRow: any = attendance.get(date) || null;
    const overtimeRow: any = overtime.get(date) || null;
    const schedule: any = schedules.get(date) || null;
    const shift: any = schedule?.shift_type_id ? shifts.get(schedule.shift_type_id) || null : null;
    const mealRows = meals.get(date) || [];
    return {
      date,
      shiftName: shift?.name || "",
      shiftTime: shift ? `${String(shift.start_time || "").slice(0, 5)}-${String(shift.end_time || "").slice(0, 5)}` : "",
      clockIn: attendanceRow?.clock_in_at || null,
      clockInDepartment: attendanceRow?.clock_in_department_name_snapshot || "",
      clockInSource: attendanceRow?.clock_in_source || "",
      clockOut: attendanceRow?.clock_out_at || null,
      clockOutDepartment: attendanceRow?.clock_out_department_name_snapshot || "",
      clockOutSource: attendanceRow?.clock_out_source || "",
      issues: attendanceIssues(attendanceRow, shift, date, today),
      attendanceNote: attendanceRow?.attendance_note || "",
      overtimeId: overtimeRow?.id || "",
      overtimeStatus: overtimeRow?.status || "",
      overtimeHours: Number(overtimeRow?.total_overtime_hours || 0),
      overtimeNote: overtimeRow?.employee_note || "",
      canDeleteOvertime: Boolean(overtimeRow && ["pending", "returned"].includes(overtimeRow.status) && today <= addDays(date, 5)),
      mealText: mealRows.map((row) => `${row.product_name_snapshot}×${row.quantity}`).join("、"),
      mealOrderId: mealRows[0]?.order_id || "",
      canCancelMeal: Boolean(mealRows.length && date === today && nowTime <= cutoff),
      mealClockDeletedWarning: Boolean(mealRows.length && !attendanceRow?.clock_in_at)
    };
  });

  const offset = (page - 1) * PAGE_SIZE;
  return { ok: true, records: records.slice(offset, offset + PAGE_SIZE), total: records.length, page, pageSize: PAGE_SIZE, fromDate, toDate };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      return Response.json(await list(ctx, await req.json()));
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "讀取個人記錄失敗" }, { status: 400 });
    }
  })
};
