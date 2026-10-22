import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, hasGroupPermission, hasAnyGroupPermission, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";

function scheduleKey(memberId: string, workDate: string) {
  return memberId + ":" + workDate;
}

function isRestDayLeave(leave: any) {
  const code = String(leave?.code || "").trim();
  const name = String(leave?.name || "").trim();
  return code === "0036" || code === "0047" || name === "例假" || name === "休息日";
}

// Supabase REST queries return at most one server-configured page of rows.
// Always paginate large exports instead of treating truncated results as missing records.
const EXPORT_PAGE_SIZE = 500;

async function readAllPages(buildQuery: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + EXPORT_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) return rows;
  }
}

async function getVisibleMembers(ctx: any, actorId: string, requestedGroupId = "") {
  const data = await readAllPages(() => ctx.supabaseAdmin
    .from("set_employee")
    .select("id,employee_code,full_name,group_id,home_department:set_departments!home_department_id(hidden_from_schedule)")
    .is("deleted_at", null)
    .not("group_id", "is", null)
    .order("id", { ascending: true }));

  const groupIds = [...new Set<string>((data || []).map((row: any) => String(row.group_id || "")).filter(Boolean))];
  const accessPairs = await Promise.all(groupIds.map(async (groupId) => [
    groupId,
    await hasGroupPermission(ctx, actorId, groupId, "attendance_review")
  ] as const));
  const allowedGroups = new Set(accessPairs.filter(([, allowed]) => allowed).map(([groupId]) => groupId));
  if (requestedGroupId && !allowedGroups.has(requestedGroupId)) throw new Error("沒有查看此群組簽到資料的權限");
  return (data || []).filter((row: any) => {
    const groupId = String(row.group_id || "");
    return allowedGroups.has(groupId) && (!requestedGroupId || groupId === requestedGroupId) && !row.home_department?.hidden_from_schedule;
  });
}

async function getScheduleContext(ctx: any, memberIds: string[], fromDate: string, toDate: string) {
  if (!memberIds.length) return { schedules: new Map(), shifts: new Map(), leaves: new Map(), departments: new Map() };
  const schedules = await readAllPages(() => ctx.supabaseAdmin
    .from("schedule_entries")
    .select("member_id,work_date,shift_type_id,leave_type_id,support_department_id")
    .in("member_id", memberIds)
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("work_date", { ascending: true })
    .order("member_id", { ascending: true }));
  const shiftIds = [...new Set<string>(schedules.map((row: any) => String(row.shift_type_id || "")).filter(Boolean))];
  const leaveIds = [...new Set<string>(schedules.map((row: any) => String(row.leave_type_id || "")).filter(Boolean))];
  const [shiftResult, leaveResult] = await Promise.all([
    shiftIds.length
      ? ctx.supabaseAdmin.from("set_shift").select("id,start_time,end_time,applicable_department_id").in("id", shiftIds)
      : Promise.resolve({ data: [], error: null }),
    leaveIds.length
      ? ctx.supabaseAdmin.from("set_leave").select("id,code,name").in("id", leaveIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (shiftResult.error) throw shiftResult.error;
  if (leaveResult.error) throw leaveResult.error;
  const departmentIds = [...new Set<string>([
    ...schedules.map((row: any) => String(row.support_department_id || "")),
    ...(shiftResult.data || []).map((row: any) => String(row.applicable_department_id || ""))
  ].filter(Boolean))];
  const departmentResult = departmentIds.length
    ? await ctx.supabaseAdmin.from("set_departments").select("id,name").in("id", departmentIds)
    : { data: [], error: null };
  if (departmentResult.error) throw departmentResult.error;

  return {
    schedules: new Map(schedules.map((row: any) => [scheduleKey(row.member_id, row.work_date), row])),
    shifts: new Map((shiftResult.data || []).map((row: any) => [row.id, row])),
    leaves: new Map((leaveResult.data || []).map((row: any) => [row.id, row])),
    departments: new Map((departmentResult.data || []).map((row: any) => [row.id, row]))
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const actorId = actorIdOf(ctx);
      if (!await hasAnyGroupPermission(ctx, actorId, "attendance_review")) throw new Error("沒有簽到審核權限");
      const body = await req.json();
      const today = taipeiDate();
      const fromDate = validDate(body?.fromDate, today);
      const toDate = validDate(body?.toDate, today);
      if (fromDate > toDate) throw new Error("日期範圍不正確");

      const requestedMemberId = String(body?.memberId || "").trim();
      const requestedGroupId = String(body?.groupId || "").trim();
      const members = await getVisibleMembers(ctx, actorId, requestedGroupId);
      const memberMap = new Map<string, any>((members || []).map((row: any) => [String(row.id || ""), row]));
      if (requestedMemberId && !memberMap.has(requestedMemberId)) {
        throw new Error("沒有查看此人員簽到資料的權限");
      }
      const visibleMemberIds: string[] = requestedMemberId ? [requestedMemberId] : [...memberMap.keys()];
      if (!visibleMemberIds.length) return Response.json({ ok: true, rows: [] });

      const [attendanceRows, scheduleContext] = await Promise.all([
        readAllPages(() => ctx.supabaseAdmin
          .from("attendance_days")
          .select("user_id,work_date,regular_minutes,overtime_minutes,clock_in_at,clock_out_at,note")
          .in("user_id", visibleMemberIds)
          .gte("work_date", fromDate)
          .lte("work_date", toDate)
          .order("work_date", { ascending: true })
          .order("user_id", { ascending: true })),
        getScheduleContext(ctx, visibleMemberIds, fromDate, toDate)
      ]);

      const rows = ((attendanceRows || []) as any[]).map((row: any) => {
        const member: any = memberMap.get(row.user_id) || {};
        const schedule: any = scheduleContext.schedules.get(scheduleKey(row.user_id, row.work_date)) || null;
        const shift: any = schedule?.shift_type_id ? scheduleContext.shifts.get(schedule.shift_type_id) || null : null;
        const leave: any = schedule?.leave_type_id ? scheduleContext.leaves.get(schedule.leave_type_id) || null : null;
        const restDayScheduled = Boolean(shift && isRestDayLeave(leave));
        // 以當天支援單位優先，否則使用實際排入班別的適用單位。
        // 無班別時不回填員工所屬單位，以免匯出錯誤。
        const scheduledDepartmentId = shift
          ? String(schedule?.support_department_id || shift.applicable_department_id || "")
          : "";
        return {
          work_date: row.work_date,
          employee_code: member.employee_code || "",
          employee_name: member.full_name || "",
          regularHours: row.regular_minutes === null ? null : Number(row.regular_minutes) / 60,
          overtimeHours: row.overtime_minutes === null ? null : Number(row.overtime_minutes) / 60,
          clock_in_at: row.clock_in_at || null,
          clock_out_at: row.clock_out_at || null,
          note: row.note || "",
          restDayScheduled,
          scheduledShiftStartTime: shift?.start_time || null,
          scheduledShiftEndTime: shift?.end_time || null,
          scheduledShiftDepartmentName: scheduleContext.departments.get(scheduledDepartmentId)?.name || ""
        };
      });
      return Response.json({ ok: true, rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "匯出失敗";
      const status = /權限/.test(message) ? 403 : 400;
      return Response.json({ message }, { status });
    }
  })
};
