const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
// 前端正式化後不得重新加入任何 v2 後載入補丁或同名函式覆蓋。

test("renderer 不再含任何 v2 JavaScript 補丁", () => {
  const files = fs.readdirSync(path.join(root, "src/renderer")).filter((file) => /^v2-.*\.js$/.test(file));
  assert.deepEqual(files, []);
});

test("帳號刪除由正式 API 與人員模組提供", () => {
  const api = read("src/renderer/web-api.js");
  const members = read("src/renderer/renderer-settings-member.js");
  assert.match(api, /async function deleteMemberProfile\(employeeCode,currentPassword=""\)/);
  assert.match(api, /request\("\/api\/v1\/members\/delete",\{method:"POST",body:\{employeeCode:String\(employeeCode\|\|""\)\.trim\(\),currentPassword:String\(currentPassword\|\|""\)\}\}\)/);
  assert.match(members, /請輸入目前密碼以確認刪除帳號/);
  assert.match(members, /softDeleted/);
  assert.doesNotMatch(members, /deleteMember\s*=\s*async function/);
  assert.doesNotMatch(api, /member-delete-v2|requestFunction\(|\/functions\/v1\//);
});

test("訂餐 Excel 由 exporter 建立，web-api 只協調下載", () => {
  const api = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  assert.equal((api.match(/async function exportMealReport\s*\(/g) || []).length, 1);
  assert.match(api, /exporter\.createMealReportWorkbook/);
  assert.doesNotMatch(api, /function buildMealEmployeeRows|function styleMealExportSheet/);
  assert.match(exporter, /async function createMealReportWorkbook/);
  assert.match(exporter, /function buildMealEmployeeRows/);
});

test("設定拖曳把手直接由正式畫面產生", () => {
  const source = ["renderer-settings-ordering.js", "renderer-settings-member.js", "renderer-settings-catalog.js", "renderer-settings-department.js", "renderer-events-drag.js"].map((file) => read("src/renderer/" + file)).join("\n");
  assert.match(source, /function renderSettingsOrderDragColumn/);
  assert.match(source, /settings-order-drag-handle/);
  assert.match(source, /!event.target.closest\("\.settings-order-drag-handle"\)/);
  assert.doesNotMatch(source, /installV2SettingsDragHandles/);
});

test("拖曳捲動保存由正式事件總控註冊", () => {
  const moduleSource = read("src/renderer/renderer-drag-scroll-preserve.js");
  const events = read("src/renderer/renderer-events.js");
  assert.match(moduleSource, /function bindDragScrollPreservation/);
  assert.match(moduleSource, /restoreDragScrollPosition/);
  assert.match(events, /bindDragScrollPreservation\(\)/);
});
