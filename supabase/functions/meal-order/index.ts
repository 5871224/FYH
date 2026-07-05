import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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
  const today = taipeiDateString();
  if (!data?.is_active || (data.hire_date && today < data.hire_date) || (data.leave_date && today > data.leave_date)) {
    throw new Error("此帳號目前不在有效期間，無法訂餐");
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
  const [{ data: attendance, error: attendanceError }, { data: products, error: productsError }, { data: orders, error: ordersError }, settings] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", profile.id).eq("work_date", orderDate).maybeSingle(),
    ctx.supabaseAdmin.from("meal_products").select("*").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", profile.id).eq("order_date", orderDate),
    getMealSettings(ctx)
  ]);
  if (attendanceError) throw attendanceError;
  if (productsError) throw productsError;
  if (ordersError) throw ordersError;

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

function readQuantityMap(items: any[]) {
  const map = new Map<string, number>();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const productId = String(item?.productId || "").trim();
    const quantity = Math.max(0, Math.floor(Number(item?.quantity || 0)));
    if (productId && quantity > 0) {
      map.set(productId, quantity);
    }
  });
  return map;
}

async function saveOrder(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  const context = await getTodayContext(ctx, profile);
  if (!context.attendance?.clock_in_at || !context.attendance?.clock_in_department_id) {
    throw new Error("今日需先完成上班打卡才能訂餐");
  }
  if (!context.orderingOpen) {
    throw new Error(`今日訂餐已於 ${context.cutoffTime} 截止`);
  }

  const quantityMap = readQuantityMap(body?.items || []);
  const activeProducts = new Map(context.products.map((product: any) => [product.id, product]));
  const orderId = context.orders[0]?.order_id || crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { error: deleteError } = await ctx.supabaseAdmin
    .from("meal_orders")
    .delete()
    .eq("user_id", profile.id)
    .eq("order_date", context.orderDate);
  if (deleteError) throw deleteError;

  const rows = Array.from(quantityMap.entries()).map(([productId, quantity]) => {
    const product: any = activeProducts.get(productId);
    if (!product) {
      throw new Error("訂餐品項已停用，請重新整理後再送出");
    }
    return {
      order_id: orderId,
      user_id: profile.id,
      employee_code_snapshot: profile.employee_code || "",
      employee_name_snapshot: profile.full_name || "",
      order_date: context.orderDate,
      department_id: context.attendance.clock_in_department_id,
      department_name_snapshot: context.attendance.clock_in_department_name_snapshot || "",
      clock_location_id: context.attendance.clock_in_department_id,
      product_id: product.id,
      product_name_snapshot: product.name || "",
      quantity,
      unit_price: product.price || 0,
      note: String(body?.note || "").trim(),
      submitted_at: nowIso,
      updated_at: nowIso
    };
  });

  if (rows.length) {
    const { error } = await ctx.supabaseAdmin.from("meal_orders").insert(rows);
    if (error) throw error;
  }
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
