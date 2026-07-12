const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");
const moduleNames = ["renderer-settings-catalog.js", "renderer-settings-department.js", "renderer-settings-ordering.js", "renderer-settings-member.js"];

function evaluate(file, expression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", file), "utf8");
  return vm.runInNewContext(source + "\n;" + expression, context);
}

test("目錄設定應保留顏色預覽與共用操作按鈕", () => {
  const context = { modalColor: "#123456", modalTextColor: "#ffffff", escapeHtml: String };
  const api = evaluate("renderer-settings-catalog.js", "({ renderColorPreviewFields, renderActionIconButton })", context);
  const preview = api.renderColorPreviewFields("leave", "事假");
  assert.equal(preview.includes("#123456") && preview.includes("事假") && preview.includes("自動字色"), true);
  assert.equal(api.renderActionIconButton("delete", "data-delete-id=\"A\"").includes("settings-icon-btn-danger"), true);
});

test("單位表單應保留有效期間、班表顯示與打卡欄位", () => {
  const context = { escapeHtml: String, isAdmin: () => true };
  const api = evaluate("renderer-settings-department.js", "({ renderDepartmentFormBody })", context);
  const html = api.renderDepartmentFormBody({ name: "門市", startDate: "2026-01-01", endDate: "", hiddenFromSchedule: true, address: "台北", latitude: 25, longitude: 121, publicIp: "1.2.3.4", attendanceEnabled: true }, "");
  ["departmentStartDate", "departmentEndDate", "departmentHiddenFromSchedule", "departmentAddress", "departmentLatitude", "departmentLongitude", "departmentPublicIp", "departmentAttendanceEnabled"].forEach((id) => assert.equal(html.includes(id), true));
});

test("設定拖曳排序應只重排可見項目並保留缺漏項目", () => {
  const api = evaluate("renderer-settings-ordering.js", "({ applyOrderedIds })");
  const items = [{ id: "A" }, { id: "B" }, { id: "C" }];
  assert.deepEqual(JSON.parse(JSON.stringify(api.applyOrderedIds(items, ["C", "A"]))), [{ id: "C" }, { id: "A" }, { id: "B" }]);
});

test("人員設定篩選應同時套用姓名、單位、權限、在職與薪資條件", () => {
  const context = {
    state: { members: [
      { id: "1", name: "王小明", deptId: "D1", role: "employee", payByDay: false, active: true },
      { id: "2", name: "王小華", deptId: "D1", role: "manager", payByDay: true, active: true },
      { id: "3", name: "李小明", deptId: "D2", role: "employee", payByDay: false, active: false }
    ] },
    memberSettingsFilters: { name: "王", department: "D1", role: "employee", employment: "active", salaryType: "monthly" },
    getMemberHomeDeptId: (member) => member.deptId,
    normalizeRole: (role) => role,
    isMemberCurrentlyActive: (member) => member.active
  };
  const api = evaluate("renderer-settings-member.js", "({ getFilteredMemberSettingsMembers })", context);
  const result = api.getFilteredMemberSettingsMembers();
  assert.deepEqual(Array.from(result.filteredMembers, (member) => member.id), ["1"]);
});

test("第六階段應移出設定管理並維持建置順序", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  ["function openListSettings", "function openDepartmentSettings", "function commitSortedListFromDom", "async function openMemberSettings"].forEach((marker) => assert.equal(renderer.includes(marker), false, "renderer.js 仍包含：" + marker));
  moduleNames.forEach((name) => assert.equal(RENDERER_CORE_FILES.includes(name), true));
  const order = RENDERER_CORE_FILES.map((name) => build.indexOf("\"" + name + "\""));
  assert.equal(order.every((index) => index >= 0), true);
  assert.equal(order.every((index, position) => position === 0 || index > order[position - 1]), true);
  assert.equal(renderer.split(/\r?\n/).length < 3900, true);
  assert.equal(readRendererCore(root).includes("async function saveMember"), true);
});
