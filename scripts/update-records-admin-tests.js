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
}\n\n`;
if (!apiTest.includes(oldExtractor)) throw new Error("找不到舊 API 測試擷取工具");
apiTest = apiTest.replace(oldExtractor, "");
const testStart = apiTest.indexOf('test("員工加班 API 應保留日期、狀態、送出與刪除操作"');
const nextTest = apiTest.indexOf('\ntest("正式 loadState', testStart);
if (testStart < 0 || nextTest < 0) throw new Error("找不到舊員工加班 API 測試");
const replacement = `test("員工加班 API 應保留日期、狀態、送出、刪除與人員排序操作", () => {
  const source = readWebApi();
  [
    'requestFunction("attendance-overtime-employee", { action: "dates" })',
    'requestFunction("attendance-overtime-employee", { action: "status", workDate })',
    'action: "submit"',
    'action: "delete"',
    'requestFunction("member-order-v2", { action: "list" })',
    'requestFunction("member-order-v2", { action: "save", memberIds })'
  ].forEach((marker) => assert.equal(source.includes(marker), true, "缺少 API 契約：" + marker));
});
`;
apiTest = `${apiTest.slice(0, testStart)}${replacement}${apiTest.slice(nextTest + 1)}`;
fs.writeFileSync(apiPath, apiTest, "utf8");

console.log("Legacy record tests updated.");
