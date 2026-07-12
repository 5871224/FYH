const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const webApiPath = path.join(rendererDir, "web-api.js");
const oldApiPath = path.join(rendererDir, "v2-api.js");
const tabletPath = path.join(rendererDir, "v2-tablet-session.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const finalCheckPath = path.join(root, "scripts", "check-v2-final.js");
const alignmentPath = path.join(root, "scripts", "check-v2-alignment.js");
const testPath = path.join(root, "tests", "renderer-phase7-v2-api-data.test.js");

function replaceAsyncBlock(source, startName, endName, replacement) {
  const start = source.indexOf(`  async function ${startName}(`);
  const end = source.indexOf(`  async function ${endName}(`, start + 1);
  if (start < 0 || end <= start) {
    throw new Error(`找不到 API 區段：${startName} -> ${endName}`);
  }
  return source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(end);
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`找不到取代位置：${label}`);
  }
  return source.replace(before, after);
}

let webApi = fs.readFileSync(webApiPath, "utf8");

const overtimeFunctions = `  async function getEmployeeOvertimeDates() {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "dates" });
  }

  async function getAttendanceOvertimeForDate(workDate) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "status", workDate });
  }

  async function getTodayAttendanceOvertime() {
    return getAttendanceOvertimeForDate(taipeiDateString());
  }

  async function submitAttendanceOvertime(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", {
      action: "submit",
      workDate: payload.workDate,
      earlyHours: payload.earlyHours,
      lateHours: payload.lateHours,
      note: payload.note || ""
    });
  }

  async function deleteAttendanceOvertime(workDate) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "delete", workDate });
  }

  async function getOvertimeReviewList(filters = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-list", filters);
  }

  async function reviewOvertimeRequest(payload = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-action", { action: "review", ...payload });
  }

  async function createAdminOvertimeRequest(payload = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-action", { action: "create", ...payload });
  }

  async function getMemberOrder() {
    ensureSignedIn();
    return requestFunction("member-order-v2", { action: "list" });
  }

  async function saveMemberOrder(memberIds = []) {
    ensureManager();
    return requestFunction("member-order-v2", { action: "save", memberIds });
  }`;
webApi = replaceAsyncBlock(webApi, "getTodayAttendanceOvertime", "getTodayMealOrder", overtimeFunctions);

const loadStateStart = webApi.indexOf("  async function loadState() {");
const loadStateEnd = webApi.indexOf("  async function syncLeaveAndOvertimeCatalogs", loadStateStart);
if (loadStateStart < 0 || loadStateEnd <= loadStateStart) {
  throw new Error("找不到 loadState 區段");
}
const loadStateSource = `  function applyMemberOrder(members, orderedIds) {
    const list = Array.isArray(members) ? members : [];
    const ids = Array.isArray(orderedIds) ? orderedIds.map(String).filter(Boolean) : [];
    if (!ids.length) return list;
    const byId = new Map(list.map((member) => [String(member.id || ""), member]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const orderedSet = new Set(ids);
    return [...ordered, ...list.filter((member) => !orderedSet.has(String(member.id || "")))];
  }

  async function loadState() {
    const auth = Boolean(currentSession?.access_token);
    try {
      const [
        settingsRows,
        departmentRows,
        profileRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows
      ] = await Promise.all([
        restSelect("scheduler_settings", { select: "*", filters: { id: \`eq.\${documentId}\` }, limit: "1", auth }),
        getDepartmentDirectoryRows(),
        getScheduleDirectoryRows(),
        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })
      ]);

      const settings = settingsRows?.[0] || {};
      const scheduleRange = getScheduleLoadRange(settings);
      const scheduleEntryRows = await restSelect("schedule_entries", {
        select: "*",
        filters: getScheduleEntryFilters(scheduleRange),
        order: "work_date.asc",
        auth
      });

      let departments = mapDepartmentRows(departmentRows);
      if (currentProfile?.role === "admin") {
        const result = await requestFunction("department-attendance-v2", {});
        const byDepartment = new Map((result.settings || []).map((row) => [row.departmentId, row]));
        departments = departments.map((department) => {
          const attendance = byDepartment.get(department.id);
          return attendance ? {
            ...department,
            address: attendance.address || "",
            latitude: attendance.latitude ?? "",
            longitude: attendance.longitude ?? "",
            publicIp: attendance.publicIp || "",
            attendanceEnabled: Boolean(attendance.attendanceEnabled)
          } : department;
        });
      }

      let members = mapMemberDirectoryRows(profileRows);
      if (currentSession?.access_token) {
        try {
          const result = await requestFunction("member-order-v2", { action: "list" });
          members = applyMemberOrder(members, result.memberIds);
        } catch {
          // Keep database sort order until member-order-v2 is available.
        }
      }
      const schedule = mapScheduleRows(scheduleEntryRows, members);

      return {
        year: Number(settings.current_year) || new Date().getFullYear(),
        month: clampInteger(settings.current_month, 0, 11, new Date().getMonth()),
        selected: { type: null, id: null },
        deptFilter: settings.dept_filter || "all",
        tableView: settings.table_view === "shift" ? "shift" : "member",
        tableDeptScopeFilter: settings.table_dept_scope_filter || "all",
        tableStatsVisible: settings.table_stats_visible !== false,
        scheduleStartDate: settings.schedule_start_date || "",
        departments,
        members,
        shifts: mapShiftRows(shiftRows),
        leaves: mapLeaveRows(leaveRows),
        overtime: mapOvertimeRows(overtimeRows),
        holidays: mapHolidayRows(holidayRows),
        rules: {
          weekStart: clampInteger(settings.week_start, 0, 6, 0),
          monthStartDay: clampInteger(settings.month_start_day, 1, 31, 1),
          eightWeekStartDate: settings.eight_week_start_date || ""
        },
        schedule,
        scheduleLoadedRanges: [scheduleRange]
      };
    } catch (error) {
      if (!currentSession?.access_token && /permission denied|42501|401|403/i.test(error.message || "")) {
        throw new Error("未登入時無法讀取正式班表，請檢查正規化資料表的匿名讀取權限");
      }
      throw error;
    }
  }

`;
webApi = webApi.slice(0, loadStateStart) + loadStateSource + webApi.slice(loadStateEnd);

webApi = replaceRequired(
  webApi,
  "    getTodayAttendanceOvertime,\n    submitAttendanceOvertime,\n    deleteAttendanceOvertime,",
  "    getEmployeeOvertimeDates,\n    getAttendanceOvertimeForDate,\n    getTodayAttendanceOvertime,\n    submitAttendanceOvertime,\n    deleteAttendanceOvertime,",
  "員工加班 API 輸出"
);
webApi = replaceRequired(
  webApi,
  "    getOvertimeReviewList,\n    reviewOvertimeRequest,\n    createAdminOvertimeRequest,",
  "    getOvertimeReviewList,\n    reviewOvertimeRequest,\n    createAdminOvertimeRequest,\n    getMemberOrder,\n    saveMemberOrder,",
  "主管加班與人員排序 API 輸出"
);
fs.writeFileSync(webApiPath, webApi);

if (!fs.existsSync(tabletPath)) throw new Error("找不到 v2-tablet-session.js");
if (!fs.existsSync(oldApiPath)) throw new Error("找不到舊 v2-api.js");
fs.unlinkSync(oldApiPath);

let build = fs.readFileSync(buildPath, "utf8");
build = replaceRequired(build, '  "v2-api.js",', '  "v2-tablet-session.js",', "JavaScript 建置清單");
fs.writeFileSync(buildPath, build);

let finalCheck = fs.readFileSync(finalCheckPath, "utf8");
finalCheck = finalCheck.replaceAll('read("src/renderer/v2-api.js")', 'read("src/renderer/v2-tablet-session.js")');
finalCheck = finalCheck.replaceAll('sourceApi.includes("installTabletSessionPolicy")', 'sourceApi.includes("installTabletSessionCompatibility")');
finalCheck = finalCheck.replaceAll('sourceApp.includes("installV2ApiOverrides")', 'sourceApp.includes("installTabletSessionCompatibility")');
fs.writeFileSync(finalCheckPath, finalCheck);

let alignment = fs.readFileSync(alignmentPath, "utf8");
alignment = alignment.replaceAll('"src/renderer/v2-api.js"', '"src/renderer/v2-tablet-session.js"');
alignment = alignment.replaceAll('read("src/renderer/v2-api.js")', 'read("src/renderer/v2-tablet-session.js")');
fs.writeFileSync(alignmentPath, alignment);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");
const readWebApi = () => fs.readFileSync(webApiPath, "utf8");

function extractFunctions(source, startName, endName) {
  const start = source.indexOf(\`async function \${startName}\`);
  const end = source.indexOf(\`async function \${endName}\`, start + 1);
  if (start < 0 || end <= start) throw new Error(\`找不到測試函式區段：\${startName} -> \${endName}\`);
  return source.slice(start, end);
}

test("人員排序應依指定 ID 排列並保留未列入人員", () => {
  const source = readWebApi();
  const start = source.indexOf("function applyMemberOrder");
  const end = source.indexOf("async function loadState", start);
  const api = vm.runInNewContext(source.slice(start, end) + "\\n;({ applyMemberOrder })");
  const result = api.applyMemberOrder([{ id: "A" }, { id: "B" }, { id: "C" }], ["C", "A"]);
  assert.deepEqual(Array.from(result, (member) => member.id), ["C", "A", "B"]);
});

test("員工加班 API 應保留日期、狀態、送出與刪除操作", async () => {
  const source = readWebApi();
  const functionSource = extractFunctions(source, "getEmployeeOvertimeDates", "getTodayMealOrder");
  const calls = [];
  const context = {
    ensureSignedIn: () => {},
    ensureManager: () => {},
    taipeiDateString: () => "2026-07-12",
    requestFunction: async (name, payload) => { calls.push([name, payload]); return { ok: true }; }
  };
  const api = vm.runInNewContext(functionSource + "\\n;({ getEmployeeOvertimeDates, getAttendanceOvertimeForDate, getTodayAttendanceOvertime, submitAttendanceOvertime, deleteAttendanceOvertime, getMemberOrder, saveMemberOrder })", context);
  await api.getEmployeeOvertimeDates();
  await api.getAttendanceOvertimeForDate("2026-07-11");
  await api.getTodayAttendanceOvertime();
  await api.submitAttendanceOvertime({ workDate: "2026-07-11", earlyHours: 0.5, lateHours: 1, note: "測試" });
  await api.deleteAttendanceOvertime("2026-07-11");
  await api.getMemberOrder();
  await api.saveMemberOrder(["M2", "M1"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["attendance-overtime-employee", { action: "dates" }],
    ["attendance-overtime-employee", { action: "status", workDate: "2026-07-11" }],
    ["attendance-overtime-employee", { action: "status", workDate: "2026-07-12" }],
    ["attendance-overtime-employee", { action: "submit", workDate: "2026-07-11", earlyHours: 0.5, lateHours: 1, note: "測試" }],
    ["attendance-overtime-employee", { action: "delete", workDate: "2026-07-11" }],
    ["member-order-v2", { action: "list" }],
    ["member-order-v2", { action: "save", memberIds: ["M2", "M1"] }]
  ]);
});

test("正式 loadState 應載入管理員打卡欄位與人員排序", () => {
  const source = readWebApi();
  const loadStart = source.indexOf("async function loadState");
  const loadEnd = source.indexOf("async function syncLeaveAndOvertimeCatalogs", loadStart);
  const block = source.slice(loadStart, loadEnd);
  assert.equal(block.includes('requestFunction("department-attendance-v2", {})'), true);
  assert.equal(block.includes('requestFunction("member-order-v2", { action: "list" })'), true);
  assert.equal(block.includes("members = applyMemberOrder(members, result.memberIds)"), true);
});

test("資料 API 應由正式 web-api 提供，平板相容層不得改寫資料方法", () => {
  const source = readWebApi();
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const tablet = fs.readFileSync(path.join(root, "src", "renderer", "v2-tablet-session.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-api.js")), false);
  assert.equal(build.includes("v2-api.js"), false);
  assert.equal(build.includes("v2-tablet-session.js"), true);
  assert.equal(tablet.includes("api.loadState ="), false);
  assert.equal(tablet.includes("api.getEmployeeOvertimeDates ="), false);
  assert.equal(source.includes("async function getEmployeeOvertimeDates"), true);
  assert.equal(source.includes("async function saveMemberOrder"), true);
});
`;
fs.writeFileSync(testPath, testSource);
console.log("V2 data loading, member order and overtime APIs merged into canonical web-api");
