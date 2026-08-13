const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
// 正式程式庫不得重新引入歷史階段命名、一次性遷移腳本或共享函式覆蓋。

test("正式檢查與 workflow 不再使用 V2 階段命名", () => {
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

test("測試檔名不再保留 phase 或 v2 階段名稱", () => {
  const invalid = fs.readdirSync(path.join(root, "tests"))
    .filter((name) => /phase\d+|(?:^|-)v2(?:-|\.)/i.test(name));
  assert.deepEqual(invalid, []);
});

test("bundle 說明不再標示過渡或 legacy 執行模式", () => {
  const build = read("scripts/build-js.js");
  assert.doesNotMatch(build, /第一階段|transitional bundle|legacy global|data-v2-module/);
  assert.match(build, /declared module execution order/);
});

test("JavaScript 架構檢查阻擋共享模組重複函式", () => {
  const audit = read("scripts/audit-js-duplicates.js");
  assert.match(audit, /isolatedModules/);
  assert.match(audit, /duplicate shared function name group/);
  assert.match(audit, /duplicate shared function body group/);
  childProcess.execFileSync(process.execPath, ["scripts/audit-js-duplicates.js", "--check"], { cwd: root, stdio: "pipe" });
});

test("正式目錄不得保留一次性遷移腳本、失效檢查與未部署端點", () => {
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

test("匯出流程不得由後載入模組覆寫正式 API 或匯出器", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const offenders = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && !["app.js", "browser-exporter.js", "web-api.js"].includes(name))
    .filter((name) => /(?:schedulerBrowserExporter|schedulerApi)\.[A-Za-z0-9_]+\s*=/.test(read(`src/renderer/${name}`)));
  assert.deepEqual(offenders, []);
  const exporter = read("src/renderer/browser-exporter.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotMatch(exporter + webApi, /approvedOvertimeRows|hasOfficialScheduleExportRows|originalExporters/);
});

test("畫面模組只能透過 schedulerApi 存取後端，不直接依賴提供者傳輸與 Token", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const providerFiles = new Set(["app-config.js", "app.js", "web-api.js"]);
  const providerTransportMarkers = /(?:supabaseUrl|supabaseAnonKey|access_token|refresh_token|\/auth\/v1\/|\/rest\/v1\/|\/functions\/v1\/|\bapikey\b)/i;
  const offenders = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && !providerFiles.has(name))
    .filter((name) => providerTransportMarkers.test(read(`src/renderer/${name}`)));
  assert.deepEqual(offenders, []);
});

test("schedulerApi 只有正式後端提供者可以建立，其他畫面模組不得另建第二套 API", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const owners = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && name !== "app.js")
    .filter((name) => /window\.schedulerApi\s*=/.test(read(`src/renderer/${name}`)));
  assert.deepEqual(owners, ["web-api.js"]);
});

test("schedulerApi 在提供者載入前建立唯讀後端門面", () => {
  const html = read("src/renderer/index.html");
  const configIndex = html.indexOf('<script src="./app-config.js');
  const boundaryIndex = html.indexOf('Object.defineProperty(window, "schedulerApi"');
  const appIndex = html.indexOf('<script src="./app.js');
  assert.ok(configIndex >= 0 && boundaryIndex > configIndex && appIndex > boundaryIndex);
  assert.match(html, /new Proxy\(value/);
  assert.match(html, /set:\s*\(\)\s*=>\s*false/);
  assert.match(html, /defineProperty:\s*\(\)\s*=>\s*false/);
  assert.match(html, /deleteProperty:\s*\(\)\s*=>\s*false/);
});
