import { withSupabase } from "npm:@supabase/server@^1";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}

function addFiveDays(value: string) {
  const date = new Date(`${value}T00:00:00+08:00`);
  date.setDate(date.getDate() + 5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
      const profile = await ctx.supabaseAdmin.from("set_employee")
        .select("role,is_active,hire_date,leave_date").eq("id", userId).single();
      if (profile.error) throw profile.error;
      const date = today();
      const end = profile.data.leave_date ? addFiveDays(profile.data.leave_date) : "";
      if (profile.data.role !== "admin" || !profile.data.is_active || (profile.data.hire_date && date < profile.data.hire_date) || (end && date > end)) {
        throw new Error("此功能限管理員使用");
      }

      const departments = await ctx.supabaseAdmin.from("set_departments")
        .select("id,address,latitude,longitude,attendance_enabled");
      const privateSettings = await ctx.supabaseAdmin.from("department_attendance_settings")
        .select("department_id,public_ip");
      if (departments.error) throw departments.error;
      if (privateSettings.error) throw privateSettings.error;
      const byDepartment = new Map((privateSettings.data || []).map((row: any) => [row.department_id, row]));
      return Response.json({ ok: true, settings: (departments.data || []).map((row: any) => ({
        departmentId: row.id,
        address: row.address || "",
        latitude: row.latitude,
        longitude: row.longitude,
        attendanceEnabled: Boolean(row.attendance_enabled),
        publicIp: byDepartment.get(row.id)?.public_ip || ""
      })) });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "讀取打卡單位設定失敗" }, { status: 400 });
    }
  })
};
