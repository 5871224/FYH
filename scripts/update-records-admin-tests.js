const fs = require("node:fs");

const recordsPath = "tests/renderer-phase13-records-views.test.js";
let records = fs.readFileSync(recordsPath, "utf8");
const oldRecordsTest = `test("訂餐統計與訂餐設定畫面應保留查詢、匯出、拖曳與儲存控制", () => {
  ["data-load-meal-report", "data-export-meal-report", "data-add-meal-product", "data-save-meal-settings", "data-meal-product-row", "meal-drag-handle"].forEach((marker) => assert.equal(views.includes(marker), true, "缺少：" + marker));
});`;
const newRecordsTest = `test("訂餐統計與訂餐設定畫面應保留即時篩選、匯出、拖曳與儲存控制", () => {
  ["data-meal-report-filter", "data-export-meal-report", "data-add-meal-product", "data-save-meal-settings", "data-meal-product-row", "meal-drag-handle"].forEach((marker) => assert.equal(views.includes(marker), true, "缺少：" + marker));
  assert.equal(read("src/renderer/renderer-records-events.js").includes("scheduleRecordsReload"), true, "訂餐統計未保留即時查詢");
});`;
if (!records.includes(oldRecordsTest)) throw new Error("找不到舊訂餐統計畫面測試");
fs.writeFileSync(recordsPath, records.replace(oldRecordsTest, newRecordsTest), "utf8");

const apiPath = "tests/renderer-phase7-v2-api-data.test.js";
let apiTest = fs.readFileSync(apiPath, "utf8");
const oldExtractor = `function extractFunctions(source, startName, endName) {
  const start = source.indexOf(\`async function \${startName}\`);
  const end = source.indexOf(\`async function \${endName}\`, start + 1);
  if (start < 0 || end <= start) throw new Error(\`找不到測試函式區段：\${startName} -> \${endName}\`);
  return source.slice(start, end);
}`;
const newExtractor = `function extractFunction(source, name) {
  const start = source.indexOf(\`async function \${name}\`);
  if (start < 0) throw new Error(\`找不到測試函式：\${name}\`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(\`測試函式未完整結束：\${name}\`);
}`;
if (!apiTest.includes(oldExtractor)) throw new Error("找不到舊 API 測試擷取工具");
apiTest = apiTest.replace(oldExtractor, newExtractor);
const oldCall = `  const functionSource = extractFunctions(source, "getEmployeeOvertimeDates", "getTodayMealOrder");`;
const newCall = `  const functionSource = ["getEmployeeOvertimeDates", "getAttendanceOvertimeForDate", "getTodayAttendanceOvertime", "submitAttendanceOvertime", "deleteAttendanceOvertime", "getMemberOrder", "saveMemberOrder"].map((name) => extractFunction(source, name)).join("\\n");`;
if (!apiTest.includes(oldCall)) throw new Error("找不到舊 API 測試區段");
fs.writeFileSync(apiPath, apiTest.replace(oldCall, newCall), "utf8");

console.log("Legacy record tests updated.");
