const test = require("node:test");
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

  assert.match(webApi, /async function exportAttendanceReview[\s\S]*const exportRows =/);
  assert.match(webApi, /row\.restDayScheduled/);
  assert.match(webApi, /scheduledShiftStartTime/);
  assert.match(webApi, /scheduledShiftEndTime/);
  assert.match(webApi, /overtime_type_id: "attendance-rest-day"/);
  assert.match(webApi, /overtime_type_id: "attendance-ledger"/);
  assert.match(webApi, /const shiftStart = String\(row\.scheduledShiftStartTime \|\| ""\)/);
  assert.match(webApi, /const actualStart = isFactory \? baseline : adjustedStart\.time/);
  assert.match(webApi, /const actualEnd = isFactory \? addMinutesToClockTime/);
  assert.match(edge, /scheduledShiftStartTime: shift\?\.start_time \|\| null/);
  assert.match(webApi, /const exported = await exportOvertime\(\{/);
  assert.doesNotMatch(webApi + exporter, /approvedOvertimeRows/);
  assert.match(edge, /schedule_entries/);
  assert.match(edge, /set_shift/);
  assert.match(edge, /set_leave/);
  assert.match(edge, /code === "0036"/);
  assert.match(edge, /code === "0047"/);
  assert.match(edge, /name === "例假"/);
  assert.match(edge, /name === "休息日"/);
  assert.doesNotMatch(edge, /\.not\("reviewed_at",\s*"is",\s*null\)/);
  assert.match(spec, /不論未審或已審.*都納入匯出判斷/);
  assert.match(exporter, /function requireExportRows/);
  assert.match(exporter, /"員工編號",[\s\S]*"加班日期",[\s\S]*"加班時間\(起\)",[\s\S]*"加班時間\(迄\)"/);
  assert.match(spec, /總共 18 欄/);
  assert.match(spec, /姓名、員工編號、星期、單位、加班日期/);
  assert.match(spec, /2\.5 小時輸出 `0230`/);
  assert.match(spec, /例假.*休息日.*班別.*視為加班/);
  assert.match(spec, /班表頁「功能 → 匯出」不提供「匯出加班」選項/);
  assert.match(spec, /簽到審核若另有加班時數.*依門市或工廠群組規則/);
});

test("缺少班別開始時間仍匯出，以 00:00 起算並標記粉紅底色", async () => {
  const vm = require("node:vm");
  const webApi = read("src/renderer/web-api.js");
  const helperStart = webApi.indexOf("function formatOvertimeHoursAsTime");
  const helperEnd = webApi.indexOf("  function downloadBlob", helperStart);
  const helpers = vm.runInNewContext(
    webApi.slice(helperStart, helperEnd) + "\n({formatOvertimeHoursAsTime,subtractOvertimeHoursFromClockTime,addMinutesToClockTime})",
    {}
  );
  const functionStart = webApi.indexOf("async function exportAttendanceReview(filters = {})");
  const functionEnd = webApi.indexOf("  async function exportMembers(", functionStart);
  let captured;
  const exportAttendanceReview = vm.runInNewContext(
    "(" + webApi.slice(functionStart, functionEnd).trim() + ")",
    {
      ensureSignedIn() {},
      requestFunction: async () => ({
        rows: [
          {employee_code: "A101", employee_name: "無班別", memberSortOrder: 1, work_date: "2026-10-01", overtimeHours: 3.5, scheduledShiftStartTime: null},
          {employee_code: "A102", employee_name: "有班別", memberSortOrder: 2, work_date: "2026-10-01", overtimeHours: 1, scheduledShiftStartTime: "11:30"}
        ]
      }),
      ...helpers,
      exportOvertime: async payload => {captured = payload;return {empty:false};}
    }
  );
  const result = await exportAttendanceReview({fromDate:"2026-10-01",toDate:"2026-10-01"});
  assert.equal(captured.exportRows.length, 2);
  assert.equal(captured.exportRows[0].overtime_start_time, "00:00");
  assert.equal(captured.exportRows[0].overtime_end_time, "03:30");
  assert.equal(captured.exportRows[0].overtime_previous_day, 0);
  assert.equal(captured.exportRows[0].missingScheduledShift, true);
  assert.equal(captured.exportRows[1].overtime_start_time, "10:30");
  assert.equal(captured.exportRows[1].overtime_end_time, "11:30");
  assert.equal(captured.exportRows[1].missingScheduledShift, false);
  assert.equal(result.highlightedMissingShift.length, 1);
});


test("門市向前、工廠向後，保留舊時間與群組人員日期排序", async () => {
  const vm = require("node:vm");
  const webApi = read("src/renderer/web-api.js");
  const helperStart = webApi.indexOf("function formatOvertimeHoursAsTime");
  const helperEnd = webApi.indexOf("  function downloadBlob", helperStart);
  const helpers = vm.runInNewContext(
    webApi.slice(helperStart, helperEnd) +
      "\n({formatOvertimeHoursAsTime,subtractOvertimeHoursFromClockTime,addMinutesToClockTime})",
    {}
  );
  const functionStart = webApi.indexOf("async function exportAttendanceReview(filters = {})");
  const functionEnd = webApi.indexOf("  async function exportMembers(", functionStart);
  let exported;
  const rows = [
    { employee_code: "F02", employee_name: "工廠乙", memberId: "f2", groupName: "工廠", groupId: "f", groupSortOrder: 2, memberSortOrder: 2, work_date: "2026-10-05", restDayScheduled: true, overtimeHours: 1, scheduledShiftStartTime: "08:00", scheduledShiftEndTime: "17:00" },
    { employee_code: "S02", employee_name: "門市乙", memberId: "s2", groupName: "門市", groupId: "s", groupSortOrder: 1, memberSortOrder: 2, work_date: "2026-10-04", restDayScheduled: true, overtimeHours: 2, scheduledShiftStartTime: "08:00", scheduledShiftEndTime: "19:30" },
    { employee_code: "S01", employee_name: "門市甲", memberId: "s1", groupName: "門市", groupId: "s", groupSortOrder: 1, memberSortOrder: 1, work_date: "2026-10-06", overtimeHours: 2, scheduledShiftStartTime: "09:00", scheduledShiftEndTime: "18:00" },
    { employee_code: "F01", employee_name: "工廠甲", memberId: "f1", groupName: "工廠", groupId: "f", groupSortOrder: 2, memberSortOrder: 1, work_date: "2026-10-03", overtimeHours: 2, scheduledShiftStartTime: "08:00", scheduledShiftEndTime: "17:00" },
    { employee_code: "S01", employee_name: "門市甲", memberId: "s1", groupName: "門市", groupId: "s", groupSortOrder: 1, memberSortOrder: 1, work_date: "2026-10-02", overtimeHours: 1, scheduledShiftStartTime: "09:00", scheduledShiftEndTime: "18:00", note: "kiểm kho" }
  ];
  const run = vm.runInNewContext(
    "(" + webApi.slice(functionStart, functionEnd).trim() + ")",
    {
      ensureSignedIn() {},
      requestFunction: async () => ({ rows }),
      ...helpers,
      exportOvertime: async payload => { exported = payload; return { empty: false }; }
    }
  );
  await run({ fromDate: "2026-10-01", toDate: "2026-10-31" });
  const results = exported.exportRows;
  assert.equal(results.map(row => row.employee_code).join(","), "S01,S01,S02,F01,F02");
  assert.equal(results[0].work_date, "2026-10-02");
  assert.equal(results[0].overtime_start_time, "10:30");
  assert.equal(results[0].overtime_end_time, "11:30");
  assert.equal(results[0].correct_start_time, "08:00");
  assert.equal(results[0].correct_end_time, "09:00");
  assert.equal(results[0].overtime_reason, "kiểm kho");
  assert.equal(results[2].overtime_start_time, "09:30");
  assert.equal(results[2].overtime_end_time, "20:30");
  assert.equal(results[2].overtime_rest_1_start_time, "11:30");
  assert.equal(results[2].overtime_rest_1_end_time, "12:30");
  assert.equal(results[2].correct_start_time, "06:00");
  assert.equal(results[2].correct_end_time, "19:30");
  assert.equal(results[3].overtime_start_time, "17:00");
  assert.equal(results[3].overtime_end_time, "19:00");
  assert.equal(results[4].overtime_start_time, "08:00");
  assert.equal(results[4].overtime_end_time, "18:00");
});
