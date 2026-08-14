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

test("schedule hot paths resolve actor access once and use set-based SQL", () => {
  const repository = read("src/backend/repositories/native-schedule-repository.js");
  const getEntries = repository.match(/async function getEntries[\s\S]*?async function saveEntries/)[0];
  const saveEntries = repository.match(/async function saveEntries[\s\S]*?return Object\.freeze/)[0];
  assert.match(getEntries, /actor as materialized/);
  assert.match(getEntries, /allowed_groups as materialized/);
  assert.doesNotMatch(getEntries, /can_access_group\(/);
  assert.match(saveEntries, /const actor = await transaction\.one/);
  assert.match(saveEntries, /incoming as materialized/);
  assert.match(saveEntries, /public\.access_role_groups allowed/);
  assert.doesNotMatch(saveEntries, /can_access_group\(/);
});

test("application RLS policies are not recreated", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /create\s+policy/i);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /enable\s+row\s+level\s+security/i);
});
