const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requestHelpers = read("src/renderer/renderer-request-helpers.js");
const authContext = read("src/renderer/renderer-auth-context.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("日期區間衝突判定應保留邊界重疊規則", () => {
  const start = requestHelpers.indexOf("function hasDateRangeOverlap");
  const end = requestHelpers.indexOf("function findDirectLeaveScheduleConflict", start);
  const api = vm.runInNewContext(requestHelpers.slice(start, end) + "\n;({ hasDateRangeOverlap })");
  assert.equal(api.hasDateRangeOverlap("2026-07-10", "2026-07-12", "2026-07-12", "2026-07-13"), true);
  assert.equal(api.hasDateRangeOverlap("2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13"), false);
  assert.equal(api.hasDateRangeOverlap("", "2026-07-11", "2026-07-12", "2026-07-13"), false);
});

test("目前人員應優先依 profile id，再依工號解析", () => {
  const start = requestHelpers.indexOf("function resolveCurrentMember");
  const end = requestHelpers.indexOf("function requestMatchesMember", start);
  const context = {
    state: { members: [{ id: "M1", code: "001" }, { id: "M2", code: "002" }] },
    currentProfile: { id: "M2", employee_code: "001" }
  };
  const api = vm.runInNewContext(requestHelpers.slice(start, end) + "\n;({ resolveCurrentMember })", context);
  assert.equal(api.resolveCurrentMember().id, "M2");
  context.currentProfile = { id: "missing", employee_code: "001" };
  assert.equal(api.resolveCurrentMember().id, "M1");
});

test("管理權限應只允許管理員與主管", () => {
  const start = authContext.indexOf("function normalizeRole");
  const end = authContext.indexOf("async function ensureManagerDirectoryLoaded", start);
  const context = { currentProfile: { role: "employee" }, currentSession: { user: { id: "U1" } } };
  const api = vm.runInNewContext(authContext.slice(start, end) + "\n;({ normalizeRole, isAdmin, isManager, canEditSchedule })", context);
  assert.equal(api.normalizeRole("unknown"), "employee");
  assert.equal(api.isManager(), false);
  context.currentProfile.role = "manager";
  assert.equal(api.isManager(), true);
  assert.equal(api.isAdmin(), false);
  context.currentProfile.role = "admin";
  assert.equal(api.isAdmin(), true);
  assert.equal(api.canEditSchedule(), true);
});

test("第九階段應移出登入與申請工具並維持模組順序", () => {
  const ordered = [
    "renderer-overtime-employee.js",
    "renderer-request-helpers.js",
    "renderer-auth-context.js",
    "renderer-attendance-page.js",
    "renderer-meal-page.js",
    "renderer-records-page.js",
    "renderer.js"
  ];
  [build, coreSource].forEach((manifest) => {
    let previous = -1;
    ordered.forEach((file) => {
      const index = manifest.indexOf(`"${file}"`);
      assert.ok(index > previous, `模組順序錯誤：${file}`);
      previous = index;
    });
  });
  ["isLoggedIn", "resolveCurrentMember", "openSignInDialog", "saveChangedPassword"].forEach((name) => {
    assert.equal(renderer.includes(`function ${name}`), false, `renderer.js 仍保留 ${name}`);
  });
  assert.equal(authContext.includes("function renderAuthGate"), true);
  assert.equal(requestHelpers.includes("function getLeaveCatalogDisplayName"), true);
  assert.ok(renderer.split("\n").length < 3200, "renderer.js 未明顯縮小");
});
