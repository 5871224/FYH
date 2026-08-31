const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Vietnamese localization runtime parses and exposes the agreed fields", () => {
  const source = read("src/renderer/app-config.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "app-config.js" }));

  [
    "fyh.language",
    "zh-TW",
    "vi-VN",
    "get_vietnamese_labels_v1",
    "save_vietnamese_label_v1",
    "groupNameVi",
    "departmentNameVi",
    "memberNameVi",
    "shiftNameVi",
    "leaveNameVi",
    "data-meal-product-name-vi"
  ].forEach((token) => assert.ok(source.includes(token), `missing localization token: ${token}`));

  assert.match(source, /language === VI && vi \? vi : String\(item\?\.name \|\| ""\)/);
});

test("Vietnamese fixed UI covers home and attendance review labels", () => {
  const source = read("src/renderer/app-config.js");
  [
    '"簽到簿": "Sổ chấm công"',
    '"修改密碼": "Đổi mật khẩu"',
    '"全部群組": "Tất cả nhóm"',
    '"全部人員": "Tất cả nhân viên"',
    '"員工": "Nhân viên"',
    '"異常": "Bất thường"',
    '"常用備註": "Ghi chú thường dùng"',
    '"批次審核": "Duyệt hàng loạt"',
    '"批次退回": "Trả lại hàng loạt"',
    '"設為未審": "Đặt thành chưa duyệt"',
    '"設為已審": "Đặt thành đã duyệt"',
    '"歷程": "Lịch sử"'
  ].forEach((token) => assert.ok(source.includes(token), `missing Vietnamese fixed label: ${token}`));

  assert.match(source, /querySelector\("#homeCard \.home-header-actions"\)/);
  assert.match(source, /actions\.insertBefore\(shell, passwordButton\)/);
  assert.doesNotMatch(source, /position:fixed;right:10px;bottom:10px/);
});

test("Vietnamese schema adds only the agreed user-maintained labels", () => {
  const sql = read("supabase/003_vietnamese_display_names.sql");

  [
    "schedule_groups add column if not exists name_vi",
    "set_departments add column if not exists name_vi",
    "set_employee add column if not exists full_name_vi",
    "set_shift add column if not exists name_vi",
    "set_leave add column if not exists name_vi",
    "meal_products add column if not exists name_vi"
  ].forEach((token) => assert.ok(sql.includes(token), `missing schema token: ${token}`));

  assert.doesNotMatch(sql, /alter table public\.set_overtime\s+add column if not exists name_vi/i);
  assert.doesNotMatch(sql, /alter table public\.holidays\s+add column if not exists name_vi/i);
});

test("Vietnamese label API keeps permission checks for every editable entity", () => {
  const sql = read("supabase/003_vietnamese_display_names.sql");
  [
    "group_settings",
    "department_settings",
    "member_settings",
    "schedule_manage",
    "leave_settings",
    "meal_admin"
  ].forEach((permission) => assert.ok(sql.includes(`'${permission}'`), `missing permission check: ${permission}`));

  assert.match(sql, /revoke all on function public\.get_vietnamese_labels_v1\(\) from public, anon;/);
  assert.match(sql, /revoke all on function public\.save_vietnamese_label_v1\(text, uuid, text\) from public, anon;/);
});
