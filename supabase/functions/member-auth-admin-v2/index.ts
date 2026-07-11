import { withSupabase } from "npm:@supabase/server@^1";

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
  return Boolean((!profile.hire_date || today >= profile.hire_date) && (!end || today <= end));
}

function firstText(...values: unknown[]) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function memberPayload(body: any) {
  return body?.member || body?.profile || body?.data || body?.payload || body || {};
}

function requestedCode(body: any) {
  const member = memberPayload(body);
  return firstText(
    member.employeeCode,
    member.employee_code,
    member.code,
    body?.employeeCode,
    body?.employee_code,
    body?.code,
    body?.previousEmployeeCode
  );
}

function requestedId(body: any) {
  const member = memberPayload(body);
  return firstText(member.id, member.userId, member.user_id, body?.id, body?.userId, body?.user_id);
}

function cloneWithRole(value: any, role: string): any {
  if (Array.isArray(value)) return value.map((item) => cloneWithRole(item, role));
  if (!value || typeof value !== "object") return value;
  const next: any = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = key === "role" ? role : cloneWithRole(item, role);
  }
  return next;
}

async function actor(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,role,hire_date,leave_date")
    .eq("id", userId).single();
  if (result.error) throw result.error;
  if (!effective(result.data) || !["manager", "admin"].includes(result.data.role)) {
    throw new Error("此功能限主管或管理員使用");
  }
  return result.data;
}

async function targetProfile(ctx: any, body: any) {
  const id = requestedId(body);
  const code = requestedCode(body);
  if (id) {
    const result = await ctx.supabaseAdmin.from("set_employee")
      .select("id,employee_code,role").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    if (result.data) return result.data;
  }
  if (code) {
    const result = await ctx.supabaseAdmin.from("set_employee")
      .select("id,employee_code,role").eq("employee_code", code).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }
  return null;
}

async function forward(req: Request, body: any) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) throw new Error("伺服器缺少 Supabase 網址設定");
  const response = await fetch(`${url}/functions/v1/member-auth-admin`, {
    method: "POST",
    headers: {
      apikey: req.headers.get("apikey") || "",
      Authorization: req.headers.get("Authorization") || "",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || "人員管理失敗");
  return result;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const currentActor = await actor(ctx);
      let body = await req.json();
      const action = String(body?.action || "");
      const target = await targetProfile(ctx, body);

      if (currentActor.role === "manager") {
        if (target?.role === "admin") throw new Error("主管不可修改、刪除或重設管理員帳號");

        if (action === "upsert_member") {
          const preservedRole = target?.role || "employee";
          body = cloneWithRole(body, preservedRole);
        }

        if (action === "delete_member" && target?.role && !["employee", "manager"].includes(target.role)) {
          throw new Error("主管無權刪除此帳號");
        }
      }

      return Response.json(await forward(req, body));
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "人員管理失敗" }, { status: 400 });
    }
  })
};
