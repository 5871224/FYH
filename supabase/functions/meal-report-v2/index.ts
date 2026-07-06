import { withSupabase } from "npm:@supabase/server@^1";

const PAGE_SIZE = 50;

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(value: string, count: number) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return taipeiDate(date);
}

function effective(profile: any, today = taipeiDate()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

function validDate(value: unknown, fallback: string) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

async function requireManager(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("role,is_active,hire_date,leave_date").eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data) || !["manager", "admin"].includes(result.data.role)) throw new Error("此功能限主管或管理員使用");
}

async function report(ctx: any, body: any) {
  await requireManager(ctx);
  const today = taipeiDate();
  const fromDate = validDate(body?.fromDate, today);
  const toDate = validDate(body?.toDate, today);
  const departmentId = String(body?.departmentId || "");
  const memberId = String(body?.memberId || "");
  const page = pageNumber(body?.page);

  let query = ctx.supabaseAdmin.from("meal_orders").select("*")
    .gte("order_date", fromDate).lte("order_date", toDate)
    .order("order_date", { ascending: false }).order("employee_code_snapshot", { ascending: true });
  if (departmentId) query = query.eq("department_id", departmentId);
  if (memberId) query = query.eq("user_id", memberId);
  const orderResult = await query;
  if (orderResult.error) throw orderResult.error;
  const orders = orderResult.data || [];

  const userIds = [...new Set(orders.map((row: any) => row.user_id).filter(Boolean))];
  const dates = [...new Set(orders.map((row: any) => row.order_date).filter(Boolean))];
  const attendanceResult = userIds.length && dates.length
    ? await ctx.supabaseAdmin.from("attendance_records").select("user_id,work_date,clock_in_at").in("user_id", userIds).in("work_date", dates)
    : { data: [], error: null };
  if (attendanceResult.error) throw attendanceResult.error;
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));

  const summaryMap = new Map<string, any>();
  const dailyMap = new Map<string, any>();
  const totals = { quantity: 0, amount: 0 };
  const details = orders.map((row: any) => {
    const quantity = Number(row.quantity || 0);
    const unitPrice = Number(row.unit_price || 0);
    const amount = quantity * unitPrice;
    totals.quantity += quantity;
    totals.amount += amount;

    const productKey = `${row.order_date}:${row.department_id || ""}:${row.product_id || ""}`;
    const productSummary = summaryMap.get(productKey) || {
      date: row.order_date,
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

    const dailyKey = `${row.order_date}:${row.department_id || ""}`;
    const daily = dailyMap.get(dailyKey) || {
      date: row.order_date,
      departmentId: row.department_id,
      departmentName: row.department_name_snapshot,
      quantity: 0,
      amount: 0
    };
    daily.quantity += quantity;
    daily.amount += amount;
    dailyMap.set(dailyKey, daily);

    return {
      id: row.id,
      orderId: row.order_id,
      date: row.order_date,
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

  const offset = (page - 1) * PAGE_SIZE;
  return {
    ok: true,
    fromDate,
    toDate,
    summary: [...summaryMap.values()],
    dailySummary: [...dailyMap.values()],
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
