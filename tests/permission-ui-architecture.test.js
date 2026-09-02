const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const rendererDir = path.join("src", "renderer");
const rendererSources = fs.readdirSync(rendererDir)
  .filter((name) => name.startsWith("renderer-") && name.endsWith(".js"))
  .map((name) => fs.readFileSync(path.join(rendererDir, name), "utf8"))
  .join("\n");
const html = fs.readFileSync(path.join(rendererDir, "index.html"), "utf8");

test("禁止以泛用主管權限控制個別功能", () => {
  assert.ok(!rendererSources.includes("hasManagementAccess"));
  assert.ok(!rendererSources.includes("promptManagerAccess"));
  assert.ok(!rendererSources.includes("manager-action"));
});

test("禁止先渲染全部功能再掃 DOM 子項目補隱藏父分類", () => {
  assert.ok(!rendererSources.includes("syncFunctionMenuCategoryVisibility"));
  assert.ok(!html.includes(":has(.ops-btn"));
  assert.ok(!html.includes('class="core-actions-menu-category" role="none"'));
});

test("敏感 UI 使用各自的正式權限", () => {
  const layout = fs.readFileSync(path.join(rendererDir, "renderer-schedule-layout.js"), "utf8");
  const tooltip = fs.readFileSync(path.join(rendererDir, "renderer-schedule-tooltip.js"), "utf8");
  const shell = fs.readFileSync(path.join(rendererDir, "renderer-app-shell.js"), "utf8");
  assert.ok(layout.includes('canManageDepartmentsInCurrentGroup()'));
  assert.ok(layout.includes('canManageMembersInCurrentGroup()'));
  assert.ok(tooltip.includes('canEditSchedule()'));
  assert.ok(shell.includes('showSchedule && canUseScheduleToolbar()'));
});
