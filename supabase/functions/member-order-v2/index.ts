import { withSupabase } from "npm:@supabase/server@^1";

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(value: string, count: number) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return taipeiDate(date);
}

function isEffective(profile: any, today = taipeiDate()) {
  const endDate = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean((!profile.hire_date || today >= profile.hire_date)
    && (!endDate || today <= endDate)
  );
}

async function requireProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  const result = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,role,hire_date,leave_date")
    .eq("id", userId)
    .single();
  if (result.error) throw result.error;
  if (!isEffective(result.data)) throw new Error("此帳號目前不在有效期間");
  return result.data;
}

async function listOrder(ctx: any) {
  await requireProfile(ctx);
  const result = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,sort_order,employee_code")
    .order("sort_order", { ascending: true })
    .order("employee_code", { ascending: true });
  if (result.error) throw result.error;
  return {
    ok: true,
    memberIds: (result.data || []).map((row: any) => row.id).filter(Boolean)
  };
}

async function saveOrder(ctx: any, body: any) {
  const profile = await requireProfile(ctx);
  if (!["manager", "admin"].includes(String(profile.role || ""))) {
    throw new Error("此功能需要主管權限");
  }

  const memberIds = [...new Set(
    (Array.isArray(body?.memberIds) ? body.memberIds : [])
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean)
  )];
  if (!memberIds.length) throw new Error("缺少人員排序資料");

  const existingResult = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id")
    .in("id", memberIds);
  if (existingResult.error) throw existingResult.error;
  const existingIds = new Set((existingResult.data || []).map((row: any) => row.id));
  const validIds = memberIds.filter((id: string) => existingIds.has(id));

  for (let index = 0; index < validIds.length; index += 1) {
    const updateResult = await ctx.supabaseAdmin
      .from("set_employee")
      .update({ sort_order: index })
      .eq("id", validIds[index]);
    if (updateResult.error) throw updateResult.error;
  }

  return { ok: true, memberIds: validIds };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await req.json();
      if (body?.action === "list") return Response.json(await listOrder(ctx));
      if (body?.action === "save") return Response.json(await saveOrder(ctx, body));
      return Response.json({ message: "不支援的人員排序操作" }, { status: 400 });
    } catch (error) {
      return Response.json({
        message: error instanceof Error ? error.message : "人員排序處理失敗"
      }, { status: 400 });
    }
  })
};
