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
  scheduleDepartmentIds?: string[];
  monthlyRestDays?: number;
};

const DEFAULT_PASSWORD = "0000";

function buildLoginEmail(employeeCode: string) {
  const normalized = String(employeeCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new Error("Â∑•Ë??ºÂ??°Ê?Âª∫Á??ªÂÖ•Â∏≥Ë?");
  }
  // ponytail: ?àÁî® local.invalid ?öÂÖß?®Áôª?•Â∏≥?üÔ?ÂÆåÂÖ®‰∏ç‰?Ë≥¥Á?ÂØ¶‰ø°ÁÆ±Ô??•‰?ÂæåË??•ÂÖ¨?∏‰ø°ÁÆ±Ô??çÊ??ôË£°?πÊ?Ê≠?? email Ë¶èÂ???  return `${normalized}@local.invalid`;
}

function normalizeRole(role: string | undefined) {
  return role === "manager" ? "manager" : "employee";
}

function normalizeMember(member: MemberPayload) {
  const employeeCode = String(member?.employeeCode || "").trim();
  const fullName = String(member?.fullName || "").trim();
  if (!employeeCode || !fullName) {
    throw new Error("Áº∫Â?Â∑•Ë??ñÂ???);
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
    scheduleDepartmentIds: Array.isArray(member?.scheduleDepartmentIds)
      ? member.scheduleDepartmentIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    loginEmail: buildLoginEmail(employeeCode)
  };
}

async function getActorRole(ctx: any) {
  const actorId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!actorId) {
    throw new Error("?æ‰??∞Áôª?•Ë∫´‰ª?);
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
      .select("id, employee_code, login_email")
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

async function resolveDepartmentUuid(ctx: any, schedulerItemId: string) {
  const itemId = String(schedulerItemId || "").trim();
  if (!itemId) {
    return null;
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("set_departments")
    .select("id")
    .eq("scheduler_item_id", itemId)
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
  const homeDepartmentUuid = await resolveDepartmentUuid(ctx, member.homeDepartmentId || member.scheduleDepartmentIds[0] || "");

  if (!profile) {
    const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: member.loginEmail,
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
      throw new Error("Âª∫Á??ªÂÖ•Â∏≥Ë?Â§±Ê?");
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
        schedule_department_ids: member.scheduleDepartmentIds,
        monthly_rest_days: member.monthlyRestDays,
        login_email: member.loginEmail
      });
    if (insertError) {
      throw insertError;
    }
    return {
      ok: true,
      created: true,
      employeeCode: member.employeeCode,
      loginEmail: member.loginEmail
    };
  }

  const { error: updateAuthError } = await ctx.supabaseAdmin.auth.admin.updateUserById(profile.id, {
    email: member.loginEmail,
    email_confirm: true,
    user_metadata: {
      employee_code: member.employeeCode,
      full_name: member.fullName
    }
  });
  if (updateAuthError && !/not found/i.test(String(updateAuthError.message || updateAuthError))) {
    throw updateAuthError;
  }
  const authUserSynced = !updateAuthError;

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
      schedule_department_ids: member.scheduleDepartmentIds,
      monthly_rest_days: member.monthlyRestDays,
      login_email: authUserSynced ? member.loginEmail : null
    })
    .eq("id", profile.id);
  if (updateProfileError) {
    throw updateProfileError;
  }

  return {
    ok: true,
    created: false,
    employeeCode: member.employeeCode,
    loginEmail: member.loginEmail
  };
}

async function resetPassword(ctx: any, body: any) {
  const employeeCode = String(body?.employeeCode || "").trim();
  const password = String(body?.password || DEFAULT_PASSWORD);
  if (!employeeCode) {
    throw new Error("Áº∫Â?Â∑•Ë?");
  }
  const profile = await findProfile(ctx, employeeCode, employeeCode);
  if (!profile?.id) {
    return new Response(JSON.stringify({ message: "?æ‰??∞ÈÄô‰?‰∫∫Âì°?ÑÁôª?•Ë??? }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
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
      if (actorRole !== "manager") {
        return new Response(JSON.stringify({ message: "Ê≠§Â??ΩÈ?‰∏ªÁÆ°‰ΩøÁî®" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      const body = await req.json();
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

      return new Response(JSON.stringify({ message: "‰∏çÊîØ?¥Á??ï‰?" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ message: error instanceof Error ? error.message : "Á≥ªÁµ±?ØË™§" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
};
