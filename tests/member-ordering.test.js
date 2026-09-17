const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

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
