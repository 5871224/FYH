const fs = require("fs");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function replaceOne(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`找不到要修改的內容：${label}`);
  return content.replace(pattern, replacement);
}

const webApiFile = "src/renderer/web-api.js";
let webApi = read(webApiFile);
const newAttendanceExport = `  async function exportAttendanceReview(filters = {}) {
    ensureSignedIn();
    const result = await requestFunction("attendance-ledger-export", {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId || ""
    });
    const exportRows = (Array.isArray(result.rows) ? result.rows : []).flatMap((row) => {
      const scheduledStart = row.restDayScheduled ? String(row.scheduledShiftStartTime || "") : "";
      const scheduledEnd = row.restDayScheduled ? String(row.scheduledShiftEndTime || "") : "";
      if (scheduledStart && scheduledEnd) {
        return [{
          employee_code: row.employee_code || "",
          work_date: row.work_date || "",
          overtime_type_id: "attendance-rest-day",
          overtime_start_time: scheduledStart,
          overtime_end_time: scheduledEnd,
          overtime_previous_day: 0,
          overtime_subsidy_type: 1,
          overtime_use_rest_1: false,
          overtime_use_rest_2: false
        }];
      }
      if (!(Number(row.overtimeHours) > 0)) return [];
      return [{
        employee_code: row.employee_code || "",
        work_date: row.work_date || "",
        overtime_type_id: "attendance-ledger",
        overtime_start_time: "00:00",
        overtime_end_time: formatOvertimeHoursAsTime(row.overtimeHours),
        overtime_previous_day: 0,
        overtime_subsidy_type: 1,
        overtime_use_rest_1: false,
        overtime_use_rest_2: false
      }];
    });
    return exportOvertime({
      startDate: filters.fromDate,
      endDate: filters.toDate,
      exportRows
    });
  }

  async function exportMembers`;
webApi = replaceOne(
  webApi,
  /  async function exportAttendanceReview\(filters = \{\}\) \{[\s\S]*?\n  \}\n\n  async function exportMembers/,
  newAttendanceExport,
  "web-api exportAttendanceReview"
);
write(webApiFile, webApi);

const edgeFile = "supabase/functions/attendance-ledger-export/index.ts";
const edgeContent = String.raw`import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, canAccessGroup, hasPermission, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";

function scheduleKey(memberId: string, workDate: string) {
  return memberId + ":" + workDate;
}

function isRestDayLeave(leave: any) {
  const code = String(leave?.code || "").trim();
  const name = String(leave?.name || "").trim();
  return code === "0036" || code === "0047" || name === "例假" || name === "休息日";
}

async function getVisibleMembers(ctx: any, actorId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,employee_code,full_name,group_id")
    .is("deleted_at", null)
    .not("group_id", "is", null);
  if (error) throw error;

  const groupIds = [...new Set<string>((data || []).map((row: any) => row.group_id).filter(Boolean))];
  const accessPairs = await Promise.all(groupIds.map(async (groupId) => [
    groupId,
    await canAccessGroup(ctx, actorId, groupId, "attendance_review")
  ] as const));
  const allowedGroups = new Set(accessPairs.filter(([, allowed]) => allowed).map(([groupId]) => groupId));
  return (data || []).filter((row: any) => allowedGroups.has(row.group_id));
}

async function getScheduleContext(ctx: any, memberIds: string[], fromDate: string, toDate: string) {
  if (!memberIds.length) return { schedules: new Map(), shifts: new Map(), leaves: new Map() };
  const scheduleResult = await ctx.supabaseAdmin
    .from("schedule_entries")
    .select("member_id,work_date,shift_type_id,leave_type_id")
    .in("member_id", memberIds)
    .gte("work_date", fromDate)
    .lte("work_date", toDate);
  if (scheduleResult.error) throw scheduleResult.error;

  const schedules = scheduleResult.data || [];
  const shiftIds = [...new Set<string>(schedules.map((row: any) => row.shift_type_id).filter(Boolean))];
  const leaveIds = [...new Set<string>(schedules.map((row: any) => row.leave_type_id).filter(Boolean))];
  const [shiftResult, leaveResult] = await Promise.all([
    shiftIds.length
      ? ctx.supabaseAdmin.from("set_shift").select("id,start_time,end_time").in("id", shiftIds)
      : Promise.resolve({ data: [], error: null }),
    leaveIds.length
      ? ctx.supabaseAdmin.from("set_leave").select("id,code,name").in("id", leaveIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (shiftResult.error) throw shiftResult.error;
  if (leaveResult.error) throw leaveResult.error;

  return {
    schedules: new Map(schedules.map((row: any) => [scheduleKey(row.member_id, row.work_date), row])),
    shifts: new Map((shiftResult.data || []).map((row: any) => [row.id, row])),
    leaves: new Map((leaveResult.data || []).map((row: any) => [row.id, row]))
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const actorId = actorIdOf(ctx);
      if (!await hasPermission(ctx, actorId, "attendance_review")) throw new Error("沒有簽到審核權限");
      const body = await req.json();
      const today = taipeiDate();
      const fromDate = validDate(body?.fromDate, today);
      const toDate = validDate(body?.toDate, today);
      if (fromDate > toDate) throw new Error("日期範圍不正確");

      const requestedMemberId = String(body?.memberId || "").trim();
      const members = await getVisibleMembers(ctx, actorId);
      const memberMap = new Map(members.map((row: any) => [row.id, row]));
      if (requestedMemberId && !memberMap.has(requestedMemberId)) {
        throw new Error("沒有查看此人員簽到資料的權限");
      }
      const visibleMemberIds = requestedMemberId ? [requestedMemberId] : [...memberMap.keys()];
      if (!visibleMemberIds.length) return Response.json({ ok: true, rows: [] });

      const [{ data: attendanceRows, error: attendanceError }, scheduleContext] = await Promise.all([
        ctx.supabaseAdmin
          .from("attendance_days")
          .select("*")
          .in("user_id", visibleMemberIds)
          .gte("work_date", fromDate)
          .lte("work_date", toDate)
          .not("reviewed_at", "is", null)
          .order("work_date", { ascending: true }),
        getScheduleContext(ctx, visibleMemberIds, fromDate, toDate)
      ]);
      if (attendanceError) throw attendanceError;

      const rows = ((attendanceRows || []) as any[]).map((row: any) => {
        const member: any = memberMap.get(row.user_id) || {};
        const schedule: any = scheduleContext.schedules.get(scheduleKey(row.user_id, row.work_date)) || null;
        const shift: any = schedule?.shift_type_id ? scheduleContext.shifts.get(schedule.shift_type_id) || null : null;
        const leave: any = schedule?.leave_type_id ? scheduleContext.leaves.get(schedule.leave_type_id) || null : null;
        const restDayScheduled = Boolean(shift && isRestDayLeave(leave));
        return {
          work_date: row.work_date,
          employee_code: member.employee_code || "",
          employee_name: member.full_name || "",
          regularHours: row.regular_minutes === null ? null : Number(row.regular_minutes) / 60,
          overtimeHours: row.overtime_minutes === null ? null : Number(row.overtime_minutes) / 60,
          clock_in_at: row.clock_in_at || null,
          clock_out_at: row.clock_out_at || null,
          note: row.note || "",
          restDayScheduled,
          scheduledShiftStartTime: restDayScheduled ? shift.start_time || null : null,
          scheduledShiftEndTime: restDayScheduled ? shift.end_time || null : null
        };
      });
      return Response.json({ ok: true, rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "匯出失敗";
      const status = /權限/.test(message) ? 403 : 400;
      return Response.json({ message }, { status });
    }
  })
};
`;
write(edgeFile, edgeContent);

const sqlFile = "supabase/002_current_updates.sql";
let sql = read(sqlFile);
const markerIndex = sql.lastIndexOf("-- 2026-08-10 權限角色排序與休例日加班匯出");
if (markerIndex < 0) throw new Error("找不到 2026-08-10 SQL 區段");
const beforeMarker = sql.slice(0, markerIndex);
let sqlTail = sql.slice(markerIndex).replace("-- 2026-08-10 權限角色排序與休例日加班匯出", "-- 2026-08-10 權限角色排序");
const scheduleExportFunction = `create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,pay_by_day boolean,work_date date,leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,overtime_type_id uuid,overtime_name text,overtime_start_time time,overtime_end_time time,overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text)
language plpgsql stable security definer set search_path=public,pg_catalog as $$
begin
 if not public.has_access_permission(auth.uid(),'schedule_manage') then raise exception '沒有班表管理權限' using errcode='42501'; end if;
 if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception '匯出日期範圍不正確'; end if;
 if p_end_date-p_start_date>366 then raise exception '單次匯出期間不可超過 366 天'; end if;
 return query select schedule.member_id,employee.employee_code,employee.full_name,employee.home_department_id,department.name,employee.pay_by_day,schedule.work_date,schedule.leave_type_id,leave_type.code,leave_type.name,schedule.leave_all_day,schedule.leave_start_time,schedule.leave_end_time,schedule.leave_reason,schedule.overtime_type_id,overtime_type.name,schedule.overtime_start_time,schedule.overtime_end_time,schedule.overtime_use_rest_1,schedule.overtime_rest_1_start_time,schedule.overtime_rest_1_end_time,schedule.overtime_use_rest_2,schedule.overtime_rest_2_start_time,schedule.overtime_rest_2_end_time,schedule.overtime_reason
 from public.schedule_entries schedule join public.set_employee employee on employee.id=schedule.member_id left join public.set_departments department on department.id=employee.home_department_id left join public.set_leave leave_type on leave_type.id=schedule.leave_type_id left join public.set_overtime overtime_type on overtime_type.id=schedule.overtime_type_id
 where schedule.work_date between p_start_date and p_end_date and public.role_applies_to_group(auth.uid(),schedule.group_id) and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
 order by schedule.work_date,employee.sort_order,employee.full_name,employee.id;
end $$;
`;
sqlTail = replaceOne(
  sqlTail,
  /create or replace function public\.get_schedule_export_rows_v2\(p_start_date date,p_end_date date\)[\s\S]*?(?=\nrevoke all on function public\.get_group_access_bundle_v1\(\))/,
  scheduleExportFunction,
  "002 最終班表匯出函式"
);
write(sqlFile, beforeMarker + sqlTail);

const roleTestFile = "tests/permission-role-ordering-restday-export.test.js";
let roleTest = read(roleTestFile);
roleTest = replaceOne(
  roleTest,
  /test\("例假或休息日有排班時，加班匯出使用該班別上下班時間", \(\) => \{[\s\S]*?\n\}\);\n?$/,
  `test("班表頁匯出加班維持只匯出明確加班設定", () => {
  const migration = read("supabase/002_current_updates.sql");
  const section = migration.slice(migration.lastIndexOf("-- 2026-08-10 權限角色排序"));
  const match = section.match(/create or replace function public\\.get_schedule_export_rows_v2[\\s\\S]*?(?=\\nrevoke all on function public\\.get_group_access_bundle_v1)/);
  const exportFunction = match?.[0] || "";
  assert.match(exportFunction, /schedule\\.overtime_type_id/);
  assert.match(exportFunction, /schedule\\.overtime_start_time/);
  assert.match(exportFunction, /schedule\\.overtime_end_time/);
  assert.doesNotMatch(exportFunction, /leave_type\\.code in \\('0036','0047'\\)/);
  assert.doesNotMatch(exportFunction, /then shift_type\\.start_time/);
  assert.doesNotMatch(exportFunction, /then shift_type\\.end_time/);
});
`,
  "角色排序測試的班表匯出案例"
);
write(roleTestFile, roleTest);

const attendanceTestFile = "tests/attendance-review-overtime-export-format.test.js";
write(attendanceTestFile, `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核匯出使用正式 exportRows 十二欄契約並納入休例日排班", () => {
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  const edge = read("supabase/functions/attendance-ledger-export/index.ts");
  const spec = read("規格書.md");

  assert.match(webApi, /async function exportAttendanceReview[\\s\\S]*const exportRows =/);
  assert.match(webApi, /row\\.restDayScheduled/);
  assert.match(webApi, /scheduledShiftStartTime/);
  assert.match(webApi, /scheduledShiftEndTime/);
  assert.match(webApi, /overtime_type_id: "attendance-rest-day"/);
  assert.match(webApi, /overtime_type_id: "attendance-ledger"/);
  assert.match(webApi, /return exportOvertime\\(\\{/);
  assert.doesNotMatch(webApi + exporter, /approvedOvertimeRows/);
  assert.match(edge, /schedule_entries/);
  assert.match(edge, /set_shift/);
  assert.match(edge, /set_leave/);
  assert.match(edge, /code === "0036"/);
  assert.match(edge, /code === "0047"/);
  assert.match(edge, /name === "例假"/);
  assert.match(edge, /name === "休息日"/);
  assert.match(exporter, /function requireExportRows/);
  assert.match(exporter, /"員工編號",[\\s\\S]*"加班日期",[\\s\\S]*"加班時間\\(起\\)",[\\s\\S]*"加班時間\\(迄\\)"/);
  assert.match(spec, /正式唯一格式為 12 欄/);
  assert.match(spec, /2\\.5 小時輸出 \`0230\`/);
  assert.match(spec, /例假.*休息日.*班別.*視為加班/);
  assert.match(spec, /只適用簽到審核.*匯出加班/);
});
`);

const specFile = "規格書.md";
let spec = read(specFile).replace("**文件版本：** 2026-08-09", "**文件版本：** 2026-08-10");
spec = replaceOne(
  spec,
  /9\. 簽到審核匯出的正式唯一格式為 12 欄；加班時數採四碼 `HHMM`，例如 2\.5 小時輸出 `0230`。\n10\. 簽到審核清單讀取遇到 `502`、`503` 或 `504` 時，等待 300 毫秒後自動重試一次；編輯、審核、退回等寫入操作不得自動重送。/,
  `9. 簽到審核匯出的正式唯一格式為 12 欄；一般加班時數採四碼 \`HHMM\`，例如 2.5 小時輸出 \`0230\`。
10. 若已審紀錄當日班表同時有「例假」或「休息日」與班別，該班別視為加班，匯出開始／結束時間直接使用班別上下班時間；此規則只適用簽到審核「匯出加班」，不改變班表頁「匯出加班」規則。
11. 簽到審核清單讀取遇到 \`502\`、\`503\` 或 \`504\` 時，等待 300 毫秒後自動重試一次；編輯、審核、退回等寫入操作不得自動重送。`,
  "規格書簽到審核匯出規則"
);
write(specFile, spec);

console.log("attendance rest-day export update applied");
