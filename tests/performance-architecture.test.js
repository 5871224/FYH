const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("heavy admin/review data is lazy-loaded", () => {
  const clicks = read("src/renderer/renderer-events-click.js");
  const records = read("src/renderer/renderer-records-page.js");
  assert.doesNotMatch(clicks, /ensureScheduleApplicationLoaded\(\);\s*if \(hasPermission\("member_settings"\)\) await ensureManagerDirectoryLoaded/);
  const personalLoader = records.match(/async function loadRecordsPage[\s\S]*?async function loadAttendanceReview/)[0];
  assert.doesNotMatch(personalLoader, /loadAttendanceReview\(false\)/);
  assert.match(clicks, /nextTab === "review"[\s\S]*!ensureAttendanceReviewState\(\)\.loaded/);
});

test("ExcelJS is lazy-loaded", () => {
  const html = read("src/renderer/index.html");
  const exporter = read("src/renderer/browser-exporter.js");
  assert.doesNotMatch(html, /exceljs(?:\.min)?\.js/i);
  assert.match(exporter, /async function ensureExcelJS\(\)/);
  assert.match(exporter, /await ensureExcelJS\(\);/);
});

test("schedule hot RPCs materialize actor access instead of row-by-row permission helpers", () => {
  const sql = read("supabase/002_current_updates.sql");
  const getEntries = sql.match(/create or replace function public\.get_schedule_entries_v3[\s\S]*?\n\$\$;/)[0];
  const saveEntries = sql.match(/create or replace function public\.save_schedule_entries_v3[\s\S]*?\n\$\$;/)[0];
  assert.match(getEntries, /actor as materialized/);
  assert.match(getEntries, /allowed_groups as materialized/);
  assert.doesNotMatch(getEntries, /can_access_group\(/);
  assert.match(saveEntries, /v_role_id uuid/);
  assert.doesNotMatch(saveEntries, /can_access_group\(/);
});

test("authenticated direct-write RLS policies are not recreated", () => {
  const sql = read("supabase/002_current_updates.sql");
  for (const name of ["write_holidays","write_scheduler_settings","write_meal_products","write_meal_settings","insert_schedule_entries","update_schedule_entries","delete_schedule_entries","insert_set_departments_group","update_set_departments_group","insert_set_employee","update_set_employee","insert_set_leave","update_set_leave","insert_set_overtime","update_set_overtime","insert_set_shift_group","update_set_shift_group"]) {
    assert.doesNotMatch(sql, new RegExp("create policy " + name + " "));
  }
});
