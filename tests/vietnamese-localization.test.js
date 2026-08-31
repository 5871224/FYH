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
