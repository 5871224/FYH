const fs = require("node:fs");

function patch(file, marker, insertion, guard) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(guard)) {
    if (!source.includes(marker)) throw new Error(`找不到測試注入點：${file}`);
    source = source.replace(marker, marker + insertion);
    fs.writeFileSync(file, source, "utf8");
  }
}

patch(
  "tests/member-order-and-department-width.test.js",
  '    openMemberSettings: async () => calls.push("open:member"),\n',
  '    reopenSettingsModalPreservingScroll: async (value) => { calls.push("reopen:" + value.category); await context.openMemberSettings(); },\n',
  "reopenSettingsModalPreservingScroll:"
);

patch(
  "tests/renderer-phase7-admin-data-fixes.test.js",
  "    confirmAction: async () => true,\n",
  '    captureSettingsReturnContext: (value) => ({ ...value, scrollTop: 120 }),\n    reopenSettingsModalPreservingScroll: async (value) => calls.push("open:" + value.listCategory),\n',
  "captureSettingsReturnContext:"
);

const testContent = String.raw`const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("共用設定返回流程應在重新開頁後還原捲動位置", async () => {
  class FakeHTMLElement {
    constructor() {
      this.scrollTop = 0;
      this.scrollHeight = 1000;
      this.clientHeight = 300;
    }
    matches(selector) {
      return selector.includes("settings-table-scroll");
    }
  }
  const scroll = new FakeHTMLElement();
  const calls = [];
  const context = {
    HTMLElement: FakeHTMLElement,
    document: { querySelector: () => scroll },
    requestAnimationFrame: (callback) => callback(),
    openDepartmentSettings: async () => calls.push("department"),
    openMemberSettings: async () => calls.push("member"),
    openListSettings: (category) => calls.push("list:" + category)
  };
  const navigationSource = read("src/renderer/renderer-settings-navigation.js");
  const api = vm.runInNewContext(navigationSource + "\n;({ reopenSettingsModalPreservingScroll })", context);
  await api.reopenSettingsModalPreservingScroll({ category: "list-settings", listCategory: "shift", scrollTop: 240, scrollSelector: ".catalog-settings-modal .settings-table-scroll" });
  assert.deepEqual(calls, ["list:shift"]);
  assert.equal(scroll.scrollTop, 240);
});

test("刪除班別應先保存位置，成功更新後再還原", async () => {
  const calls = [];
  const context = {
    window: { schedulerApi: { deleteCatalogItem: async () => calls.push("delete") } },
    state: {
      shifts: [{ id: "S1" }, { id: "S2" }],
      leaves: [],
      overtime: [],
      members: [{ id: "M1", scheduleShiftIds: ["S1", "S2"] }]
    },
    captureSettingsReturnContext: (value) => { calls.push("capture"); return { ...value, scrollTop: 180 }; },
    confirmAction: async () => { calls.push("confirm"); return true; },
    getMemberScheduleShiftIds: (member) => member.scheduleShiftIds,
    removeAssignmentsByItem: () => calls.push("remove"),
    renderAll: () => calls.push("render"),
    reopenSettingsModalPreservingScroll: async (value) => calls.push("reopen:" + value.scrollTop),
    setSaveStatus: () => {},
    console
  };
  const catalogSource = read("src/renderer/renderer-settings-catalog.js");
  const functionSource = catalogSource.slice(catalogSource.indexOf("async function deleteListItem"));
  const api = vm.runInNewContext(functionSource + "\n;({ deleteListItem })", context);
  await api.deleteListItem("shift", "S1");
  assert.deepEqual(calls, ["capture", "confirm", "delete", "remove", "render", "reopen:180"]);
  assert.deepEqual(Array.from(context.state.shifts, (item) => item.id), ["S2"]);
  assert.deepEqual(Array.from(context.state.members[0].scheduleShiftIds), ["S2"]);
});

test("所有主要設定刪除流程都必須使用共用捲動還原", () => {
  const catalog = read("src/renderer/renderer-settings-catalog.js");
  const department = read("src/renderer/renderer-settings-department.js");
  const member = read("src/renderer/renderer-settings-member.js");
  const ordering = read("src/renderer/renderer-settings-ordering.js");
  assert.match(catalog, /async function deleteListItem[\s\S]*captureSettingsReturnContext[\s\S]*await reopenSettingsModalPreservingScroll/);
  assert.match(department, /async function deleteDepartment[\s\S]*captureSettingsReturnContext[\s\S]*await reopenSettingsModalPreservingScroll/);
  assert.match(member, /async function deleteMember[\s\S]*captureSettingsReturnContext[\s\S]*await reopenSettingsModalPreservingScroll/);
  assert.equal(ordering.includes("reopenSettingsModalPreservingScroll(returnTo)"), true);
});
`;

fs.writeFileSync("tests/settings-scroll-preservation.test.js", testContent, "utf8");
console.log("設定頁捲動測試修正完成");
