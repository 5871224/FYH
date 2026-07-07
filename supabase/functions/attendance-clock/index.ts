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

function addDaysToDateString(dateString: string, count: number) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return taipeiDateString(date);
}

function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active
    && (!profile.hire_date || today >= profile.hire_date)
    && (!effectiveEndDate || today <= effectiveEndDate));
}

function getClientIp(req: Request) {
  return String(
    req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]
      || ""
  ).trim();
}

function isPhoneRequest(req: Request, requestedDeviceType: unknown) {
  const userAgent = req.headers.get("user-agent") || "";
  const clientHintMobile = req.headers.get("sec-ch-ua-mobile") === "?1";
  const isIPad = /iPad/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  const isTablet = isIPad || isAndroidTablet || /Tablet|Silk/i.test(userAgent);

  if (isTablet) return false;
  if (requestedDeviceType === "phone") return true;
  if (clientHintMobile) return true;
  if (/iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent)) return true;

  return false;
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
  if (!allowedIp || !clientIp) return false;
  return allowedIp
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(clientIp);
}

function safeAttendanceRecord(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    user_id: record.user_id,
    work_date: record.work_date,
    employee_code_snapshot: record.employee_code_snapshot || "",
    employee_name_snapshot: record.employee_name_snapshot || "",
    clock_in_at: record.clock_in_at || null,
    clock_in_department_id: record.clock_in_department_id || null,
    clock_in_department_name_snapshot: record.clock_in_department_name_snapshot || "",
    clock_in_source: record.clock_in_source || "",
    clock_out_at: record.clock_out_at || null,
    clock_out_department_id: record.clock_out_department_id || null,
    clock_out_department_name_snapshot: record.clock_out_department_name_snapshot || "",
    clock_out_source: record.clock_out_source || "",
    attendance_note: record.attendance_note || "",
    created_at: record.created_at,
    updated_at: record.updated_at
  };
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
  if (!isProfileEffective(data)) {
    throw new Error("帳號不在有效任職期間，無法打卡");
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
  return safeAttendanceRecord(data);
}

async function getEnabledDepartments(ctx: any) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_departments")
    .select("id, name, address, latitude, longitude, attendance_enabled, public_ip")
    .eq("attendance_enabled", true);
  if (error) throw error;
  return data || [];
}

async function resolveClockLocation(ctx: any, req: Request, body: any) {
  const departments = await getEnabledDepartments(ctx);
  if (!departments.length) {
    throw new Error("目前沒有啟用打卡的單位，請先到修改單位設定打卡資料");
  }

  const allowGps = isPhoneRequest(req, body?.deviceType);
  const latitude = toNumber(body?.latitude);
  const longitude = toNumber(body?.longitude);
  const accuracy = toNumber(body?.accuracy);
  if (allowGps && latitude !== null && longitude !== null
    && accuracy !== null && accuracy <= MAX_GPS_ACCURACY_METERS) {
    const gpsMatch = departments
      .map((department: any) => {
        const departmentLatitude = toNumber(department.latitude);
        const departmentLongitude = toNumber(department.longitude);
        if (departmentLatitude === null || departmentLongitude === null) return null;
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
      latitude: null,
      longitude: null,
      accuracy: null,
      distance: null,
      ip: clientIp
    };
  }

  throw new Error(clientIp
    ? `目前 IP ${clientIp} 不在可打卡單位設定內，請改用手機 GPS 或請管理員確認固定 IP`
    : "目前無法取得可用的 GPS 或固定 IP 打卡位置");
}

async function clock(ctx: any, req: Request, body: any, kind: "clock_in" | "clock_out") {
  const profile = await getProfile(ctx);
  const workDate = taipeiDateString();
  const location = await resolveClockLocation(ctx, req, body);
  const { data, error } = await ctx.supabaseAdmin.rpc("save_attendance_clock", {
    p_user_id: profile.id,
    p_work_date: workDate,
    p_kind: kind,
    p_location: {
      departmentId: location.department.id,
      source: location.source,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      distance: location.distance,
      ip: location.ip || ""
    }
  });
  if (error) throw error;
  return {
    ...data,
    record: safeAttendanceRecord(data?.record)
  };
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
      if (body?.action === "clock_in") return Response.json(await clock(ctx, req, body, "clock_in"));
      if (body?.action === "clock_out") return Response.json(await clock(ctx, req, body, "clock_out"));
      return Response.json({ message: "不支援的打卡操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "打卡失敗" }, { status: 400 });
    }
  })
};
