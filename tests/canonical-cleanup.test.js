const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("canonical renderer has no legacy role state or guessed schedule ids", () => {
  const foundation = read("src/renderer/renderer-foundation.js");
  const normalization = read("src/renderer/renderer-state-normalization.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotMatch(foundation, /ROLE_OPTIONS|role:\s*"manager"/);
  assert.doesNotMatch(normalization, /merged\.role|fallbackOvertimeId/);
  assert.doesNotMatch(webApi, /resolveManagerMemberProfileId|profileMemberId/);
  assert.match(webApi, /function makeScheduleKey\(memberId,workDate\)/);
  assert.match(webApi, /if\(!isUuid\(memberId\)\|\|!workDate\)throw new Error\("schedule cell member UUID and date are required"\)/);
});

test("group state keeps canonical metadata directly and archive ranges separately", () => {
  const groups = read("src/renderer/renderer-groups-permissions-archive.js");
  assert.doesNotMatch(groups, /entityMap|makeIdMap|allDepartments|allMembers|allShifts|allSchedule/);
  assert.match(groups, /catalog:\s*\{ departments: \[\], members: \[\], shifts: \[\], schedule: \{\} \}/);
  assert.match(groups, /archiveRanges/);
  assert.match(groups, /getDefaultAccessRoleId/);
});

test("Supabase Edge Function runtime is removed and domain logic lives in FYH backend", () => {
  assert.equal(fs.existsSync(path.join(root, "supabase", "functions")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts", "deploy-edge-functions.ps1")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts", "check-public-supabase.js")), false);
  assert.equal(fs.existsSync(path.join(root, "deno.lock")), false);

  const attendance = read("src/backend/native-attendance.js");
  const meal = read("src/backend/native-meal.js");
  const member = read("src/backend/services/native-member-service.js");
  for (const token of ["taipeiDate", "actor", "reviewSet", "exportRows"]) assert.match(attendance, new RegExp(`function ${token}`));
  assert.match(meal, /function createNativeMeal/);
  assert.match(member, /memberRepository\.saveMember/);
  assert.match(member, /memberRepository\.resetPassword/);
  assert.match(member, /memberRepository\.deleteMember/);
});

test("XLSX meal formatting belongs to exporter, not transport API", () => {
  const exporter = read("src/renderer/browser-exporter.js");
  const webApi = read("src/renderer/web-api.js");
  assert.match(exporter, /async function createMealReportWorkbook/);
  assert.doesNotMatch(webApi, /function buildMealEmployeeRows|function styleMealExportSheet|compactMealExportDate/);
  assert.match(webApi, /exporter\.createMealReportWorkbook/);
});

test("leave and overtime saves use explicit domain paths", () => {
  const catalog = read("src/renderer/renderer-settings-catalog.js");
  assert.match(catalog, /async function saveLeaveItem/);
  assert.match(catalog, /async function saveOvertimeItem/);
  assert.match(catalog, /async function persistNamedCatalogItem/);
});

test("SQL canonical source is portable PostgreSQL without legacy authorization APIs", () => {
  const schema = read("supabase/001_current_schema.sql");
  const updates = read("supabase/002_current_updates.sql");
  const combined = `${schema}\n${updates}`;
  const executableSql = combined.replace(/--.*$/gm, "");

  assert.doesNotMatch(combined, /legacy_role|access_role_legacy_role|employee\.role|new\.role|ROLE_OPTIONS/);
  assert.doesNotMatch(schema, /\brole text not null default 'employee'/);
  for (const pattern of [
    /auth\.uid\s*\(/i,
    /auth\.role\s*\(/i,
    /create\s+policy/i,
    /enable\s+row\s+level\s+security/i,
    /\bservice_role\b/i,
    /\bauthenticated\b/i,
    /\banon\b/i,
    /get_my_profile_v3/i,
    /get_schedule_archive_ranges_v1/i,
    /get_group_entity_map_v1/i
  ]) {
    assert.doesNotMatch(executableSql, pattern);
  }

  assert.match(updates, /create or replace function public\.is_employee_account_effective/);
  assert.match(updates, /create or replace function public\.is_schedule_date_archived/);
  assert.match(updates, /create or replace function public\.protect_archived_schedule_v1/);
});

test("canonical SQL keeps only PostgreSQL integrity triggers instead of application RLS", () => {
  const sql = read("supabase/002_current_updates.sql");
  const executableSql = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(executableSql, /create\s+policy/i);
  assert.doesNotMatch(executableSql, /enable\s+row\s+level\s+security/i);
  assert.match(sql, /create trigger trg_schedule_entries_protect_archive/);
  assert.match(sql, /create trigger trg_schedule_entries_set_group/);
});
