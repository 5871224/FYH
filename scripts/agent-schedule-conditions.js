const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();

function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function write(file, content) { fs.writeFileSync(path.join(root, file), content, "utf8"); }
function replaceOnce(file, search, replacement) {
  const source = read(file);
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one match, found ${count}: ${search.slice(0, 100)}`);
  write(file, source.replace(search, replacement));
}
function appendOnce(file, marker, block) {
  const source = read(file);
  if (source.includes(marker)) return;
  write(file, source.trimEnd() + "\n\n" + block.trim() + "\n");
}

const assignmentSnippet = read("scripts/agent-schedule-condition-assignment.txt").trim();
const sqlBlock = read("scripts/agent-schedule-conditions.sql").trim();
const specBlock = read("scripts/agent-schedule-condition-spec.txt").trim();

for (const file of ["scripts/build-js.js", "scripts/renderer-core-source.js"]) {
  replaceOnce(file,
    '  "renderer-schedule-interaction.js",\n  "renderer-auto-schedule-compliance.js",',
    '  "renderer-schedule-interaction.js",\n  "renderer-schedule-conditions.js",\n  "renderer-auto-schedule-compliance.js",'
  );
}

replaceOnce("src/renderer/renderer-auto-schedule-demand.js",
`function markAutoLeave(scheduleMap, member, dateString, leave, preview, reason) {
  const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (!slot || !leave) {
    return false;
  }
`,
`function markAutoLeave(scheduleMap, member, dateString, leave, preview, reason) {
  const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (!slot || !leave) {
    return false;
  }
  const blockingConditions = getBlockingSameLeaveConditions(scheduleMap, member.id, dateString);
  if (blockingConditions.length) {
    noteScheduleConditionBlocks(preview, dateString, blockingConditions, \`${reason || "排假"}：已達同休限額，未自動排假\`);
    return false;
  }
`);

replaceOnce("src/renderer/renderer-auto-schedule-assignment.js",
  "function findBestDailyShiftAssignments(scheduleMap, dateString, preview) {",
  `${assignmentSnippet}\n\nfunction findBestDailyShiftAssignments(scheduleMap, dateString, preview) {`
);
replaceOnce("src/renderer/renderer-auto-schedule-assignment.js",
`  const assignments = findMinimumCostFlowAssignments(scheduleMap, options, dateString, preview.dates || [dateString]);
  assignments.forEach(({ shift, member }) => {`,
`  const sameShiftConditions = getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_SHIFT);
  const conditionResult = sameShiftConditions.length
    ? findConstraintAwareDailyShiftAssignments(scheduleMap, options, dateString, preview.dates || [dateString])
    : {
      assignments: findMinimumCostFlowAssignments(scheduleMap, options, dateString, preview.dates || [dateString]),
      blockedConditions: []
    };
  const assignments = conditionResult.assignments;
  assignments.forEach(({ shift, member }) => {`
);
replaceOnce("src/renderer/renderer-auto-schedule-assignment.js",
`  if (missingDetails.length) {
    const missing = missingDetails.reduce((sum, item) => sum + item.missing, 0);`,
`  if (missingDetails.length) {
    if (conditionResult.blockedConditions.length) {
      noteScheduleConditionBlocks(preview, dateString, conditionResult.blockedConditions, "已達同班限額，無法再安排");
    }
    const missing = missingDetails.reduce((sum, item) => sum + item.missing, 0);`
);

replaceOnce("src/renderer/renderer-auto-schedule.js",
`        markAutoLeave(scheduleMap, member, dateString, regularLeave, preview, hadShift ? "例假加班" : "固定例假");
        if (hadShift) {`,
`        const placed = markAutoLeave(scheduleMap, member, dateString, regularLeave, preview, hadShift ? "例假加班" : "固定例假");
        if (placed && hadShift) {`
);
replaceOnce("src/renderer/renderer-auto-schedule.js",
`        && isMemberActiveOnDateString(member, dateString)
        && !hasAnyLeaveOnDate(scheduleMap, member.id, dateString)
      ));`,
`        && isMemberActiveOnDateString(member, dateString)
        && !hasAnyLeaveOnDate(scheduleMap, member.id, dateString)
        && canAutoPlaceLeaveByScheduleConditions(scheduleMap, member.id, dateString)
      ));`
);
replaceOnce("src/renderer/renderer-auto-schedule.js",
`      markAutoLeave(scheduleMap, member, candidateDate, restLeave, preview, hasAnyShiftOnDate(scheduleMap, member.id, candidateDate) ? "休息日加班" : "補足休息日");
      if (hasAnyShiftOnDate(scheduleMap, member.id, candidateDate)) {
        preview.warnings.push(\`${member.name} ${candidateDate} 預排為休息日加班\`);
      }
      restCount += 1;`,
`      const placed = markAutoLeave(scheduleMap, member, candidateDate, restLeave, preview, hasAnyShiftOnDate(scheduleMap, member.id, candidateDate) ? "休息日加班" : "補足休息日");
      if (!placed) {
        preview.warnings.push(\`${member.name} 休息日不足 ${target - restCount} 天\`);
        break;
      }
      if (hasAnyShiftOnDate(scheduleMap, member.id, candidateDate)) {
        preview.warnings.push(\`${member.name} ${candidateDate} 預排為休息日加班\`);
      }
      restCount += 1;`
);
replaceOnce("src/renderer/renderer-auto-schedule.js",
`  const missingLeaveLabels = getMissingAutoScheduleLeaveLabels();
  if (missingLeaveLabels.length) {
    reportValidationError(\`自動排班需要先在假別設定新增：${missingLeaveLabels.join("、")}\`);
    return;
  }
  closeModal();`,
`  const missingLeaveLabels = getMissingAutoScheduleLeaveLabels();
  if (missingLeaveLabels.length) {
    reportValidationError(\`自動排班需要先在假別設定新增：${missingLeaveLabels.join("、")}\`);
    return;
  }
  try {
    await loadScheduleConditions(groupFeatureState.currentGroupId, true);
  } catch (error) {
    reportValidationError(\`讀取排班條件失敗：${error.message || error}\`);
    return;
  }
  closeModal();`
);

replaceOnce("src/renderer/renderer-auto-fill-schedule.js",
`  const missingShiftMembers = [];

  state.members.forEach((member) => {`,
`  const missingShiftMembers = [];
  const workingSchedule = deepClone(state.schedule || {});
  let conditionBlockedCount = 0;

  state.members.forEach((member) => {`
);
replaceOnce("src/renderer/renderer-auto-fill-schedule.js",
`      if (!key || !isBlankScheduleSlot(state.schedule[key] || null)) {
        return;
      }
      preview.slots[key] = {
        shift: firstShiftId,
        leave: null,
        overtime: null
      };`,
`      if (!key || !isBlankScheduleSlot(workingSchedule[key] || null)) {
        return;
      }
      const blockingConditions = getBlockingSameShiftConditions(workingSchedule, member.id, firstShiftId, dateString);
      if (blockingConditions.length) {
        conditionBlockedCount += 1;
        noteScheduleConditionBlocks(preview, dateString, blockingConditions, "已達同班限額，未自動補班");
        return;
      }
      preview.slots[key] = {
        shift: firstShiftId,
        leave: null,
        overtime: null
      };
      workingSchedule[key] = deepClone(preview.slots[key]);`
);
replaceOnce("src/renderer/renderer-auto-fill-schedule.js",
`  if (missingShiftMembers.length) {
    preview.warnings.push(\`以下月薪人員未設定排班班別，未自動補班：${missingShiftMembers.join("、")}\`);
  }
  return preview;`,
`  if (missingShiftMembers.length) {
    preview.warnings.push(\`以下月薪人員未設定排班班別，未自動補班：${missingShiftMembers.join("、")}\`);
  }
  if (conditionBlockedCount) {
    preview.warnings.push(\`共有 ${conditionBlockedCount} 格因排班條件未自動補班\`);
  }
  return preview;`
);
replaceOnce("src/renderer/renderer-auto-fill-schedule.js",
`  try {
    await ensureAutoFillScheduleRangeLoaded(startDate, endDate);
    closeModal();`,
`  try {
    await Promise.all([
      ensureAutoFillScheduleRangeLoaded(startDate, endDate),
      loadScheduleConditions(groupFeatureState.currentGroupId, true)
    ]);
    closeModal();`
);

replaceOnce("src/renderer/renderer-groups-permissions-archive.js",
`    ["permissionSettingsMenuButton", "權限設定", "permission_settings", "permission-settings"],
    ["scheduleArchiveMenuButton", "班表封存", "schedule_view", "schedule-archive"]`,
`    ["permissionSettingsMenuButton", "權限設定", "permission_settings", "permission-settings"],
    ["scheduleConditionsMenuButton", "排班條件", "schedule_manage", "schedule-conditions"],
    ["scheduleArchiveMenuButton", "班表封存", "schedule_view", "schedule-archive"]`
);
replaceOnce("src/renderer/renderer-groups-permissions-archive.js",
`    const visible = action === "schedule-archive" ? hasPermission("schedule_view") : hasPermission(permission);`,
`    const visible = action === "schedule-conditions"
      ? canEditSchedule()
      : action === "schedule-archive"
        ? hasPermission("schedule_view")
        : hasPermission(permission);`
);
replaceOnce("src/renderer/renderer-groups-permissions-archive.js",
`    if (action === "permission-settings") { event.preventDefault(); closeCoreActionsMenu(); openPermissionSettings(); return; }
    if (action === "schedule-archive") { event.preventDefault(); closeCoreActionsMenu(); void openScheduleArchive(); return; }`,
`    if (action === "permission-settings") { event.preventDefault(); closeCoreActionsMenu(); openPermissionSettings(); return; }
    if (action === "schedule-conditions") { event.preventDefault(); closeCoreActionsMenu(); void openScheduleConditions(); return; }
    if (action === "schedule-archive") { event.preventDefault(); closeCoreActionsMenu(); void openScheduleArchive(); return; }
    if (button.dataset.addScheduleCondition !== undefined) { event.preventDefault(); openScheduleConditionForm(); return; }
    if (button.dataset.editScheduleCondition) { event.preventDefault(); openScheduleConditionForm(button.dataset.editScheduleCondition); return; }
    if (button.dataset.saveScheduleCondition !== undefined) { event.preventDefault(); void saveScheduleConditionFromModal(); return; }
    if (button.dataset.deleteScheduleCondition) { event.preventDefault(); void deleteScheduleCondition(button.dataset.deleteScheduleCondition); return; }`
);

appendOnce("supabase/002_current_updates.sql", "create table if not exists public.schedule_conditions", sqlBlock);

replaceOnce("規格書.md", "**文件版本：** 2026-08-14", "**文件版本：** 2026-08-19");
replaceOnce("規格書.md",
`- 班表封存。
- 列印班表。`,
`- 班表封存。
- 排班條件。
- 列印班表。`
);
replaceOnce("規格書.md",
`其他現有功能與排列保持原規格。

## 6.4 群組設定`,
`其他現有功能與排列保持原規格。

${specBlock}

## 6.4 群組設定`
);

replaceOnce("tests/renderer-auto-schedule.test.js",
`const moduleNames = ["renderer-auto-schedule-compliance.js", "renderer-auto-schedule-demand.js", "renderer-auto-schedule-assignment.js", "renderer-auto-schedule.js"];`,
`const moduleNames = ["renderer-schedule-conditions.js", "renderer-auto-schedule-compliance.js", "renderer-auto-schedule-demand.js", "renderer-auto-schedule-assignment.js", "renderer-auto-schedule.js"];`
);
replaceOnce("tests/renderer-auto-schedule.test.js",
`    state: { members: [], shifts: [], departments: [], leaves: Array.from(leaveMap.values()), schedule: {} },`,
`    state: { members: [], shifts: [], departments: [], leaves: Array.from(leaveMap.values()), schedule: {} },
    groupFeatureState: { currentGroupId: "G" },`
);
replaceOnce("tests/renderer-auto-schedule.test.js",
`test("自動排班應維持明確建置順序", () => {`,
`test("同休限制應把任何假別都算入限額", () => {
  const context = makeContext();
  context.state.members = [
    { id: "A", name: "甲", groupId: "G" },
    { id: "B", name: "乙", groupId: "G" },
    { id: "C", name: "丙", groupId: "G" }
  ];
  const api = evaluateAutoSchedule("({ scheduleConditionState, getBlockingSameLeaveConditions })", context);
  api.scheduleConditionState.byGroup.set("G", [{
    id: "C1", groupId: "G", type: "same_leave", limitCount: 1, memberIds: ["A", "B", "C"]
  }]);
  const schedule = { "A_2026-07-12": { leave: "any-leave" } };
  assert.equal(api.getBlockingSameLeaveConditions(schedule, "B", "2026-07-12").length, 1);
  assert.equal(api.getBlockingSameLeaveConditions(schedule, "A", "2026-07-12").length, 0);
});

test("同班限制應計入既有班別且可改排其他班別", () => {
  const context = makeContext();
  context.state.members = [
    { id: "A", name: "甲", groupId: "G" },
    { id: "B", name: "乙", groupId: "G" },
    { id: "C", name: "丙", groupId: "G" }
  ];
  const api = evaluateAutoSchedule("({ scheduleConditionState, getBlockingSameShiftConditions })", context);
  api.scheduleConditionState.byGroup.set("G", [{
    id: "C1", groupId: "G", type: "same_shift", limitCount: 1, memberIds: ["A", "B", "C"]
  }]);
  const schedule = { "A_2026-07-12": { shift: "S" } };
  assert.equal(api.getBlockingSameShiftConditions(schedule, "B", "S", "2026-07-12").length, 1);
  assert.equal(api.getBlockingSameShiftConditions(schedule, "B", "T", "2026-07-12").length, 0);
});

test("失效人員應在讀取條件時忽略且不套用無效條件", () => {
  const context = makeContext();
  context.state.members = [
    { id: "A", name: "甲", groupId: "G", deleted: false },
    { id: "B", name: "乙", groupId: "OTHER", deleted: false },
    { id: "C", name: "丙", groupId: "G", deleted: true }
  ];
  const api = evaluateAutoSchedule("({ scheduleConditionState, getEffectiveScheduleConditions })", context);
  api.scheduleConditionState.byGroup.set("G", [{
    id: "C1", groupId: "G", type: "same_shift", limitCount: 1, memberIds: ["A", "B", "C", "MISSING"]
  }]);
  assert.equal(api.getEffectiveScheduleConditions("same_shift").length, 0);
});

test("自動排班應維持明確建置順序", () => {`
);

replaceOnce("tests/canonical-schema.test.js",
`    /create table if not exists public\\.schedule_archive_entries/,`,
`    /create table if not exists public\\.schedule_archive_entries/,
    /create table if not exists public\\.schedule_conditions/,
    /create or replace function public\\.get_schedule_conditions_v1/,
    /create or replace function public\\.save_schedule_condition_v1/,
    /create or replace function public\\.delete_schedule_condition_v1/,`
);

replaceOnce("scripts/check-renderer-contracts.js",
`  "src/renderer/renderer-foundation.js",`,
`  "src/renderer/renderer-foundation.js",
  "src/renderer/renderer-schedule-conditions.js",`
);
replaceOnce("scripts/check-renderer-contracts.js",
`assert(databaseSql.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");`,
`assert(databaseSql.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");
assert(databaseSql.includes("create table if not exists public.schedule_conditions"), "SQL 缺少 schedule_conditions");
for (const rpcName of ["get_schedule_conditions_v1", "save_schedule_condition_v1", "delete_schedule_condition_v1"]) {
  assert(databaseSql.includes(rpcName), \`SQL 缺少排班條件 RPC：${rpcName}\`);
}`
);

console.log("schedule conditions patch applied");
