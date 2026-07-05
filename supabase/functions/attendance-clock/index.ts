import { withSupabase } from "npm:@supabase/server@^1";

const MAX_GPS_DISTANCE_METERS = 300;
const MAX_GPS_ACCURACY_METERS = 300;

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getClientIp(req: Request) {
  return String(
    req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]
      || ""
  ).trim();
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ipMatches(allowedIp: string, clientIp: string) {
  if (!allowedIp || !clientIp) {
    return false;
  }
  return allowedIp
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(clientIp);
}

async function getProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) {
    throw new Error("請先登入");
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id, employee_code, full_name, role, is_active, hire_date, leave_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const today = taipeiDateString();
  if (!data?.is_active || (data.hire_date && today < data.hire_date) || (data.leave_date && today > data.leave_date)) {
    throw new Error("此帳號目前不在有效期間，無法打卡");
  }
  return data;
}

async function getTodayRecord(ctx: any, userId: string, workDate = taipeiDateString()) {
  const { data, error } = await ctx.supabaseAdmin
    .from("attendance_records")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getEnabledDepartments(ctx: any) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_departments")
    .select("id, name, address, latitude, longitude, public_ip, attendance_enabled")
    .eq("attendance_enabled", true);
  if (error) throw error;
  return data || [];
}

async function resolveClockLocation(ctx: any, req: Request, body: any) {
  const departments = await getEnabledDepartments(ctx);
  if (!departments.length) {
    throw new Error("目前沒有啟用中的打卡地點，請聯絡管理員");
  }

  const latitude = toNumber(body?.latitude);
  const longitude = toNumber(body?.longitude);
  const accuracy = toNumber(body?.accuracy);
  if (latitude !== null && longitude !== null && accuracy !== null && accuracy <= MAX_GPS_ACCURACY_METERS) {
    const gpsMatch = departments
      .map((department: any) => {
        const departmentLatitude = toNumber(department.latitude);
        const departmentLongitude = toNumber(department.longitude);
        if (departmentLatitude === null || departmentLongitude === null) {
          return null;
        }
        return {
          department,
          distance: distanceMeters(latitude, longitude, departmentLatitude, departmentLongitude)
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance - b.distance)[0];
    if (gpsMatch && gpsMatch.distance <= MAX_GPS_DISTANCE_METERS) {
      return {
        department: gpsMatch.department,
        source: "GPS",
        latitude,
        longitude,
        accuracy,
        distance: Math.round(gpsMatch.distance),
        ip: getClientIp(req)
      };
    }
  }

  const clientIp = getClientIp(req);
  const ipDepartment = departments.find((department: any) => ipMatches(String(department.public_ip || ""), clientIp));
  if (ipDepartment) {
    return {
      department: ipDepartment,
      source: "IP",
      latitude,
      longitude,
      accuracy,
      distance: null,
      ip: clientIp
    };
  }

  throw new Error(clientIp
    ? `目前網路 IP 為 ${clientIp}，未列入公司允許的打卡 IP，請確認已連接公司網路，或聯絡管理員確認 IP 設定。`
    : "目前位置或網路不符合打卡條件，請確認已到公司地點或連接公司網路。");
}

function buildClockFields(kind: "clock_in" | "clock_out", location: any, nowIso: string) {
  return {
    [`${kind}_at`]: nowIso,
    [`${kind}_department_id`]: location.department.id,
    [`${kind}_department_name_snapshot`]: location.department.name || "",
    [`${kind}_address_snapshot`]: location.department.address || "",
    [`${kind}_source`]: location.source,
    [`${kind}_latitude`]: location.latitude,
    [`${kind}_longitude`]: location.longitude,
    [`${kind}_accuracy`]: location.accuracy,
    [`${kind}_distance`]: location.distance,
    [`${kind}_ip`]: location.ip || "",
    updated_at: nowIso
  };
}

async function writeLog(ctx: any, recordId: string, actionType: string, operator: any) {
  await ctx.supabaseAdmin.from("attendance_action_logs").insert({
    attendance_record_id: recordId,
    action_type: actionType,
    operator_user_id: operator.id,
    operator_name_snapshot: operator.full_name || ""
  });
}

async function clock(ctx: any, req: Request, body: any, kind: "clock_in" | "clock_out") {
  const profile = await getProfile(ctx);
  const workDate = taipeiDateString();
  const existing = await getTodayRecord(ctx, profile.id, workDate);
  if (existing?.[`${kind}_at`]) {
    return { ok: true, record: existing, duplicate: true, serverDate: workDate };
  }
  if (kind === "clock_in" && existing?.clock_out_at) {
    throw new Error("已完成下班打卡，不能再補打上班卡");
  }

  const location = await resolveClockLocation(ctx, req, body);
  const nowIso = new Date().toISOString();
  const fields = buildClockFields(kind, location, nowIso);
  let record = existing;

  if (record) {
    const { data, error } = await ctx.supabaseAdmin
      .from("attendance_records")
      .update(fields)
      .eq("id", record.id)
      .select("*")
      .single();
    if (error) throw error;
    record = data;
  } else {
    const { data, error } = await ctx.supabaseAdmin
      .from("attendance_records")
      .insert({
        user_id: profile.id,
        work_date: workDate,
        ...fields
      })
      .select("*")
      .single();
    if (error) throw error;
    record = data;
  }

  await writeLog(ctx, record.id, kind, profile);
  return { ok: true, record, duplicate: false, serverDate: workDate };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await req.json();
      const profile = await getProfile(ctx);
      if (body?.action === "today") {
        return Response.json({
          ok: true,
          profile,
          record: await getTodayRecord(ctx, profile.id),
          serverDate: taipeiDateString()
        });
      }
      if (body?.action === "clock_in") {
        return Response.json(await clock(ctx, req, body, "clock_in"));
      }
      if (body?.action === "clock_out") {
        return Response.json(await clock(ctx, req, body, "clock_out"));
      }
      return Response.json({ message: "不支援的打卡操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "打卡失敗" }, { status: 400 });
    }
  })
};
