const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 正式回歸：首次進班表只依八週起算日計算今天所在週期，且同一範圍只查一次。
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首次班表應以八週起算日決定今天所在週期且只查一次班表", () => {
  const webApi = read("src/renderer/web-api.js");
  const lazy = read("src/renderer/page-lazy-data.mjs");
  const loadStart = webApi.indexOf("async function loadState()");
  const loadEnd = webApi.indexOf("async function syncLeaveAndOvertimeCatalogs", loadStart);
  const loadBlock = webApi.slice(loadStart, loadEnd);

  assert.match(loadBlock, /const scheduleRange = getScheduleLoadRange\(settings\)/);
  assert.match(loadBlock, /const visibleStartDate = addDaysToDateString\(scheduleRange\.startDate, 7\)/);
  assert.match(loadBlock, /scheduleStartDate: visibleStartDate/);
  assert.doesNotMatch(loadBlock, /settings\.schedule_start_date/);
  assert.equal((loadBlock.match(/restSelect\("schedule_entries"/g) || []).length, 1);
  assert.doesNotMatch(loadBlock, /department-attendance-v2/);

  const ensureStart = lazy.indexOf("async function ensureSchedulePageData()");
  const ensureEnd = lazy.indexOf("document.body.addEventListener", ensureStart);
  const ensureBlock = lazy.slice(ensureStart, ensureEnd);
  assert.doesNotMatch(ensureBlock, /ensureVisibleScheduleLoaded/);
});

test("班表只補群組實體對照且單位打卡設定延後到單位設定", () => {
  const lazy = read("src/renderer/page-lazy-data.mjs");
  const department = read("src/renderer/renderer-settings-department.js");
  const webApi = read("src/renderer/web-api.js");

  assert.match(lazy, /get_group_entity_map_v1/);
  assert.match(lazy, /bundle: groupFeatureState\.bundle/);
  assert.match(department, /ensureDepartmentAttendanceSettingsLoaded/);
  assert.match(department, /getDepartmentAttendanceSettings/);
  assert.match(webApi, /async function getDepartmentAttendanceSettings\(\)/);
  assert.match(webApi, /getDepartmentAttendanceSettings,/);
});

test("規格書明定首次班表不相容舊瀏覽位置", () => {
  const spec = read("規格書.md");
  assert.match(spec, /首次畫面不得使用或相容舊的 `schedule_start_date` 瀏覽位置/);
  assert.match(spec, /同一首次載入不得再對同一可視區間補查第二次 `schedule_entries`/);
});
