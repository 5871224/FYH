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
  return Boolean(
    profile
      && !profile.deleted_at
      && profile.group_id
      && (!profile.hire_date || today >= profile.hire_date)
      && (!effectiveEndDate || today <= effectiveEndDate)
  );
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
  const isIPad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  const isTablet = isIPad || isAndroidTablet || /Tablet|Silk/i.test(userAgent);
  if (isTablet) return false;
  if (requestedDeviceType === "phone" || clientHintMobile) return true;
  return /iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent);
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
  return allowedIp.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean).includes(clientIp);
}

function safeLocation(location: any) {
  if (!location || typeof location !== "object") return null;
  return {
    departmentId: location.departmentId || "",
    name: location.name || "",
    address: location.address || "",
    source: location.source || "",
    accuracy: location.accuracy ?? null,
    distance: location.distance ?? null
  };
}

function safeAttendanceRecord(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    user_id: record.user_id,
    work_date: record.work_date,
    clock_in_at: record.clock_in_at || null,
    clock_in_location: safeLocation(record.clock_in_location),
    clock_out_at: record.clock_out_at || null,
    clock_out_location: safeLocation(record.clock_out_location),
    regular_minutes: record.regular_minutes ?? null,
    overtime_minutes: record.overtime_minutes ?? null,
    note: record.note || "",
    reviewed_at: record.reviewed_at || null,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

async function getProfile(ctx: any) {
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!userId) throw new Error("請先登入");
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,employee_code,full_name,group_id,hire_date,leave_date,deleted_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  if (!isProfileEffective(data)) throw new Error("帳號不在有效任職期間或尚未設定群組，無法打卡");
  return data;
}

async function getTodayRecord(ctx: any, userId: string, workDate = taipeiDateString()) {
  const { data, error } = await ctx.supabaseAdmin
    .from("attendance_days")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw error;
  return safeAttendanceRecord(data);
}

async function getEnabledDepartments(ctx: any, groupId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_departments")
    .select("id,name,address,latitude,longitude,attendance_enabled,public_ip,group_id,deleted_at")
    .eq("group_id", groupId)
    .eq("attendance_enabled", true)
    .is("deleted_at", null);
  if (error) throw error;
  return data || [];
}

async function resolveClockLocation(ctx: any, req: Request, body: any, groupId: string) {
  const departments = await getEnabledDepartments(ctx, groupId);
  if (!departments.length) throw new Error("所屬群組目前沒有啟用打卡的單位，請洽管理員確認打卡設定");

  const allowGps = isPhoneRequest(req, body?.deviceType);
  const latitude = toNumber(body?.latitude);
  const longitude = toNumber(body?.longitude);
  const accuracy = toNumber(body?.accuracy);
  let gpsFailure = "";

  if (allowGps && latitude !== null && longitude !== null && accuracy !== null && accuracy <= MAX_GPS_ACCURACY_METERS) {
    const gpsMatch = departments
      .map((department: any) => {
        const departmentLatitude = toNumber(department.latitude);
        const departmentLongitude = toNumber(department.longitude);
        if (departmentLatitude === null || departmentLongitude === null) return null;
        return { department, distance: distanceMeters(latitude, longitude, departmentLatitude, departmentLongitude) };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance - b.distance)[0];
    if (gpsMatch && gpsMatch.distance <= MAX_GPS_DISTANCE_METERS) {
      return {
        departmentId: gpsMatch.department.id,
        name: gpsMatch.department.name || "",
        address: gpsMatch.department.address || "",
        source: "GPS",
        latitude,
        longitude,
        accuracy,
        distance: Math.round(gpsMatch.distance),
        ip: getClientIp(req)
      };
    }
    gpsFailure = gpsMatch
      ? `目前距離最近可打卡單位約 ${Math.round(gpsMatch.distance)} 公尺，需在 ${MAX_GPS_DISTANCE_METERS} 公尺內`
      : "所屬群組已啟用打卡的單位尚未設定經緯度";
  } else if (allowGps) {
    if (body?.geolocationError) gpsFailure = String(body.geolocationError);
    else if (latitude === null || longitude === null || accuracy === null) gpsFailure = "手機沒有提供 GPS 定位，請允許瀏覽器定位後再打卡";
    else if (accuracy > MAX_GPS_ACCURACY_METERS) gpsFailure = `手機 GPS 精度約 ${Math.round(accuracy)} 公尺，需小於 ${MAX_GPS_ACCURACY_METERS} 公尺`;
  }

  const clientIp = getClientIp(req);
  const ipDepartment = departments.find((department: any) => ipMatches(String(department.public_ip || ""), clientIp));
  if (ipDepartment) {
    return {
      departmentId: ipDepartment.id,
      name: ipDepartment.name || "",
      address: ipDepartment.address || "",
      source: "IP",
      latitude: null,
      longitude: null,
      accuracy: null,
      distance: null,
      ip: clientIp
    };
  }

  console.warn("attendance-location-rejected", {
    groupId,
    reason: gpsFailure || "IP_NOT_ALLOWED",
    hasClientIp: Boolean(clientIp)
  });
  throw new Error("目前位置或網路不符合所屬群組的打卡條件，請確認定位權限或洽管理員");
}

async function clock(ctx: any, req: Request, body: any, kind: "clock_in" | "clock_out") {
  const profile = await getProfile(ctx);
  const workDate = taipeiDateString();
  const location = await resolveClockLocation(ctx, req, body, profile.group_id);
  const { data, error } = await ctx.supabaseAdmin.rpc("save_attendance_clock", {
    p_user_id: profile.id,
    p_work_date: workDate,
    p_kind: kind,
    p_location: location
  });
  if (error) throw error;
  return { ...data, record: safeAttendanceRecord(data?.record) };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const body = await req.json();
      const profile = await getProfile(ctx);
      if (body?.action === "today") {
        return Response.json({ ok: true, profile, record: await getTodayRecord(ctx, profile.id), serverDate: taipeiDateString() });
      }
      if (body?.action === "clock_in") return Response.json(await clock(ctx, req, body, "clock_in"));
      if (body?.action === "clock_out") return Response.json(await clock(ctx, req, body, "clock_out"));
      return Response.json({ message: "不支援的打卡操作" }, { status: 400 });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "打卡失敗" }, { status: 400 });
    }
  })
};
