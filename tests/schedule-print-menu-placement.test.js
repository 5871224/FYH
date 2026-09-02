const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const groups = fs.readFileSync("src/renderer/renderer-groups-permissions-archive.js", "utf8");
const toolbar = fs.readFileSync("src/renderer/renderer-events-toolbar.js", "utf8");
const config = fs.readFileSync("src/renderer/app-config.js", "utf8");

test("列印班表固定屬於匯出分類並由 export 權限建立", () => {
  const start = groups.indexOf('id: "export"');
  const end = groups.indexOf('return sections;', start);
  const exportSection = groups.slice(start, end);
  assert.ok(exportSection.includes('hasCommonPermission("export")') || groups.slice(Math.max(0, start - 120), end).includes('hasCommonPermission("export")'));
  assert.ok(exportSection.includes('{ id: "schedulePrintMenuButton", label: "列印班表", action: "print-schedule" }'));
});

test("班表列印不得再用 DOM fallback 塞到功能選單外層", () => {
  assert.ok(!config.includes("ensureMenuButton"));
  assert.ok(!config.includes("menu.prepend(button)"));
  assert.ok(!config.includes("MutationObserver(ensureMenuButton)"));
  assert.ok(config.includes('hasCommonPermission("export")'));
  assert.ok(config.includes("window.openSchedulePrintRangeDialog = openFromFunctionMenu"));
});

test("功能選單 print-schedule action 只呼叫正式列印入口", () => {
  assert.ok(toolbar.includes('if (action === "print-schedule") return window.openSchedulePrintRangeDialog?.();'));
});
