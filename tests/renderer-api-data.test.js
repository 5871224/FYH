const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");
const readWebApi = () => fs.readFileSync(webApiPath, "utf8");

test("人員排序應依指定 ID 排列並保留未列入人員", () => {
  const source = readWebApi();
  const start = source.indexOf("function applyMemberOrder");
  const end = source.indexOf("async function loadState", start);
  const api = vm.runInNewContext(source.slice(start, end) + "\n;({ applyMemberOrder })");
  const result = api.applyMemberOrder([{ id: "A" }, { id: "B" }, { id: "C" }], ["C", "A"]);
  assert.deepEqual(Array.from(result, (member) => member.id), ["C", "A", "B"]);
});

test("員工加班 API 應保留日期、狀態、送出、刪除與人員排序操作", () => {
  const source = readWebApi();
  [
    'requestFunction("attendance-overtime-employee", { action: "dates" })',
    'requestFunction("attendance-overtime-employee", { action: "status", workDate })',
    'action: "submit"',
    'action: "delete"',
    'requestFunction("member-order-v2", { action: "list" })',
    'requestFunction("member-order-v2", { action: "save", memberIds })'
  ].forEach((marker) => assert.equal(source.includes(marker), true, "缺少 API 契約：" + marker));
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

test("資料 API 應由正式 web-api 提供且不再依賴 V2 相容層", () => {
  const source = readWebApi();
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-api.js")), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-tablet-session.js")), false);
  assert.equal(build.includes("v2-api.js"), false);
  assert.equal(build.includes("v2-tablet-session.js"), false);
  assert.equal(source.includes("async function getEmployeeOvertimeDates"), true);
  assert.equal(source.includes("async function saveMemberOrder"), true);
});
