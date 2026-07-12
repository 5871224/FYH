const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const webApiPath = path.join(rendererDir, "web-api.js");
const catalogPath = path.join(rendererDir, "renderer-settings-catalog.js");
const patchPath = path.join(rendererDir, "v2-admin-data-fixes.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testPath = path.join(root, "tests", "renderer-phase7-admin-data-fixes.test.js");

let webApi = fs.readFileSync(webApiPath, "utf8");
const oldPreviousCode = 'previousEmployeeCode: String(previousEmployeeCode || member?.code || "").trim(),';
const newPreviousCode = 'previousEmployeeCode: String(previousEmployeeCode || "").trim(),';
if (!webApi.includes(oldPreviousCode)) throw new Error("找不到人員同步上一工號欄位");
webApi = webApi.replace(oldPreviousCode, newPreviousCode);

const deleteApiMarker = "  async function resolveManagerMemberProfileId(memberId, memberCode) {";
if (!webApi.includes(deleteApiMarker)) throw new Error("找不到目錄 API 插入位置");
const deleteApi = `  async function deleteCatalogItem(category, id) {
    ensureManager();
    return requestFunction("catalog-admin", {
      action: "delete",
      category: String(category || ""),
      id: String(id || "")
    });
  }

`;
webApi = webApi.replace(deleteApiMarker, deleteApi + deleteApiMarker);
const exportMarker = "    saveCatalogItem,\n    saveScheduleCells,";
if (!webApi.includes(exportMarker)) throw new Error("找不到 schedulerApi 目錄方法輸出位置");
webApi = webApi.replace(exportMarker, "    saveCatalogItem,\n    deleteCatalogItem,\n    saveScheduleCells,");
fs.writeFileSync(webApiPath, webApi);

let catalog = fs.readFileSync(catalogPath, "utf8");
const deleteStart = catalog.indexOf("async function deleteListItem(category, id) {");
if (deleteStart < 0) throw new Error("找不到目錄刪除函式");
const canonicalDelete = `async function deleteListItem(category, id) {
  const labelMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  const confirmed = await confirmAction(\`確定要刪除這個\${labelMap[category] || "項目"}嗎？\`);
  if (!confirmed) {
    return;
  }

  closeModal();
  try {
    await window.schedulerApi.deleteCatalogItem(category, id);
  } catch (error) {
    setSaveStatus(\`\${labelMap[category] || "項目"}刪除失敗：\${error.message || error}\`);
    renderAll();
    openListSettings(category);
    return;
  }

  if (category === "shift") {
    state.shifts = state.shifts.filter((item) => item.id !== id);
    state.members = state.members.map((member) => ({
      ...member,
      scheduleShiftIds: getMemberScheduleShiftIds(member).filter((shiftId) => shiftId !== id)
    }));
  }
  if (category === "leave") state.leaves = state.leaves.filter((item) => item.id !== id);
  if (category === "overtime") state.overtime = state.overtime.filter((item) => item.id !== id);
  removeAssignmentsByItem(category, id);
  renderAll();
  openListSettings(category);
}`;
catalog = catalog.slice(0, deleteStart) + canonicalDelete + "\n";
fs.writeFileSync(catalogPath, catalog);

if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的管理資料修正補丁");
fs.unlinkSync(patchPath);
let build = fs.readFileSync(buildPath, "utf8");
build = build.replace(/^\s*"v2-admin-data-fixes\.js",?\r?\n/m, "");
fs.writeFileSync(buildPath, build);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
    closeModal: () => calls.push("close"),
    window: { schedulerApi: { deleteCatalogItem: apiImpl } },
    setSaveStatus: (message) => calls.push(message),
    renderAll: () => calls.push("render"),
    openListSettings: (category) => calls.push("open:" + category),
    getMemberScheduleShiftIds: (member) => member.scheduleShiftIds,
    removeAssignmentsByItem: (category, id) => calls.push("remove:" + category + ":" + id)
  };
  const api = vm.runInNewContext(functionSource + "\\n;({ deleteListItem })", context);
  return { api, context, calls };
}

test("目錄刪除成功後才更新前端狀態", async () => {
  const { api, context, calls } = evaluateDelete(async () => ({ ok: true }));
  await api.deleteListItem("shift", "S1");
  assert.deepEqual(Array.from(context.state.shifts, (item) => item.id), ["S2"]);
  assert.deepEqual(Array.from(context.state.members[0].scheduleShiftIds), ["S2"]);
  assert.equal(calls.includes("remove:shift:S1"), true);
  assert.equal(calls.includes("open:shift"), true);
});

test("後端刪除失敗時不應先移除前端資料", async () => {
  const { api, context, calls } = evaluateDelete(async () => { throw new Error("已有歷史資料"); });
  await api.deleteListItem("leave", "L1");
  assert.deepEqual(Array.from(context.state.leaves, (item) => item.id), ["L1"]);
  assert.equal(calls.some((value) => String(value).includes("已有歷史資料")), true);
  assert.equal(calls.includes("remove:leave:L1"), false);
});

test("安全目錄 API 與人員同步應由正式 web-api 提供", () => {
  const webApi = fs.readFileSync(path.join(root, "src", "renderer", "web-api.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(webApi.includes('async function deleteCatalogItem(category, id)'), true);
  assert.equal(webApi.includes('requestFunction("catalog-admin"'), true);
  assert.equal(webApi.includes("    deleteCatalogItem,"), true);
  assert.equal(webApi.includes('previousEmployeeCode: String(previousEmployeeCode || "").trim()'), true);
  assert.equal(webApi.includes('previousEmployeeCode: String(previousEmployeeCode || member?.code'), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-admin-data-fixes.js")), false);
  assert.equal(build.includes("v2-admin-data-fixes.js"), false);
});

test("目錄刪除畫面流程不應再依賴函式覆蓋", () => {
  const catalog = fs.readFileSync(catalogPath, "utf8");
  assert.equal(catalog.includes("deleteListItem = async function"), false);
  assert.equal((catalog.match(/async function deleteListItem\\b/g) || []).length, 1);
  assert.equal(catalog.includes("await window.schedulerApi.deleteCatalogItem(category, id)"), true);
  assert.equal(catalog.includes("await forceSave()"), false);
});
`;
fs.writeFileSync(testPath, testSource);
console.log("admin data fixes patch merged into canonical API and catalog module");
