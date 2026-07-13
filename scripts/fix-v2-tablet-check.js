const fs = require("node:fs");
const path = require("node:path");

const finalCheckPath = path.resolve(__dirname, "check-renderer-contracts.js");
const alignmentCheckPath = path.resolve(__dirname, "check-renderer-alignment.js");

let finalCheck = fs.readFileSync(finalCheckPath, "utf8");
finalCheck = finalCheck.replaceAll(
  "src/renderer/v2-overtime-employee.js",
  "src/renderer/renderer-overtime-employee.js"
);
const blockStart = finalCheck.indexOf('const sourceApi = read("src/renderer/v2-tablet-session.js");');
const blockEndText = 'assert(sourceApi.includes("30 * 60 * 1000"), "平板未使用電腦版 30 分鐘閒置期限");';
const blockEnd = finalCheck.indexOf(blockEndText, blockStart);
if (blockStart < 0 || blockEnd < 0) {
  throw new Error("找不到平板 Session 舊檢查區段");
}
const replacement = `const tabletSessionSource = read("src/renderer/v2-tablet-session.js");
const canonicalWebApiSource = read("src/renderer/web-api.js");
const sourceApp = read("src/renderer/app.js");
const publishedApp = read("docs/app.js");
assert(sourceApp === publishedApp, "src/renderer/app.js 與 docs/app.js 不同步");
assert(!canonicalWebApiSource.includes("safeDepartmentColumns") && !canonicalWebApiSource.includes("runManagerSafeWrite") && !canonicalWebApiSource.includes("managerSafeFetch"), "前端仍使用攔截 fetch 的補丁式權限控制");
assert(tabletSessionSource.includes("installTabletSessionCompatibility") && tabletSessionSource.includes("sessionStorage"), "平板登入 Session 相容層缺少分頁儲存規則");
assert(tabletSessionSource.includes("/Android/i") && tabletSessionSource.includes("!/Mobile/i"), "Android 平板 Session 判斷缺失");
assert(tabletSessionSource.includes("/iPad/i") && tabletSessionSource.includes("/Macintosh/i") && tabletSessionSource.includes("touchPoints > 1"), "iPad Session 判斷缺失");
assert(tabletSessionSource.includes("30 * 60 * 1000"), "平板未使用電腦版 30 分鐘閒置期限");`;
finalCheck = finalCheck.slice(0, blockStart)
  + replacement
  + finalCheck.slice(blockEnd + blockEndText.length);
fs.writeFileSync(finalCheckPath, finalCheck);

let alignmentCheck = fs.readFileSync(alignmentCheckPath, "utf8");
alignmentCheck = alignmentCheck.replaceAll(
  "src/renderer/v2-overtime-employee.js",
  "src/renderer/renderer-overtime-employee.js"
);
fs.writeFileSync(alignmentCheckPath, alignmentCheck);
console.log("tablet session behavior and canonical overtime checks updated");
