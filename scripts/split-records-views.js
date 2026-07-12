const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");
const testPath = path.join(root, "tests", "renderer-phase13-records-views.test.js");

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
const viewsRange = findRange(originalRenderer, "function formatRecordDateTime", "function timeValueFromIso", "記錄頁畫面渲染");
const viewsSource = viewsRange.content;
let renderer = originalRenderer.slice(0, viewsRange.start) + originalRenderer.slice(viewsRange.end);
renderer = renderer.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(path.join(rendererDir, "renderer-records-views.js"), `/* 記錄頁、訂餐統計、加班審核、打卡管理與訂餐設定畫面。\n * 由 renderer.js 拆分；不變更查詢、審核或儲存流程。\n */\n\n${viewsSource}\n`);
fs.writeFileSync(rendererPath, renderer);

const marker = `  "renderer-main-pages.js",\n  "renderer-modal-navigation.js",`;
const replacement = `  "renderer-main-pages.js",\n  "renderer-records-views.js",\n  "renderer-modal-navigation.js",`;
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

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const views = read("src/renderer/renderer-records-views.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("記錄頁畫面應保留個人、加班審核與打卡管理分頁", () => {
  ["個人記錄", "加班審核", "打卡管理", "data-records-tab", "renderPersonalRecordsSection", "renderOvertimeReviewSection", "renderAttendanceAdminSection"].forEach((marker) => assert.equal(views.includes(marker), true, "缺少：" + marker));
});

test("訂餐統計與訂餐設定畫面應保留查詢、匯出、拖曳與儲存控制", () => {
  ["data-load-meal-report", "data-export-meal-report", "data-add-meal-product", "data-save-meal-settings", "data-meal-product-row", "meal-drag-handle"].forEach((marker) => assert.equal(views.includes(marker), true, "缺少：" + marker));
});

test("第十三階段應移出記錄頁畫面並維持模組順序", () => {
  const ordered = ["renderer-main-pages.js", "renderer-records-views.js", "renderer-modal-navigation.js", "renderer.js"];
  [build, coreSource].forEach((manifest) => {
    let previous = -1;
    ordered.forEach((file) => {
      const index = manifest.indexOf('"' + file + '"');
      assert.ok(index > previous, "模組順序錯誤：" + file);
      previous = index;
    });
  });
  ["formatRecordDateTime", "renderRecordsTabs", "renderPersonalRecordsSection", "renderMealReportSection", "renderOvertimeReviewSection", "renderAttendanceAdminSection", "renderMealSettingsSection"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });
  assert.ok(renderer.split(String.fromCharCode(10)).length < 2500, "renderer.js 未明顯縮小");
});
`;
fs.writeFileSync(testPath, testSource);
console.log(JSON.stringify({ viewLines: viewsSource.split("\n").length, rendererLines: renderer.split("\n").length }));
