const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("全新資料庫只保留兩個正式 SQL 檔與每日簽到模型", () => {
  const schema = read("supabase/001_current_schema.sql");
  const updates = read("supabase/002_current_updates.sql");
  const combined = schema + updates;
  assert.equal(fs.existsSync(path.join(root, "supabase/003_attendance_ledger.sql")), false);
  assert.equal(fs.existsSync(path.join(root, "supabase/004_remove_legacy_attendance.sql")), false);
  assert.match(schema, /create table if not exists public\.attendance_days/);
  assert.match(schema, /create table if not exists public\.attendance_audit_logs/);
  for (const name of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs", "delete_member_account_v3"]) {
    assert.equal(combined.includes(name), false, `SQL 仍包含淘汰結構：${name}`);
  }
});

test("正式 SQL 必須包含群組、角色共用／群組權限與班表封存模型", () => {
  const combined = read("supabase/001_current_schema.sql") + read("supabase/002_current_updates.sql");
  for (const pattern of [
    /create table if not exists public\.schedule_groups/,
    /create table if not exists public\.access_roles/,
    /common_permissions text\[\]/,
    /create table if not exists public\.access_role_group_permissions/,
    /permissions text\[\]/,
    /create table if not exists public\.schedule_archives/,
    /create table if not exists public\.schedule_archive_entries/,
    /create table if not exists public\.schedule_conditions/,
    /create or replace function public\.role_has_common_permission/,
    /create or replace function public\.role_has_group_permission/,
    /create or replace function public\.has_common_permission/,
    /create or replace function public\.has_group_permission/,
    /create or replace function public\.get_schedule_conditions_v1/,
    /create or replace function public\.save_schedule_condition_v1/,
    /create or replace function public\.delete_schedule_condition_v1/,
    /create or replace function public\.save_schedule_group_v1/,
    /create or replace function public\.archive_schedule_v1/,
    /create or replace function public\.protect_archived_schedule_v1/,
    /create policy read_schedule_entries[\s\S]*schedule_view/,
    /create or replace function public\.save_schedule_entries_v3[\s\S]*schedule_manage/
  ]) {
    assert.match(combined, pattern);
  }
  assert.doesNotMatch(combined, /create or replace function public\.save_access_role_v1/);
  assert.doesNotMatch(combined, /create or replace function public\.has_access_permission/);
  assert.doesNotMatch(combined, /create policy update_schedule_entries/);
  assert.match(combined, /drop policy if exists update_schedule_entries on public\.schedule_entries/);
  const accessControl = read("supabase/functions/access-control/index.ts");
  assert.match(accessControl, /save_role/);
  assert.match(accessControl, /delete_role/);
  assert.match(accessControl, /reorder_roles/);
});

test("群組簽到審核 Edge Function 必須列入部署清單與文件", () => {
  const deploy = read("scripts/deploy-edge-functions.ps1");
  const readme = read("README.md");
  const spec = read("規格書.md");
  assert.match(deploy, /"attendance-review-groups"/);
  assert.match(readme, /`attendance-review-groups`/);
  assert.match(spec, /`attendance-review-groups`/);
  assert.equal(fs.existsSync(path.join(root, "supabase/functions/attendance-review-groups/index.ts")), true);
});

test("正式文件不得描述切換期相容或補丁式執行", () => {
  const docs = [read("README.md"), read("AGENTS.md"), read("規格書.md")].join("\n");
  assert.match(docs, /單一正式版本原則|唯一正式資料結構/);
  assert.doesNotMatch(docs, /004_remove_legacy_attendance|沿用既有 12 欄格式|平台暫時無法實體刪除/);
});
