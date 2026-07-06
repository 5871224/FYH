import { withSupabase } from "npm:@supabase/server@^1";

const PAGE_SIZE = 50;

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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

function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

function shiftMinutes(value: string) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

function punchMinutes(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
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

function nowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

async function requireAdmin(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,role,is_active,hire_date,leave_date").eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data) || result.data.role !== "admin") throw new Error("此功能限管理員使用");
}

function issues(record: any, shift: any, today: string) {
  const output: string[] = [];
  const hasIn = Boolean(record?.clock_in_at);
  const hasOut = Boolean(record?.clock_out_at);
  if (!shift) {
    if (hasIn || hasOut) output.push("無排班但有打卡");
    return output;
  }

  const start = shiftMinutes(shift.start_time);
  const end = shiftMinutes(shift.end_time);
  if (start === null || end === null) {
    output.push("班別缺少完整上下班時間");
    return output;
  }

  const inMinutes = hasIn ? punchMinutes(record.clock_in_at) : null;
  const outMinutes = hasOut ? punchMinutes(record.clock_out_at) : null;
  if ((hasIn && inMinutes === null) || (hasOut && outMinutes === null)) {
    output.push("打卡時間不完整或格式異常");
  }

  const pastDate = record.work_date < today;
  const currentDate = record.work_date === today;
  const currentMinutes = nowMinutes();
  if (!hasIn && (pastDate || (currentDate && currentMinutes >= start + 1))) output.push("未打上班");
  if (!hasOut && (pastDate || (currentDate && currentMinutes >= end + 1))) output.push("未打下班");
  if (inMinutes !== null && inMinutes >= start + 1) output.push("遲到");
  if (outMinutes !== null && outMinutes < end) output.push("早退");
  if (hasIn && hasOut) {
    const inTime = new Date(record.clock_in_at).getTime();
    const outTime = new Date(record.clock_out_at).getTime();
    if (Number.isFinite(inTime) && Number.isFinite(outTime) && inTime > outTime) output.push("上班晚於下班");
  }
  if (hasIn && record.clock_in_department_id && shift.applicable_department_id && record.clock_in_department_id !== shift.applicable_department_id) {
    output.push("上班地點不符");
  }
  if (hasOut && record.clock_out_department_id && shift.applicable_department_id && record.clock_out_department_id !== shift.applicable_department_id) {
    output.push("下班地點不符");
  }
  return output;
}

async function list(ctx: any, body: any) {
  await requireAdmin(ctx);
  const today = taipeiDate();
  const fromDate = validDate(body?.fromDate, today);
  const toDate = validDate(body?.toDate, today);
  const memberId = String(body?.memberId || "");
  const abnormalOnly = body?.abnormalOnly !== false;
  const issueType = String(body?.issueType || "");
  const page = pageNumber(body?.page);

  const [memberResult, attendanceResult, scheduleResult] = await Promise.all([
    ctx.supabaseAdmin.from("set_employee").select("id,employee_code,full_name,role,hire_date,leave_date,is_active").order("employee_code", { ascending: true }),
    ctx.supabaseAdmin.from("attendance_records").select("*").gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("schedule_entries").select("member_id,work_date,shift_type_id").gte("work_date", fromDate).lte("work_date", toDate)
  ]);
  for (const result of [memberResult, attendanceResult, scheduleResult]) if (result.error) throw result.error;

  const shiftIds = [...new Set((scheduleResult.data || []).map((row: any) => row.shift_type_id).filter(Boolean))];
  const shiftResult = shiftIds.length
    ? await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id").in("id", shiftIds)
    : { data: [], error: null };
  if (shiftResult.error) throw shiftResult.error;

  const members = memberResult.data || [];
  const shifts = new Map((shiftResult.data || []).map((row: any) => [row.id, row]));
  const schedules = new Map((scheduleResult.data || []).map((row: any) => [`${row.member_id}:${row.work_date}`, { ...row, shift: shifts.get(row.shift_type_id) || null }]));
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));
  const rows: any[] = [];

  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    for (const member of members) {
      if (memberId && member.id !== memberId) continue;
      const key = `${member.id}:${date}`;
      const current = attendance.get(key) || {
        id: "",
        user_id: member.id,
        work_date: date,
        employee_code_snapshot: member.employee_code,
        employee_name_snapshot: member.full_name
      };
      const schedule = schedules.get(key) || null;
      const currentIssues = issues(current, schedule?.shift || null, today);
      if (abnormalOnly && !currentIssues.length) continue;
      if (issueType && !currentIssues.includes(issueType)) continue;
      rows.push({
        ...current,
        employee_code_snapshot: current.employee_code_snapshot || member.employee_code || "",
        employee_name_snapshot: current.employee_name_snapshot || member.full_name || "",
        shift_name: schedule?.shift?.name || "",
        shift_start_time: schedule?.shift?.start_time || "",
        shift_end_time: schedule?.shift?.end_time || "",
        shift_department_id: schedule?.shift?.applicable_department_id || "",
        issues: currentIssues
      });
    }
  }

  rows.sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || String(a.employee_code_snapshot).localeCompare(String(b.employee_code_snapshot)));
  const offset = (page - 1) * PAGE_SIZE;
  return {
    ok: true,
    members,
    issueTypes: ["未打上班", "未打下班", "無排班但有打卡", "遲到", "早退", "上班晚於下班", "打卡時間不完整或格式異常", "上班地點不符", "下班地點不符", "班別缺少完整上下班時間"],
    rows: rows.slice(offset, offset + PAGE_SIZE),
    total: rows.length,
    page,
    pageSize: PAGE_SIZE
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      return Response.json(await list(ctx, await req.json()));
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "讀取打卡管理失敗" }, { status: 400 });
    }
  })
};
