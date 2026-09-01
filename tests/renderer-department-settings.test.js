const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 驗證正式七欄單位設定畫面與管理資料延後載入。
const root = path.resolve(__dirname, "..");

test("單位設定最終畫面應直接由正式模組提供七欄", async () => {
  const source = fs.readFileSync(path.join(root, "src", "renderer", "renderer-settings-department.js"), "utf8");
  let modalConfig = null;
  const context = {
    state: {
      departments: [{ id: "D1", name: "門市", startDate: "2026-01-01", endDate: "2026-12-31", hiddenFromSchedule: true, attendanceEnabled: true }],
      members: [{ id: "M1", name: "小明", deptId: "D1", active: true }]
    },
    departmentSettingsView: "",
    modalContext: {},
    ensureManagerDirectoryLoaded: async () => {},
    canManagePermissions: () => false,
    showInfoMessage: () => {},
    isMemberCurrentlyActive: (member) => member.active,
    getMemberHomeDeptId: (member) => member.deptId,
    escapeHtml: String,
    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),
    renderActionIconButton: (kind) => kind,
    renderSettingsOrderDragColumn: (isHeader = false) => `<div class="settings-order-drag-col">${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true">≡</span>'}</div>`,
    openEntityListModal: (config) => { modalConfig = config; }
  };
  const api = vm.runInNewContext(source + "\n;({ openDepartmentSettings })", context);
  await api.openDepartmentSettings();
  assert.equal(modalConfig.body.includes("settings-order-drag-col"), true);
  assert.equal(modalConfig.body.includes("開始日期<br>結束日期"), true);
  assert.equal(modalConfig.body.includes("不顯示"), true);
  assert.equal(modalConfig.body.includes("可否打卡"), true);
  assert.equal(modalConfig.body.includes("2026-01-01") && modalConfig.body.includes("2026-12-31"), true);
});

test("單位設定不應再依賴後載入函式覆蓋", () => {
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const department = fs.readFileSync(path.join(root, "src", "renderer", "renderer-settings-department.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-department-settings-columns.js")), false);
  assert.equal(build.includes("v2-department-settings-columns.js"), false);
  assert.equal(department.includes("openDepartmentSettings = function"), false);
  assert.equal((department.match(/function openDepartmentSettings/g) || []).length, 1);
});
