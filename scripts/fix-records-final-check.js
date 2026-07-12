const fs = require("node:fs");

const file = "scripts/check-v2-final.js";
let source = fs.readFileSync(file, "utf8");
const replacements = [
  [
    'const sourceLiveReports = read("src/renderer/v2-live-report-filters.js");',
    'const sourceLiveReports = ["src/renderer/renderer-period-exports.js", "src/renderer/renderer-records-events.js"].map(read).join("\\n");',
    "舊期間匯出檢查來源"
  ],
  [
    'const sourceRecords = read("src/renderer/v2-records.js");',
    'const sourceRecords = ["src/renderer/renderer-records-page.js", "src/renderer/renderer-records-views.js", "src/renderer/renderer-records-actions.js", "src/renderer/renderer-records-events.js"].map(read).join("\\n");',
    "舊記錄頁檢查來源"
  ],
  [
    'assert(sourceApp.includes("function isTabletDevice") && sourceApp.includes("function renderMealPage") && sourceApp.includes("function validateMealOrderItems") && sourceApp.includes("installV2RecordsUi") && !sourceApp.includes("installV2MealUi"), "JavaScript bundle 缺少必要正式模組");',
    'assert(sourceApp.includes("function isTabletDevice") && sourceApp.includes("function renderMealPage") && sourceApp.includes("function validateMealOrderItems") && sourceApp.includes("function loadRecordsPage") && sourceApp.includes("function renderPersonalRecordsSection") && sourceApp.includes("function bindRecordsEvents") && sourceApp.includes("function installPeriodExports") && !sourceApp.includes("installV2MealUi") && !sourceApp.includes("installV2RecordsUi") && !sourceApp.includes("installV2PersonalRecordLayout") && !sourceApp.includes("installV2OvertimeAdmin") && !sourceApp.includes("installV2AttendanceAdmin"), "JavaScript bundle 缺少必要正式模組");',
    "舊 V2 記錄模組總斷言"
  ]
];
for (const [oldLine, newLine, label] of replacements) {
  if (!source.includes(oldLine)) throw new Error(`找不到${label}`);
  source = source.replace(oldLine, newLine);
}
fs.writeFileSync(file, source, "utf8");
console.log("V2 final record and period-export sources updated.");
