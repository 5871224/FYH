export const TAIPEI_TIME_ZONE = "Asia/Taipei";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TAIPEI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TAIPEI_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function taipeiDateString(date = new Date()) {
  return DATE_FORMATTER.format(date);
}

export function taipeiTimeString(date = new Date()) {
  return TIME_FORMATTER.format(date);
}

export function addDaysToDateString(value: string, count: number) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + count);
  return DATE_FORMATTER.format(date);
}

export function validDate(value: unknown, fallback: string) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

export function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

export function positiveInteger(value: unknown, fallback = 55) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

export function isProfileEffective(profile: any, today = taipeiDateString()) {
  if (!profile || profile.deleted_at) return false;
  const effectiveEndDate = profile.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return (!profile.hire_date || today >= profile.hire_date)
    && (!effectiveEndDate || today <= effectiveEndDate);
}

export function isProfileEmployedOn(profile: any, date: string) {
  return Boolean(profile
    && (!profile.hire_date || date >= profile.hire_date)
    && (!profile.leave_date || date <= profile.leave_date));
}

export function datesBetween(fromDate: string, toDate: string) {
  const dates: string[] = [];
  for (let date = fromDate; date && date <= toDate; date = addDaysToDateString(date, 1)) dates.push(date);
  return dates;
}

export function actorIdOf(ctx: any) {
  const actorId = String(ctx.userClaims?.sub || ctx.userClaims?.id || "").trim();
  if (!isUuid(actorId)) throw new Error("缺少有效登入身分");
  return actorId;
}

export async function rpcBoolean(ctx: any, name: string, payload: Record<string, unknown>) {
  const { data, error } = await ctx.supabaseAdmin.rpc(name, payload);
  if (error) throw error;
  return data === true;
}

export function hasPermission(ctx: any, actorId: string, permission: string) {
  return rpcBoolean(ctx, "has_access_permission", { p_user_id: actorId, p_permission: permission });
}

export function canAccessGroup(ctx: any, actorId: string, groupId: string, permission: string) {
  if (!isUuid(groupId)) return Promise.resolve(false);
  return rpcBoolean(ctx, "can_access_group", { p_user_id: actorId, p_group_id: groupId, p_permission: permission });
}
