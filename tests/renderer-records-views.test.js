const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const views = read("src/renderer/renderer-records-views.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");
const attendanceAdminFunction = read("supabase/functions/attendance-admin-list-v2/index.ts");
const reportRecordsFunction = read("supabase/functions/report-records/index.ts");

test("記錄頁畫面應保留個人、加班審核與打卡管理分頁", () => {
  ["個人記錄", "加班審核", "打卡管理", "data-records-tab", "renderPersonalRecordsSection", "renderOvertimeReviewSection", "renderAttendanceAdminSection"].forEach((marker) => assert.equal(views.includes(marker), true, "缺少：" + marker));
});

test("訂餐統計與訂餐設定畫面應保留即時篩選、匯出、拖曳與儲存控制", () => {
  ["data-meal-report-filter", "data-export-meal-report", "data-add-meal-product", "data-save-meal-settings", "data-meal-product-row", "meal-drag-handle"].forEach((marker) => assert.equal(views.includes(marker), true, "缺少：" + marker));
  assert.equal(read("src/renderer/renderer-records-events.js").includes("scheduleRecordsReload"), true, "訂餐統計未保留即時查詢");
});

test("打卡管理顯示項目應排除資料品質防呆提示", () => {
  assert.equal(views.includes("<span>顯示項目</span><select data-attendance-filter=\"issueType\">"), true);
  assert.equal(views.includes("<span>異常類型</span>"), false);

  [attendanceAdminFunction, reportRecordsFunction].forEach((source) => {
    const options = source.match(/issueTypes:\s*\[([^\]]*)\]/s)?.[1] || "";
    assert.equal(options.includes("打卡時間不完整或格式異常"), false);
    assert.equal(options.includes("班別缺少完整上下班時間"), false);
  });

  assert.equal(attendanceAdminFunction.includes('output.push("打卡時間不完整或格式異常")'), true);
  assert.equal(attendanceAdminFunction.includes('output.push("班別缺少完整上下班時間")'), true);
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
