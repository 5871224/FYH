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
  return Boolean(
    profile
    && !profile.deleted_at
    && (!profile.hire_date || today >= profile.hire_date)
    && (!effectiveEndDate || today <= effectiveEndDate)
  );
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

async function getActor(ctx: any) {
  const actorId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!actorId) throw new Error("缺少登入身分");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,access_role_id,hire_date,leave_date,deleted_at")
    .eq("id", actorId)
    .is("deleted_at", null)
    .single();
  if (result.error) throw result.error;
  if (!isProfileEffective(result.data)) throw new Error("此帳號目前不在有效期間");
  return result.data;
}

async function hasPermission(ctx: any, userId: string, permission: string) {
  const result = await ctx.supabaseAdmin.rpc("has_access_permission", {
    p_user_id: userId,
    p_permission: permission
  });
  if (result.error) throw result.error;
  return Boolean(result.data);
}

async function canAccessGroup(ctx: any, userId: string, groupId: string, permission: string) {
  const result = await ctx.supabaseAdmin.rpc("can_access_group", {
    p_user_id: userId,
    p_group_id: groupId,
    p_permission: permission
  });
  if (result.error) throw result.error;
  return Boolean(result.data);
}

async function removeShiftFromMembers(ctx: any, shiftId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,schedule_shift_ids")
    .is("deleted_at", null);
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

async function hasUnarchivedSchedule(ctx: any, category: string, itemId: string) {
  const column = category === "shift"
    ? "shift_type_id"
    : category === "leave"
      ? "leave_type_id"
      : "overtime_type_id";
  const result = await ctx.supabaseAdmin.from("schedule_entries")
    .select("group_id,work_date")
    .eq(column, itemId)
    .limit(10000);
  if (result.error) throw result.error;
  for (const row of result.data || []) {
    const archived = await ctx.supabaseAdmin.rpc("is_schedule_date_archived", {
      p_group_id: row.group_id,
      p_work_date: row.work_date
    });
    if (archived.error) throw archived.error;
    if (!archived.data) return true;
  }
  return false;
}

async function deleteShift(ctx: any, actor: any, itemId: string) {
  const found = await ctx.supabaseAdmin.from("set_shift")
    .select("id,group_id,deleted_at")
    .eq("id", itemId)
    .maybeSingle();
  if (found.error) throw found.error;
  if (!found.data || found.data.deleted_at) {
    return { ok: true, deleted: false, category: "shift", itemId };
  }
  if (!found.data.group_id || !await canAccessGroup(ctx, actor.id, found.data.group_id, "schedule_manage")) {
    throw new Error("此角色不可管理該群組班別");
  }
  if (await hasUnarchivedSchedule(ctx, "shift", itemId)) {
    throw new Error("此班別仍有未封存班表，請先完成班表封存或清除相關排班");
  }
  await removeShiftFromMembers(ctx, itemId);
  const result = await ctx.supabaseAdmin.from("set_shift")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .select("id");
  if (result.error) throw result.error;
  return { ok: true, deleted: Boolean(result.data?.length), softDeleted: true, category: "shift", itemId };
}

async function deleteSharedCatalogItem(ctx: any, actor: any, category: string, itemId: string) {
  const config = CATEGORY_CONFIG[category];
  if (!await hasPermission(ctx, actor.id, "leave_settings")) {
    throw new Error("沒有假別設定權限");
  }
  const found = await ctx.supabaseAdmin.from(config.table)
    .select("id").eq("id", itemId).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) return { ok: true, deleted: false, category, itemId };
  if (await hasUnarchivedSchedule(ctx, category, itemId)) {
    throw new Error(`此${config.label}仍有未封存班表，請先完成班表封存或清除相關排班`);
  }
  const result = await ctx.supabaseAdmin.from(config.table)
    .delete().eq("id", itemId).select("id");
  if (result.error) {
    throw new Error(`此${config.label}仍有歷史關聯，暫時不可刪除`);
  }
  return { ok: true, deleted: Boolean(result.data?.length), category, itemId };
}

async function deleteCatalogItem(ctx: any, actor: any, body: any) {
  const category = String(body?.category || "").trim();
  const itemId = String(body?.itemId || "").trim();
  const config = CATEGORY_CONFIG[category];
  if (!config) throw new Error("不支援的設定類型");
  if (!itemId) throw new Error(`缺少${config.label}識別碼`);
  return category === "shift"
    ? deleteShift(ctx, actor, itemId)
    : deleteSharedCatalogItem(ctx, actor, category, itemId);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const actor = await getActor(ctx);
      const body = await req.json();
      if (body?.action === "delete") {
        return Response.json(await deleteCatalogItem(ctx, actor, body));
      }
      return Response.json({ message: "不支援的操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "刪除設定失敗" }, { status: 400 });
    }
  })
};
