const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表初始讀取範圍固定為目前八週 56 天", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /function scheduleRange\(settings=\{\}\)[\s\S]*?return\{startDate:start,endDate:addDays\(start,55\)\}/);
  assert.doesNotMatch(api, /addDays\(start,-7\)/);
  assert.doesNotMatch(api, /addDays\(start,62\)/);
});

test("目前八週班表 FYH API 必須以明確 offset/limit 分頁讀到全部列", () => {
  const api = read("src/renderer/web-api.js");
  const repository = read("src/backend/repositories/native-schedule-repository.js");
  assert.match(api, /async function loadEntryRows\(startDate,endDate\)\{const rows=\[\];let offset=0;for\(;;\)/);
  assert.match(api, /\/api\/v1\/schedule\/entries\$\{qs\(\{startDate,endDate,offset,limit:1000\}\)\}/);
  assert.match(api, /if\(page\.length<1000\)break;offset\+=page\.length/);
  assert.doesNotMatch(api, /Range-Unit|Content-Range|parseContentRangeTotal|callRpcAllRows/);
  assert.match(repository, /const safeOffset = Math\.max\(0, Number\(offset\) \|\| 0\)/);
  assert.match(repository, /const safeLimit = Math\.min\(1000, Math\.max\(1, Number\(limit\) \|\| 1000\)\)/);
  assert.match(repository, /limit \$5::integer\s+offset \$4::integer/);
});

test("初始八週與切換八週都使用完整分頁讀取", () => {
  const api = read("src/renderer/web-api.js");
  const calls = api.match(/const rows=await loadEntryRows\(/g) || [];
  assert.equal(calls.length, 2);
  assert.match(api, /async function loadState\(\)[\s\S]*?const rows=await loadEntryRows\(range\.startDate,range\.endDate\)/);
  assert.match(api, /async function loadScheduleEntries\(range=\{\}\)[\s\S]*?const rows=await loadEntryRows\(startDate,endDate\)/);
  assert.doesNotMatch(api, /get_schedule_entries_v3|callRpc\(/);
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
