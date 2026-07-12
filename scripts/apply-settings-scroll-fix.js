const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`找不到待替換區塊：${label}`);
  }
  return source.replace(search, replacement);
}

function updateNavigation() {
  const file = "src/renderer/renderer-settings-navigation.js";
  let source = read(file);
  if (!source.includes("async function reopenSettingsModalPreservingScroll")) {
    source += `\n\nasync function reopenSettingsModalPreservingScroll(context) {\n  if (!context?.category) {\n    return false;\n  }\n  if (context.category === "department-settings") {\n    await openDepartmentSettings();\n  } else if (context.category === "member-settings") {\n    await openMemberSettings();\n  } else if (context.category === "list-settings" && context.listCategory) {\n    openListSettings(context.listCategory);\n  } else {\n    return false;\n  }\n  restoreSettingsScroll(context);\n  return true;\n}\n`;
  }
  write(file, source);
}

function updateCatalog() {
  const file = "src/renderer/renderer-settings-catalog.js";
  let source = read(file);
  source = replaceOrThrow(source,
`  closeModal();\n  renderAll();\n  reopenModalFromContext(returnTo || { category: "list-settings", listCategory: "shift" });`,
`  closeModal();\n  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: "shift", scrollTop: 0 });`,
"班別儲存後返回");
  source = replaceOrThrow(source,
`  closeModal();\n  renderAll();\n  reopenModalFromContext(returnTo || { category: "list-settings", listCategory: category });`,
`  closeModal();\n  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: category, scrollTop: 0 });`,
"假別加班儲存後返回");
  source = source.replace(/async function deleteListItem\(category, id\) \{[\s\S]*?\n\}\s*$/, `async function deleteListItem(category, id) {\n  const labelMap = {\n    shift: "班別",\n    leave: "假別",\n    overtime: "加班"\n  };\n  const returnTo = captureSettingsReturnContext({\n    category: "list-settings",\n    listCategory: category\n  });\n  const confirmed = await confirmAction(\`確定要刪除這個\${labelMap[category] || "項目"}嗎？\`);\n  if (!confirmed) {\n    return;\n  }\n\n  try {\n    await window.schedulerApi.deleteCatalogItem(category, id);\n  } catch (error) {\n    setSaveStatus(\`\${labelMap[category] || "項目"}刪除失敗：\${error.message || error}\`);\n    return;\n  }\n\n  if (category === "shift") {\n    state.shifts = state.shifts.filter((item) => item.id !== id);\n    state.members = state.members.map((member) => ({\n      ...member,\n      scheduleShiftIds: getMemberScheduleShiftIds(member).filter((shiftId) => shiftId !== id)\n    }));\n  }\n  if (category === "leave") state.leaves = state.leaves.filter((item) => item.id !== id);\n  if (category === "overtime") state.overtime = state.overtime.filter((item) => item.id !== id);\n  removeAssignmentsByItem(category, id);\n  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo);\n}\n`);
  if (!source.includes("await reopenSettingsModalPreservingScroll(returnTo);")) {
    throw new Error("班別假別加班刪除未套用捲動還原");
  }
  write(file, source);
}

function updateDepartment() {
  const file = "src/renderer/renderer-settings-department.js";
  let source = read(file);
  source = replaceOrThrow(source,
`  closeModal();\n  renderAll();\n  reopenModalFromContext(returnTo || { category: "department-settings", view: departmentSettingsView });`,
`  closeModal();\n  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo || { category: "department-settings", view: departmentSettingsView, scrollTop: 0 });`,
"單位儲存後返回");
  source = replaceOrThrow(source,
`  const confirmed = await confirmAction("確定要刪除這個單位嗎？");`,
`  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });\n  const confirmed = await confirmAction("確定要刪除這個單位嗎？");`,
"單位刪除前保存捲動");
  source = replaceOrThrow(source,
`  renderAll();\n  openDepartmentSettings();\n  queueSave();`,
`  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo);\n  queueSave();`,
"單位刪除後還原捲動");
  source = replaceOrThrow(source,
`  state.members = state.departments.flatMap((department) => grouped.get(department.id) || []);\n  openDepartmentSettings();\n  restoreSettingsScroll(returnTo);\n  renderAll();\n  queueSave();`,
`  state.members = state.departments.flatMap((department) => grouped.get(department.id) || []);\n  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo);\n  queueSave();`,
"跨單位拖曳後還原捲動");
  write(file, source);
}

function updateMember() {
  const file = "src/renderer/renderer-settings-member.js";
  let source = read(file);
  source = replaceOrThrow(source,
`  currentMember = resolveCurrentMember();\n  closeModal();\n  renderAll();\n  reopenModalFromContext(returnTo);`,
`  currentMember = resolveCurrentMember();\n  closeModal();\n  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo || { category: "member-settings", scrollTop: 0 });`,
"人員儲存後返回");
  source = replaceOrThrow(source,
`async function importMembersFromSettings() {\n  try {`,
`async function importMembersFromSettings() {\n  const returnTo = captureSettingsReturnContext({ category: "member-settings" });\n  try {`,
"人員匯入前保存捲動");
  source = replaceOrThrow(source,
`    currentMember = resolveCurrentMember();\n    renderAll();\n    openMemberSettings();\n    queueSave();`,
`    currentMember = resolveCurrentMember();\n    renderAll();\n    await reopenSettingsModalPreservingScroll(returnTo);\n    queueSave();`,
"人員匯入後還原捲動");
  source = replaceOrThrow(source,
`  const confirmed = await confirmAction("確定要刪除這位人員嗎？");`,
`  const returnTo = captureSettingsReturnContext({ category: "member-settings" });\n  const confirmed = await confirmAction("確定要刪除這位人員嗎？");`,
"人員刪除前保存捲動");
  source = replaceOrThrow(source,
`  renderAll();\n  openMemberSettings();\n}`,
`  renderAll();\n  await reopenSettingsModalPreservingScroll(returnTo);\n}`,
"人員刪除後還原捲動");
  write(file, source);
}

function updateOrdering() {
  const file = "src/renderer/renderer-settings-ordering.js";
  let source = read(file);
  source = source.replace(/function reopenSortedSettings\(category, returnTo\) \{[\s\S]*?\n\}/, `function reopenSortedSettings(_category, returnTo) {\n  void reopenSettingsModalPreservingScroll(returnTo);\n}`);
  source = replaceOrThrow(source,
`  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });\n  state.members = nextMembers;\n  openDepartmentSettings();\n  restoreSettingsScroll(returnTo);\n  renderAll();\n  queueSave();`,
`  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });\n  state.members = nextMembers;\n  renderAll();\n  void reopenSettingsModalPreservingScroll(returnTo);\n  queueSave();`,
"單位內人員排序後還原捲動");
  write(file, source);
}

function updateSpec() {
  const file = "規格書.md";
  let source = read(file);
  const ruleTitle = "設定視窗重新整理與捲動位置";
  if (source.includes(ruleTitle)) return;
  const start = source.indexOf("## 3.3");
  const end = source.indexOf("# 第四章", start);
  if (start < 0 || end < 0) throw new Error("找不到規格書 3.3 節");
  const section = source.slice(start, end);
  const numbers = [...section.matchAll(/### 3\.3\.(\d+)/g)].map((match) => Number(match[1]));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  const addition = `\n### 3.3.${next} ${ruleTitle}\n\n1. 班別、假別、加班、單位與人員設定在新增、修改、刪除、匯入或拖曳排序後重新建立清單時，必須保留操作前的垂直捲動位置。\n2. 刪除後若清單高度變短，瀏覽器可將位置限制在新的最大捲動範圍，但不得無條件跳回最上方。\n3. 使用者取消確認或後端操作失敗時，不重新建立設定視窗，也不得改變目前捲動位置。\n`;
  source = source.slice(0, end) + addition + "\n" + source.slice(end);
  write(file, source);
}

function writeTests() {
  const file = "tests/settings-scroll-preservation.test.js";
  const content = `const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\nconst vm = require("node:vm");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\n\ntest("共用設定返回流程應在重新開頁後還原捲動位置", async () => {\n  class FakeHTMLElement {\n    constructor() {\n      this.scrollTop = 0;\n      this.scrollHeight = 1000;\n      this.clientHeight = 300;\n    }\n    matches(selector) {\n      return selector.includes("settings-table-scroll");\n    }\n  }\n  const scroll = new FakeHTMLElement();\n  const calls = [];\n  const context = {\n    HTMLElement: FakeHTMLElement,\n    document: { querySelector: () => scroll },\n    requestAnimationFrame: (callback) => callback(),\n    openDepartmentSettings: async () => calls.push("department"),\n    openMemberSettings: async () => calls.push("member"),\n    openListSettings: (category) => calls.push(\`list:\${category}\`)\n  };\n  const api = vm.runInNewContext(\`${read("src/renderer/renderer-settings-navigation.js")}\\n;({ reopenSettingsModalPreservingScroll })\`, context);\n  await api.reopenSettingsModalPreservingScroll({ category: "list-settings", listCategory: "shift", scrollTop: 240, scrollSelector: ".catalog-settings-modal .settings-table-scroll" });\n  assert.deepEqual(calls, ["list:shift"]);\n  assert.equal(scroll.scrollTop, 240);\n});\n\ntest("刪除班別應先保存位置，成功更新後再還原", async () => {\n  const calls = [];\n  const context = {\n    window: { schedulerApi: { deleteCatalogItem: async () => calls.push("delete") } },\n    state: {\n      shifts: [{ id: "S1" }, { id: "S2" }],\n      leaves: [],\n      overtime: [],\n      members: [{ id: "M1", scheduleShiftIds: ["S1", "S2"] }]\n    },\n    captureSettingsReturnContext: (value) => { calls.push("capture"); return { ...value, scrollTop: 180 }; },\n    confirmAction: async () => { calls.push("confirm"); return true; },\n    getMemberScheduleShiftIds: (member) => member.scheduleShiftIds,\n    removeAssignmentsByItem: () => calls.push("remove"),\n    renderAll: () => calls.push("render"),\n    reopenSettingsModalPreservingScroll: async (value) => calls.push(\`reopen:\${value.scrollTop}\`),\n    setSaveStatus: () => {},\n    console\n  };\n  const api = vm.runInNewContext(\`${read("src/renderer/renderer-settings-catalog.js")}\\n;({ deleteListItem })\`, context);\n  await api.deleteListItem("shift", "S1");\n  assert.deepEqual(calls, ["capture", "confirm", "delete", "remove", "render", "reopen:180"]);\n  assert.deepEqual(Array.from(context.state.shifts, (item) => item.id), ["S2"]);\n  assert.deepEqual(Array.from(context.state.members[0].scheduleShiftIds), ["S2"]);\n});\n\ntest("所有主要設定刪除流程都必須使用共用捲動還原", () => {\n  const catalog = read("src/renderer/renderer-settings-catalog.js");\n  const department = read("src/renderer/renderer-settings-department.js");\n  const member = read("src/renderer/renderer-settings-member.js");\n  const ordering = read("src/renderer/renderer-settings-ordering.js");\n  assert.match(catalog, /async function deleteListItem[\\s\\S]*captureSettingsReturnContext[\\s\\S]*await reopenSettingsModalPreservingScroll/);\n  assert.match(department, /async function deleteDepartment[\\s\\S]*captureSettingsReturnContext[\\s\\S]*await reopenSettingsModalPreservingScroll/);\n  assert.match(member, /async function deleteMember[\\s\\S]*captureSettingsReturnContext[\\s\\S]*await reopenSettingsModalPreservingScroll/);\n  assert.equal(ordering.includes("reopenSettingsModalPreservingScroll(returnTo)"), true);\n});\n`;
  write(file, content);
}

updateNavigation();
updateCatalog();
updateDepartment();
updateMember();
updateOrdering();
updateSpec();
writeTests();
console.log("設定頁捲動位置修正完成");
