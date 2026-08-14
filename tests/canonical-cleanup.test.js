const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("canonical renderer has no legacy role state or guessed schedule ids", () => {
  const foundation = read("src/renderer/renderer-foundation.js");
  const normalization = read("src/renderer/renderer-state-normalization.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotMatch(foundation, /ROLE_OPTIONS|role:\s*"manager"/);
  assert.doesNotMatch(normalization, /merged\.role|fallbackOvertimeId/);
  assert.doesNotMatch(webApi, /resolveManagerMemberProfileId/);
  assert.match(webApi, /isUuid\(profileMemberId\)/);
});

test("group state keeps canonical metadata directly and archive ranges separately", () => {
  const groups = read("src/renderer/renderer-groups-permissions-archive.js");
  assert.doesNotMatch(groups, /entityMap|makeIdMap|allDepartments|allMembers|allShifts|allSchedule/);
  assert.match(groups, /catalog:\s*\{ departments: \[\], members: \[\], shifts: \[\], schedule: \{\} \}/);
  assert.match(groups, /archiveRanges/);
  assert.match(groups, /getDefaultAccessRoleId/);
});

test("Edge Functions share Taipei/effective-account and permission primitives", () => {
  const shared = read("supabase/functions/_shared/runtime.ts");
  for (const token of ["taipeiDateString", "isProfileEffective", "actorIdOf", "hasPermission", "canAccessGroup"]) {
    assert.match(shared, new RegExp(`function ${token}|export function ${token}`));
  }
  for (const path of [
    "supabase/functions/attendance-clock/index.ts",
    "supabase/functions/attendance-ledger/index.ts",
    "supabase/functions/attendance-review-groups/index.ts",
    "supabase/functions/attendance-ledger-export/index.ts",
    "supabase/functions/meal-order/index.ts",
    "supabase/functions/meal-report-v2/index.ts",
    "supabase/functions/meal-cancel-v2/index.ts",
    "supabase/functions/member-auth-admin/index.ts"
  ]) assert.match(read(path), /\.\.\/_shared\/runtime\.ts/);
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

test("SQL canonical source has no text-role compatibility model or dynamic policy rewriting", () => {
  const schema = read("supabase/001_current_schema.sql");
  const updates = read("supabase/002_current_updates.sql");
  const combined = `${schema}\n${updates}`;
  assert.doesNotMatch(combined, /legacy_role|access_role_legacy_role|employee\.role|new\.role|ROLE_OPTIONS/);
  assert.doesNotMatch(schema, /\brole text not null default 'employee'/);
  assert.doesNotMatch(updates, /Performance Advisor: remaining public RLS auth context uses init-plan evaluation/);
  assert.match(updates, /get_my_profile_v3/);
  assert.match(updates, /get_schedule_archive_ranges_v1/);
  assert.doesNotMatch(updates, /get_group_entity_map_v1\(\)/);
});

test("each final RLS policy is created once and authenticated has no direct write policy", () => {
  const sql = read("supabase/002_current_updates.sql");
  const names = [...sql.matchAll(/create\s+policy\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/gi)].map((match) => `${match[2]}.${match[1]}`);
  assert.equal(new Set(names).size, names.length);
  for (const statement of sql.match(/create\s+policy[\s\S]*?;/gi) || []) {
    if (/to\s+authenticated/i.test(statement)) assert.doesNotMatch(statement, /for\s+(insert|update|delete|all)\b/i);
  }
});
