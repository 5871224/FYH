import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, addDaysToDateString as addDays, datesBetween, hasPermission, isProfileEffective as effective, isProfileEmployedOn as employedOn, pageNumber, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";

const PAGE_SIZE = 50;
const ISSUE_TYPES = [
  "未打上班", "未打下班", "無排班但有打卡", "遲到", "早退",
  "上班晚於下班", "上班地點不符", "下班地點不符"
];








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
    timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function nowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false
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
  const past = workDate < today;
  const sameDay = workDate === today;
  const now = nowMinutes();
  if (!hasIn && (past || (sameDay && now >= start + 1))) output.push("未打上班");
  if (!hasOut && (past || (sameDay && now >= end + 1))) output.push("未打下班");
  if (inMinutes !== null && inMinutes >= start + 1) output.push("遲到");
  if (outMinutes !== null && outMinutes < end) output.push("早退");
  if (hasIn && hasOut && new Date(record.clock_in_at).getTime() > new Date(record.clock_out_at).getTime()) output.push("上班晚於下班");
  const inDepartment = locationValue(record?.clock_in_location, "departmentId");
  const outDepartment = locationValue(record?.clock_out_location, "departmentId");
  if (hasIn && inDepartment && shift.applicable_department_id && inDepartment !== shift.applicable_department_id) output.push("上班地點不符");
  if (hasOut && outDepartment && shift.applicable_department_id && outDepartment !== shift.applicable_department_id) output.push("下班地點不符");
  return output;
}

function hoursToMinutes(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || Math.round(hours * 2) !== hours * 2) {
    throw new Error("工時必須以 0.5 小時為單位");
  }
  return Math.round(hours * 60);
}

function minutesToHours(value: unknown) {
  return value === null || value === undefined ? null : Number(value) / 60;
}

function timeToIso(workDate: string, value: unknown) {
  const time = String(value || "").trim();
  if (!time) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("打卡時間格式錯誤");
  return new Date(`${workDate}T${time}:00+08:00`).toISOString();
}

function rowKey(userId: string, workDate: string) {
  return `${userId}:${workDate}`;
}

function catalogSegment(category: string, item: any) {
  if (!item) return null;
  return {
    category, itemId: item.id || "", code: item.code || "",
    name: item.name || (category === "overtime" ? "加班" : ""),
    color: item.color || (category === "overtime" ? "#D85A30" : "#888780"),
    textColor: item.text_color || "", autoTextColor: item.auto_text_color !== false
  };
}

function normalizeCommonNotes(value: unknown) {
  const source = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return [...new Set(source.map((note) => String(note || "").trim()).filter(Boolean))];
}

async function getCommonNotes(ctx: any) {
  const result = await ctx.supabaseAdmin.from("scheduler_settings")
    .select("attendance_common_notes").eq("id", "default").maybeSingle();
  if (result.error) throw result.error;
  return normalizeCommonNotes(result.data?.attendance_common_notes);
}

async function saveCommonNotes(ctx: any, body: any) {
  const notes = normalizeCommonNotes(body?.notes);
  const result = await ctx.supabaseAdmin.from("scheduler_settings")
    .update({ attendance_common_notes: notes.join("\n"), updated_at: new Date().toISOString() })
    .eq("id", "default");
  if (result.error) throw result.error;
  return { ok: true, commonNotes: notes };
}

async function getActor(ctx: any) {
  const userId = actorIdOf(ctx);
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,group_id,access_role_id,hire_date,leave_date,deleted_at")
    .eq("id", userId).is("deleted_at", null).single();
  if (result.error) throw result.error;
  if (!effective(result.data)) throw new Error("此帳號目前不在有效期間");
  if (!await hasPermission(ctx, userId, "attendance_review")) throw new Error("沒有簽到審核權限");
  return result.data;
}

async function applicableGroupIds(ctx: any, actor: any) {
  const result = await ctx.supabaseAdmin.from("access_role_groups")
    .select("group_id").eq("role_id", actor.access_role_id);
  if (result.error) throw result.error;
  return (result.data || []).map((row: any) => row.group_id).filter(Boolean);
}

async function resolveGroupScope(ctx: any, actor: any, requestedGroupId: string) {
  const ids = await applicableGroupIds(ctx, actor);
  if (requestedGroupId) {
    if (!ids.includes(requestedGroupId)) throw new Error("此角色不可查看該群組");
    return [requestedGroupId];
  }
  return ids;
}

async function fetchScheduleContext(ctx: any, fromDate: string, toDate: string, memberIds: string[]) {
  if (!memberIds.length) return { schedules: new Map(), shifts: new Map(), leaves: new Map(), overtimeTypes: new Map() };
  const scheduleResult = await ctx.supabaseAdmin.from("schedule_entries")
    .select("member_id,work_date,shift_type_id,leave_type_id,overtime_type_id,support_department_id,group_id")
    .in("member_id", memberIds).gte("work_date", fromDate).lte("work_date", toDate);
  if (scheduleResult.error) throw scheduleResult.error;
  const rows = scheduleResult.data || [];
  const shiftIds = [...new Set(rows.map((row: any) => row.shift_type_id).filter(Boolean))];
  const leaveIds = [...new Set(rows.map((row: any) => row.leave_type_id).filter(Boolean))];
  const overtimeIds = [...new Set(rows.map((row: any) => row.overtime_type_id).filter(Boolean))];
  const [shiftResult, leaveResult, overtimeResult] = await Promise.all([
    shiftIds.length ? ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id,color,text_color,auto_text_color").in("id", shiftIds) : Promise.resolve({ data: [], error: null }),
    leaveIds.length ? ctx.supabaseAdmin.from("set_leave").select("id,code,name,color,text_color,auto_text_color").in("id", leaveIds) : Promise.resolve({ data: [], error: null }),
    overtimeIds.length ? ctx.supabaseAdmin.from("set_overtime").select("id,name,color,text_color,auto_text_color").in("id", overtimeIds) : Promise.resolve({ data: [], error: null })
  ]);
  for (const result of [shiftResult, leaveResult, overtimeResult]) if (result.error) throw result.error;
  return {
    schedules: new Map(rows.map((row: any) => [rowKey(row.member_id, row.work_date), row])),
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
    schedule, shift,
    shiftName: shift?.name || "",
    shiftTime: shift ? `${String(shift.start_time || "").slice(0, 5)}-${String(shift.end_time || "").slice(0, 5)}` : "",
    scheduleSegments: [catalogSegment("shift", shift), catalogSegment("leave", leave), catalogSegment("overtime", overtimeType)].filter(Boolean)
  };
}

async function getOrCreateDay(ctx: any, userId: string, workDate: string) {
  const current = await ctx.supabaseAdmin.from("attendance_days").select("*")
    .eq("user_id", userId).eq("work_date", workDate).maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return current.data;
  const memberResult = await ctx.supabaseAdmin.from("set_employee")
    .select("group_id,home_department_id").eq("id", userId).single();
  if (memberResult.error) throw memberResult.error;
  const [groupResult, departmentResult] = await Promise.all([
    memberResult.data.group_id ? ctx.supabaseAdmin.from("schedule_groups").select("name").eq("id", memberResult.data.group_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    memberResult.data.home_department_id ? ctx.supabaseAdmin.from("set_departments").select("name").eq("id", memberResult.data.home_department_id).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  if (groupResult.error) throw groupResult.error;
  if (departmentResult.error) throw departmentResult.error;
  const inserted = await ctx.supabaseAdmin.from("attendance_days").insert({
    user_id: userId, work_date: workDate, group_id: memberResult.data.group_id,
    group_name_snapshot: groupResult.data?.name || "",
    department_name_snapshot: departmentResult.data?.name || ""
  }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function writeAudit(ctx: any, rowId: string, action: string, actorId: string, beforeData: any, afterData: any, reason = "") {
  const result = await ctx.supabaseAdmin.from("attendance_audit_logs").insert({
    attendance_day_id: rowId, action, changed_by: actorId,
    before_data: beforeData, after_data: afterData, reason: String(reason || "")
  });
  if (result.error) throw result.error;
}

async function ensureTargetAllowed(ctx: any, actor: any, userId: string) {
  const target = await ctx.supabaseAdmin.from("set_employee")
    .select("id,group_id,home_department_id,deleted_at").eq("id", userId).is("deleted_at", null).maybeSingle();
  if (target.error) throw target.error;
  if (!target.data) throw new Error("找不到人員");
  const allowed = await ctx.supabaseAdmin.rpc("can_access_group", {
    p_user_id: actor.id, p_group_id: target.data.group_id, p_permission: "attendance_review"
  });
  if (allowed.error) throw allowed.error;
  if (!allowed.data) throw new Error("此角色不可審核該群組");
  return target.data;
}

async function buildReviewRows(ctx: any, body: any, actor: any, exportOnly = false) {
  const today = taipeiDate();
  const fromDate = validDate(body?.fromDate, addDays(today, -30));
  const toDate = validDate(body?.toDate, today);
  const requestedGroupId = String(body?.groupId || "");
  const groupIds = await resolveGroupScope(ctx, actor, requestedGroupId);
  const memberId = String(body?.memberId || "");
  const status = exportOnly ? "reviewed" : String(body?.status || "unreviewed");
  const issueType = String(body?.issueType || "");
  const page = pageNumber(body?.page);
  const commonNotes = await getCommonNotes(ctx);
  if (!groupIds.length) return { ok: true, members: [], departments: [], issueTypes: ISSUE_TYPES, commonNotes, rows: [], total: 0, page, pageSize: PAGE_SIZE };

  const [memberResult, groupResult, departmentResult] = await Promise.all([
    ctx.supabaseAdmin.from("set_employee")
      .select("id,employee_code,full_name,group_id,home_department_id,hire_date,leave_date,deleted_at")
      .in("group_id", groupIds).is("deleted_at", null).order("employee_code", { ascending: true }),
    ctx.supabaseAdmin.from("schedule_groups").select("id,name").in("id", groupIds),
    ctx.supabaseAdmin.from("set_departments").select("id,name,address,group_id,attendance_enabled,deleted_at").in("group_id", groupIds).is("deleted_at", null)
  ]);
  for (const result of [memberResult, groupResult, departmentResult]) if (result.error) throw result.error;
  const members = memberResult.data || [];
  const memberIds = members.map((member: any) => member.id);
  const [attendanceResult, scheduleContext] = await Promise.all([
    memberIds.length ? ctx.supabaseAdmin.from("attendance_days").select("*").in("user_id", memberIds).gte("work_date", fromDate).lte("work_date", toDate) : Promise.resolve({ data: [], error: null }),
    fetchScheduleContext(ctx, fromDate, toDate, memberIds)
  ]);
  if (attendanceResult.error) throw attendanceResult.error;
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [rowKey(row.user_id, row.work_date), row]));
  const groupNames = new Map((groupResult.data || []).map((row: any) => [row.id, row.name]));
  const departmentNames = new Map((departmentResult.data || []).map((row: any) => [row.id, row.name]));
  const rows: any[] = [];

  for (const date of datesBetween(fromDate, toDate)) {
    for (const member of members) {
      if (memberId && member.id !== memberId) continue;
      if (!employedOn(member, date)) continue;
      const current: any = attendance.get(rowKey(member.id, date)) || null;
      const reviewed = Boolean(current?.reviewed_at);
      if (status === "reviewed" && !reviewed) continue;
      if (status === "unreviewed" && reviewed) continue;
      const schedule = scheduleDisplay(scheduleContext, member.id, date);
      const currentIssues = attendanceIssues(current || { work_date: date }, schedule.shift, date, today);
      if (issueType && issueType !== "__all__" && !currentIssues.includes(issueType)) continue;
      const departmentId = schedule.schedule?.support_department_id || member.home_department_id || "";
      rows.push({
        id: current?.id || "", user_id: member.id, work_date: date,
        employee_code: member.employee_code || "", employee_name: member.full_name || "",
        groupId: member.group_id || current?.group_id || "",
        groupName: current?.group_name_snapshot || groupNames.get(member.group_id) || "",
        departmentId,
        departmentName: current?.department_name_snapshot || departmentNames.get(departmentId) || "",
        ...schedule,
        clock_in_at: current?.clock_in_at || null, clock_in_location: current?.clock_in_location || null,
        clock_out_at: current?.clock_out_at || null, clock_out_location: current?.clock_out_location || null,
        regularHours: minutesToHours(current?.regular_minutes), overtimeHours: minutesToHours(current?.overtime_minutes),
        note: current?.note || "", reviewed, reviewedAt: current?.reviewed_at || null, issues: currentIssues
      });
    }
  }
  rows.sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || String(a.employee_code).localeCompare(String(b.employee_code)));
  const offset = exportOnly ? 0 : (page - 1) * PAGE_SIZE;
  return {
    ok: true,
    members: members.map((member: any) => ({ id: member.id, employee_code: member.employee_code, full_name: member.full_name, group_id: member.group_id })),
    departments: (departmentResult.data || [])
      .map((department: any) => ({ id: department.id, name: department.name || "", group_id: department.group_id })),
    issueTypes: ISSUE_TYPES,
    commonNotes,
    rows: exportOnly ? rows : rows.slice(offset, offset + PAGE_SIZE),
    total: rows.length, page, pageSize: exportOnly ? rows.length : PAGE_SIZE
  };
}

async function resolveAdminClockLocation(ctx: any, target: any, departmentIdValue: unknown, oldLocation: any, clockAt: string | null) {
  if (!clockAt) return null;
  const departmentId = String(departmentIdValue || "").trim();
  if (!departmentId) return oldLocation || { name: "管理員補登", source: "管理員補登" };
  if (String(oldLocation?.departmentId || "") === departmentId) return oldLocation;
  const result = await ctx.supabaseAdmin.from("set_departments")
    .select("id,name,address,group_id,deleted_at")
    .eq("id", departmentId).is("deleted_at", null).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("找不到指定的打卡地點");
  if (String(result.data.group_id || "") !== String(target.group_id || "")) throw new Error("打卡地點不屬於該人員群組");
  return {
    departmentId: result.data.id,
    name: result.data.name || "",
    address: result.data.address || "",
    source: "管理員修改",
    accuracy: null,
    distance: null
  };
}

async function reviewSave(ctx: any, body: any, actor: any) {
  const userId = String(body?.userId || "");
  const workDate = validDate(body?.workDate, "");
  if (!userId || !workDate) throw new Error("缺少人員或日期");
  const target = await ensureTargetAllowed(ctx, actor, userId);
  const old = await getOrCreateDay(ctx, userId, workDate);
  const clockInAt = timeToIso(workDate, body?.clockInTime);
  const clockOutAt = timeToIso(workDate, body?.clockOutTime);
  const update: any = {
    clock_in_at: clockInAt, clock_out_at: clockOutAt,
    regular_minutes: hoursToMinutes(body?.regularHours),
    overtime_minutes: hoursToMinutes(body?.overtimeHours),
    note: String(body?.note || ""), reviewed_at: null, reviewed_by: null
  };
  [update.clock_in_location, update.clock_out_location] = await Promise.all([
    resolveAdminClockLocation(ctx, target, body?.clockInLocationDepartmentId, old.clock_in_location, clockInAt),
    resolveAdminClockLocation(ctx, target, body?.clockOutLocationDepartmentId, old.clock_out_location, clockOutAt)
  ]);
  const result = await ctx.supabaseAdmin.from("attendance_days").update(update).eq("id", old.id).select("*").single();
  if (result.error) throw result.error;
  await writeAudit(ctx, old.id, "admin_edit", actor.id, old, result.data, body?.reason);
  return { ok: true, record: result.data };
}

function parseReviewToken(token: unknown) {
  const [userId, workDate] = String(token || "").split(":");
  return { userId, workDate };
}

async function reviewSet(ctx: any, body: any, actor: any) {
  const reviewed = Boolean(body?.reviewed);
  const rawTokens = Array.isArray(body?.tokens) ? body.tokens : [body?.token];
  const targets: Array<{ userId: string; workDate: string; key: string }> = [];
  const seen = new Set<string>();
  for (const token of rawTokens.filter(Boolean)) {
    const { userId, workDate } = parseReviewToken(token);
    if (!userId || !validDate(workDate, "")) continue;
    const key = rowKey(userId, workDate);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ userId, workDate, key });
  }
  if (!targets.length) {
    return { ok: true, changed: 0, reviewed, reviewedAt: null, records: [] };
  }

  const userIds = [...new Set(targets.map((target) => target.userId))];
  const workDates = [...new Set(targets.map((target) => target.workDate))];
  const [allowedGroupIds, targetResult] = await Promise.all([
    applicableGroupIds(ctx, actor),
    ctx.supabaseAdmin.from("set_employee")
      .select("id,group_id,home_department_id,deleted_at")
      .in("id", userIds).is("deleted_at", null)
  ]);
  if (targetResult.error) throw targetResult.error;
  const allowedGroups = new Set<string>(allowedGroupIds.map(String));
  const targetMembers = new Map<string, any>((targetResult.data || []).map((row: any) => [String(row.id), row]));
  for (const userId of userIds) {
    const member = targetMembers.get(userId);
    if (!member) throw new Error("找不到人員");
    if (!allowedGroups.has(String(member.group_id || ""))) throw new Error("此角色不可審核該群組");
  }

  const attendanceResult = await ctx.supabaseAdmin.from("attendance_days")
    .select("*").in("user_id", userIds).in("work_date", workDates);
  if (attendanceResult.error) throw attendanceResult.error;
  const dayByKey = new Map<string, any>((attendanceResult.data || [])
    .map((row: any) => [rowKey(row.user_id, row.work_date), row]));
  const missingTargets = targets.filter((target) => !dayByKey.has(target.key));

  if (missingTargets.length) {
    const groupIds = [...new Set<string>(missingTargets
      .map((target) => String(targetMembers.get(target.userId)?.group_id || ""))
      .filter(Boolean))];
    const departmentIds = [...new Set<string>(missingTargets
      .map((target) => String(targetMembers.get(target.userId)?.home_department_id || ""))
      .filter(Boolean))];
    const [groupResult, departmentResult] = await Promise.all([
      groupIds.length
        ? ctx.supabaseAdmin.from("schedule_groups").select("id,name").in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      departmentIds.length
        ? ctx.supabaseAdmin.from("set_departments").select("id,name").in("id", departmentIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (groupResult.error) throw groupResult.error;
    if (departmentResult.error) throw departmentResult.error;
    const groupNames = new Map<string, string>((groupResult.data || []).map((row: any) => [String(row.id), String(row.name || "")]));
    const departmentNames = new Map<string, string>((departmentResult.data || []).map((row: any) => [String(row.id), String(row.name || "")]));
    const insertRows = missingTargets.map((target) => {
      const member = targetMembers.get(target.userId);
      const groupId = String(member?.group_id || "");
      const departmentId = String(member?.home_department_id || "");
      return {
        user_id: target.userId,
        work_date: target.workDate,
        group_id: groupId || null,
        group_name_snapshot: groupNames.get(groupId) || "",
        department_name_snapshot: departmentNames.get(departmentId) || ""
      };
    });
    const insertedResult = await ctx.supabaseAdmin.from("attendance_days").insert(insertRows).select("*");
    if (insertedResult.error) throw insertedResult.error;
    for (const row of insertedResult.data || []) {
      dayByKey.set(rowKey(row.user_id, row.work_date), row);
    }
  }

  const beforeRows = targets.map((target) => dayByKey.get(target.key)).filter(Boolean);
  if (beforeRows.length !== targets.length) throw new Error("部分簽到紀錄建立失敗");
  const dayIds = beforeRows.map((row: any) => row.id);
  const reviewedAt = reviewed ? new Date().toISOString() : null;
  const update = reviewed
    ? { reviewed_at: reviewedAt, reviewed_by: actor.id }
    : { reviewed_at: null, reviewed_by: null };
  const updateResult = await ctx.supabaseAdmin.from("attendance_days")
    .update(update).in("id", dayIds).select("*");
  if (updateResult.error) throw updateResult.error;
  const updatedRows = updateResult.data || [];
  if (updatedRows.length !== dayIds.length) throw new Error("部分簽到紀錄更新失敗");
  const updatedById = new Map<string, any>(updatedRows.map((row: any) => [String(row.id), row]));
  const auditRows = beforeRows.map((old: any) => ({
    attendance_day_id: old.id,
    action: reviewed ? "reviewed" : "returned",
    changed_by: actor.id,
    before_data: old,
    after_data: updatedById.get(String(old.id)) || old,
    reason: String(body?.reason || "")
  }));
  const auditResult = await ctx.supabaseAdmin.from("attendance_audit_logs").insert(auditRows);
  if (auditResult.error) throw auditResult.error;

  return {
    ok: true,
    changed: updatedRows.length,
    reviewed,
    reviewedAt,
    records: updatedRows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      work_date: row.work_date,
      reviewed: Boolean(row.reviewed_at),
      reviewedAt: row.reviewed_at || null
    }))
  };
}

async function history(ctx: any, body: any, actor: any) {
  const recordId = String(body?.recordId || "");
  if (!recordId) return { ok: true, logs: [] };
  const attendanceResult = await ctx.supabaseAdmin.from("attendance_days").select("user_id").eq("id", recordId).maybeSingle();
  if (attendanceResult.error) throw attendanceResult.error;
  if (!attendanceResult.data) return { ok: true, logs: [] };
  await ensureTargetAllowed(ctx, actor, attendanceResult.data.user_id);
  const result = await ctx.supabaseAdmin.from("attendance_audit_logs")
    .select("id,action,changed_by,before_data,after_data,reason,created_at,set_employee:changed_by(full_name)")
    .eq("attendance_day_id", recordId).order("created_at", { ascending: false });
  if (result.error) throw result.error;
  return { ok: true, logs: (result.data || []).map((log: any) => ({ ...log, operator_name: log.set_employee?.full_name || "" })) };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      const actor = await getActor(ctx);
      if (body?.action === "review_list") return Response.json(await buildReviewRows(ctx, body, actor, false));
      if (body?.action === "export_list") return Response.json(await buildReviewRows(ctx, body, actor, true));
      if (body?.action === "review_save") return Response.json(await reviewSave(ctx, body, actor));
      if (body?.action === "review_set") return Response.json(await reviewSet(ctx, body, actor));
      if (body?.action === "history") return Response.json(await history(ctx, body, actor));
      if (body?.action === "common_notes_save") return Response.json(await saveCommonNotes(ctx, body));
      return Response.json({ message: "不支援的簽到審核操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "簽到審核操作失敗" }, { status: 400 });
    }
  })
};
