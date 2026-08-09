const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("前一週與後一週只水平捲動，不切換八週資料範圍", () => {
  const events = read("src/renderer/renderer-events-toolbar.js");
  const actions = read("src/renderer/renderer-export-actions.js");

  assert.match(events, /bindClick\("prevWeekButton", \(\) => scrollScheduleByWeeks\(-1\)\)/);
  assert.match(events, /bindClick\("nextWeekButton", \(\) => scrollScheduleByWeeks\(1\)\)/);
  assert.match(events, /bindClick\("tablePrevWeekButton", \(\) => scrollScheduleByWeeks\(-1\)\)/);
  assert.match(events, /bindClick\("tableNextWeekButton", \(\) => scrollScheduleByWeeks\(1\)\)/);

  const scrollFunction = actions.match(/function scrollScheduleByWeeks\(weeks\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(scrollFunction, /dayWidth \* SCHEDULE_WEEK_SCROLL_DAYS/);
  assert.match(actions, /const SCHEDULE_WEEK_SCROLL_DAYS = 7;/);
  assert.doesNotMatch(scrollFunction, /state\.scheduleStartDate|ensureVisibleScheduleLoaded|renderAll|forceSave/);
});

test("前八週與後八週才切換完整班表期間", () => {
  const events = read("src/renderer/renderer-events-toolbar.js");
  const actions = read("src/renderer/renderer-export-actions.js");

  assert.match(events, /bindClick\("prevPeriodButton", async \(\) => changeSchedulePeriodWeeks\(-8\)\)/);
  assert.match(events, /bindClick\("nextPeriodButton", async \(\) => changeSchedulePeriodWeeks\(8\)\)/);
  assert.match(actions, /async function changeSchedulePeriodWeeks\(weeks\)/);
  assert.match(actions, /state\.scheduleStartDate = addDaysToDateString\(startDate, weeks \* 7\)/);
});

test("週導覽按鈕依實際水平捲動邊界啟用停用", () => {
  const events = read("src/renderer/renderer-events-toolbar.js");
  const actions = read("src/renderer/renderer-export-actions.js");

  assert.match(actions, /maxScrollLeft: Math\.max\(0, tableWrap\.scrollWidth - tableWrap\.clientWidth\)/);
  assert.match(actions, /button\.disabled = !canScrollScheduleByWeeks\(weeks\)/);
  assert.match(events, /syncScheduleWeekNavigationButtons\(\);/);
});

test("規格書明定週導覽不改變八週資料範圍", () => {
  const spec = read("規格書.md");
  assert.match(spec, /前一週、後一週只水平捲動 7 個日期欄，不變更目前八週資料範圍/);
  assert.match(spec, /只有「前八週」、「後八週」切換完整八週期間/);
});
