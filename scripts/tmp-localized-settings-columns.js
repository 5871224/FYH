const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one match, found ${count}: ${from.slice(0, 100)}`);
  }
  write(path, source.replace(from, to));
}

// 1. Shared locale-aware display-name helper.
replaceOnce(
  'src/renderer/renderer-runtime-helpers.js',
  `function getDepartmentName(deptId) {\n  return state.departments.find((department) => department.id === deptId)?.name || "未指定單位";\n}\n`,
  `function getLocalizedName(item, chineseFallback = "") {\n  const chineseName = String(chineseFallback || item?.name || "");\n  const vietnameseName = String(item?.nameVi || "").trim();\n  return window.fyhI18n?.isVietnamese?.() && vietnameseName ? vietnameseName : chineseName;\n}\n\nfunction getDepartmentName(deptId) {\n  const department = state.departments.find((item) => item.id === deptId);\n  return department ? getLocalizedName(department) : "未指定單位";\n}\n`
);
replaceOnce(
  'src/renderer/renderer-runtime-helpers.js',
  `function getMemberScheduleShiftNames(member) {\n  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));\n  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);\n  return names.length ? names.join("、") : "未指定";\n}\n\nfunction renderMemberScheduleShiftPills(member) {\n  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));\n  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);\n`,
  `function getMemberScheduleShiftNames(member) {\n  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, getLocalizedName(shift)]));\n  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);\n  return names.length ? names.join("、") : "未指定";\n}\n\nfunction renderMemberScheduleShiftPills(member) {\n  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, getLocalizedName(shift)]));\n  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);\n`
);
replaceOnce(
  'src/renderer/renderer-runtime-helpers.js',
  `  return leave.code ? \`${'${leave.code} ${leave.name}'}\` : leave.name;\n}`,
  `  const name = getLocalizedName(leave);\n  return leave.code ? \`${'${leave.code} ${name}'}\` : name;\n}`
);

// 2. Department settings table: one name column, localized in-place.
replaceOnce(
  'src/renderer/renderer-settings-department.js',
  `         <div class="department-settings-title"><span>${'${escapeHtml(department.name)}'}</span><small class="department-settings-name-vi">${'${escapeHtml(department.nameVi || "-")}'}</small></div>`,
  `         <div class="department-settings-title"><span>${'${escapeHtml(getLocalizedName(department))}'}</span></div>`
);
replaceOnce(
  'src/renderer/renderer-settings-department.js',
  `                <span>${'${escapeHtml(member.name)}'}</span>`,
  `                <span>${'${escapeHtml(getLocalizedName(member))}'}</span>`
);
replaceOnce(
  'src/renderer/renderer-settings-department.js',
  `             <div>單位<br><span>越文名稱</span></div>`,
  `             <div>單位</div>`
);

// 3. Member settings table: remove Vietnamese-only column and localize the original name column.
replaceOnce(
  'src/renderer/renderer-settings-member.js',
  `              <div>姓名</div>\n              <div>越文名稱</div>\n              <div>排班班別</div>`,
  `              <div>姓名</div>\n              <div>排班班別</div>`
);
replaceOnce(
  'src/renderer/renderer-settings-member.js',
  `                <div class="member-table-name">${'${escapeHtml(member.name)}'}</div>\n                <div class="member-table-name-vi">${'${escapeHtml(member.nameVi || "-")}'}</div>`,
  `                <div class="member-table-name">${'${escapeHtml(getLocalizedName(member))}'}</div>`
);
replaceOnce(
  'src/renderer/renderer-settings-member.js',
  `${'${state.departments.filter((department) => !department.deleted).map((department) => `<option value="${escapeHtml(department.id)}" ${memberSettingsFilters.department === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}'}`,
  `${'${state.departments.filter((department) => !department.deleted).map((department) => `<option value="${escapeHtml(department.id)}" ${memberSettingsFilters.department === department.id ? "selected" : ""}>${escapeHtml(getLocalizedName(department))}</option>`).join("")}'}`
);
replaceOnce(
  'src/renderer/renderer-settings-member.js',
  `<span>${'${escapeHtml(shift.name)}'}</span>`,
  `<span>${'${escapeHtml(getLocalizedName(shift))}'}</span>`
);
replaceOnce(
  'src/renderer/renderer-settings-member.js',
  `  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));`,
  `  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, getLocalizedName(shift)]));`
);

// 4. Shift / leave settings tables: remove Vietnamese-only columns; original display becomes localized.
replaceOnce(
  'src/renderer/renderer-settings-catalog.js',
  `    return members.map((member) => (\n      \`<span class="settings-member-chip" data-shift-schedule-member="${'${escapeHtml(member.id)}'}" title="雙擊修改人員">${'${escapeHtml(member.name)}'}</span>\`\n    )).join("");`,
  `    return members.map((member) => (\n      \`<span class="settings-member-chip" data-shift-schedule-member="${'${escapeHtml(member.id)}'}" title="雙擊修改人員">${'${escapeHtml(getLocalizedName(member))}'}</span>\`\n    )).join("");`
);
replaceOnce(
  'src/renderer/renderer-settings-catalog.js',
  `                ${'${category === "shift" ? "<div>越文名稱</div>" : ""}'}\n                ${'${category === "leave" ? "<div>假別代碼</div>" : ""}'}`,
  `                ${'${category === "leave" ? "<div>假別代碼</div>" : ""}'}`
);
replaceOnce(
  'src/renderer/renderer-settings-catalog.js',
  `                ${'${category === "shift" ? "" : `<div>${category === "leave" ? "假別" : "加班"}</div>`}'}\n                ${'${category === "leave" ? "<div>越文名稱</div>" : ""}'}`,
  `                ${'${category === "shift" ? "" : `<div>${category === "leave" ? "假別" : "加班"}</div>`}'}`
);
replaceOnce(
  'src/renderer/renderer-settings-catalog.js',
  `${'${escapeHtml(item.name || item.code || "名稱")}'}</div>\n                  </div>\n                  ${'${category === "shift" ? `<div class="settings-table-name-vi">${escapeHtml(item.nameVi || "-")}</div>` : ""}'}`,
  `${'${escapeHtml(getLocalizedName(item, item.name || item.code || "名稱"))}'}</div>\n                  </div>`
);
replaceOnce(
  'src/renderer/renderer-settings-catalog.js',
  `${'${category === "shift" ? "" : `<div class="settings-table-name">${escapeHtml(category === "leave" ? getLeaveCatalogDisplayName(item) : item.name)}</div>`}'}\n                  ${'${category === "leave" ? `<div class="settings-table-name-vi">${escapeHtml(item.nameVi || "-")}</div>` : ""}'}`,
  `${'${category === "shift" ? "" : `<div class="settings-table-name">${escapeHtml(category === "leave" ? getLocalizedName(item, getLeaveCatalogDisplayName(item)) : getLocalizedName(item))}</div>`}'}`
);

// 5. Permission settings: one role-name column, localized in-place.
replaceOnce(
  'src/renderer/renderer-groups-permissions-archive.js',
  `<th class="permission-role-col">角色名稱</th><th class="permission-role-vi-col">越文名稱</th><th class="permission-group-col">適用群組</th>`,
  `<th class="permission-role-col">角色名稱</th><th class="permission-group-col">適用群組</th>`
);
replaceOnce(
  'src/renderer/renderer-groups-permissions-archive.js',
  `<td class="permission-role-col">${'${escapeHtml(role.name)}'}</td><td class="permission-role-vi-col">${'${escapeHtml(role.nameVi || "-")}'}</td><td class="permission-group-col">`,
  `<td class="permission-role-col">${'${escapeHtml(getLocalizedName(role))}'}</td><td class="permission-group-col">`
);

// Refresh Vietnamese cache after member save/reload so the schedule immediately receives the new nameVi.
replaceOnce(
  'src/renderer/renderer-groups-permissions-archive.js',
  `    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");\n    await reloadGroupApplicationState();\n    closeModal();`,
  `    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");\n    await reloadGroupApplicationState();\n    await window.fyhI18n?.refreshLabels?.();\n    window.fyhI18n?.refresh?.();\n    closeModal();`
);

// 6. Schedule page uses the same locale-aware names directly instead of relying on a second DOM translation pass.
replaceOnce(
  'src/renderer/renderer-schedule-toolbar.js',
  `  const name = item.name || categoryLabel;`,
  `  const name = getLocalizedName(item, categoryLabel);`
);
replaceOnce(
  'src/renderer/renderer-schedule-toolbar.js',
  `>${'${escapeHtml(department.name)}'}</option>`,
  `>${'${escapeHtml(getLocalizedName(department))}'}</option>`
);
// The same option template occurs twice; update the remaining occurrence separately.
replaceOnce(
  'src/renderer/renderer-schedule-toolbar.js',
  `>${'${escapeHtml(department.name)}'}</option>`,
  `>${'${escapeHtml(getLocalizedName(department))}'}</option>`
);
replaceOnce(
  'src/renderer/renderer-schedule-toolbar.js',
  `>${'${escapeHtml(item.name)}'}</button>`,
  `>${'${escapeHtml(getLocalizedName(item))}'}</button>`
);
replaceOnce(
  'src/renderer/renderer-schedule-toolbar.js',
  `return \`<span class="member-main ${'${selectedShiftClass}'}">${'${escapeHtml(member.name)}'}${'${payTypeLabel}'}</span>\`;`,
  `return \`<span class="member-main ${'${selectedShiftClass}'}">${'${escapeHtml(getLocalizedName(member))}'}${'${payTypeLabel}'}</span>\`;`
);
replaceOnce(
  'src/renderer/renderer-schedule-table.js',
  `html += \`<td class="dept-col">${'${escapeHtml(shift.name)}'}</td>\`;`,
  `html += \`<td class="dept-col">${'${escapeHtml(getLocalizedName(shift))}'}</td>\`;`
);
// Department name occurs in two table row paths.
let scheduleTable = read('src/renderer/renderer-schedule-table.js');
const departmentToken = '${escapeHtml(department.name)}';
const departmentCount = scheduleTable.split(departmentToken).length - 1;
if (departmentCount !== 2) throw new Error(`renderer-schedule-table.js: expected 2 department name renderings, found ${departmentCount}`);
scheduleTable = scheduleTable.replaceAll(departmentToken, '${escapeHtml(getLocalizedName(department))}');
write('src/renderer/renderer-schedule-table.js', scheduleTable);

replaceOnce(
  'src/renderer/renderer-schedule-cells.js',
  `>${'${escapeHtml(member.name)}'}</div>\`;`,
  `>${'${escapeHtml(getLocalizedName(member))}'}</div>\`;`
);
replaceOnce(
  'src/renderer/renderer-schedule-cells.js',
  `        name: shift.name,`,
  `        name: getLocalizedName(shift),`
);

// Schedule width measurement must measure the name actually rendered.
replaceOnce(
  'src/renderer/renderer-schedule-layout.js',
  `const shiftContentWidth = visibleShifts.reduce((max, shift) => Math.max(max, measureTextWidth(shift.name, deptStyle)), 0);`,
  `const shiftContentWidth = visibleShifts.reduce((max, shift) => Math.max(max, measureTextWidth(getLocalizedName(shift), deptStyle)), 0);`
);
replaceOnce(
  'src/renderer/renderer-schedule-layout.js',
  `const visibleDepartments = visibleGroups.map(({ department }) => department.name);`,
  `const visibleDepartments = visibleGroups.map(({ department }) => getLocalizedName(department));`
);
replaceOnce(
  'src/renderer/renderer-schedule-layout.js',
  `members.map((member) => \`${'${member.name || ""}${member.payByDay ? "PT" : ""}'}\`)`,
  `members.map((member) => \`${'${getLocalizedName(member)}${member.payByDay ? "PT" : ""}'}\`)`
);

// 7. Grid contracts after removing dedicated Vietnamese display columns.
replaceOnce(
  'src/renderer/css/components.css',
  `.member-settings-modal .member-table-row {\n  grid-template-columns: var(--settings-drag-column-width) 104px minmax(86px, .9fr) minmax(110px, .95fr) minmax(170px, 1.45fr) 64px 108px 84px 78px var(--settings-action-column-width);\n}`,
  `.member-settings-modal .member-table-row {\n  grid-template-columns: var(--settings-drag-column-width) 104px minmax(96px, 1fr) minmax(170px, 1.45fr) 64px 108px 84px 78px var(--settings-action-column-width);\n}`
);
replaceOnce(
  'src/renderer/css/components.css',
  `.catalog-settings-modal .settings-table-row-shift {\n  grid-template-columns: var(--settings-drag-column-width) minmax(76px, .55fr) minmax(110px, .8fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) var(--settings-action-column-width);\n}`,
  `.catalog-settings-modal .settings-table-row-shift {\n  grid-template-columns: var(--settings-drag-column-width) minmax(96px, .65fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) var(--settings-action-column-width);\n}`
);
replaceOnce(
  'src/renderer/css/components.css',
  `.catalog-settings-modal .settings-table-row-leave {\n  grid-template-columns: var(--settings-drag-column-width) repeat(7, minmax(0, 1fr)) var(--settings-action-column-width);\n}`,
  `.catalog-settings-modal .settings-table-row-leave {\n  grid-template-columns: var(--settings-drag-column-width) repeat(6, minmax(0, 1fr)) var(--settings-action-column-width);\n}`
);
replaceOnce(
  'src/renderer/css/components.css',
  `  .member-settings-modal .member-table-row {\n    grid-template-columns: var(--settings-drag-column-width) 92px minmax(72px, .85fr) minmax(96px, .9fr) minmax(150px, 1.25fr) 54px 92px 72px 68px var(--settings-action-column-width);\n  }`,
  `  .member-settings-modal .member-table-row {\n    grid-template-columns: var(--settings-drag-column-width) 92px minmax(80px, .9fr) minmax(150px, 1.25fr) 54px 92px 72px 68px var(--settings-action-column-width);\n  }`
);

// 8. Focused regression test. Edit forms intentionally retain Vietnamese input fields.
write('tests/localized-settings-columns.test.js', `const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\n\nconst read = (path) => fs.readFileSync(path, 'utf8');\n\ntest('settings list tables use one localized name column', () => {\n  const department = read('src/renderer/renderer-settings-department.js');\n  const member = read('src/renderer/renderer-settings-member.js');\n  const catalog = read('src/renderer/renderer-settings-catalog.js');\n  const permissions = read('src/renderer/renderer-groups-permissions-archive.js');\n\n  assert.doesNotMatch(department, /department-settings-name-vi/);\n  assert.doesNotMatch(department, /單位<br><span>越文名稱<\\/span>/);\n  assert.match(department, /getLocalizedName\\(department\\)/);\n\n  assert.doesNotMatch(member, /member-table-name-vi/);\n  assert.match(member, /member-table-name[^\\n]*getLocalizedName\\(member\\)/);\n\n  assert.doesNotMatch(catalog, /settings-table-name-vi/);\n  assert.doesNotMatch(catalog, /category === "shift" \\? "<div>越文名稱<\\/div>"/);\n  assert.doesNotMatch(catalog, /category === "leave" \\? "<div>越文名稱<\\/div>"/);\n  assert.match(catalog, /getLocalizedName\\(item/);\n\n  assert.doesNotMatch(permissions, /permission-role-vi-col/);\n  assert.match(permissions, /permission-role-col[^\\n]*getLocalizedName\\(role\\)/);\n\n  // Vietnamese edit fields remain available for maintaining translated names.\n  assert.match(department, /id="departmentNameVi"/);\n  assert.match(catalog, /id="shiftNameVi"/);\n  assert.match(catalog, /id="leaveNameVi"/);\n  assert.match(permissions, /id="memberNameVi"/);\n  assert.match(permissions, /id="accessRoleNameVi"/);\n});\n\ntest('member save refreshes Vietnamese labels before returning to the settings list', () => {\n  const source = read('src/renderer/renderer-groups-permissions-archive.js');\n  const saveStart = source.indexOf('async function saveMember(mode)');\n  const saveEnd = source.indexOf('function syncMemberGroupFields', saveStart);\n  const saveMember = source.slice(saveStart, saveEnd);\n  const syncIndex = saveMember.indexOf('syncMemberProfile');\n  const reloadIndex = saveMember.indexOf('reloadGroupApplicationState');\n  const refreshIndex = saveMember.indexOf('fyhI18n?.refreshLabels');\n  assert.ok(syncIndex >= 0 && reloadIndex > syncIndex && refreshIndex > reloadIndex);\n});\n\ntest('schedule renders localized member, department and shift names directly', () => {\n  const toolbar = read('src/renderer/renderer-schedule-toolbar.js');\n  const table = read('src/renderer/renderer-schedule-table.js');\n  const cells = read('src/renderer/renderer-schedule-cells.js');\n  assert.match(toolbar, /member-main[^\\n]*getLocalizedName\\(member\\)/);\n  assert.match(table, /getLocalizedName\\(department\\)/);\n  assert.match(table, /getLocalizedName\\(shift\\)/);\n  assert.match(cells, /getLocalizedName\\(member\\)/);\n});\n`);

console.log('Localized settings/schedule source migration applied.');
