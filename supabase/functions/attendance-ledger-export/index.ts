import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function validDate(value: unknown, fallback: string) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function actorIdOf(ctx: any) {
  const actorId = String(ctx.userClaims?.sub || ctx.userClaims?.id || "").trim();
  if (!actorId) throw new Error("請先登入");
  return actorId;
}

async function rpcBoolean(ctx: any, name: string, payload: Record<string, unknown>) {
  const { data, error } = await ctx.supabaseAdmin.rpc(name, payload);
  if (error) throw error;
  return data === true;
}

async function requireAttendanceReviewer(ctx: any, actorId: string) {
  const allowed = await rpcBoolean(ctx, "has_access_permission", {
    p_user_id: actorId,
    p_permission: "attendance_review"
  });
  if (!allowed) throw new Error("沒有簽到審核權限");
}

async function getVisibleMembers(ctx: any, actorId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,employee_code,full_name,group_id")
    .is("deleted_at", null)
    .not("group_id", "is", null);
  if (error) throw error;

  const groupIds = [...new Set((data || []).map((row: any) => row.group_id).filter(Boolean))];
  const accessPairs = await Promise.all(groupIds.map(async (groupId) => [
    groupId,
    await rpcBoolean(ctx, "can_access_group", {
      p_user_id: actorId,
      p_group_id: groupId,
      p_permission: "attendance_review"
    })
  ] as const));
  const allowedGroups = new Set(accessPairs.filter(([, allowed]) => allowed).map(([groupId]) => groupId));
  return (data || []).filter((row: any) => allowedGroups.has(row.group_id));
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const actorId = actorIdOf(ctx);
      await requireAttendanceReviewer(ctx, actorId);
      const body = await req.json();
      const today = taipeiDate();
      const fromDate = validDate(body?.fromDate, today);
      const toDate = validDate(body?.toDate, today);
      if (fromDate > toDate) throw new Error("日期範圍不正確");

      const requestedMemberId = String(body?.memberId || "").trim();
      const members = await getVisibleMembers(ctx, actorId);
      const memberMap = new Map(members.map((row: any) => [row.id, row]));
      if (requestedMemberId && !memberMap.has(requestedMemberId)) {
        throw new Error("沒有查看此人員簽到資料的權限");
      }
      const visibleMemberIds = requestedMemberId ? [requestedMemberId] : [...memberMap.keys()];
      if (!visibleMemberIds.length) return Response.json({ ok: true, rows: [] });

      const { data: attendanceRows, error: attendanceError } = await ctx.supabaseAdmin
        .from("attendance_days")
        .select("*")
        .in("user_id", visibleMemberIds)
        .gte("work_date", fromDate)
        .lte("work_date", toDate)
        .not("reviewed_at", "is", null)
        .order("work_date", { ascending: true });
      if (attendanceError) throw attendanceError;

      const rows = (attendanceRows || []).map((row: any) => {
        const member: any = memberMap.get(row.user_id) || {};
        return {
          work_date: row.work_date,
          employee_code: member.employee_code || "",
          employee_name: member.full_name || "",
          regularHours: row.regular_minutes === null ? null : Number(row.regular_minutes) / 60,
          overtimeHours: row.overtime_minutes === null ? null : Number(row.overtime_minutes) / 60,
          clock_in_at: row.clock_in_at || null,
          clock_out_at: row.clock_out_at || null,
          note: row.note || ""
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
