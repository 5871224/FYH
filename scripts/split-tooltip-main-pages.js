const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");
const testPath = path.join(root, "tests", "renderer-phase12-tooltip-main-pages.test.js");

function findRange(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`找不到${label}的安全拆分邊界`);
  return { start, end, content: source.slice(start, end).trim() };
}

function insertModules(source, marker, replacement, label) {
  if (!source.includes(marker)) throw new Error(`找不到${label}的模組插入點`);
  return source.replace(marker, replacement);
}

const originalRenderer = fs.readFileSync(rendererPath, "utf8");
const tooltipRange = findRange(originalRenderer, "function shouldPromptLeaveDetail", "function renderHomeDashboard", "班表提示框");
const pagesRange = findRange(originalRenderer, "function renderHomeDashboard", "function formatRecordDateTime", "首頁打卡與訂餐渲染");
const tooltipSource = tooltipRange.content;
const pagesSource = pagesRange.content;
let renderer = originalRenderer.slice(0, tooltipRange.start) + originalRenderer.slice(pagesRange.end);
renderer = renderer.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(path.join(rendererDir, "renderer-schedule-tooltip.js"), `/* 請假與加班明細提示框。\n * 由 renderer.js 拆分；不變更提示內容或互動規則。\n */\n\n${tooltipSource}\n`);
fs.writeFileSync(path.join(rendererDir, "renderer-main-pages.js"), `/* 首頁、打卡頁與今日訂餐頁渲染。\n * 由 renderer.js 拆分；不變更畫面內容或操作規則。\n */\n\n${pagesSource}\n`);
fs.writeFileSync(rendererPath, renderer);

const marker = `  "renderer-auth-context.js",\n  "renderer-modal-navigation.js",`;
const replacement = `  "renderer-auth-context.js",\n  "renderer-schedule-tooltip.js",\n  "renderer-main-pages.js",\n  "renderer-modal-navigation.js",`;
let build = fs.readFileSync(buildPath, "utf8");
build = insertModules(build, marker, replacement, "JavaScript 建置清單");
fs.writeFileSync(buildPath, build);
let coreSource = fs.readFileSync(coreSourcePath, "utf8");
coreSource = insertModules(coreSource, marker, replacement, "renderer 測試來源清單");
fs.writeFileSync(coreSourcePath, coreSource);

const testSource = `const test = require("node:test");
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
  ["data-home-action=\\\"clock\\\"", "data-home-action=\\\"schedule\\\"", "data-home-action=\\\"meal\\\"", "data-home-action=\\\"records\\\""].forEach((marker) => assert.equal(pages.includes(marker), true));
  assert.equal(pages.includes("data-meal-tab=\\\"stats\\\""), true);
  assert.equal(pages.includes("data-meal-tab=\\\"settings\\\""), true);
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
`;
fs.writeFileSync(testPath, testSource);
console.log(JSON.stringify({ tooltipLines: tooltipSource.split("\n").length, pageLines: pagesSource.split("\n").length, rendererLines: renderer.split("\n").length }));
