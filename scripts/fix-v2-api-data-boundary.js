const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.resolve(__dirname, "canonicalize-v2-api-data.js");
let source = fs.readFileSync(scriptPath, "utf8");

if (!source.includes('"getMealOrderStatus"')) {
  throw new Error("找不到待修正的 getMealOrderStatus 邊界");
}
source = source.replaceAll('"getMealOrderStatus"', '"getTodayMealOrder"');

const exportStart = source.indexOf("const exportMarker = `");
const exportEndText = "webApi = webApi.replace(exportMarker, exportReplacement);";
const exportEnd = source.indexOf(exportEndText, exportStart);
if (exportStart < 0 || exportEnd < 0) {
  throw new Error("找不到待修正的 V2 API 輸出區段");
}
const replacement = [
  'const employeeExportMarker = "    getTodayAttendanceOvertime,\\n";',
  'if (!webApi.includes(employeeExportMarker)) throw new Error("找不到員工加班 API 輸出位置");',
  'webApi = webApi.replace(employeeExportMarker, "    getEmployeeOvertimeDates,\\n    getAttendanceOvertimeForDate,\\n" + employeeExportMarker);',
  '',
  'const managerExportMarker = "    createAdminOvertimeRequest,\\n";',
  'if (!webApi.includes(managerExportMarker)) throw new Error("找不到主管加班 API 輸出位置");',
  'webApi = webApi.replace(managerExportMarker, managerExportMarker + "    getMemberOrder,\\n    saveMemberOrder,\\n");'
].join("\n");
source = source.slice(0, exportStart)
  + replacement
  + source.slice(exportEnd + exportEndText.length);

fs.writeFileSync(scriptPath, source);
console.log("V2 overtime boundary and API export list updated");
