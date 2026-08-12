const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("設定頁匯出應完整分派單位、班別、假別與加班", async () => {
  const source = read("src/renderer/renderer-export-actions.js");
  const calls = [];
  const context = {
    state: { year: 2026, month: 8 },
    window: { schedulerApi: {
      exportDepartments: async (payload) => calls.push(["department", payload]),
      exportShifts: async (payload) => calls.push(["shift", payload]),
      exportLeaveSettings: async (payload) => calls.push(["leave", payload]),
      exportOvertimeSettings: async (payload) => calls.push(["overtime", payload])
    } },
    setSaveStatus: () => {}
  };
  const api = vm.runInNewContext(source + "\n;({ exportDepartmentsFromSettings, exportListSettings })", context);

  await api.exportDepartmentsFromSettings();
  await api.exportListSettings("shift");
  await api.exportListSettings("leave");
  await api.exportListSettings("overtime");

  assert.deepEqual(Array.from(calls, ([name]) => name), ["department", "shift", "leave", "overtime"]);
  calls.forEach(([, payload]) => {
    assert.equal(payload.state, context.state);
    assert.equal(payload.year, 2026);
    assert.equal(payload.month, 8);
  });
});

test("完整畫面重繪後才同步群組與功能權限 UI", () => {
  const shell = read("src/renderer/renderer-app-shell.js");
  const renderTableIndex = shell.indexOf("renderTable();");
  const permissionIndex = shell.indexOf("syncPermissionUi();", renderTableIndex);
  assert.ok(renderTableIndex >= 0);
  assert.ok(permissionIndex > renderTableIndex, "權限 UI 必須在首頁、訂餐頁與班表完成重繪後再同步");
});

test("群組停用訂餐時應顯示正確原因並以後端狀態回寫前端快取", () => {
  const mainPages = read("src/renderer/renderer-main-pages.js");
  const mealPage = read("src/renderer/renderer-meal-page.js");
  assert.match(mainPages, /status\.mealEnabled === false[\s\S]*此群組未開放訂餐/);
  assert.match(mealPage, /function syncCurrentGroupMealAvailability\(status\)/);
  assert.match(mealPage, /actorGroup\.mealEnabled = status\.mealEnabled/);
  assert.match(mealPage, /syncCurrentGroupMealAvailability\(status\)/);
});
