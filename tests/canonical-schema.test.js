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

  const sqlFiles = fs
    .readdirSync(path.join(root, "supabase"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(sqlFiles, ["001_current_schema.sql", "002_current_updates.sql"]);

  assert.match(schema, /create table if not exists public\.attendance_days/);
  assert.match(schema, /create table if not exists public\.attendance_audit_logs/);
  for (const name of [
    "attendance_records",
    "attendance_action_logs",
    "attendance_overtime_requests",
    "overtime_review_logs",
    "delete_member_account_v3"
  ]) {
    assert.equal(combined.includes(name), false, `SQL 仍包含淘汰結構：${name}`);
  }
});

test("正式 SQL 保留群組、角色權限、班表封存與必要資料完整性機制", () => {
  const combined = read("supabase/001_current_schema.sql") + read("supabase/002_current_updates.sql");
  for (const pattern of [
    /create table if not exists public\.schedule_groups/,
    /create table if not exists public\.access_roles/,
    /create table if not exists public\.access_role_groups/,
    /create table if not exists public\.schedule_archives/,
    /create table if not exists public\.schedule_archive_entries/,
    /create or replace function public\.protect_archived_schedule_v1/
  ]) {
    assert.match(combined, pattern);
  }
});

test("正式 SQL 不依賴 Supabase 專屬執行機制", () => {
  const combined = read("supabase/001_current_schema.sql") + read("supabase/002_current_updates.sql");
  const executableSql = combined.replace(/--.*$/gm, "");
  for (const pattern of [
    /auth\.uid\s*\(/i,
    /auth\.role\s*\(/i,
    /enable\s+row\s+level\s+security/i,
    /create\s+policy/i,
    /\bservice_role\b/i,
    /\bauthenticated\b/i,
    /\banon\b/i,
    /save_attendance_clock/i,
    /save_meal_order/i,
    /get_scheduler_bootstrap_v3/i,
    /save_schedule_entries_v3/i
  ]) {
    assert.doesNotMatch(executableSql, pattern);
  }
});

test("Supabase Edge Function runtime 已移除，正式入口為 FYH Backend", () => {
  const readme = read("README.md");
  assert.equal(fs.existsSync(path.join(root, "supabase", "functions")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts", "deploy-edge-functions.ps1")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts", "check-public-supabase.js")), false);
  assert.equal(fs.existsSync(path.join(root, "deno.lock")), false);

  for (const file of [
    "src/backend/api-contract.js",
    "src/backend/api-router.js",
    "src/backend/native-attendance.js",
    "src/backend/native-meal.js",
    "src/backend/db/postgres.js"
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `缺少 FYH Backend 正式模組：${file}`);
  }

  assert.match(readme, /瀏覽器前端[\s\S]*\/api\/v1\/\*[\s\S]*FYH Node\.js Backend[\s\S]*PostgreSQL/);
  assert.match(readme, /Supabase Edge Functions 已退出正式架構/);
});

test("正式文件不得描述切換期相容或補丁式執行", () => {
  const docs = [read("README.md"), read("AGENTS.md"), read("規格書.md")].join("\n");
  assert.match(docs, /單一正式版本原則|唯一正式資料結構/);
  assert.doesNotMatch(docs, /004_remove_legacy_attendance|沿用既有 12 欄格式|平台暫時無法實體刪除/);
});
