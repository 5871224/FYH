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

test("目前八週班表 RPC 必須分頁讀到全部列，不受單次回傳上限截斷", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /const RPC_PAGE_SIZE = 1000/);
  assert.match(api, /async function callRpcAllRows\(functionName, payload = \{\}\)/);
  assert.match(api, /"Range-Unit": "items"/);
  assert.match(api, /Range: `\$\{offset\}-\$\{offset \+ RPC_PAGE_SIZE - 1\}`/);
  assert.match(api, /parseContentRangeTotal\(response\.headers\.get\("Content-Range"\)\)/);
  assert.match(api, /offset \+= page\.length/);
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
