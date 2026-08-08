const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定安全目錄刪除與新增人員上一工號行為。
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "src", "renderer", "renderer-settings-catalog.js");

function evaluateDelete(apiImpl) {
  const source = fs.readFileSync(catalogPath, "utf8");
  const start = source.indexOf("async function deleteListItem");
  const functionSource = source.slice(start);
  const calls = [];
  const context = {
    state: {
      shifts: [{ id: "S1" }, { id: "S2" }],
      leaves: [{ id: "L1" }],
      overtime: [{ id: "O1" }],
      members: [{ id: "M1", scheduleShiftIds: ["S1", "S2"] }]
    },
    confirmAction: async () => true,
    captureSettingsReturnContext: (value) => ({ ...value, scrollTop: 120 }),
    reopenSettingsModalPreservingScroll: async (value) => calls.push("open:" + value.listCategory),
    closeModal: () => calls.push("close"),
    window: { schedulerApi: { deleteCatalogItem: apiImpl } },
    setSaveStatus: (message) => calls.push(message),
    renderAll: () => calls.push("render"),
    openListSettings: (category) => calls.push("open:" + category),
    getMemberScheduleShiftIds: (member) => member.scheduleShiftIds,
    removeAssignmentsByItem: (category, id) => calls.push("remove:" + category + ":" + id)
  };
  const api = vm.runInNewContext(functionSource + "\n;({ deleteListItem })", context);
  return { api, context, calls };
}

test("目錄刪除成功後才更新前端狀態", async () => {
  const { api, context, calls } = evaluateDelete(async () => ({ ok: true }));
  await api.deleteListItem("shift", "S1");
  assert.deepEqual(Array.from(context.state.shifts, (item) => item.id), ["S1", "S2"]);
  assert.equal(context.state.shifts.find((item) => item.id === "S1")?.deleted, true);
  assert.deepEqual(Array.from(context.state.members[0].scheduleShiftIds), ["S2"]);
  assert.equal(calls.includes("remove:shift:S1"), false);
  assert.equal(calls.includes("open:shift"), true);
});

test("後端刪除失敗時不應先移除前端資料", async () => {
  const { api, context, calls } = evaluateDelete(async () => { throw new Error("已有歷史資料"); });
  await api.deleteListItem("leave", "L1");
  assert.deepEqual(Array.from(context.state.leaves, (item) => item.id), ["L1"]);
  assert.equal(calls.some((value) => String(value).includes("已有歷史資料")), true);
  assert.equal(calls.includes("remove:leave:L1"), false);
  assert.equal(calls.includes("close"), false);
});

test("安全目錄 API 與人員同步應由正式 web-api 提供", () => {
  const webApi = fs.readFileSync(path.join(root, "src", "renderer", "web-api.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(webApi.includes('async function deleteCatalogItem(category, itemId)'), true);
  assert.equal(webApi.includes('callRpc("delete_catalog_item_v3"'), true);
  assert.equal(webApi.includes('p_item_id: String(itemId || "")'), true);
  assert.equal(webApi.includes('requestFunction("catalog-admin"'), false);
  assert.equal(webApi.includes("    deleteCatalogItem,"), true);
  assert.equal(webApi.includes('previousEmployeeCode: String(previousEmployeeCode || "").trim()'), true);
  assert.equal(webApi.includes('groupId: member?.groupId || ""'), true);
  assert.equal(webApi.includes('accessRoleId: member?.roleId || ""'), true);
  assert.equal(webApi.includes('previousEmployeeCode: String(previousEmployeeCode || member?.code'), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-admin-data-fixes.js")), false);
  assert.equal(build.includes("v2-admin-data-fixes.js"), false);
});

test("目錄刪除畫面流程不應再依賴函式覆蓋", () => {
  const catalog = fs.readFileSync(catalogPath, "utf8");
  assert.equal(catalog.includes("deleteListItem = async function"), false);
  assert.equal((catalog.match(/async function deleteListItem\b/g) || []).length, 1);
  assert.equal(catalog.includes("await window.schedulerApi.deleteCatalogItem(category, id)"), true);
  assert.equal(catalog.includes("await forceSave()"), false);
});
