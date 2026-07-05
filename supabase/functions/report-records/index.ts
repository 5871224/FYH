import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return taipeiDateString(date);
}

function isManagerRole(role: string) {
  return role === "admin" || role === "manager";
}

function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active && (!profile.hire_date || today >= profile.hire_date) && (!effectiveEndDate || today <= effectiveEndDate));
}

async function getProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id, employee_code, full_name, role, is_active, hire_date, leave_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const today = taipeiDateString();
  if (!isProfileEffective(data, today)) {
    throw new Error("此帳號目前不在有效期間，無法查看記錄");
  }
  return data;
}

async function personalRecords(ctx: any) {
  const profile = await getProfile(ctx);
  const today = taipeiDateString();
  const fromDate = addDays(today, -49);
  const [attendanceResult, overtimeResult, mealResult, scheduleResult] = await Promise.all([
    ctx.supabaseAdmin.from("attendance_records").select("*").eq("user_id", profile.id).gte("work_date", fromDate).lte("work_date", today),
    ctx.supabaseAdmin.from("attendance_overtime_requests").select("*").eq("user_id", profile.id).eq("is_deleted_by_employee", false).gte("work_date", fromDate).lte("work_date", today),
    ctx.supabaseAdmin.from("meal_orders").select("*").eq("user_id", profile.id).gte("order_date", fromDate).lte("order_date", today),
    ctx.supabaseAdmin.from("schedule_entries").select("work_date, shift:shift_type_id(name,start_time,end_time)").eq("member_id", profile.id).gte("work_date", fromDate).lte("work_date", today)
  ]);
  for (const result of [attendanceResult, overtimeResult, mealResult, scheduleResult]) {
    if (result.error) throw result.error;
  }

  const byDate = new Map<string, any>();
  for (let index = 0; index < 50; index += 1) {
    const date = addDays(today, -index);
    byDate.set(date, {
      date,
      shiftName: "",
      shiftTime: "",
      clockIn: null,
      clockInDepartment: "",
      clockOut: null,
      clockOutDepartment: "",
      overtimeStatus: "",
      overtimeHours: 0,
      mealText: ""
    });
  }
  (scheduleResult.data || []).forEach((row: any) => {
    const record = byDate.get(row.work_date);
    if (record && row.shift) {
      record.shiftName = row.shift.name || "";
      record.shiftTime = `${String(row.shift.start_time || "").slice(0, 5)}-${String(row.shift.end_time || "").slice(0, 5)}`;
    }
  });
  (attendanceResult.data || []).forEach((row: any) => {
    const record = byDate.get(row.work_date);
    if (record) {
      record.clockIn = row.clock_in_at;
      record.clockInDepartment = row.clock_in_department_name_snapshot || "";
      record.clockOut = row.clock_out_at;
      record.clockOutDepartment = row.clock_out_department_name_snapshot || "";
      record.attendanceNote = row.attendance_note || "";
    }
  });
  (overtimeResult.data || []).forEach((row: any) => {
    const record = byDate.get(row.work_date);
    if (record) {
      record.overtimeStatus = row.status || "";
      record.overtimeHours = Number(row.total_overtime_hours || 0);
      record.overtimeNote = row.employee_note || "";
    }
  });
  const mealsByDate = new Map<string, string[]>();
  (mealResult.data || []).forEach((row: any) => {
    const list = mealsByDate.get(row.order_date) || [];
    list.push(`${row.product_name_snapshot}x${row.quantity}`);
    mealsByDate.set(row.order_date, list);
  });
  mealsByDate.forEach((list, date) => {
    const record = byDate.get(date);
    if (record) record.mealText = list.join("、");
  });

  return {
    ok: true,
    records: Array.from(byDate.values())
  };
}

async function mealStats(ctx: any) {
  const profile = await getProfile(ctx);
  if (!isManagerRole(profile.role)) {
    throw new Error("此功能限主管或管理員使用");
  }
  const today = taipeiDateString();
  const { data, error } = await ctx.supabaseAdmin
    .from("meal_orders")
    .select("*")
    .eq("order_date", today);
  if (error) throw error;
  const byProduct = new Map<string, any>();
  const details = (data || []).map((row: any) => {
    const item = byProduct.get(row.product_name_snapshot) || {
      productName: row.product_name_snapshot,
      quantity: 0,
      amount: 0
    };
    item.quantity += Number(row.quantity || 0);
    item.amount += Number(row.quantity || 0) * Number(row.unit_price || 0);
    byProduct.set(row.product_name_snapshot, item);
    return {
      employeeName: row.employee_name_snapshot,
      departmentName: row.department_name_snapshot,
      productName: row.product_name_snapshot,
      quantity: Number(row.quantity || 0),
      amount: Number(row.quantity || 0) * Number(row.unit_price || 0)
    };
  });
  return {
    ok: true,
    orderDate: today,
    summary: Array.from(byProduct.values()),
    details
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await req.json();
      if (body?.action === "personal") return Response.json(await personalRecords(ctx));
      if (body?.action === "meal_stats") return Response.json(await mealStats(ctx));
      return Response.json({ message: "不支援的報表操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "讀取報表失敗" }, { status: 400 });
    }
  })
};
