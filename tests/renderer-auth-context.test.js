const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const authContext = read("src/renderer/renderer-auth-context.js");
const stateNormalization = read("src/renderer/renderer-state-normalization.js");
const settingsCatalog = read("src/renderer/renderer-settings-catalog.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("目前人員應優先依 profile id，再依工號解析", () => {
  const start = authContext.indexOf("function resolveCurrentMember");
  const end = authContext.indexOf("function canManagePermissions", start);
  const context = {
    state: { members: [{ id: "M1", code: "001" }, { id: "M2", code: "002" }] },
    currentProfile: { id: "M2", employee_code: "001" }
  };
  const api = vm.runInNewContext(authContext.slice(start, end) + "\n;({ resolveCurrentMember })", context);
  assert.equal(api.resolveCurrentMember().id, "M2");
  context.currentProfile = { id: "missing", employee_code: "001" };
  assert.equal(api.resolveCurrentMember().id, "M1");
});

test("各管理介面應由自己的共用或群組權限決定", () => {
  const start = authContext.indexOf("function canManagePermissions");
  const end = authContext.indexOf("async function ensureManagerDirectoryLoaded", start);
  let commonPermissions = [];
  const actor = { groupPermissions: { G1: [] } };
  const context = {
    authenticated: true,
    currentUser: { id: "U1" },
    groupFeatureState: { currentGroupId: "G1" },
    hasCommonPermission: (permission) => commonPermissions.includes(permission),
    hasGroupPermission: (groupId, permission) => (actor.groupPermissions[groupId] || []).includes(permission)
  };
  const api = vm.runInNewContext(authContext.slice(start, end) + "\n;({ canManagePermissions, canEditSchedule, canUseScheduleToolbar })", context);
  assert.equal(api.canManagePermissions(), false);
  assert.equal(api.canEditSchedule(), false);
  assert.equal(api.canUseScheduleToolbar(), false);

  actor.groupPermissions.G1 = ["schedule_view", "schedule_manage"];
  assert.equal(api.canEditSchedule(), true);
  assert.equal(api.canUseScheduleToolbar(), true);

  actor.groupPermissions.G1 = ["schedule_view"];
  commonPermissions = ["export"];
  assert.equal(api.canUseScheduleToolbar(), false, "匯出權限不可開啟排班工具列");

  commonPermissions = ["settings"];
  assert.equal(api.canManagePermissions(), true);
  assert.equal(api.canUseScheduleToolbar(), false, "設定權限不可開啟排班工具列");

  commonPermissions = ["leave_settings"];
  assert.equal(api.canUseScheduleToolbar(), true, "假別設定需能使用對應工具列");
});

test("假別明細與設定輔助應位於對應責任模組", () => {
  assert.equal(stateNormalization.includes("function leaveRequiresTime"), true);
  assert.equal(stateNormalization.includes("function defaultLeaveIsAllDay"), true);
  assert.equal(settingsCatalog.includes("function getLeaveCatalogDisplayName"), true);
});

test("登入、簽到簿與班表模組順序應維持且不再載入舊申請模組", () => {
  const ordered = [
    "renderer-auth-context.js",
    "renderer-schedule-tooltip.js",
    "renderer-main-pages.js",
    "renderer-records-views.js",
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
    assert.equal(manifest.includes("renderer-overtime-employee.js"), false);
    assert.equal(manifest.includes("renderer-request-helpers.js"), false);
  });
  ["isLoggedIn", "resolveCurrentMember", "openSignInDialog", "saveChangedPassword"].forEach((name) => {
    assert.equal(renderer.includes(`function ${name}`), false, `renderer.js 仍保留 ${name}`);
  });
  assert.equal(authContext.includes("function renderAuthGate"), true);
  assert.ok(renderer.split("\n").length < 3200, "renderer.js 未明顯縮小");
});

test("排班前端不得保留已淘汰申請流程的無引用輔助名稱", () => {
  const source = [authContext, stateNormalization, settingsCatalog, read("src/renderer/renderer-schedule-interaction.js")].join("\n");
  [
    "getRequestActor",
    "requestMatchesMember",
    "hasDateRangeOverlap",
    "findDirectLeaveScheduleConflict",
    "hasDirectOvertimeScheduleConflict",
    "formatRequestDateText",
    "formatOvertimeTimeText",
    "formatOvertimeRestLines",
    "getLeaveStyleForRecord",
    "getLeaveStyleForSlot",
    "cleanSlotMeta",
    "cancelLeaveRequestIds"
  ].forEach((name) => assert.equal(source.includes(name), false, `仍保留舊輔助名稱：${name}`));
});
