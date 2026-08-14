const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表初始讀取範圍固定為目前八週 56 天", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /startDate: visibleStart,\s*endDate: addDaysToDateString\(visibleStart, 55\)/);
  assert.match(api, /const visibleStartDate = scheduleRange\.startDate \|\| taipeiDateString\(\)/);
  assert.doesNotMatch(api, /addDaysToDateString\(visibleStart, -7\)/);
  assert.doesNotMatch(api, /addDaysToDateString\(visibleStart, 62\)/);
});

test("目前八週班表 RPC 必須以明確 offset/limit 分頁讀到全部列", () => {
  const api = read("src/renderer/web-api.js");
  const sql = read("supabase/002_current_updates.sql");
  assert.match(api, /const RPC_PAGE_SIZE = 1000/);
  assert.match(api, /async function callRpcAllRows\(functionName, payload = \{\}\)/);
  assert.match(api, /p_offset: offset/);
  assert.match(api, /p_limit: RPC_PAGE_SIZE/);
  assert.match(api, /if \(page\.length < RPC_PAGE_SIZE\)/);
  assert.match(api, /offset \+= page\.length/);
  assert.doesNotMatch(api, /Range-Unit|Content-Range|parseContentRangeTotal/);
  assert.match(sql, /get_schedule_entries_v3\(\s*p_start_date date,\s*p_end_date date,\s*p_offset integer,\s*p_limit integer\s*\)/);
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit,1000\),1\),1000\)/);
  assert.match(sql, /offset greatest\(coalesce\(p_offset,0\),0\)/);
});

test("初始八週與切換八週都使用完整分頁讀取", () => {
  const api = read("src/renderer/web-api.js");
  const calls = api.match(/callRpcAllRows\("get_schedule_entries_v3"/g) || [];
  assert.equal(calls.length, 2);
  assert.doesNotMatch(api, /callRpc\("get_schedule_entries_v3"/);
});

test("切換八週只載入目標 56 天，不預載前後一週", () => {
  const dateUtils = read("src/renderer/renderer-date-utils.js");
  assert.match(dateUtils, /function getVisibleScheduleLoadRange\(\) \{\s*return getVisibleDateRange\(\);\s*\}/);
  assert.match(dateUtils, /const range = getVisibleScheduleLoadRange\(\);/);
  assert.doesNotMatch(dateUtils, /getBufferedVisibleDateRange/);
});

test("前後八週導覽仍在切換後按需載入班表", () => {
  const rendererFiles = fs.readdirSync(path.join(root, "src", "renderer"))
    .filter((name) => name.endsWith(".js") && name !== "app.js")
    .map((name) => read(path.join("src", "renderer", name)))
    .join("\n");
  const start = rendererFiles.indexOf("async function changeSchedulePeriodWeeks(weeks)");
  assert.ok(start >= 0, "找不到 changeSchedulePeriodWeeks");
  const body = rendererFiles.slice(start, start + 1800);
  assert.match(body, /await ensureVisibleScheduleLoaded\(\)/);
});
