const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("單位設定電腦版應使用七欄自適應寬度，不固定撐到 920px", () => {
  const css = read("src/renderer/css/pages.css");
  const departmentTableRule = css.match(/\.department-settings-modal \.department-settings-table-department \{[^}]*\}/)?.[0] || "";
  assert.equal(departmentTableRule.includes("min-width: 920px"), false);
  assert.equal(departmentTableRule.includes("width: 920px"), false);
  assert.match(css, /\.department-settings-modal \.department-settings-table-wrap \{[\s\S]*?overflow-x: hidden;/);
  assert.match(css, /\.department-settings-modal \.department-settings-table-department \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
  assert.equal(css.includes("grid-column: 7 !important"), true);
  assert.equal(css.includes(".department-settings-flag:nth-of-type(5)"), true);
  assert.equal(css.includes(".department-settings-flag:nth-of-type(6)"), true);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?overflow-x: auto;/);
});

test("人員設定應直接由正式模組輸出第一欄拖曳把手", () => {
  const ordering = read("src/renderer/renderer-settings-ordering.js");
  const member = read("src/renderer/renderer-settings-member.js");
  const dragEvents = read("src/renderer/renderer-events-drag.js");
  assert.equal(fs.existsSync(path.join(root, "src/renderer/v2-settings-drag-handles.js")), false);
  assert.equal(ordering.includes("function renderSettingsOrderDragColumn"), true);
  assert.equal(member.includes("renderSettingsOrderDragColumn(true)"), true);
  assert.equal(member.includes("renderSettingsOrderDragColumn()"), true);
  assert.equal(member.includes('data-sort-category="member"'), true);
  assert.equal(member.includes('sortable-settings-item" draggable="true"'), false);
  assert.equal(dragEvents.includes('!event.target.closest(".settings-order-drag-handle")'), true);
});
test("拖曳人員只調整人員順序並重新開啟人員設定", async () => {
  const source = read("src/renderer/renderer-settings-ordering.js");

  class FakeHTMLElement {
    constructor(id) {
      this.dataset = { sortItem: id };
    }
  }

  const rows = [new FakeHTMLElement("M2"), new FakeHTMLElement("M1")];
  const calls = [];
  const context = {
    HTMLElement: FakeHTMLElement,
    document: {
      querySelectorAll: (selector) => selector.includes('data-sort-category="member"') ? rows : []
    },
    state: {
      departments: [],
      members: [{ id: "M1" }, { id: "M2" }],
      shifts: [],
      leaves: [],
      overtime: [{ id: "O1" }, { id: "O2" }]
    },
    departmentSettingsView: "department",
    cssEscapeValue: (value) => value,
    getItemList: (category) => {
      calls.push(`getItemList:${category}`);
      return context.state.overtime;
    },
    captureSettingsReturnContext: (value) => {
      calls.push(`capture:${value.category}`);
      return value;
    },
    openDepartmentSettings: () => calls.push("open:department"),
    openMemberSettings: async () => calls.push("open:member"),
    reopenSettingsModalPreservingScroll: async (value) => { calls.push("reopen:" + value.category); await context.openMemberSettings(); },
    openListSettings: (category) => calls.push(`open:list:${category}`),
    restoreSettingsScroll: (value) => calls.push(`restore:${value.category}`),
    renderAll: () => calls.push("render"),
    queueSave: () => calls.push("save"),
    window: { schedulerApi: { reorderSettings: async () => calls.push("reorder") } },
    getMemberHomeDeptId: () => ""
  };

  const api = vm.runInNewContext(`${source}\n;({ commitSortedListFromDom })`, context);
  assert.equal(api.commitSortedListFromDom("member"), true);
  await Promise.resolve();

  assert.deepEqual(Array.from(context.state.members, (item) => item.id), ["M2", "M1"]);
  assert.deepEqual(Array.from(context.state.overtime, (item) => item.id), ["O1", "O2"]);
  assert.equal(calls.includes("getItemList:member"), false);
  assert.equal(calls.includes("open:member"), true);
  assert.equal(calls.some((value) => value.startsWith("open:list:")), false);
  assert.equal(calls.includes("save"), false);
  assert.equal(calls.includes("reorder"), true);
});

test("未知排序類型不得再落入加班資料", () => {
  const source = read("src/renderer/renderer-settings-ordering.js");
  assert.equal(source.includes('["shift", "leave", "overtime"].includes(category)'), true);
  assert.equal(source.includes('if (category === "member") return state.members;'), true);
  assert.match(source, /if \(!currentList\) \{\s*return false;/);
});
