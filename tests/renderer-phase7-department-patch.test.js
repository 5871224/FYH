const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("單位設定最終畫面應直接由正式模組提供六欄", async () => {
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
    showInfoMessage: () => {},
    isMemberCurrentlyActive: (member) => member.active,
    getMemberHomeDeptId: (member) => member.deptId,
    escapeHtml: String,
    renderActionIconButton: (kind) => kind,
    openEntityListModal: (config) => { modalConfig = config; }
  };
  const api = vm.runInNewContext(source + "\n;({ openDepartmentSettings })", context);
  await api.openDepartmentSettings();
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
