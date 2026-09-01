const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定補丁整併前實際使用的人員拖曳列與篩選刷新行為。
const root = path.resolve(__dirname, "..");
const memberPath = path.join(root, "src", "renderer", "renderer-settings-member.js");

function findFunctionStart(source, name, fromIndex = 0) {
  const pattern = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  pattern.lastIndex = fromIndex;
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

function extract(source, startName, endName) {
  const start = findFunctionStart(source, startName);
  const end = findFunctionStart(source, endName, start + 1);
  return source.slice(start, end);
}

test("人員設定列應直接提供拖曳排序識別值", () => {
  const source = fs.readFileSync(memberPath, "utf8");
  const renderSource = extract(source, "renderMemberSettingsList", "refreshMemberSettingsList");
  const context = {
    getFilteredMemberSettingsMembers: () => ({
      sourceMembers: [{ id: "M1" }],
      filteredMembers: [{ id: "M1", code: "001", name: "小明", role: "employee", hireDate: "", leaveDate: "", fixedRestWeekday: 0 }]
    }),
    canEditMemberAccount: () => true,
    escapeHtml: String,
    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),
    renderMemberScheduleShiftPills: () => "早班",
    getRoleLabel: () => "員工",
    getSalaryTypeLabel: () => "月薪",
    getRestWeekdayLabel: () => "週日",
    renderActionIconButton: (kind) => kind,
    renderSettingsOrderDragColumn: (isHeader = false) => `<div class="settings-order-drag-col">${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true">≡</span>'}</div>`
  };
  const api = vm.runInNewContext(renderSource + "\n;({ renderMemberSettingsList })", context);
  const html = api.renderMemberSettingsList();
  assert.equal(html.includes('class="settings-order-drag-handle" draggable="true"'), true);
  assert.equal(html.includes('sortable-settings-item" draggable="true"'), false);
  assert.equal(html.includes('data-sort-category="member"'), true);
  assert.equal(html.includes('data-sort-item="M1"'), true);
  assert.equal(html.includes('data-member-settings-row="M1"'), true);
});

test("重新渲染人員清單應保留捲動位置與輸入游標", () => {
  const source = fs.readFileSync(memberPath, "utf8");
  const refreshSource = extract(source, "refreshMemberSettingsList", "openMemberSettings");
  const oldScroll = { scrollTop: 37 };
  const nextScroll = { scrollTop: 0 };
  let focused = false;
  let selection = null;
  const nextInput = { focus: () => { focused = true; }, setSelectionRange: (start, end) => { selection = [start, end]; } };
  let rendered = false;
  const list = {
    querySelector: (selector) => {
      if (selector === ".member-table-scroll") return rendered ? nextScroll : oldScroll;
      if (selector.includes("data-member-settings-filter-field")) return nextInput;
      return null;
    },
    set innerHTML(_value) { rendered = true; }
  };
  const activeElement = {
    dataset: { memberSettingsFilterField: "name" },
    selectionStart: 2,
    selectionEnd: 4,
    matches: () => true
  };
  const context = {
    document: { getElementById: () => list, activeElement },
    renderMemberSettingsList: () => "<div></div>"
  };
  const api = vm.runInNewContext(refreshSource + "\n;({ refreshMemberSettingsList })", context);
  api.refreshMemberSettingsList();
  assert.equal(nextScroll.scrollTop, 37);
  assert.equal(focused, true);
  assert.deepEqual(selection, [2, 4]);
});

test("人員排序應由正式設定模組提供而非覆蓋函式", () => {
  const source = fs.readFileSync(memberPath, "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-member-order.js")), false);
  assert.equal(build.includes("v2-member-order.js"), false);
  assert.equal(source.includes("renderMemberSettingsList = function"), false);
  assert.equal(source.includes("refreshMemberSettingsList = function"), false);
  assert.equal((source.match(/function renderMemberSettingsList\b/g) || []).length, 1);
  assert.equal((source.match(/function refreshMemberSettingsList\b/g) || []).length, 1);
});
