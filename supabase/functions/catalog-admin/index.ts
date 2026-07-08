import { withSupabase } from "npm:@supabase/server@^1";

const CATEGORY_CONFIG: Record<string, { table: string; label: string }> = {
  shift: { table: "set_shift", label: "班別" },
  leave: { table: "set_leave", label: "假別" },
  overtime: { table: "set_overtime", label: "加班" }
};

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
  return Boolean(profile?.is_active !== false && (!profile.hire_date || today >= profile.hire_date) && (!effectiveEndDate || today <= effectiveEndDate));
}

async function requireManager(ctx: any) {
  const actorId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!actorId) throw new Error("缺少登入身分");
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("role,is_active,hire_date,leave_date")
    .eq("id", actorId)
    .single();
  if (error) throw error;
  if (!isProfileEffective(data) || !["manager", "admin"].includes(data?.role)) {
    throw new Error("此功能限主管或管理員使用");
  }
}

function normalizeTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  const body = text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1) : text;
  return body.split(",").map((item) => item.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

async function removeShiftFromMembers(ctx: any, shiftId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,schedule_shift_ids");
  if (error) throw error;

  for (const profile of data || []) {
    const currentIds = normalizeTextArray(profile.schedule_shift_ids);
    if (!currentIds.includes(shiftId)) continue;
    const { error: updateError } = await ctx.supabaseAdmin
      .from("set_employee")
      .update({ schedule_shift_ids: currentIds.filter((id) => id !== shiftId) })
      .eq("id", profile.id);
    if (updateError) throw updateError;
  }
}

async function deleteCatalogItem(ctx: any, body: any) {
  const category = String(body?.category || "").trim();
  const itemId = String(body?.itemId || "").trim();
  const config = CATEGORY_CONFIG[category];
  if (!config) throw new Error("不支援的設定類型");
  if (!itemId) throw new Error(`缺少${config.label}識別碼`);

  const { data: existing, error: findError } = await ctx.supabaseAdmin
    .from(config.table)
    .select("id")
    .eq("id", itemId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return { ok: true, deleted: false, category, itemId };

  if (category === "shift") {
    await removeShiftFromMembers(ctx, itemId);
  }

  const { data, error } = await ctx.supabaseAdmin
    .from(config.table)
    .delete()
    .eq("id", itemId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(`${config.label}刪除失敗，請重新整理後再試`);

  return { ok: true, deleted: true, category, itemId };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      await requireManager(ctx);
      const body = await req.json();
      if (body?.action === "delete") {
        return Response.json(await deleteCatalogItem(ctx, body));
      }
      return Response.json({ message: "不支援的操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "刪除設定失敗" }, { status: 400 });
    }
  })
};
