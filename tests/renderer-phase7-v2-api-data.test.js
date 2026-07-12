const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");
const readWebApi = () => fs.readFileSync(webApiPath, "utf8");

function extractFunctions(source, startName, endName) {
  const start = source.indexOf(`async function ${startName}`);
  const end = source.indexOf(`async function ${endName}`, start + 1);
  if (start < 0 || end <= start) throw new Error(`找不到測試函式區段：${startName} -> ${endName}`);
  return source.slice(start, end);
}

test("人員排序應依指定 ID 排列並保留未列入人員", () => {
  const source = readWebApi();
  const start = source.indexOf("function applyMemberOrder");
  const end = source.indexOf("async function loadState", start);
  const api = vm.runInNewContext(source.slice(start, end) + "\n;({ applyMemberOrder })");
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
  const api = vm.runInNewContext(functionSource + "\n;({ getEmployeeOvertimeDates, getAttendanceOvertimeForDate, getTodayAttendanceOvertime, submitAttendanceOvertime, deleteAttendanceOvertime, getMemberOrder, saveMemberOrder })", context);
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
