const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
// 畫面初始化與 CI 架構檢查都不得建立第二份狀態或留下產生檔。

test("個人記錄畫面使用正式狀態初始化來源", () => {
  const source = read("src/renderer/renderer-records-views.js");
  const start = source.indexOf("function renderPersonalRecordsSection");
  const end = source.indexOf("function renderMealReportSection", start);
  const block = source.slice(start, end);
  assert.match(block, /ensureRecordsState\(\)/);
  assert.doesNotMatch(block, /addDaysToDateString\(today, -49\)/);
  assert.doesNotMatch(block, /personalPageSize = Number/);
});

test("正式期間匯出直接整合於操作模組並使用共用月份天數函式", () => {
  const source = read("src/renderer/renderer-export-actions.js");
  assert.equal((source.match(/function daysInMonth\s*\(/g) || []).length, 0);
  assert.match(source, /Math\.min\(startDay, daysInMonth\(year, month\)\)/);
  assert.match(source, /async function runPeriodExport/);
  assert.equal(fs.existsSync(path.join(root, "src/renderer/renderer-period-exports.js")), false);
});

test("架構檢查模式不得產生稽核報告檔", () => {
  const cssReport = path.join(root, "css-duplicate-report.md");
  const jsReport = path.join(root, "js-duplicate-report.md");
  fs.rmSync(cssReport, { force: true });
  fs.rmSync(jsReport, { force: true });
  childProcess.execFileSync(process.execPath, ["scripts/audit-css-duplicates.js", "--check"], { cwd: root, stdio: "pipe" });
  childProcess.execFileSync(process.execPath, ["scripts/audit-js-duplicates.js", "--check"], { cwd: root, stdio: "pipe" });
  assert.equal(fs.existsSync(cssReport), false);
  assert.equal(fs.existsSync(jsReport), false);
});
