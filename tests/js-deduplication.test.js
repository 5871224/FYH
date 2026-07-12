const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function rendererSource() {
  const js = fs.readdirSync(path.join(root, "src/renderer"))
    .filter((file) => file.endsWith(".js") && file !== "app.js")
    .map((file) => read("src/renderer/" + file));
  const css = fs.readdirSync(path.join(root, "src/renderer/css"))
    .filter((file) => file.endsWith(".css"))
    .map((file) => read("src/renderer/css/" + file));
  return [...js, ...css].join("\n");
}

test("記錄頁不再使用 v2 UI 標記", () => {
  const source = rendererSource();
  assert.doesNotMatch(source, /data-v2-/);
  assert.doesNotMatch(source, /(?:^|[.\s"'])v2-(?:personal|overtime)/m);
  assert.match(source, /data-personal-record-filter/);
  assert.match(source, /data-overtime-review-check/);
});

test("記錄篩選只由正式記錄事件處理器更新並重新載入", () => {
  const formEvents = read("src/renderer/renderer-events-form.js");
  const recordsEvents = read("src/renderer/renderer-records-events.js");
  assert.doesNotMatch(formEvents, /dataset\.(?:mealReportFilter|overtimeReviewFilter|attendanceFilter)/);
  assert.match(recordsEvents, /scheduleRecordsReload\("meal", loadMealReport\)/);
  assert.match(recordsEvents, /scheduleRecordsReload\("overtime", loadOvertimeReview\)/);
  assert.match(recordsEvents, /scheduleRecordsReload\("attendance", loadAttendanceAdmin\)/);
});

test("登入資料狀態由工廠與單一重設函式提供", () => {
  const foundation = read("src/renderer/renderer-foundation.js");
  const renderer = read("src/renderer/renderer.js");
  const auth = read("src/renderer/renderer-auth-actions.js");
  for (const name of ["createAttendanceState", "createAttendanceOvertimeState", "createMealOrderState", "resetLoadedUserRuntimeState"]) {
    assert.match(foundation, new RegExp("function " + name + "\\("));
  }
  assert.equal((renderer.match(/resetLoadedUserRuntimeState\(\)/g) || []).length, 2);
  assert.equal((auth.match(/resetLoadedUserRuntimeState\(\)/g) || []).length, 1);
  assert.doesNotMatch(renderer + auth, /attendanceState = \{ loading: false/);
});

test("自動排班預覽只由共用函式寫入與儲存", () => {
  const interaction = read("src/renderer/renderer-schedule-interaction.js");
  const autoFill = read("src/renderer/renderer-auto-fill-schedule.js");
  const autoSchedule = read("src/renderer/renderer-auto-schedule.js");
  assert.match(interaction, /async function applySchedulePreviewSlots/);
  assert.match(autoFill, /applySchedulePreviewSlots\(autoSchedulePreview\?\.slots/);
  assert.match(autoSchedule, /applySchedulePreviewSlots\(autoSchedulePreview\.slots/);
  assert.doesNotMatch(autoFill + autoSchedule, /Object\.entries\(previewSlots\)/);
});
