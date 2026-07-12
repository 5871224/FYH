const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const memberPath = path.join(rendererDir, "renderer-settings-member.js");
const patchPath = path.join(rendererDir, "v2-member-order.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testPath = path.join(root, "tests", "renderer-phase7-member-order.test.js");

function findFunctionStart(source, name, fromIndex = 0) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, "g");
  pattern.lastIndex = fromIndex;
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

function replaceFunction(source, name, nextName, replacement) {
  const start = findFunctionStart(source, name);
  const end = findFunctionStart(source, nextName, start + 1);
  if (start < 0 || end <= start) throw new Error(`找不到函式區段：${name} -> ${nextName}`);
  return source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(end);
}

let memberSource = fs.readFileSync(memberPath, "utf8");
const renderFunction = `function renderMemberSettingsList() {
  const { sourceMembers, filteredMembers } = getFilteredMemberSettingsMembers();
  return \`
      \${sourceMembers.length
        ? \`
      <div class="member-table-wrap">
        <div class="member-table-scroll">
          <div class="member-table">
            <div class="member-table-row member-table-head">
              <div>工號</div>
              <div>姓名</div>
              <div>排班班別</div>
              <div>權限</div>
              <div>到職日<br>離職日</div>
              <div>計薪方式</div>
              <div>例假星期</div>
              <div class="member-table-actions-head">操作</div>
            </div>
            \${filteredMembers.map((member) => {
              const canEditAccount = canEditMemberAccount(member);
              return \`
              <div class="member-table-row sortable-settings-item" draggable="true" data-sort-category="member" data-sort-item="\${escapeHtml(member.id)}" data-member-settings-row="\${escapeHtml(member.id)}">
                <div class="member-table-code">\${escapeHtml(member.code)}</div>
                <div class="member-table-name">\${escapeHtml(member.name)}</div>
                <div class="member-shift-pill-list">\${renderMemberScheduleShiftPills(member)}</div>
                <div>\${getRoleLabel(member.role)}</div>
                <div class="member-date-stack"><span>\${escapeHtml(member.hireDate || "-")}</span><span>\${escapeHtml(member.leaveDate || "-")}</span></div>
                <div>\${getSalaryTypeLabel(member)}</div>
                <div>\${getRestWeekdayLabel(member.fixedRestWeekday)}</div>
                <div class="member-table-actions">
                  \${canEditAccount ? renderActionIconButton("edit", \`data-edit-member="\${escapeHtml(member.id)}"\`) : ""}
                  \${canEditAccount ? renderActionIconButton("delete", \`data-delete-member="\${escapeHtml(member.id)}"\`) : ""}
                </div>
              </div>
            \`;
            }).join("")}
          </div>
        </div>
      </div>
        \`
        : '<div class="empty-state">目前還沒有人員</div>'
      }
      \${sourceMembers.length && !filteredMembers.length ? '<div class="empty-state">沒有符合篩選條件的人員</div>' : ""}
    \`;
}`;
const refreshFunction = `function refreshMemberSettingsList() {
  const list = document.getElementById("memberSettingsList");
  if (!list) return;

  const scroll = list.querySelector(".member-table-scroll");
  const scrollTop = scroll?.scrollTop || 0;
  const active = document.activeElement;
  const field = active?.matches?.("[data-member-settings-filter-field]")
    ? active.dataset.memberSettingsFilterField
    : "";
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;

  list.innerHTML = renderMemberSettingsList();

  const nextScroll = list.querySelector(".member-table-scroll");
  if (nextScroll) nextScroll.scrollTop = scrollTop;
  if (field) {
    const next = list.querySelector(\`[data-member-settings-filter-field="\${field}"]\`);
    next?.focus();
    if (typeof next?.setSelectionRange === "function" && Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
      next.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}`;
memberSource = replaceFunction(memberSource, "renderMemberSettingsList", "refreshMemberSettingsList", renderFunction);
memberSource = replaceFunction(memberSource, "refreshMemberSettingsList", "openMemberSettings", refreshFunction);
fs.writeFileSync(memberPath, memberSource);

if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的人員排序補丁");
fs.unlinkSync(patchPath);
let build = fs.readFileSync(buildPath, "utf8");
build = build.replace(/^\s*"v2-member-order\.js",?\r?\n/m, "");
fs.writeFileSync(buildPath, build);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const memberPath = path.join(root, "src", "renderer", "renderer-settings-member.js");

function findFunctionStart(source, name, fromIndex = 0) {
  const pattern = new RegExp("(?:async\\\\s+)?function\\\\s+" + name + "\\\\s*\\\\(", "g");
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
    renderMemberScheduleShiftPills: () => "早班",
    getRoleLabel: () => "員工",
    getSalaryTypeLabel: () => "月薪",
    getRestWeekdayLabel: () => "週日",
    renderActionIconButton: (kind) => kind
  };
  const api = vm.runInNewContext(renderSource + "\\n;({ renderMemberSettingsList })", context);
  const html = api.renderMemberSettingsList();
  assert.equal(html.includes('draggable="true"'), true);
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
  const api = vm.runInNewContext(refreshSource + "\\n;({ refreshMemberSettingsList })", context);
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
  assert.equal((source.match(/function renderMemberSettingsList\\b/g) || []).length, 1);
  assert.equal((source.match(/function refreshMemberSettingsList\\b/g) || []).length, 1);
});
`;
fs.writeFileSync(testPath, testSource);
console.log("member order patch merged into canonical member settings module");
