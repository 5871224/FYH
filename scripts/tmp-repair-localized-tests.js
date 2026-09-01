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
  if (count !== 1) throw new Error(`${path}: expected 1 match, found ${count}`);
  write(path, source.replace(from, to));
}

// Isolated renderer tests intentionally evaluate one module without its normal bundle dependencies.
// Stub the shared localization helper in Chinese mode for those unit-test sandboxes.
replaceOnce(
  'tests/renderer-department-settings.test.js',
  `    escapeHtml: String,\n    renderActionIconButton: (kind) => kind,`,
  `    escapeHtml: String,\n    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),\n    renderActionIconButton: (kind) => kind,`
);

replaceOnce(
  'tests/renderer-member-order.test.js',
  `    canEditMemberAccount: () => true,\n    escapeHtml: String,`,
  `    canEditMemberAccount: () => true,\n    escapeHtml: String,\n    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),`
);

// Three schedule-cell tests use the same isolated module and need the shared helper stub.
let scheduleTest = read('tests/renderer-schedule-rendering.test.js');
const scheduleNeedle = `    getItemTextColor: () => "#ffffff", textColor: () => "#ffffff", escapeHtml: String,\n    shouldPromptLeaveDetail:`;
const scheduleCount = scheduleTest.split(scheduleNeedle).length - 1;
if (scheduleCount !== 2) throw new Error(`renderer-schedule-rendering.test.js: expected 2 compact cell contexts, found ${scheduleCount}`);
scheduleTest = scheduleTest.replaceAll(
  scheduleNeedle,
  `    getItemTextColor: () => "#ffffff", textColor: () => "#ffffff", escapeHtml: String,\n    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),\n    shouldPromptLeaveDetail:`
);
const regularNeedle = `    textColor: () => "#ffffff",\n    escapeHtml: String,\n    shouldPromptLeaveDetail:`;
if ((scheduleTest.split(regularNeedle).length - 1) !== 1) throw new Error('renderer-schedule-rendering.test.js: regular-holiday context not found exactly once');
scheduleTest = scheduleTest.replace(
  regularNeedle,
  `    textColor: () => "#ffffff",\n    escapeHtml: String,\n    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),\n    shouldPromptLeaveDetail:`
);
write('tests/renderer-schedule-rendering.test.js', scheduleTest);

// The product requirement changed: list tables no longer expose a separate Vietnamese-name column.
const vietnamesePath = 'tests/vietnamese-localization.test.js';
let vietnamese = read(vietnamesePath);
const startMarker = `test("settings renderers expose Vietnamese columns and edit fields", () => {`;
const endMarker = `\ntest("group and meal Vietnamese names use their formal save paths", () => {`;
const start = vietnamese.indexOf(startMarker);
const end = vietnamese.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('vietnamese localization renderer contract test block not found');
const replacement = `test("settings lists localize the original name column while edit forms retain Vietnamese fields", () => {\n  const department = read("src/renderer/renderer-settings-department.js");\n  const member = read("src/renderer/renderer-settings-member.js");\n  const catalog = read("src/renderer/renderer-settings-catalog.js");\n  const permission = read("src/renderer/renderer-groups-permissions-archive.js");\n  const mealViews = read("src/renderer/renderer-records-views.js");\n\n  ["departmentNameVi", "getLocalizedName(department)"].forEach((token) => assert.ok(department.includes(token)));\n  assert.doesNotMatch(department, /department-settings-name-vi/);\n\n  ["getLocalizedName(member)", "memberNameVi"].forEach((token) => assert.ok((member + permission).includes(token)));\n  assert.doesNotMatch(member, /member-table-name-vi/);\n\n  ["shiftNameVi", "leaveNameVi", "getLocalizedName(item"].forEach((token) => assert.ok(catalog.includes(token)));\n  assert.doesNotMatch(catalog, /settings-table-name-vi/);\n\n  ["accessRoleNameVi", "memberNameVi", "groupNameVi"].forEach((token) => assert.ok(permission.includes(token)));\n  assert.ok(permission.includes("getLocalizedName(role)"));\n  assert.doesNotMatch(permission, /permission-role-vi-col/);\n\n  assert.ok(mealViews.includes('data-meal-product-field="nameVi"'));\n  assert.ok(mealViews.includes("product.nameVi || product.name_vi"));\n});\n`;
vietnamese = vietnamese.slice(0, start) + replacement + vietnamese.slice(end + 1);
write(vietnamesePath, vietnamese);

console.log('Localized renderer test contracts repaired.');
