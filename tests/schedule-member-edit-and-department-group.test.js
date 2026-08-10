const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表姓名雙擊依人員設定權限開啟並延遲載入管理欄位", () => {
  const auth = read("src/renderer/renderer-auth-context.js");
  const table = read("src/renderer/renderer-schedule-table.js");
  const cells = read("src/renderer/renderer-schedule-cells.js");
  const events = read("src/renderer/renderer-events-click.js");
  const memberForm = read("src/renderer/renderer-groups-permissions-archive.js");
  const published = read("docs/app.js");

  assert.match(auth, /function canManageMembersInCurrentGroup\(\)/);
  assert.match(auth, /hasPermission\("member_settings"\) && roleAppliesToGroup\(groupFeatureState\.currentGroupId\)/);
  assert.match(table, /const memberEditAttrs = canEditMemberSettings/);
  assert.match(cells, /data-shift-schedule-member=/);
  assert.match(events, /async function openScheduleMemberEditor\(memberId\)/);
  assert.match(events, /await ensureManagerDirectoryLoaded\(\)/);
  assert.match(events, /openMemberForm\("edit", memberId\)/);
  assert.doesNotMatch(events, /開啟修改人員失敗/);
  assert.match(memberForm, /function renderMemberCustomRoleOptions\(member\)/);
  assert.ok(memberForm.indexOf("function renderMemberCustomRoleOptions(member)") < memberForm.indexOf("function openMemberForm(mode, memberId"));
  assert.match(events, /document\.body\.addEventListener\("dblclick", async \(event\)/);
  assert.match(events, /target\.dataset\.tableMemberId && target\.dataset\.rowIndex && canEditSchedule\(\)/);
  const doubleClickBlock = events.slice(events.indexOf('document.body.addEventListener("dblclick"'));
  assert.doesNotMatch(doubleClickBlock, /if \(!canEditSchedule\(\)\) return/);
  assert.match(published, /async function openScheduleMemberEditor\(memberId\)/);
  assert.match(published, /function renderMemberCustomRoleOptions\(member\)/);
});

test("新增單位自動沿用開啟表單時的目前群組", () => {
  const source = read("src/renderer/renderer-settings-department.js");
  const spec = read("規格書.md");

  assert.match(source, /groupId: groupFeatureState\.currentGroupId/);
  assert.match(source, /modalContext = \{ mode, category: "department", targetId: departmentId, groupId, returnTo \}/);
  assert.match(source, /previousDepartment\?\.groupId \|\| modalContext\.groupId \|\| groupFeatureState\.currentGroupId/);
  assert.match(source, /const payload = \{[^\n]+name, groupId, startDate/);
  assert.match(spec, /新增表單不顯示群組欄位；系統自動以開啟時的目前群組作為單位所屬群組/);
});
