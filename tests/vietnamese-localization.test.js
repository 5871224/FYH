const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Vietnamese localization uses the formal scheduler API and no runtime field patching", () => {
  const config = read("src/renderer/app-config.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotThrow(() => new vm.Script(config, { filename: "app-config.js" }));
  ["fyh.language", "zh-TW", "vi-VN", "roles: normalizeLabelRows"].forEach((token) => assert.ok(config.includes(token), 'missing localization token: ' + token));
  assert.ok(webApi.includes("async function getVietnameseLabels()"));
  assert.ok(webApi.includes("async function saveVietnameseLabel(entity, id, value)"));
  assert.ok(config.includes("window.schedulerApi.getVietnameseLabels()"));
  assert.ok(config.includes("function installApiIntegration()"), "missing installApiIntegration runtime definition");
  assert.ok(config.includes("async function saveLabel("), "missing saveLabel runtime definition");
  assert.doesNotMatch(config.slice(config.indexOf("function installVietnameseLocalization")), /session\.access_token/);
  assert.doesNotMatch(config.slice(config.indexOf("function installVietnameseLocalization")), /api\[name\]\s*=\s*wrapped/);
  assert.doesNotMatch(config, /function\s+(?:addLocalizedField|ensureLocalizedFormFields|ensureMealLocalizedColumn)\b/);
});

test("Vietnamese fixed UI covers settings lists, forms, home and attendance review", () => {
  const source = read("src/renderer/app-config.js");
  [
    '"修改密碼": "Đổi mật khẩu"',
    '"單位設定": "Cài đặt bộ phận"',
    '"人員設定": "Cài đặt nhân viên"',
    '"班別設定": "Cài đặt ca"',
    '"假別設定": "Cài đặt loại nghỉ"',
    '"權限設定": "Cài đặt quyền"',
    '"越文名稱": "Tên tiếng Việt"',
    '"所屬人員": "Nhân viên thuộc bộ phận"',
    '"角色名稱": "Tên vai trò"',
    '"適用群組": "Nhóm áp dụng"',
    '"權限項目": "Quyền hạn"',
    '"修改單位": "Sửa bộ phận"',
    '"修改人員": "Sửa nhân viên"',
    '"修改班別": "Sửa ca"',
    '"修改假別": "Sửa loại nghỉ"',
    '"修改角色": "Sửa vai trò"',
    '"批次審核": "Duyệt hàng loạt"',
    '"匯入": "Nhập dữ liệu"',
    '"功能": "Chức năng"',
    '"修改群組": "Sửa nhóm"',
    '"新增群組": "Thêm nhóm"',
    '"修改排班條件": "Sửa điều kiện xếp ca"',
    '"新增排班條件": "Thêm điều kiện xếp ca"'
  ].forEach((token) => assert.ok(source.includes(token), 'missing Vietnamese fixed label: ' + token));
  assert.match(source, /actions\.insertBefore\(shell, passwordButton\)/);
  assert.doesNotMatch(source, /position:fixed;right:10px;bottom:10px/);
  assert.ok(source.includes("text.match(/^排班條件－(.+)$/)"));
  assert.ok(source.includes("text.match(/^(.+)封存班表$/)"));
});

test("schedule weekday headers switch to Vietnamese labels", () => {
  const layout = read("src/renderer/renderer-schedule-layout.js");
  const config = read("src/renderer/app-config.js");
  assert.ok(layout.includes('["CN", "T2", "T3", "T4", "T5", "T6", "T7"]'));
  assert.ok(layout.includes("getScheduleWeekdayLabel(weekday)"));
  assert.ok(config.includes('["CN", "T2", "T3", "T4", "T5", "T6", "T7"]'));
});

test("settings lists localize the original name column while edit forms retain Vietnamese fields", () => {
  const department = read("src/renderer/renderer-settings-department.js");
  const member = read("src/renderer/renderer-settings-member.js");
  const catalog = read("src/renderer/renderer-settings-catalog.js");
  const permission = read("src/renderer/renderer-groups-permissions-archive.js");
  const mealViews = read("src/renderer/renderer-records-views.js");

  ["departmentNameVi", "getLocalizedName(department)"].forEach((token) => assert.ok(department.includes(token)));
  assert.doesNotMatch(department, /department-settings-name-vi/);

  ["getLocalizedName(member)", "memberNameVi"].forEach((token) => assert.ok((member + permission).includes(token)));
  assert.doesNotMatch(member, /member-table-name-vi/);

  ["shiftNameVi", "leaveNameVi", "getLocalizedName(item"].forEach((token) => assert.ok(catalog.includes(token)));
  assert.doesNotMatch(catalog, /settings-table-name-vi/);

  ["accessRoleNameVi", "memberNameVi", "groupNameVi"].forEach((token) => assert.ok(permission.includes(token)));
  assert.ok(permission.includes("getLocalizedName(role)"));
  assert.doesNotMatch(permission, /permission-role-vi-col/);

  assert.ok(mealViews.includes('data-meal-product-field="nameVi"'));
  assert.ok(mealViews.includes("product.nameVi || product.name_vi"));
});
test("group and meal Vietnamese names use their formal save paths", () => {
  const groupSource = read("src/renderer/renderer-groups-permissions-archive.js");
  const mealActions = read("src/renderer/renderer-records-actions.js");
  const webApi = read("src/renderer/web-api.js");
  const sql = read("supabase/002_current_updates.sql");
  assert.match(groupSource, /const nameVi = document\.getElementById\("groupNameVi"\)/);
  assert.match(groupSource, /saveScheduleGroup\(\{[^}]*\bnameVi\b/s);
  assert.match(webApi, /saveVietnameseLabel\("group", result\?\.group\?\.id \|\| group\?\.id, group\?\.nameVi \|\| ""\)/);
  assert.match(mealActions, /nameVi:\s*row\.querySelector\('\[data-meal-product-field="nameVi"\]'\)/);
  assert.ok(sql.includes("v_name_vi"));
  assert.ok(sql.includes("name_vi=excluded.name_vi") || sql.includes("name_vi = excluded.name_vi"));
  assert.match(sql, /insert into public\.meal_products\(id, name, name_vi, price, is_active, sort_order, updated_at\)/);
});

test("Vietnamese schema is canonical, includes roles, and excludes overtime and holidays", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.equal(fs.existsSync(path.join(root, "supabase/003_vietnamese_display_names.sql")), false);
  [
    "schedule_groups add column if not exists name_vi",
    "set_departments add column if not exists name_vi",
    "set_employee add column if not exists full_name_vi",
    "set_shift add column if not exists name_vi",
    "set_leave add column if not exists name_vi",
    "meal_products add column if not exists name_vi",
    "access_roles add column if not exists name_vi",
    "get_vietnamese_labels_v1",
    "save_vietnamese_label_v1",
    "when 'role' then",
    "permission_settings"
  ].forEach((token) => assert.ok(sql.includes(token), 'missing canonical Vietnamese SQL token: ' + token));
  assert.doesNotMatch(sql, /alter table public\.set_overtime\s+add column if not exists name_vi/i);
  assert.doesNotMatch(sql, /alter table public\.holidays\s+add column if not exists name_vi/i);
});

test("member save persists Vietnamese full name through the member Edge function", () => {
  const webApi = read("src/renderer/web-api.js");
  const edge = read("supabase/functions/member-auth-admin/index.ts");
  assert.ok(webApi.includes("fullNameVi: member?.nameVi"));
  assert.ok(edge.includes("fullNameVi?: string"));
  assert.ok(edge.includes("full_name_vi: member.fullNameVi || null"));
});
