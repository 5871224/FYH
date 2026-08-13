const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("formal checks no longer use v2 phase naming", () => {
  const packageJson = JSON.parse(read("package.json"));
  const workflow = read(".github/workflows/deploy-pages.yml");
  assert.equal(typeof packageJson.scripts["renderer:check"], "string");
  assert.equal(packageJson.scripts["v2:check"], undefined);
  assert.match(packageJson.scripts["renderer:check"], /check-renderer-alignment\.js/);
  assert.match(packageJson.scripts["renderer:check"], /check-renderer-contracts\.js/);
  assert.doesNotMatch(workflow, /V2|v2:check/);
  assert.equal(fs.existsSync(path.join(root, "scripts/check-v2-alignment.js")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts/check-v2-final.js")), false);
});

test("test filenames no longer keep phase or v2 stage names", () => {
  const invalid = fs.readdirSync(path.join(root, "tests"))
    .filter((name) => /phase\d+|(?:^|-)v2(?:-|\.)/i.test(name));
  assert.deepEqual(invalid, []);
});

test("bundle description no longer marks transitional or legacy runtime", () => {
  const build = read("scripts/build-js.js");
  assert.doesNotMatch(build, /transitional bundle|legacy global|data-v2-module/);
  assert.match(build, /declared module execution order/);
});

test("JavaScript architecture check blocks duplicate shared functions", () => {
  const audit = read("scripts/audit-js-duplicates.js");
  assert.match(audit, /isolatedModules/);
  assert.match(audit, /duplicate shared function name group/);
  assert.match(audit, /duplicate shared function body group/);
  childProcess.execFileSync(process.execPath, ["scripts/audit-js-duplicates.js", "--check"], { cwd: root, stdio: "pipe" });
});

test("formal tree excludes obsolete migration and patch files", () => {
  const obsolete = [
    "scripts/canonicalize-v2-api-data.js",
    "scripts/fix-v2-api-data-test.js",
    "scripts/fix-v2-tablet-check.js",
    "scripts/deploy-v2.ps1",
    "scripts/fix-v2-api-data-boundary.js",
    "scripts/one-shot-update-pages-spec.py",
    "scripts/check-auto-schedule-department-dates.js",
    "scripts/check-auto-schedule-rules.js",
    "scripts/check-auto-schedule-settings.js",
    "scripts/check-color-previews.js",
    "scripts/check-empty-state.js",
    "scripts/check-export-empty-guards.js",
    "scripts/check-schedule-table-rounded-corners.js",
    "scripts/check-selected-shift-highlight.js",
    "scripts/check-shift-range-selection.js",
    "scripts/check-rest-compliance.js",
    "scripts/check-unused-supabase-tables.js",
    "supabase/functions/attendance-overtime/index.ts",
    "supabase/functions/member-auth-admin-v2/index.ts",
    "src/renderer/renderer-period-exports.js",
    "src/renderer/renderer-export-availability.js",
    "supabase/003_attendance_ledger.sql",
    "supabase/004_remove_legacy_attendance.sql"
  ].filter((file) => fs.existsSync(path.join(root, file)));
  assert.deepEqual(obsolete, []);
  const invalidTests = fs.readdirSync(path.join(root, "tests"))
    .filter((name) => /phase\d+|(?:^|-)v2(?:-|\.)|patch|overrides|data-fixes/i.test(name));
  assert.deepEqual(invalidTests, []);
});

test("export flow is not overwritten by later renderer modules", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const offenders = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && !["app.js", "browser-exporter.js", "web-api.js"].includes(name))
    .filter((name) => /(?:schedulerBrowserExporter|schedulerApi)\.[A-Za-z0-9_]+\s*=/.test(read(`src/renderer/${name}`)));
  assert.deepEqual(offenders, []);
  const exporter = read("src/renderer/browser-exporter.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotMatch(exporter + webApi, /approvedOvertimeRows|hasOfficialScheduleExportRows|originalExporters/);
});

test("renderer modules only reach backend through schedulerApi", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const providerFiles = new Set(["app-config.js", "app.js", "web-api.js"]);
  const providerTransportMarkers = /(?:supabaseUrl|supabaseAnonKey|access_token|refresh_token|\/auth\/v1\/|\/rest\/v1\/|\/functions\/v1\/|\bapikey\b)/i;
  const offenders = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && !providerFiles.has(name))
    .filter((name) => providerTransportMarkers.test(read(`src/renderer/${name}`)));
  assert.deepEqual(offenders, []);
});

test("only the formal backend provider creates schedulerApi", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const owners = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && name !== "app.js")
    .filter((name) => /window\.schedulerApi\s*=/.test(read(`src/renderer/${name}`)));
  assert.deepEqual(owners, ["web-api.js"]);
});

test("schedulerApi facade is readonly and strips provider auth tokens", () => {
  const html = read("src/renderer/index.html");
  const configIndex = html.indexOf('<script src="./app-config.js');
  const boundaryIndex = html.indexOf('Object.defineProperty(window, "schedulerApi"');
  const appIndex = html.indexOf('<script src="./app.js');
  assert.ok(configIndex >= 0 && boundaryIndex > configIndex && appIndex > boundaryIndex);
  assert.match(html, /const sanitizeAuthContext = \(context\) =>/);
  assert.match(html, /const createFacade = \(value\) =>/);
  assert.match(html, /session: user \? Object\.freeze\(\{ user \}\) : null/);
  assert.match(html, /return Object\.freeze\(facade\)/);
  assert.match(html, /provider = createFacade\(value\)/);
});
