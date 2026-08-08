import { withSupabase } from "npm:@supabase/server@^1";
import { hasPermission, isProfileEffective, positiveInteger, taipeiDateString, taipeiTimeString } from "../_shared/runtime.ts";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}


function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return Boolean(
    profile
    && !profile.deleted_at
    && (!profile.hire_date || today >= profile.hire_date)
    && (!effectiveEndDate || today <= effectiveEndDate)
  );
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
    .select("id,employee_code,full_name,group_id,access_role_id,home_department_id,hire_date,leave_date,deleted_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  if (!isProfileEffective(data)) throw new Error("帳號不在有效任職期間，無法訂餐");
  return data;
}

async function getGroup(ctx: any, groupId: string) {
  if (!groupId) return null;
  const result = await ctx.supabaseAdmin
    .from("schedule_groups")
    .select("id,code,name,meal_enabled,status,deleted_at")
    .eq("id", groupId)
    .is("deleted_at", null)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function requireMealAdmin(ctx: any, profile: any) {
  if (!await hasPermission(ctx, profile.id, "meal_admin")) {
    throw new Error("沒有訂餐管理權限");
  }
}

async function getMealSettings(ctx: any) {
  const { data, error } = await ctx.supabaseAdmin
    .from("meal_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return {
    id: "default",
    daily_cutoff_time: data?.daily_cutoff_time || "10:30",
    company_subsidy: positiveInteger(data?.company_subsidy, 55),
    ...(data || {})
  };
}

async function getTodayContext(ctx: any, profile: any) {
  const orderDate = taipeiDateString();
  const [{ data: attendance, error: attendanceError }, { data: orders, error: ordersError }, settings, group] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_days").select("*").eq("user_id", profile.id).eq("work_date", orderDate).maybeSingle(),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", profile.id).eq("order_date", orderDate),
    getMealSettings(ctx),
    getGroup(ctx, profile.group_id)
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
  const mealEnabled = Boolean(group && group.status === "active" && group.meal_enabled);
  return {
    orderDate,
    nowTime,
    cutoffTime,
    companySubsidy: positiveInteger(settings.company_subsidy, 55),
    orderingOpen: mealEnabled && nowTime <= cutoffTime,
    mealEnabled,
    group: group ? { id: group.id, code: group.code, name: group.name } : null,
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
  return { ok: true, ...context, summary: summarizeOrder(context.orders) };
}

type NormalizedMealItem = { productId: string; quantity: number; note: string };

function normalizeIncomingItems(items: any[]): NormalizedMealItem[] {
  const byProduct = new Map<string, NormalizedMealItem>();
  for (const raw of Array.isArray(items) ? items : []) {
    const productId = String(raw?.productId || "").trim();
    if (!productId) continue;
    const quantity = Number(raw?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      throw new Error("訂餐數量必須是 0 或正整數");
    }
    const previous = byProduct.get(productId);
    byProduct.set(productId, {
      productId,
      quantity: (previous?.quantity || 0) + quantity,
      note: String(raw?.note ?? previous?.note ?? "").trim()
    });
  }
  return [...byProduct.values()];
}

function buildEffectiveItems(context: any, incoming: NormalizedMealItem[]) {
  const products = new Map((context.products || []).map((product: any) => [String(product.id), product]));
  const oldOrders = new Map((context.orders || []).map((order: any) => [String(order.product_id), order]));
  const effective = new Map(incoming.map((item) => [item.productId, { ...item }]));

  for (const item of incoming) {
    const product: any = products.get(item.productId);
    const oldOrder: any = oldOrders.get(item.productId);
    if (!product && item.quantity > 0) throw new Error("訂餐品項不存在");
    if (product?.is_active === false) {
      if (!oldOrder && item.quantity > 0) throw new Error("停用品項不可新增");
      if (oldOrder && item.quantity > Number(oldOrder.quantity || 0)) {
        throw new Error("停用品項只能減少或取消，不可增加數量");
      }
    }
  }

  for (const [productId, oldOrder] of oldOrders) {
    const product: any = products.get(productId);
    if (product?.is_active === false && !effective.has(productId)) {
      effective.set(productId, {
        productId,
        quantity: Number((oldOrder as any).quantity || 0),
        note: String((oldOrder as any).note || "")
      });
    }
  }
  return [...effective.values()];
}

async function stampMealGroup(ctx: any, profile: any, context: any) {
  if (!context.group?.id) return;
  const [ordersResult, attendanceResult] = await Promise.all([
    ctx.supabaseAdmin.from("meal_orders").update({
      group_id: context.group.id,
      group_name_snapshot: context.group.name
    }).eq("user_id", profile.id).eq("order_date", context.orderDate),
    ctx.supabaseAdmin.from("attendance_days").update({
      group_id: context.group.id,
      group_name_snapshot: context.group.name
    }).eq("user_id", profile.id).eq("work_date", context.orderDate)
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (attendanceResult.error) throw attendanceResult.error;
}

async function saveOrder(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  const context = await getTodayContext(ctx, profile);
  if (!context.mealEnabled) throw new Error("此群組未開放訂餐");
  const departmentId = String(context.attendance?.clock_in_location?.departmentId || "");
  if (!context.attendance?.clock_in_at || !departmentId) {
    throw new Error("請先完成上班打卡後再訂餐");
  }
  if (!context.orderingOpen) throw new Error(`今日訂餐已於 ${context.cutoffTime} 截止`);

  const incoming = normalizeIncomingItems(body?.items);
  const items = buildEffectiveItems(context, incoming);
  const positiveCount = items.filter((item) => item.quantity > 0).length;
  if (!(context.orders || []).length && positiveCount === 0) throw new Error("尚未選擇訂餐品項");

  const { error } = await ctx.supabaseAdmin.rpc("save_meal_order", {
    p_user_id: profile.id,
    p_items: items,
    p_note: ""
  });
  if (error) throw error;
  await stampMealGroup(ctx, profile, context);
  return todayStatus(ctx);
}

async function adminSettings(ctx: any) {
  const profile = await getProfile(ctx);
  await requireMealAdmin(ctx, profile);
  const [settings, productsResult] = await Promise.all([
    getMealSettings(ctx),
    ctx.supabaseAdmin.from("meal_products").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true })
  ]);
  if (productsResult.error) throw productsResult.error;
  return { ok: true, settings, products: productsResult.data || [] };
}

async function saveAdminSettings(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  await requireMealAdmin(ctx, profile);
  const companySubsidy = Number(body?.companySubsidy);
  if (!Number.isInteger(companySubsidy) || companySubsidy <= 0) {
    throw new Error("公司補助只能輸入正整數");
  }
  const { data, error } = await ctx.supabaseAdmin.rpc("save_meal_admin_settings", {
    p_products: Array.isArray(body?.products) ? body.products : [],
    p_daily_cutoff_time: String(body?.dailyCutoffTime || "").slice(0, 5),
    p_company_subsidy: companySubsidy,
    p_operator_user_id: profile.id
  });
  if (error) throw error;
  return { ok: true, result: data };
}

async function deleteAdminProduct(ctx: any, body: any) {
  const profile = await getProfile(ctx);
  await requireMealAdmin(ctx, profile);
  const productId = String(body?.productId || "").trim();
  if (!productId) throw new Error("缺少品項ID");
  const { data, error } = await ctx.supabaseAdmin.rpc("delete_meal_product_v2", {
    p_product_id: productId,
    p_operator_user_id: profile.id
  });
  if (error) throw error;
  return { ok: true, result: data };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      if (body?.action === "today_status") return Response.json(await todayStatus(ctx));
      if (body?.action === "save") return Response.json(await saveOrder(ctx, body));
      if (body?.action === "admin_settings") return Response.json(await adminSettings(ctx));
      if (body?.action === "save_admin_settings") return Response.json(await saveAdminSettings(ctx, body));
      if (body?.action === "delete_admin_product") return Response.json(await deleteAdminProduct(ctx, body));
      return Response.json({ message: "不支援的訂餐操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "訂餐失敗" }, { status: 400 });
    }
  })
};
