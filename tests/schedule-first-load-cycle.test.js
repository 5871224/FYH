const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首次班表只載入目前八週 56 天並由完整分頁查詢取得全部列", () => {
  const webApi = read("src/renderer/web-api.js");
  const loadStart = webApi.indexOf("async function loadState()");
  const loadEnd = webApi.indexOf("async function loadScheduleEntries", loadStart);
  const block = webApi.slice(loadStart, loadEnd);
  assert.match(block, /const scheduleRange = getScheduleLoadRange\(settings\)/);
  assert.match(block, /const visibleStartDate = scheduleRange\.startDate \|\| taipeiDateString\(\)/);
  assert.match(block, /scheduleStartDate: visibleStartDate/);
  assert.doesNotMatch(block, /settings\.schedule_start_date/);
  assert.equal((block.match(/callRpcAllRows\("get_schedule_entries_v3"/g) || []).length, 1);
  assert.doesNotMatch(block, /callRpc\("get_schedule_entries_v3"/);
  assert.doesNotMatch(block, /restSelect|schedule_entries\?select/);
});

test("班表初始化不再依賴頁面補丁或第二次同區間查詢", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  assert.match(pageData, /await ensureVisibleScheduleLoaded\(\)/);
  assert.doesNotMatch(pageData, /page-lazy-data|groupRpc|stopImmediatePropagation/);
});

test("單位打卡設定仍延後到單位設定頁載入", () => {
  const department = read("src/renderer/renderer-settings-department.js");
  const webApi = read("src/renderer/web-api.js");
  assert.match(department, /ensureDepartmentAttendanceSettingsLoaded/);
  assert.match(department, /getDepartmentAttendanceSettings/);
  assert.match(webApi, /async function getDepartmentAttendanceSettings\(\)/);
});

test("規格書明定首次班表不相容舊瀏覽位置", () => {
  const spec = read("規格書.md");
  assert.match(spec, /首次畫面不得使用或相容舊的 `schedule_start_date` 瀏覽位置/);
  assert.match(spec, /同一首次載入不得再對同一可視區間補查第二次 `schedule_entries`/);
});
