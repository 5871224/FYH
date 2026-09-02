const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const groups = fs.readFileSync("src/renderer/renderer-groups-permissions-archive.js", "utf8");
const events = fs.readFileSync("src/renderer/renderer-events-toolbar.js", "utf8");
const html = fs.readFileSync("src/renderer/index.html", "utf8");

test("功能選單在渲染時依正式權限建立分類", () => {
  assert.ok(groups.includes('if (hasCommonPermission("settings"))'));
  assert.ok(groups.includes('if (hasGroupPermission(groupId, "schedule_manage"))'));
  assert.ok(groups.includes('if (hasCommonPermission("export"))'));
  assert.ok(groups.includes('data-function-menu-section="${section.id}"'));
  assert.ok(groups.includes('data-function-menu-action="${item.action}"'));
});

test("班表管理只建立排班分類，不隱含設定或匯出", () => {
  assert.ok(groups.includes('id: "schedule",\n      label: "排班"'));
  assert.ok(groups.includes('id: "settings",\n      label: "設定"'));
  assert.ok(groups.includes('id: "export",\n      label: "匯出"'));
  assert.ok(!groups.includes('syncFunctionMenuCategoryVisibility'));
  assert.ok(!html.includes(':has(.ops-btn'));
});

test("動態功能選單使用容器事件委派，重新渲染不會遺失事件", () => {
  assert.ok(events.includes('function bindCoreActionsMenuEvents()'));
  assert.ok(events.includes('button[data-function-menu-action]'));
  assert.ok(events.includes('runFunctionMenuAction(action)'));
  assert.ok(!events.includes('bindClick("exportScheduleButton"'));
  assert.ok(!events.includes('bindClick("weekStartSettingsButton"'));
});
