const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首次班表只載入目前八週 56 天並由 FYH API 完整分頁取得全部列", () => {
  const webApi = read("src/renderer/web-api.js");
  const entryStart = webApi.indexOf("async function loadEntryRows");
  const entryEnd = webApi.indexOf("async function loadState", entryStart);
  const entryBlock = webApi.slice(entryStart, entryEnd);
  const loadStart = webApi.indexOf("async function loadState()");
  const loadEnd = webApi.indexOf("async function loadScheduleEntries", loadStart);
  const loadBlock = webApi.slice(loadStart, loadEnd);

  assert.match(loadBlock, /const range=scheduleRange\(settings\)/);
  assert.match(loadBlock, /const rows=await loadEntryRows\(range\.startDate,range\.endDate\)/);
  assert.match(loadBlock, /scheduleStartDate:range\.startDate/);
  assert.match(loadBlock, /scheduleLoadedRanges:\[range\]/);
  assert.doesNotMatch(loadBlock, /settings\.schedule_start_date/);

  assert.match(entryBlock, /request\(`\/api\/v1\/schedule\/entries\$\{qs\(\{startDate,endDate,offset,limit:1000\}\)\}`\)/);
  assert.match(entryBlock, /rows\.push\(\.\.\.page\)/);
  assert.match(entryBlock, /if\(page\.length<1000\)break/);
  assert.match(entryBlock, /offset\+=page\.length/);
  assert.doesNotMatch(entryBlock, /callRpc|restSelect|schedule_entries\?select/);
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
