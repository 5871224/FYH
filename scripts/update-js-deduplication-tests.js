const fs = require("node:fs");

const file = "tests/renderer-final-decomposition.test.js";
let source = fs.readFileSync(file, "utf8");

const formImport = 'const formEvents = read("src/renderer/renderer-events-form.js");';
if (!source.includes(formImport)) throw new Error("找不到表單事件測試來源");
source = source.replace(formImport, `${formImport}\nconst recordsEvents = read("src/renderer/renderer-records-events.js");`);

const oldBlock = `  ["memberSettingsFilterField", "mealReportFilter", "toggleOvertimePanel", "leaveAssignmentAllDay"].forEach((marker) => {
    assert.equal(formEvents.includes(marker), true, "缺少表單入口：" + marker);
  });`;
const newBlock = `  ["memberSettingsFilterField", "toggleOvertimePanel", "leaveAssignmentAllDay"].forEach((marker) => {
    assert.equal(formEvents.includes(marker), true, "缺少表單入口：" + marker);
  });
  ["mealReportFilter", "overtimeReviewFilter", "attendanceFilter"].forEach((marker) => {
    assert.equal(recordsEvents.includes(marker), true, "缺少記錄篩選入口：" + marker);
  });`;
if (!source.includes(oldBlock)) throw new Error("找不到舊記錄篩選事件斷言");
source = source.replace(oldBlock, newBlock);

fs.writeFileSync(file, source, "utf8");
console.log("JavaScript deduplication tests updated.");
