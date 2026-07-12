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
  ]
];
for (const [oldLine, newLine, label] of replacements) {
  if (!source.includes(oldLine)) throw new Error(`找不到${label}`);
  source = source.replace(oldLine, newLine);
}
fs.writeFileSync(file, source, "utf8");
console.log("V2 final record and period-export sources updated.");
