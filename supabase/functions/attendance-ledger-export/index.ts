import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, canAccessGroup, hasPermission, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";

function scheduleKey(memberId: string, workDate: string) {
  return memberId + ":" + workDate;
}

function isRestDayLeave(leave: any) {
  const code = String(leave?.code || "").trim();
  const name = String(leave?.name || "").trim();
  return code === "0036" || code === "0047" || name === "例假" || name === "休息日";
}

async function getVisibleMembers(ctx: any, actorId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,employee_code,full_name,group_id")
    .is("deleted_at", null)
    .not("group_id", "is", null);
  if (error) throw error;

  const groupIds = [...new Set<string>((data || []).map((row: any) => String(row.group_id || "")).filter(Boolean))];
  const accessPairs = await Promise.all(groupIds.map(async (groupId) => [
    groupId,
    await canAccessGroup(ctx, actorId, groupId, "attendance_review")
  ] as const));
  const allowedGroups = new Set(accessPairs.filter(([, allowed]) => allowed).map(([groupId]) => groupId));
  return (data || []).filter((row: any) => allowedGroups.has(String(row.group_id || "")));
}

async function getScheduleContext(ctx: any, memberIds: string[], fromDate: string, toDate: string) {
  if (!memberIds.length) return { schedules: new Map(), shifts: new Map(), leaves: new Map() };
  const scheduleResult = await ctx.supabaseAdmin
    .from("schedule_entries")
    .select("member_id,work_date,shift_type_id,leave_type_id")
    .in("member_id", memberIds)
    .gte("work_date", fromDate)
    .lte("work_date", toDate);
  if (scheduleResult.error) throw scheduleResult.error;

  const schedules = scheduleResult.data || [];
  const shiftIds = [...new Set<string>(schedules.map((row: any) => String(row.shift_type_id || "")).filter(Boolean))];
  const leaveIds = [...new Set<string>(schedules.map((row: any) => String(row.leave_type_id || "")).filter(Boolean))];
  const [shiftResult, leaveResult] = await Promise.all([
    shiftIds.length
      ? ctx.supabaseAdmin.from("set_shift").select("id,start_time,end_time").in("id", shiftIds)
      : Promise.resolve({ data: [], error: null }),
    leaveIds.length
      ? ctx.supabaseAdmin.from("set_leave").select("id,code,name").in("id", leaveIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (shiftResult.error) throw shiftResult.error;
  if (leaveResult.error) throw leaveResult.error;

  return {
    schedules: new Map(schedules.map((row: any) => [scheduleKey(row.member_id, row.work_date), row])),
    shifts: new Map((shiftResult.data || []).map((row: any) => [row.id, row])),
    leaves: new Map((leaveResult.data || []).map((row: any) => [row.id, row]))
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const actorId = actorIdOf(ctx);
      if (!await hasPermission(ctx, actorId, "attendance_review")) throw new Error("沒有簽到審核權限");
      const body = await req.json();
      const today = taipeiDate();
      const fromDate = validDate(body?.fromDate, today);
      const toDate = validDate(body?.toDate, today);
      if (fromDate > toDate) throw new Error("日期範圍不正確");

      const requestedMemberId = String(body?.memberId || "").trim();
      const members = await getVisibleMembers(ctx, actorId);
      const memberMap = new Map<string, any>((members || []).map((row: any) => [String(row.id || ""), row]));
      if (requestedMemberId && !memberMap.has(requestedMemberId)) {
        throw new Error("沒有查看此人員簽到資料的權限");
      }
      const visibleMemberIds: string[] = requestedMemberId ? [requestedMemberId] : [...memberMap.keys()];
      if (!visibleMemberIds.length) return Response.json({ ok: true, rows: [] });

      const [{ data: attendanceRows, error: attendanceError }, scheduleContext] = await Promise.all([
        ctx.supabaseAdmin
          .from("attendance_days")
          .select("*")
          .in("user_id", visibleMemberIds)
          .gte("work_date", fromDate)
          .lte("work_date", toDate)
          .not("reviewed_at", "is", null)
          .order("work_date", { ascending: true }),
        getScheduleContext(ctx, visibleMemberIds, fromDate, toDate)
      ]);
      if (attendanceError) throw attendanceError;

      const rows = ((attendanceRows || []) as any[]).map((row: any) => {
        const member: any = memberMap.get(row.user_id) || {};
        const schedule: any = scheduleContext.schedules.get(scheduleKey(row.user_id, row.work_date)) || null;
        const shift: any = schedule?.shift_type_id ? scheduleContext.shifts.get(schedule.shift_type_id) || null : null;
        const leave: any = schedule?.leave_type_id ? scheduleContext.leaves.get(schedule.leave_type_id) || null : null;
        const restDayScheduled = Boolean(shift && isRestDayLeave(leave));
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
          scheduledShiftStartTime: restDayScheduled ? shift.start_time || null : null,
          scheduledShiftEndTime: restDayScheduled ? shift.end_time || null : null
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
