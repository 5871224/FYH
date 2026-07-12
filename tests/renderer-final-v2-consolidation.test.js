const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("renderer 不再含任何 v2 JavaScript 補丁", () => {
  const files = fs.readdirSync(path.join(root, "src/renderer")).filter((file) => /^v2-.*\.js$/.test(file));
  assert.deepEqual(files, []);
});

test("帳號刪除由正式 API 與人員模組提供", () => {
  const api = read("src/renderer/web-api.js");
  const members = read("src/renderer/renderer-settings-member.js");
  assert.match(api, /async function deleteMemberProfile\(employeeCode, currentPassword = ""\)/);
  assert.match(api, /currentPassword: String\(currentPassword/);
  assert.match(members, /請輸入目前密碼以確認刪除帳號/);
  assert.match(members, /softDeleted/);
  assert.doesNotMatch(members, /deleteMember\s*=\s*async function/);
});

test("訂餐 Excel 由正式 web-api 唯一提供", () => {
  const api = read("src/renderer/web-api.js");
  assert.equal((api.match(/async function exportMealReport\s*\(/g) || []).length, 1);
  assert.equal(api.includes("row.amount - mealDays * companySubsidy"), true);
  assert.match(api, /員工姓名.*員工編號.*早餐金額.*午餐金額/s);
  assert.doesNotMatch(api, /首次下訂時間|最後修改時間|員工工號/);
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
