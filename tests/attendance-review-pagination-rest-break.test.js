const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核換頁會重試網路層失敗並防止過期請求覆蓋", () => {
  const webApi = read("src/renderer/web-api.js");
  const foundation = read("src/renderer/renderer-foundation.js");
  const page = read("src/renderer/renderer-records-page.js");
  const events = read("src/renderer/renderer-records-events.js");
  const views = read("src/renderer/renderer-records-views.js");

  assert.match(webApi, /async function requestFunction[\s\S]*?try \{[\s\S]*?await fetch[\s\S]*?catch \(error\)[\s\S]*?retryTransientOnce && attempt === 0[\s\S]*?setTimeout\(resolve, 300\)/);
  assert.match(webApi, /getAttendanceReviewList[\s\S]*?retryTransientOnce: true/);
  assert.match(foundation, /attendanceReview:[\s\S]*?requestId: 0/);
  assert.match(page, /requestId: Number\(current\.requestId \|\| 0\)/);
  assert.match(page, /const requestId = Number\(review\.requestId \|\| 0\) \+ 1/);
  assert.match(page, /Number\(current\.requestId \|\| 0\) !== requestId/);
  assert.doesNotMatch(page, /let attendanceReviewLoadRequestId/);
  assert.match(events, /if \(review\.loading\) return;/);
  assert.match(views, /page <= 1 \|\| review\.loading/);
  assert.match(views, /page >= pages \|\| review\.loading/);
});

test("簽到審核後端會分批讀取完整班表與打卡資料", () => {
  const edgeFunction = read("supabase/functions/attendance-review-groups/index.ts");

  assert.match(edgeFunction, /const DATA_FETCH_PAGE_SIZE = 1000/);
  assert.match(edgeFunction, /async function fetchAllRows[\s\S]*?offset \+= DATA_FETCH_PAGE_SIZE[\s\S]*?pageRows\.length < DATA_FETCH_PAGE_SIZE/);
  assert.match(edgeFunction, /from\("schedule_entries"\)[\s\S]*?order\("work_date"[\s\S]*?order\("member_id"[\s\S]*?range\(from, to\)/);
  assert.match(edgeFunction, /from\("attendance_days"\)\.select\("\*"\)[\s\S]*?order\("work_date"[\s\S]*?order\("user_id"[\s\S]*?range\(from, to\)/);
});

test("休息日或例假簽到審核匯出在加班開始四小時後帶一小時休息", () => {
  const webApi = read("src/renderer/web-api.js");

  assert.match(webApi, /function addMinutesToClockTime/);
  const helperStart = webApi.indexOf("function addMinutesToClockTime");
  const helperEnd = webApi.indexOf("\n  function downloadBlob", helperStart);
  const helperSource = webApi.slice(helperStart, helperEnd).trim();
  const helper = Function(`${helperSource}; return addMinutesToClockTime;`)();
  assert.equal(helper("11:30", 4 * 60), "15:30");
  assert.equal(helper("11:30", 5 * 60), "16:30");

  assert.match(webApi, /const overtimeStart = adjustedStart\.time \|\| scheduledStart/);
  assert.match(webApi, /addMinutesToClockTime\(overtimeStart, 4 \* 60\)/);
  assert.match(webApi, /addMinutesToClockTime\(overtimeStart, 5 \* 60\)/);
  assert.match(webApi, /overtime_use_rest_1: true/);
  assert.match(webApi, /overtime_rest_1_start_time: rest1Start/);
  assert.match(webApi, /overtime_rest_1_end_time: rest1End/);
  assert.match(webApi, /overtime_rest_1_paid: 0/);
});
