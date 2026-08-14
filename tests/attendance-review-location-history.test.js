const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核操作圖示與表頭狀態清楚", () => {
  const view = read("src/renderer/renderer-records-views.js");
  const css = read("src/renderer/css/pages.css");
  assert.match(view, /M5 12l4 4L19 6/);
  assert.match(view, /M12 9v4m0 4h\.01/);
  assert.match(view, /is-set-reviewed/);
  assert.match(view, /is-set-unreviewed/);
  assert.match(css, /\.attendance-review-table thead th \{\s*text-align: center;/);
});

test("簽到審核編輯上下班地點會完整傳到後端並受群組權限驗證", () => {
  const actions = read("src/renderer/renderer-records-actions.js");
  const page = read("src/renderer/renderer-records-page.js");
  const attendance = read("src/backend/native-attendance.js");
  assert.match(actions, /reviewClockInLocation/);
  assert.match(actions, /reviewClockOutLocation/);
  assert.match(actions, /clockInLocationDepartmentId/);
  assert.match(actions, /clockOutLocationDepartmentId/);
  assert.match(page, /departments: result\.departments \|\| \[\]/);
  assert.match(actions, /\.filter\(\(department\) => groupId &&/);
  assert.doesNotMatch(actions, /departments\.unshift/);
  assert.doesNotMatch(actions, /管理員補登/);
  assert.match(attendance, /async function reviewSave\(/);
  assert.match(attendance, /clockInLocationDepartmentId/);
  assert.match(attendance, /clockOutLocationDepartmentId/);
  assert.match(attendance, /打卡地點不屬於該人員群組/);
  assert.match(attendance, /String\(d\.group_id\)!==String\(target\.group_id\)/);
  assert.doesNotMatch(attendance, /此單位目前未開放打卡/);
});

test("簽到修改歷程使用中文操作名稱並顯示時間與地點前後值", () => {
  const actions = read("src/renderer/renderer-records-actions.js");
  assert.match(actions, /admin_edit: "主管修正"/);
  assert.match(actions, /reviewed: "設為已審"/);
  assert.match(actions, /returned: "設為未審"/);
  assert.match(actions, /上班地點/);
  assert.match(actions, /下班地點/);
  assert.match(actions, /變更內容/);
});
