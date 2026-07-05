import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDaysToDateString(dateString: string, count: number) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return taipeiDateString(date);
}

function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!effectiveEndDate || today <= effectiveEndDate));
}

function taipeiTimeString(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

async function getProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");

  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id, employee_code, full_name, is_active, hire_date, leave_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  if (!isProfileEffective(data)) {
    throw new Error("帳號不在有效任職期間，無法訂餐");
  }
  return data;
}

async function getMealSettings(ctx: any) {
  const { data, error } = await ctx.supabaseAdmin
    .from("meal_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return data || { id: "default", daily_cutoff_time: "10:30" };
}

async function getTodayContext(ctx: any, profile: any) {
  const orderDate = taipeiDateString();
  const [{ data: attendance, error: attendanceError }, { data: orders, error: ordersError }, settings] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", profile.id).eq("work_date", orderDate).maybeSingle(),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", profile.id).eq("order_date", orderDate),
    getMealSettings(ctx)
  ]);
  if (attendanceError) throw attendanceError;
  if (ordersError) throw ordersError;

  const orderedProductIds = [...new Set((orders || []).map((order: any) => order.product_id).filter(Boolean))];
  const productQuery = ctx.supabaseAdmin
    .from("meal_products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const { data: products, error: productsError } = orderedProductIds.length
    ? await productQuery.or(`is_active.eq.true,id.in.(${orderedProductIds.join(",")})`)
    : await productQuery.eq("is_active", true);
  if (productsError) throw productsError;

  const nowTime = taipeiTimeString();
  const cutoffTime = String(settings.daily_cutoff_time || "10:30").slice(0, 5);
  return {
    orderDate,
    nowTime,
    cutoffTime,
    orderingOpen: nowTime <= cutoffTime,
    attendance: attendance || null,
    products: products || [],
    orders: orders || []
  };
}

function summarizeOrder(orders: any[]) {
  return {
    orderId: orders[0]?.order_id || "",
    totalQuantity: orders.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    totalAmount: orders.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  };
}

async function todayStatus(ctx: any) {
  const profile = await getProfile(ctx);
  const context = await getTodayContext(ctx, profile);
  return {
    ok: true,
    ...context,
    summary: summarizeOrder(context.orders)
  };
}

async function saveOrder(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  const { error } = await ctx.supabaseAdmin.rpc("save_meal_order", {
    p_user_id: profile.id,
    p_items: Array.isArray(body?.items) ? body.items : [],
    p_note: String(body?.note || "").trim()
  });
  if (error) throw error;
  return todayStatus(ctx);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await req.json();
      if (body?.action === "today_status") return Response.json(await todayStatus(ctx));
      if (body?.action === "save") return Response.json(await saveOrder(ctx, body));
      return Response.json({ message: "不支援的訂餐操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "訂餐失敗" }, { status: 400 });
    }
  })
};
