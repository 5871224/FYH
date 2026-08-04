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

async function requireAdmin(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,role").eq("id", userId).single();
  if (result.error) throw result.error;
  if (result.data?.role !== "admin") throw new Error("此功能限管理員使用");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      await requireAdmin(ctx);
      const body = await req.json();
      const today = taipeiDate();
      const fromDate = validDate(body?.fromDate, today);
      const toDate = validDate(body?.toDate, today);
      const memberId = String(body?.memberId || "");
      let query = ctx.supabaseAdmin.from("attendance_days")
        .select("*")
        .gte("work_date", fromDate)
        .lte("work_date", toDate)
        .not("reviewed_at", "is", null)
        .order("work_date", { ascending: true });
      if (memberId) query = query.eq("user_id", memberId);
      const attendanceResult = await query;
      if (attendanceResult.error) throw attendanceResult.error;
      const userIds = [...new Set((attendanceResult.data || []).map((row: any) => row.user_id))];
      const memberResult = userIds.length
        ? await ctx.supabaseAdmin.from("set_employee").select("id,employee_code,full_name").in("id", userIds)
        : { data: [], error: null };
      if (memberResult.error) throw memberResult.error;
      const members = new Map((memberResult.data || []).map((row: any) => [row.id, row]));
      const rows = (attendanceResult.data || []).map((row: any) => {
        const member: any = members.get(row.user_id) || {};
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
      return Response.json({ message: error instanceof Error ? error.message : "匯出失敗" }, { status: 400 });
    }
  })
};
