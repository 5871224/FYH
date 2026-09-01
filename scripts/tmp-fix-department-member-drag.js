const fs = require('node:fs');

const departmentPath = 'src/renderer/renderer-settings-department.js';
const testPath = 'tests/schedule-member-edit-and-department-group.test.js';

let source = fs.readFileSync(departmentPath, 'utf8');
const start = source.indexOf('async function moveMemberToDepartment(memberId, departmentId, targetMemberId = "") {');
const end = source.indexOf('\nfunction moveDragPreviewElement(', start);
if (start < 0 || end < 0) throw new Error('moveMemberToDepartment block not found');

const replacement = `async function moveMemberToDepartment(memberId, departmentId, targetMemberId = "") {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || targetMemberId === memberId) {
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  const remaining = state.members.filter((item) => item.id !== memberId);
  const targetDeptId = targetMemberId
    ? (getMemberHomeDeptId(remaining.find((item) => item.id === targetMemberId)) || departmentId)
    : departmentId;
  const targetDepartment = state.departments.find((department) => !department.deleted && department.id === targetDeptId);
  if (!targetDepartment) {
    return;
  }
  const grouped = new Map(state.departments.map((department) => [department.id, []]));
  remaining.forEach((item) => {
    const homeDeptId = getMemberHomeDeptId(item);
    if (grouped.has(homeDeptId)) {
      grouped.get(homeDeptId).push(item);
    }
  });
  if (!grouped.has(targetDeptId)) {
    return;
  }
  const movedMember = {
    ...member,
    deptId: targetDeptId,
    groupId: targetDepartment.groupId || member.groupId || ""
  };
  const targetList = grouped.get(targetDeptId);
  const targetIndex = targetMemberId ? targetList.findIndex((item) => item.id === targetMemberId) : -1;
  if (targetIndex >= 0) {
    targetList.splice(targetIndex, 0, movedMember);
  } else {
    targetList.push(movedMember);
  }
  const nextMembers = state.departments.flatMap((department) => grouped.get(department.id) || []);
  const includedIds = new Set(nextMembers.map((item) => item.id));
  nextMembers.push(...remaining.filter((item) => !includedIds.has(item.id)));

  try {
    await window.schedulerApi.syncMemberProfile(movedMember, member.code);
  } catch (error) {
    const message = formatSchedulerError(error, "人員單位儲存失敗");
    setSaveStatus(\`人員單位儲存失敗：\${message}\`);
    showInfoMessage(\`人員單位儲存失敗：\${message}\`);
    return;
  }

  state.members = nextMembers;
  currentMember = resolveCurrentMember();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
  const orderedIds = nextMembers.filter((item) => !item.deleted).map((item) => item.id);
  void window.schedulerApi.reorderSettings("member", orderedIds)
    .catch((error) => setSaveStatus(\`人員排序儲存失敗：\${error.message}\`));
}`;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(departmentPath, source, 'utf8');

let test = fs.readFileSync(testPath, 'utf8');
const token = '單位設定拖曳人員會正式寫回人員單位';
if (!test.includes(token)) {
  test += `\n\ntest("${token}", () => {\n  const source = read("src/renderer/renderer-settings-department.js");\n  const start = source.indexOf("async function moveMemberToDepartment");\n  const end = source.indexOf("function moveDragPreviewElement", start);\n  const block = source.slice(start, end);\n\n  assert.ok(start >= 0 && end > start);\n  assert.match(block, /syncMemberProfile\\(movedMember, member\\.code\\)/);\n  assert.match(block, /deptId: targetDeptId/);\n  assert.match(block, /groupId: targetDepartment\\.groupId \\|\\| member\\.groupId/);\n  assert.match(block, /reorderSettings\\("member", orderedIds\\)/);\n  assert.doesNotMatch(block, /queueSave\\(\\)/);\n});\n`;
  fs.writeFileSync(testPath, test, 'utf8');
}
