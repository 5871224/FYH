import { withSupabase } from "npm:@supabase/server@^1";

type MemberPayload = {
  employeeCode?: string;
  fullName?: string;
  role?: string;
  hireDate?: string | null;
  leaveDate?: string | null;
  payByDay?: boolean;
  fixedRestWeekday?: number;
  homeDepartmentId?: string;
  scheduleShiftIds?: string[];
  monthlyRestDays?: number;
};

const DEFAULT_PASSWORD = "0000";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || "").trim());
}

function buildLoginEmail(employeeCode: string) {
  const normalized = String(employeeCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new Error("工號無法建立登入帳號");
  }
  // ponytail: 用 local.invalid 建內部登入帳號，完全不依賴真實信箱；日後接公司信箱時再換 email 規則。
  return `${normalized}@local.invalid`;
}

function normalizeRole(role: string | undefined) {
  return role === "admin" || role === "manager" ? role : "employee";
}

function hasManagerAccess(role: string | undefined) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "admin" || normalizedRole === "manager";
}

function hasAdminAccess(role: string | undefined) {
  return normalizeRole(role) === "admin";
}

function normalizeMember(member: MemberPayload) {
  const employeeCode = String(member?.employeeCode || "").trim();
  const fullName = String(member?.fullName || "").trim();
  if (!employeeCode || !fullName) {
    throw new Error("缺少工號或姓名");
  }
  return {
    employeeCode,
    fullName,
    role: normalizeRole(member?.role),
    hireDate: member?.hireDate || null,
    leaveDate: member?.leaveDate || null,
    payByDay: Boolean(member?.payByDay),
    fixedRestWeekday: Math.min(6, Math.max(0, Number(member?.fixedRestWeekday) || 0)),
    homeDepartmentId: String(member?.homeDepartmentId || "").trim(),
    scheduleShiftIds: Array.isArray(member?.scheduleShiftIds)
      ? member.scheduleShiftIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    authEmail: buildLoginEmail(employeeCode)
  };
}

async function getActorRole(ctx: any) {
  const actorId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!actorId) {
    throw new Error("缺少登入身分");
  }
  const { data, error } = await ctx.supabase
    .from("set_employee")
    .select("role")
    .eq("id", actorId)
    .single();
  if (error) {
    throw error;
  }
  return data?.role || "";
}

async function findProfile(ctx: any, currentCode: string, previousCode: string) {
  const codes = Array.from(new Set([previousCode, currentCode].map((value) => String(value || "").trim()).filter(Boolean)));
  for (const code of codes) {
    const { data, error } = await ctx.supabaseAdmin
      .from("set_employee")
      .select("id, employee_code, role")
      .eq("employee_code", code)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return data;
    }
  }
  return null;
}

async function resolveDepartmentUuid(ctx: any, departmentId: string) {
  const itemId = String(departmentId || "").trim();
  if (!isUuid(itemId)) {
    return null;
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("set_departments")
    .select("id")
    .eq("id", itemId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data?.id || null;
}

async function upsertMember(ctx: any, body: any) {
  const member = normalizeMember(body?.member || {});
  const previousEmployeeCode = String(body?.previousEmployeeCode || member.employeeCode).trim();
  const password = String(body?.defaultPassword || DEFAULT_PASSWORD);
  const profile = await findProfile(ctx, member.employeeCode, previousEmployeeCode);
  const homeDepartmentUuid = await resolveDepartmentUuid(ctx, member.homeDepartmentId || "");
  const actorRole = normalizeRole(body?.actorRole);
  if (!hasAdminAccess(actorRole)) {
    if (!profile && member.role !== "employee") {
      throw new Error("只有管理員可以新增主管或管理員");
    }
    if (profile?.role === "admin") {
      throw new Error("只有管理員可以修改管理員帳號");
    }
    if (profile && member.role !== normalizeRole(profile.role)) {
      throw new Error("只有管理員可以修改人員權限");
    }
  }

  if (!profile) {
    const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: member.authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        employee_code: member.employeeCode,
        full_name: member.fullName
      }
    });
    if (error) {
      throw error;
    }
    const userId = data.user?.id;
    if (!userId) {
      throw new Error("建立登入帳號失敗");
    }
    const { error: insertError } = await ctx.supabaseAdmin
      .from("set_employee")
      .insert({
        id: userId,
        employee_code: member.employeeCode,
        full_name: member.fullName,
        role: member.role,
        hire_date: member.hireDate,
        leave_date: member.leaveDate,
        pay_by_day: member.payByDay,
        fixed_rest_weekday: member.fixedRestWeekday,
        home_department_id: homeDepartmentUuid,
        schedule_shift_ids: member.scheduleShiftIds,
        monthly_rest_days: member.monthlyRestDays
      });
    if (insertError) {
      throw insertError;
    }
    return {
      ok: true,
      created: true,
      employeeCode: member.employeeCode,
      authEmail: member.authEmail
    };
  }

  const { error: updateAuthError } = await ctx.supabaseAdmin.auth.admin.updateUserById(profile.id, {
    email: member.authEmail,
    email_confirm: true,
    user_metadata: {
      employee_code: member.employeeCode,
      full_name: member.fullName
    }
  });
  if (updateAuthError && !/not found/i.test(String(updateAuthError.message || updateAuthError))) {
    throw updateAuthError;
  }
  const { error: updateProfileError } = await ctx.supabaseAdmin
    .from("set_employee")
    .update({
      employee_code: member.employeeCode,
      full_name: member.fullName,
      role: member.role,
      hire_date: member.hireDate,
      leave_date: member.leaveDate,
      pay_by_day: member.payByDay,
      fixed_rest_weekday: member.fixedRestWeekday,
      home_department_id: homeDepartmentUuid,
      schedule_shift_ids: member.scheduleShiftIds,
      monthly_rest_days: member.monthlyRestDays
    })
    .eq("id", profile.id);
  if (updateProfileError) {
    throw updateProfileError;
  }

  return {
      ok: true,
      created: false,
      employeeCode: member.employeeCode,
      authEmail: member.authEmail
  };
}

async function resetPassword(ctx: any, body: any) {
  const employeeCode = String(body?.employeeCode || "").trim();
  const password = String(body?.password || DEFAULT_PASSWORD);
  if (!employeeCode) {
    throw new Error("缺少工號");
  }
  const profile = await findProfile(ctx, employeeCode, employeeCode);
  if (!profile?.id) {
    return new Response(JSON.stringify({ message: "找不到這位人員的登入帳號" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (normalizeRole(profile.role) === "admin" && !hasAdminAccess(body?.actorRole)) {
    throw new Error("只有管理員可以重設管理員密碼");
  }
  const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(profile.id, {
    password
  });
  if (error) {
    throw error;
  }
  return {
    ok: true,
    employeeCode,
    password
  };
}

console.assert(buildLoginEmail("SELF_CHECK") === "self_check@local.invalid", "member-auth-admin buildLoginEmail failed");

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const actorRole = await getActorRole(ctx);
      if (!hasManagerAccess(actorRole)) {
        return new Response(JSON.stringify({ message: "此功能限主管使用" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      const body = await req.json();
      body.actorRole = actorRole;
      if (body?.action === "upsert_member") {
        return Response.json(await upsertMember(ctx, body));
      }
      if (body?.action === "reset_password") {
        const result = await resetPassword(ctx, body);
        if (result instanceof Response) {
          return result;
        }
        return Response.json(result);
      }

      return new Response(JSON.stringify({ message: "不支援的操作" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ message: error instanceof Error ? error.message : "系統錯誤" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
};
