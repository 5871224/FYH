const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');

test('settings list tables use one localized name column', () => {
  const department = read('src/renderer/renderer-settings-department.js');
  const member = read('src/renderer/renderer-settings-member.js');
  const catalog = read('src/renderer/renderer-settings-catalog.js');
  const permissions = read('src/renderer/renderer-groups-permissions-archive.js');

  assert.doesNotMatch(department, /department-settings-name-vi/);
  assert.doesNotMatch(department, /單位<br><span>越文名稱<\/span>/);
  assert.match(department, /getLocalizedName\(department\)/);

  assert.doesNotMatch(member, /member-table-name-vi/);
  assert.match(member, /member-table-name[^\n]*getLocalizedName\(member\)/);

  assert.doesNotMatch(catalog, /settings-table-name-vi/);
  assert.doesNotMatch(catalog, /category === "shift" \? "<div>越文名稱<\/div>"/);
  assert.doesNotMatch(catalog, /category === "leave" \? "<div>越文名稱<\/div>"/);
  assert.match(catalog, /getLocalizedName\(item/);

  assert.doesNotMatch(permissions, /permission-role-vi-col/);
  assert.match(permissions, /permission-role-col[^\n]*getLocalizedName\(role\)/);

  // Vietnamese edit fields remain available for maintaining translated names.
  assert.match(department, /id="departmentNameVi"/);
  assert.match(catalog, /id="shiftNameVi"/);
  assert.match(catalog, /id="leaveNameVi"/);
  assert.match(permissions, /id="memberNameVi"/);
  assert.match(permissions, /id="accessRoleNameVi"/);
});

test('member save refreshes Vietnamese labels before returning to the settings list', () => {
  const source = read('src/renderer/renderer-groups-permissions-archive.js');
  const saveStart = source.indexOf('async function saveMember(mode)');
  const saveEnd = source.indexOf('function syncMemberGroupFields', saveStart);
  const saveMember = source.slice(saveStart, saveEnd);
  const syncIndex = saveMember.indexOf('syncMemberProfile');
  const reloadIndex = saveMember.indexOf('reloadGroupApplicationState');
  const refreshIndex = saveMember.indexOf('fyhI18n?.refreshLabels');
  assert.ok(syncIndex >= 0 && reloadIndex > syncIndex && refreshIndex > reloadIndex);
});

test('schedule renders localized member, department and shift names directly', () => {
  const toolbar = read('src/renderer/renderer-schedule-toolbar.js');
  const table = read('src/renderer/renderer-schedule-table.js');
  const cells = read('src/renderer/renderer-schedule-cells.js');
  assert.match(toolbar, /member-main[^\n]*getLocalizedName\(member\)/);
  assert.match(table, /getLocalizedName\(department\)/);
  assert.match(table, /getLocalizedName\(shift\)/);
  assert.match(cells, /getLocalizedName\(member\)/);
});
