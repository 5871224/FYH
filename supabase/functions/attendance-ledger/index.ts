import { withSupabase } from "npm:@supabase/server@^1";
import { addDaysToDateString as addDays, datesBetween, isProfileEffective as effective, isProfileEmployedOn as employedOn, pageNumber, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";

const PAGE_SIZE = 50;







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
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
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

function locationValue(location: any, key: string) {
  return location && typeof location === "object" ? String(location[key] || "") : "";
}

function attendanceIssues(record: any, shift: any, workDate: string, today = taipeiDate()) {
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
  const now = nowMinutes();
  if (!hasIn && (past || (sameDay && now >= start + 1))) output.push("未打上班");
  if (!hasOut && (past || (sameDay && now >= end + 1))) output.push("未打下班");
  if (inMinutes !== null && inMinutes >= start + 6) output.push("遲到");
  if (outMinutes !== null && outMinutes < end - 30) output.push("早退");
  if (hasIn && hasOut && new Date(record.clock_in_at).getTime() > new Date(record.clock_out_at).getTime()) output.push("上班晚於下班");
  const inDepartment = locationValue(record?.clock_in_location, "departmentId");
  const outDepartment = locationValue(record?.clock_out_location, "departmentId");
  if (hasIn && inDepartment && shift.applicable_department_id && inDepartment !== shift.applicable_department_id) output.push("上班地點不符");
  if (hasOut && outDepartment && shift.applicable_department_id && outDepartment !== shift.applicable_department_id) output.push("下班地點不符");
  return output;
}

function catalogSegment(category: string, item: any) {
  if (!item) return null;
  return {
    category,
    itemId: item.id || "",
    code: item.code || "",
    name: item.name || (category === "overtime" ? "加班" : ""),
    color: item.color || (category === "overtime" ? "#D85A30" : "#888780"),
    textColor: item.text_color || "",
    autoTextColor: item.auto_text_color !== false
  };
}

function hoursToMinutes(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || Math.round(hours * 2) !== hours * 2) {
    throw new Error("工時必須以 0.5 小時為單位");
  }
  const minutes = Math.round(hours * 60);
  if (minutes > 32760) throw new Error("工時超過可輸入範圍");
  return minutes;
}

function minutesToHours(value: unknown) {
  return value === null || value === undefined ? null : Number(value) / 60;
}

function rowKey(userId: string, workDate: string) {
  return `${userId}:${workDate}`;
}

async function getActor(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,hire_date,leave_date,deleted_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();
  if (result.error) throw result.error;
  if (!effective(result.data)) throw new Error("此帳號目前不在有效期間");
  return result.data;
}

async function fetchScheduleContext(ctx: any, fromDate: string, toDate: string, memberIds?: string[]) {
  let scheduleQuery = ctx.supabaseAdmin.from("schedule_entries")
    .select("member_id,work_date,shift_type_id,leave_type_id,overtime_type_id")
    .gte("work_date", fromDate).lte("work_date", toDate);
  if (memberIds?.length) scheduleQuery = scheduleQuery.in("member_id", memberIds);
  const scheduleResult = await scheduleQuery;
  if (scheduleResult.error) throw scheduleResult.error;
  const scheduleRows = scheduleResult.data || [];
  const shiftIds = [...new Set(scheduleRows.map((row: any) => row.shift_type_id).filter(Boolean))];
  const leaveIds = [...new Set(scheduleRows.map((row: any) => row.leave_type_id).filter(Boolean))];
  const overtimeIds = [...new Set(scheduleRows.map((row: any) => row.overtime_type_id).filter(Boolean))];
  const [shiftResult, leaveResult, overtimeResult] = await Promise.all([
    shiftIds.length
      ? ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id,color,text_color,auto_text_color").in("id", shiftIds)
      : Promise.resolve({ data: [], error: null }),
    leaveIds.length
      ? ctx.supabaseAdmin.from("set_leave").select("id,code,name,color,text_color,auto_text_color").in("id", leaveIds)
      : Promise.resolve({ data: [], error: null }),
    overtimeIds.length
      ? ctx.supabaseAdmin.from("set_overtime").select("id,name,color,text_color,auto_text_color").in("id", overtimeIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  for (const result of [shiftResult, leaveResult, overtimeResult]) if (result.error) throw result.error;
  return {
    schedules: new Map(scheduleRows.map((row: any) => [rowKey(row.member_id, row.work_date), row])),
    shifts: new Map((shiftResult.data || []).map((row: any) => [row.id, row])),
    leaves: new Map((leaveResult.data || []).map((row: any) => [row.id, row])),
    overtimeTypes: new Map((overtimeResult.data || []).map((row: any) => [row.id, row]))
  };
}

function scheduleDisplay(context: any, userId: string, date: string) {
  const schedule: any = context.schedules.get(rowKey(userId, date)) || null;
  const shift: any = schedule?.shift_type_id ? context.shifts.get(schedule.shift_type_id) || null : null;
  const leave: any = schedule?.leave_type_id ? context.leaves.get(schedule.leave_type_id) || null : null;
  const overtimeType: any = schedule?.overtime_type_id ? context.overtimeTypes.get(schedule.overtime_type_id) || null : null;
  return {
    shift,
    shiftName: shift?.name || "",
    shiftTime: shift ? `${String(shift.start_time || "").slice(0, 5)}-${String(shift.end_time || "").slice(0, 5)}` : "",
    scheduleSegments: [catalogSegment("shift", shift), catalogSegment("leave", leave), catalogSegment("overtime", overtimeType)].filter(Boolean)
  };
}

function normalizeCommonNotes(value: unknown) {
  return [...new Set(String(value || "").split(/\r?\n/).map((note) => note.trim()).filter(Boolean))];
}

async function getCommonNotes(ctx: any) {
  const result = await ctx.supabaseAdmin.from("scheduler_settings")
    .select("attendance_common_notes").eq("id", "default").maybeSingle();
  if (result.error) throw result.error;
  return normalizeCommonNotes(result.data?.attendance_common_notes);
}

async function personalList(ctx: any, body: any, actor: any) {
  const today = taipeiDate();
  const toDate = validDate(body?.toDate, today);
  const fromDate = validDate(body?.fromDate, addDays(today, -49));
  const page = pageNumber(body?.page);
  const sortDirection = body?.sortDirection === "asc" ? "asc" : "desc";
  const commonNotes = await getCommonNotes(ctx);
  const [attendanceResult, mealResult, scheduleContext, mealSettingResult] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_days").select("*").eq("user_id", actor.id).gte("work_date", fromDate).lte("work_date", toDate),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", actor.id).gte("order_date", fromDate).lte("order_date", toDate),
    fetchScheduleContext(ctx, fromDate, toDate, [actor.id]),
    ctx.supabaseAdmin.from("meal_settings").select("daily_cutoff_time").eq("id", "default").maybeSingle()
  ]);
  for (const result of [attendanceResult, mealResult, mealSettingResult]) if (result.error) throw result.error;
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [row.work_date, row]));
  const meals = new Map<string, any[]>();
  for (const row of mealResult.data || []) {
    const group = meals.get(row.order_date) || [];
    group.push(row);
    meals.set(row.order_date, group);
  }
  const cutoff = String(mealSettingResult.data?.daily_cutoff_time || "10:30").slice(0, 5);
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const records = datesBetween(fromDate, toDate)
    .filter((date) => employedOn(actor, date))
    .sort((a, b) => sortDirection === "asc" ? a.localeCompare(b) : b.localeCompare(a))
    .map((date) => {
      const row: any = attendance.get(date) || null;
      const schedule = scheduleDisplay(scheduleContext, actor.id, date);
      const mealRows = meals.get(date) || [];
      return {
        id: row?.id || "",
        date,
        ...schedule,
        clockIn: row?.clock_in_at || null,
        clockInLocation: row?.clock_in_location || null,
        clockOut: row?.clock_out_at || null,
        clockOutLocation: row?.clock_out_location || null,
        regularHours: minutesToHours(row?.regular_minutes),
        overtimeHours: minutesToHours(row?.overtime_minutes),
        note: row?.note || "",
        reviewed: Boolean(row?.reviewed_at),
        reviewedAt: row?.reviewed_at || null,
        issues: attendanceIssues(row || { work_date: date }, schedule.shift, date, today),
        editable: !row?.reviewed_at,
        mealText: mealRows.map((meal) => `${meal.product_name_snapshot}×${meal.quantity}`).join("、"),
        mealOrderId: mealRows[0]?.order_id || "",
        canCancelMeal: Boolean(mealRows.length && date === today && nowTime <= cutoff),
        mealClockDeletedWarning: Boolean(mealRows.length && !row?.clock_in_at)
      };
    });
  const offset = (page - 1) * PAGE_SIZE;
  return { ok: true, records: records.slice(offset, offset + PAGE_SIZE), commonNotes, total: records.length, page, pageSize: PAGE_SIZE, fromDate, toDate, serverDate: today };
}

async function getOrCreateDay(ctx: any, userId: string, workDate: string) {
  const current = await ctx.supabaseAdmin.from("attendance_days").select("*")
    .eq("user_id", userId).eq("work_date", workDate).maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return current.data;
  const inserted = await ctx.supabaseAdmin.from("attendance_days")
    .insert({ user_id: userId, work_date: workDate }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function writeAudit(ctx: any, rowId: string, action: string, actorId: string, beforeData: any, afterData: any, reason = "") {
  const result = await ctx.supabaseAdmin.from("attendance_audit_logs").insert({
    attendance_day_id: rowId,
    action,
    changed_by: actorId,
    before_data: beforeData,
    after_data: afterData,
    reason: String(reason || "")
  });
  if (result.error) throw result.error;
}

async function personalSave(ctx: any, body: any, actor: any) {
  const workDate = validDate(body?.workDate, "");
  if (!workDate || !employedOn(actor, workDate)) throw new Error("只能修改任職期間的簽到資料");
  const field = String(body?.field || "");
  if (!["regularHours", "overtimeHours", "note"].includes(field)) throw new Error("不支援的簽到欄位");
  const old = await getOrCreateDay(ctx, actor.id, workDate);
  if (old.reviewed_at) throw new Error("此日簽到紀錄已審，無法修改");
  const update: any = {};
  if (field === "regularHours") update.regular_minutes = hoursToMinutes(body?.value);
  if (field === "overtimeHours") update.overtime_minutes = hoursToMinutes(body?.value);
  if (field === "note") update.note = String(body?.value || "");
  const result = await ctx.supabaseAdmin.from("attendance_days").update(update).eq("id", old.id).select("*").single();
  if (result.error) throw result.error;
  await writeAudit(ctx, old.id, `employee_${field}`, actor.id, old, result.data);
  return { ok: true, record: result.data };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      const actor = await getActor(ctx);
      if (body?.action === "personal_list") return Response.json(await personalList(ctx, body, actor));
      if (body?.action === "personal_save") return Response.json(await personalSave(ctx, body, actor));
      return Response.json({ message: "不支援的簽到簿操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "簽到簿操作失敗" }, { status: 400 });
    }
  })
};
