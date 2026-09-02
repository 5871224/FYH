const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const groups = fs.readFileSync("src/renderer/renderer-groups-permissions-archive.js", "utf8");
const auth = fs.readFileSync("src/renderer/renderer-auth-context.js", "utf8");
const toolbar = fs.readFileSync("src/renderer/renderer-events-toolbar.js", "utf8");
const exportsSource = fs.readFileSync("src/renderer/renderer-export-actions.js", "utf8");
const html = fs.readFileSync("src/renderer/index.html", "utf8");

test("設定選單只由 settings 共用權限開啟", () => {
  assert.ok(groups.includes('action === "group-settings" || action === "permission-settings" || action === "schedule-archive"'));
  assert.ok(groups.includes('? hasCommonPermission("settings")'));
  assert.ok(groups.includes('weekStartSettingsButton: hasCommonPermission("settings")'));
  assert.ok(groups.includes('if (!hasCommonPermission("settings") || !hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")) return;'));
  assert.ok(!auth.match(/const managerOnlyIds = \[[\s\S]*?\];/)?.[0].includes("weekStartSettingsButton"));
});

test("匯出選單四個功能全部直接對應 export 共用權限", () => {
  ["exportScheduleButton", "exportSapButton", "exportLeaveButton", "exportOvertimeButton"].forEach((id) => {
    assert.ok(groups.includes(`${id}: hasCommonPermission("export")`), `${id} 未綁定 export 權限`);
    assert.ok(!html.includes(`manager-action" id="${id}`), `${id} 仍使用 generic manager-action`);
  });
  assert.ok(!html.includes('id="exportOvertimeButton" type="button" hidden'));
});

test("匯出上班日正式綁定期間匯出並限制目前群組", () => {
  assert.ok(toolbar.includes('bindClick("exportScheduleButton"'));
  assert.ok(toolbar.includes('openExportPeriodDialog("workday")'));
  assert.ok(exportsSource.includes('workday: { title: "匯出上班日期間", action: "匯出上班日" }'));
  assert.ok(exportsSource.includes('await window.schedulerApi.loadScheduleExportRows(startDate, endDate);'));
  assert.ok(exportsSource.includes("function filterExportRowsToCurrentGroup(rows)"));
  assert.ok(exportsSource.includes('filterExportRowsToCurrentGroup(await window.schedulerApi.loadScheduleExportRows(startDate, endDate))'));
  assert.ok(exportsSource.includes("const members = getCurrentGroupExportMembers();"));
});


test("功能選單父分類只在至少一個子功能可見時顯示", () => {
  assert.ok(groups.includes("function syncFunctionMenuCategoryVisibility()"));
  assert.ok(groups.includes('category.querySelectorAll(":scope > .core-actions-submenu > button")'));
  assert.ok(groups.includes('button.style.display !== "none"'));
  assert.ok(groups.includes("syncFunctionMenuCategoryVisibility();"));
});
