const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核移除代為申請並只顯示員工姓名", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const clicks = read("src/renderer/renderer-events-click.js");
  assert.equal(views.includes("代為申請"), false);
  assert.equal(views.includes("data-open-admin-attendance-create"), false);
  assert.equal(actions.includes("openAdminAttendanceCreateModal"), false);
  assert.equal(actions.includes("saveAdminAttendanceCreate"), false);
  assert.equal(clicks.includes("openAdminAttendanceCreate"), false);
  assert.equal(views.includes('${escapeHtml(row.employee_name || "")}<br><span>${escapeHtml(row.employee_code || "")}</span>'), false);
  assert.match(views, /attendance-review-employee-col[^>]*>\$\{escapeHtml\(row\.employee_name/);
});

test("背景初始化完成後不強制把已開啟頁面切回首頁", () => {
  const source = read("src/renderer/renderer.js");
  assert.equal(source.includes('currentMember = resolveCurrentMember();\n    appView = "home";'), false);
  assert.match(source, /let appView = "home";/);
  assert.match(source, /if \(!authContext\?\.authenticated \|\| !authContext\?\.user\)[\s\S]*?appView = "home";/);
});

test("個人記錄輸入採暫存與靜默重新讀取", () => {
  const foundation = read("src/renderer/renderer-foundation.js");
  const page = read("src/renderer/renderer-records-page.js");
  const events = read("src/renderer/renderer-records-events.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const views = read("src/renderer/renderer-records-views.js");
  assert.match(foundation, /personalDrafts: \{\}/);
  assert.match(page, /function setPersonalAttendanceDraft/);
  assert.match(page, /async function loadRecordsPage\(shouldRender = true\)/);
  assert.match(events, /document\.addEventListener\("input"[\s\S]*?setPersonalAttendanceDraft/);
  assert.match(actions, /await loadRecordsPage\(false\)/);
  assert.match(actions, /clearPersonalAttendanceDraft/);
  assert.equal(actions.includes("input.disabled = true"), false);
  assert.match(views, /getPersonalAttendanceValue\(record, field\)/);
  assert.match(views, /getPersonalAttendanceValue\(record, "note"\)/);
});
