const fs = require("node:fs");

const file = "scripts/check-v2-final.js";
let source = fs.readFileSync(file, "utf8");
const oldLine = 'const sourceLiveReports = read("src/renderer/v2-live-report-filters.js");';
const newLine = 'const sourceLiveReports = ["src/renderer/renderer-period-exports.js", "src/renderer/renderer-records-events.js"].map(read).join("\\n");';
if (!source.includes(oldLine)) throw new Error("找不到舊期間匯出檢查來源");
source = source.replace(oldLine, newLine);
fs.writeFileSync(file, source, "utf8");
console.log("V2 final period-export source updated.");
