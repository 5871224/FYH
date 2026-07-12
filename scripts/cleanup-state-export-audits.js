const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
const write = (file, content) => fs.writeFileSync(path.join(root, file), `${content.trimEnd()}\n`, "utf8");

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到清理位置：${label}`);
  return source.replace(from, to);
}

let recordsViews = read("src/renderer/renderer-records-views.js");
recordsViews = mustReplace(recordsViews, `function renderPersonalRecordsSection() {
    const today = getTodayDateString();
    recordsState.personalFilters = recordsState.personalFilters || {
      fromDate: addDaysToDateString(today, -49),
      toDate: today
    };
    recordsState.personalPage = Number(recordsState.personalPage || 1);
    recordsState.personalTotal = Number(recordsState.personalTotal || 0);
    recordsState.personalPageSize = Number(recordsState.personalPageSize || 50);

    const filters = recordsState.personalFilters;`, `function renderPersonalRecordsSection() {
    ensureRecordsState();
    const filters = recordsState.personalFilters;`, "個人記錄狀態補值");
write("src/renderer/renderer-records-views.js", recordsViews);

let periodExports = read("src/renderer/renderer-period-exports.js");
periodExports = mustReplace(periodExports, `
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
`, "\n", "期間匯出月份天數函式");
write("src/renderer/renderer-period-exports.js", periodExports);

let cssAudit = read("scripts/audit-css-duplicates.js");
cssAudit = mustReplace(cssAudit, `const reportPath = path.join(root, "css-duplicate-report.md");
fs.writeFileSync(reportPath, \`${"${lines.join(\"\\n\")}"}\\n\`, "utf8");
console.log(\`CSS audit completed: ${"${rules.length}"} rules, ${"${exactGroups.length}"} exact groups, ${"${overrideGroups.length}"} override groups.\`);`, `const checkOnly = process.argv.includes("--check");
if (!checkOnly) {
  const reportPath = path.join(root, "css-duplicate-report.md");
  fs.writeFileSync(reportPath, \`${"${lines.join(\"\\n\")}"}\\n\`, "utf8");
}
console.log(\`CSS audit completed: ${"${rules.length}"} rules, ${"${exactGroups.length}"} exact groups, ${"${overrideGroups.length}"} override groups.\`);`, "CSS 稽核報告輸出");
cssAudit = cssAudit.replace('if (process.argv.includes("--check") && exactGroups.length) {', 'if (checkOnly && exactGroups.length) {');
write("scripts/audit-css-duplicates.js", cssAudit);

let jsAudit = read("scripts/audit-js-duplicates.js");
jsAudit = mustReplace(jsAudit, `fs.writeFileSync(path.join(root, "js-duplicate-report.md"), \`${"${report.join(\"\\n\")}"}\\n\`, "utf8");
console.log(\`JavaScript audit completed: ${"${functions.length}"} functions, ${"${duplicateNames.length}"} duplicate names, ${"${exactBodies.length}"} exact bodies.\`);`, `const checkOnly = process.argv.includes("--check");
if (!checkOnly) {
  fs.writeFileSync(path.join(root, "js-duplicate-report.md"), \`${"${report.join(\"\\n\")}"}\\n\`, "utf8");
}
console.log(\`JavaScript audit completed: ${"${functions.length}"} functions, ${"${duplicateNames.length}"} duplicate names, ${"${exactBodies.length}"} exact bodies.\`);`, "JavaScript 稽核報告輸出");
jsAudit = jsAudit.replace('if (process.argv.includes("--check")) {', 'if (checkOnly) {');
write("scripts/audit-js-duplicates.js", jsAudit);

const tests = `const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("個人記錄畫面使用正式狀態初始化來源", () => {
  const source = read("src/renderer/renderer-records-views.js");
  const start = source.indexOf("function renderPersonalRecordsSection");
  const end = source.indexOf("function renderMealReportSection", start);
  const block = source.slice(start, end);
  assert.match(block, /ensureRecordsState\\(\\)/);
  assert.doesNotMatch(block, /addDaysToDateString\\(today, -49\\)/);
  assert.doesNotMatch(block, /personalPageSize = Number/);
});

test("期間匯出使用共用月份天數函式", () => {
  const source = read("src/renderer/renderer-period-exports.js");
  assert.equal((source.match(/function daysInMonth\\s*\\(/g) || []).length, 0);
  assert.match(source, /Math\\.min\\(startDay, daysInMonth\\(year, month\\)\\)/);
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
`;
write("tests/state-export-audit-cleanup.test.js", tests);

let spec = read("規格書.md");
if (!spec.includes("### 狀態初始化與架構稽核輸出")) {
  spec += `\n\n### 狀態初始化與架構稽核輸出\n\n- 個人記錄畫面必須透過 ` + "`ensureRecordsState()`" + ` 取得日期、分頁與筆數預設值，不得在畫面函式重複補值。\n- 期間匯出使用共用 ` + "`daysInMonth()`" + `，不得另行宣告同名月份天數函式。\n- CSS 與 JavaScript 架構稽核在 ` + "`--check`" + ` 模式只回傳檢查結果，不得產生 Markdown 報告檔。\n`;
}
write("規格書.md", spec);

console.log("State, export and audit cleanup completed.");
