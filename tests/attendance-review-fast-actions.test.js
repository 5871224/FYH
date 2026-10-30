const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("門市休例日加班前推、工廠加班接在下班後", () => {
  const webApi = read("src/renderer/web-api.js");
  const spec = read("規格書.md");
  const helperStart = webApi.indexOf("function subtractOvertimeHoursFromClockTime");
  const helperEnd = webApi.indexOf("\n  function downloadBlob", helperStart);
  const helperSource = webApi.slice(helperStart, helperEnd).trim();
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.ok(helperSource);
  const helper = Function(`${helperSource}; return subtractOvertimeHoursFromClockTime;`)();
  assert.deepEqual(helper("08:00", 2), { time: "06:00", previousDay: 0 });
  assert.deepEqual(helper("01:00", 2), { time: "23:00", previousDay: 1 });
  assert.ok(webApi.includes('const adjustedStart = subtractOvertimeHoursFromClockTime(baselineStart, hours)'));
  assert.ok(webApi.includes('const actualStart = isFactory ? baselineStart : adjustedStart.time || baselineStart'));
  assert.ok(webApi.includes('overtime_previous_day: isFactory ? 0 : adjustedStart.previousDay'));
  assert.match(spec, /門市群組以 11:30～20:30/);
  assert.match(spec, /工廠群組的額外加班時數改為在班別下班時間之後/);
});

test("簽到審核寫入採批次後端與前端局部更新", () => {
  const actions = read("src/renderer/renderer-records-actions.js");
  const edge = read("supabase/functions/attendance-review-groups/index.ts");
  const spec = read("規格書.md");
  const reviewSet = edge.match(/async function reviewSet\(ctx: any, body: any, actor: any\) \{[\s\S]*?\n\}\n\nasync function history/)?.[0] || "";
  const single = actions.match(/async function setAttendanceReviewed\(token, reviewed\) \{[\s\S]*?\n\}/)?.[0] || "";
  const batch = actions.match(/async function batchReviewAttendance\(mode\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(actions, /function applyAttendanceReviewSetResult/);
  assert.match(single, /applyAttendanceReviewSetResult/);
  assert.match(batch, /applyAttendanceReviewSetResult/);
  assert.doesNotMatch(single, /loadRecordsPage/);
  assert.doesNotMatch(batch, /loadRecordsPage/);
  assert.match(single, /if \(pageChanged\) await loadAttendanceReview\(false\)/);
  assert.match(batch, /if \(pageChanged\) await loadAttendanceReview\(false\)/);
  assert.ok(reviewSet);
  assert.doesNotMatch(reviewSet, /ensureTargetAllowed/);
  assert.match(reviewSet, /const \[allowedGroupIds, targetResult\] = await Promise\.all/);
  assert.match(reviewSet, /\.update\(update\)\.in\("id", dayIds\)\.select\("\*"\)/);
  assert.match(reviewSet, /from\("attendance_audit_logs"\)\.insert\(auditRows\)/);
  assert.match(spec, /集合式權限驗證、批次更新 `attendance_days`、批次寫入 `attendance_audit_logs`/);
});
