import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, addDaysToDateString as addDays, hasAnyGroupPermission, isProfileEffective as effective, pageNumber, positiveInteger, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";

const PAGE_SIZE = 50;







async function getActor(ctx: any) {
  const userId = actorIdOf(ctx);
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,access_role_id,hire_date,leave_date,deleted_at")
    .eq("id", userId).is("deleted_at", null).single();
  if (result.error) throw result.error;
  if (!effective(result.data)) throw new Error("此帳號目前不在有效期間");
  if (!await hasAnyGroupPermission(ctx, userId, "meal_admin")) throw new Error("沒有訂餐管理權限");
  return result.data;
}

async function resolveGroupIds(ctx: any, actor: any, requestedGroupId: string) {
  const result = await ctx.supabaseAdmin.from("access_role_group_permissions")
    .select("group_id,permissions").eq("role_id", actor.access_role_id).contains("permissions", ["meal_admin"]);
  if (result.error) throw result.error;
  const ids = (result.data || []).map((row: any) => row.group_id).filter(Boolean);
  if (requestedGroupId) {
    if (!ids.includes(requestedGroupId)) throw new Error("此角色不可查看該群組訂餐資料");
    return [requestedGroupId];
  }
  return ids;
}

async function report(ctx: any, body: any) {
  const actor = await getActor(ctx);
  const today = taipeiDate();
  const fromDate = validDate(body?.fromDate, today);
  const toDate = validDate(body?.toDate, today);
  const departmentId = String(body?.departmentId || "");
  const memberId = String(body?.memberId || "");
  const requestedGroupId = String(body?.groupId || "");
  const groupIds = await resolveGroupIds(ctx, actor, requestedGroupId);
  const page = pageNumber(body?.page);

  const settingsResult = await ctx.supabaseAdmin.from("meal_settings")
    .select("company_subsidy").eq("id", "default").maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  const companySubsidy = positiveInteger(settingsResult.data?.company_subsidy, 55);

  if (!groupIds.length) {
    return {
      ok: true, fromDate, toDate, companySubsidy,
      summary: [], dailySummary: [], memberSummary: [], details: [], exportDetails: [],
      totals: { quantity: 0, amount: 0 }, total: 0, page, pageSize: PAGE_SIZE
    };
  }

  let query = ctx.supabaseAdmin.from("meal_orders").select("*")
    .in("group_id", groupIds)
    .gte("order_date", fromDate).lte("order_date", toDate)
    .order("order_date", { ascending: false })
    .order("employee_code_snapshot", { ascending: true });
  if (departmentId) query = query.eq("department_id", departmentId);
  if (memberId) query = query.eq("user_id", memberId);
  const orderResult = await query;
  if (orderResult.error) throw orderResult.error;
  const orders = orderResult.data || [];

  const userIds = [...new Set(orders.map((row: any) => row.user_id).filter(Boolean))];
  const dates = [...new Set(orders.map((row: any) => row.order_date).filter(Boolean))];
  const attendanceResult = userIds.length && dates.length
    ? await ctx.supabaseAdmin.from("attendance_days")
      .select("user_id,work_date,clock_in_at")
      .in("user_id", userIds).in("work_date", dates)
    : { data: [], error: null };
  if (attendanceResult.error) throw attendanceResult.error;
  const attendance = new Map<string, any>((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));

  const summaryMap = new Map<string, any>();
  const dailyMap = new Map<string, any>();
  const memberMap = new Map<string, any>();
  const totals = { quantity: 0, amount: 0 };
  const details = orders.map((row: any) => {
    const quantity = Number(row.quantity || 0);
    const unitPrice = Number(row.unit_price || 0);
    const amount = quantity * unitPrice;
    totals.quantity += quantity;
    totals.amount += amount;

    const productKey = `${row.order_date}:${row.group_id || ""}:${row.department_id || ""}:${row.product_id || ""}`;
    const productSummary = summaryMap.get(productKey) || {
      date: row.order_date,
      groupId: row.group_id,
      groupName: row.group_name_snapshot || "",
      departmentId: row.department_id,
      departmentName: row.department_name_snapshot,
      productId: row.product_id,
      productName: row.product_name_snapshot,
      quantity: 0,
      amount: 0
    };
    productSummary.quantity += quantity;
    productSummary.amount += amount;
    summaryMap.set(productKey, productSummary);

    const dailyKey = `${row.order_date}:${row.group_id || ""}:${row.department_id || ""}`;
    const daily = dailyMap.get(dailyKey) || {
      date: row.order_date,
      groupId: row.group_id,
      groupName: row.group_name_snapshot || "",
      departmentId: row.department_id,
      departmentName: row.department_name_snapshot,
      quantity: 0,
      amount: 0
    };
    daily.quantity += quantity;
    daily.amount += amount;
    dailyMap.set(dailyKey, daily);

    const memberKey = String(row.user_id || row.employee_name_snapshot || "");
    const member = memberMap.get(memberKey) || {
      employeeId: row.user_id,
      employeeName: row.employee_name_snapshot,
      employeeCode: row.employee_code_snapshot,
      dates: new Set<string>(),
      amount: 0
    };
    if (quantity > 0 && row.order_date) member.dates.add(row.order_date);
    member.amount += amount;
    memberMap.set(memberKey, member);

    return {
      id: row.id,
      orderId: row.order_id,
      date: row.order_date,
      groupId: row.group_id,
      groupName: row.group_name_snapshot || "",
      departmentId: row.department_id,
      departmentName: row.department_name_snapshot,
      employeeId: row.user_id,
      employeeCode: row.employee_code_snapshot,
      employeeName: row.employee_name_snapshot,
      productId: row.product_id,
      productName: row.product_name_snapshot,
      quantity,
      unitPrice,
      amount,
      note: row.note || "",
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      clockDeletedWarning: !attendance.get(`${row.user_id}:${row.order_date}`)?.clock_in_at
    };
  });

  const memberSummary = [...memberMap.values()].map((row: any) => {
    const days = row.dates.size;
    return {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      days,
      amount: row.amount,
      companySubsidy,
      selfPay: row.amount - days * companySubsidy
    };
  }).sort((a: any, b: any) => (
    String(a.employeeName || "").localeCompare(String(b.employeeName || ""), "zh-Hant")
    || String(a.employeeCode || "").localeCompare(String(b.employeeCode || ""))
  ));

  const offset = (page - 1) * PAGE_SIZE;
  return {
    ok: true,
    fromDate,
    toDate,
    companySubsidy,
    summary: [...summaryMap.values()],
    dailySummary: [...dailyMap.values()],
    memberSummary,
    details: details.slice(offset, offset + PAGE_SIZE),
    exportDetails: details,
    totals,
    total: details.length,
    page,
    pageSize: PAGE_SIZE
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      return Response.json(await report(ctx, await req.json()));
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "讀取訂餐統計失敗" }, { status: 400 });
    }
  })
};
