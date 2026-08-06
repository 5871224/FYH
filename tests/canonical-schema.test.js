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

test("正式文件不得描述切換期相容或補丁式執行", () => {
  const docs = [read("README.md"), read("AGENTS.md"), read("規格書.md")].join("\n");
  assert.match(docs, /單一正式版本原則|唯一正式資料結構/);
  assert.doesNotMatch(docs, /004_remove_legacy_attendance|沿用既有 12 欄格式|平台暫時無法實體刪除/);
});
