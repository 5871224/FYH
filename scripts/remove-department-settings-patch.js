const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const departmentPath = path.join(rendererDir, "renderer-settings-department.js");
const patchPath = path.join(rendererDir, "v2-department-settings-columns.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testPath = path.join(root, "tests", "renderer-phase7-department-patch.test.js");

const source = fs.readFileSync(departmentPath, "utf8");
const start = source.indexOf("async function openDepartmentSettings()");
const end = source.indexOf("function renderDepartmentAttendanceFields");
if (start < 0 || end <= start) throw new Error("找不到單位設定函式邊界");

const finalImplementation = `async function openDepartmentSettings() {
  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {
    showInfoMessage(\`讀取管理資料失敗：\${error.message || error}\`);
    return;
  }
  departmentSettingsView = "department";
  modalContext = { category: "department-settings", view: "department" };
  const activeMembers = state.members.filter(isMemberCurrentlyActive);
  const departmentRows = state.departments.map((department) => {
    const homeMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) === department.id);
    const startDate = department.startDate || "-";
    const endDate = department.endDate || "-";
    return \`
      <div class="department-settings-row sortable-settings-item" draggable="true" data-sort-category="department" data-sort-item="\${escapeHtml(department.id)}" data-drop-department="\${escapeHtml(department.id)}">
        <div class="department-settings-title">\${escapeHtml(department.name)}</div>
        <div class="member-inline-list">
          \${homeMembers.length
            ? homeMembers.map((member) => \`
              <div class="member-item draggable-member" draggable="true" data-member-card="\${escapeHtml(member.id)}" data-drop-member="\${escapeHtml(member.id)}" data-drop-department="\${escapeHtml(department.id)}">
                <span>\${escapeHtml(member.name)}</span>
              </div>
            \`).join("")
            : '<div class="dept-empty-pill">拖曳人員到這裡</div>'
          }
        </div>
        <div class="department-settings-date-stack"><span>\${escapeHtml(startDate)}</span><span>\${escapeHtml(endDate)}</span></div>
        <div class="department-settings-flag">\${department.hiddenFromSchedule ? "是" : "否"}</div>
        <div class="department-settings-flag">\${department.attendanceEnabled ? "是" : "否"}</div>
        <div class="member-table-actions">
          \${renderActionIconButton("edit", \`data-edit-department="\${escapeHtml(department.id)}"\`)}
          \${renderActionIconButton("delete", \`data-delete-department="\${escapeHtml(department.id)}"\`)}
        </div>
      </div>
    \`;
  }).join("");
  const body = state.departments.length
    ? \`
      <div class="department-settings-table-wrap">
        <div class="department-settings-table department-settings-table-department">
          <div class="department-settings-row department-settings-head">
            <div>單位</div>
            <div>所屬人員</div>
            <div>開始日期<br>結束日期</div>
            <div>不顯示</div>
            <div>可否打卡</div>
            <div>操作</div>
          </div>
          \${departmentRows}
        </div>
      </div>
    \`
    : '<div class="empty-state">目前還沒有單位</div>';
  openEntityListModal({
    title: "單位設定",
    modalClass: "modal modal-wide department-settings-modal settings-list-modal",
    body,
    headerButtons: \`
      <button class="ghost-btn" type="button" data-export-departments="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-departments="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-department="true">新增</button>
    \`,
    hideFooterClose: true
  });
}

`;

fs.writeFileSync(departmentPath, source.slice(0, start) + finalImplementation + source.slice(end));
if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的單位設定補丁");
fs.unlinkSync(patchPath);

const buildSource = fs.readFileSync(buildPath, "utf8");
const nextBuild = buildSource.replace(/^\s*"v2-department-settings-columns\.js",?\r?\n/m, "");
if (nextBuild === buildSource) throw new Error("建置清單找不到單位設定補丁");
fs.writeFileSync(buildPath, nextBuild);

const testSource = `const test = require("node:test");
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
  const api = vm.runInNewContext(source + "\\n;({ openDepartmentSettings })", context);
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
`;
fs.writeFileSync(testPath, testSource);
console.log("department settings patch merged into canonical module");
