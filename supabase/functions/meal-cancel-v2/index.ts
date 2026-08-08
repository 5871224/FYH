import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, isProfileEffective, taipeiDateString, taipeiTimeString } from "../_shared/runtime.ts";



export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const userId = actorIdOf(ctx);
      const profile = await ctx.supabaseAdmin.from("set_employee")
        .select("hire_date,leave_date,deleted_at")
        .eq("id", userId)
        .is("deleted_at", null)
        .single();
      if (profile.error) throw profile.error;
      const today = taipeiDateString();
      if (!isProfileEffective(profile.data, today)) throw new Error("此帳號目前不在有效期間");

      const settings = await ctx.supabaseAdmin.from("meal_settings")
        .select("daily_cutoff_time").eq("id", "default").maybeSingle();
      if (settings.error) throw settings.error;
      const cutoff = String(settings.data?.daily_cutoff_time || "10:30").slice(0, 5);
      if (taipeiTimeString() > cutoff) throw new Error(`今日訂餐已於 ${cutoff} 截止`);

      const result = await ctx.supabaseAdmin.from("meal_orders").delete()
        .eq("user_id", userId).eq("order_date", today);
      if (result.error) throw result.error;
      return Response.json({ ok: true, cancelled: true, orderDate: today });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "取消訂餐失敗" }, { status: 400 });
    }
  })
};
