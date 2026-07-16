const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const tooltip = read("src/renderer/renderer-schedule-tooltip.js");
const pages = read("src/renderer/renderer-main-pages.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("假別明細摘要應保留整天、時間與原因", () => {
  const start = tooltip.indexOf("function shouldPromptLeaveDetail");
  const end = tooltip.indexOf("function hideLeaveTooltip", start);
  const source = tooltip.slice(start, end);
  const context = { leaveRequiresTime: () => true };
  const api = vm.runInNewContext(source + String.fromCharCode(10) + ";({ shouldPromptLeaveDetail, formatLeaveDetailSummary })", context);
  assert.equal(api.shouldPromptLeaveDetail({ requiresReason: true }), true);
  assert.deepEqual(Array.from(api.formatLeaveDetailSummary({ requiresReason: true }, { allDay: false, startTime: "08:30", endTime: "10:00", reason: "測試" })), ["時間：08:30 - 10:00", "原因：測試"]);
});

test("主頁渲染應保留首頁四個入口與訂餐管理分頁", () => {
  assert.equal(pages.includes('<div class="clock-page-header">'), true);
  assert.equal(pages.includes("home-hero"), false);
  ["data-home-action=\"clock\"", "data-home-action=\"schedule\"", "data-home-action=\"meal\"", "data-home-action=\"records\""].forEach((marker) => assert.equal(pages.includes(marker), true));
  assert.equal(pages.includes("data-meal-tab=\"stats\""), true);
  assert.equal(pages.includes("data-meal-tab=\"settings\""), true);
  assert.equal(pages.includes("renderTodayOvertimePanel()"), true);
});

test("第十二階段應移出提示框與主頁渲染並維持模組順序", () => {
  const ordered = ["renderer-auth-context.js", "renderer-schedule-tooltip.js", "renderer-main-pages.js", "renderer-modal-navigation.js", "renderer.js"];
  [build, coreSource].forEach((manifest) => {
    let previous = -1;
    ordered.forEach((file) => {
      const index = manifest.indexOf('"' + file + '"');
      assert.ok(index > previous, "模組順序錯誤：" + file);
      previous = index;
    });
  });
  ["shouldPromptLeaveDetail", "showScheduleTooltip", "renderHomeDashboard", "renderClockPage", "renderMealPage"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });
  assert.ok(renderer.split(String.fromCharCode(10)).length < 2600, "renderer.js 未明顯縮小");
});
