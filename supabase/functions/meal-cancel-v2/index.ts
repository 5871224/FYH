import { withSupabase } from "npm:@supabase/server@^1";

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}

function localTime() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
      const profile = await ctx.supabaseAdmin.from("set_employee")
        .select("hire_date,leave_date").eq("id", userId).single();
      if (profile.error) throw profile.error;
      const today = localDate();
      const leaveEnd = profile.data.leave_date
        ? new Date(`${profile.data.leave_date}T00:00:00+08:00`)
        : null;
      if (leaveEnd) leaveEnd.setDate(leaveEnd.getDate() + 5);
      const effectiveEnd = leaveEnd
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(leaveEnd)
        : "";
      if ((profile.data.hire_date && today < profile.data.hire_date) || (effectiveEnd && today > effectiveEnd)) {
        throw new Error("此帳號目前不在有效期間");
      }

      const settings = await ctx.supabaseAdmin.from("meal_settings")
        .select("daily_cutoff_time").eq("id", "default").maybeSingle();
      if (settings.error) throw settings.error;
      const cutoff = String(settings.data?.daily_cutoff_time || "10:30").slice(0, 5);
      if (localTime() > cutoff) throw new Error(`今日訂餐已於 ${cutoff} 截止`);

      const result = await ctx.supabaseAdmin.from("meal_orders").delete()
        .eq("user_id", userId).eq("order_date", today);
      if (result.error) throw result.error;
      return Response.json({ ok: true, cancelled: true, orderDate: today });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "取消訂餐失敗" }, { status: 400 });
    }
  })
};
