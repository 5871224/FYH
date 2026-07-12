const fs = require("node:fs");
const path = require("node:path");

const testPath = path.resolve(__dirname, "..", "tests", "renderer-phase7-overtime-patches.test.js");
let source = fs.readFileSync(testPath, "utf8");
const broken = 'source + "\n;({ formatClockButtonStatus, renderTodayOvertimePanel, renderOvertimeEstimate })"';
const fixed = 'source + "\\n;({ formatClockButtonStatus, renderTodayOvertimePanel, renderOvertimeEstimate })"';
if (!source.includes(broken)) {
  throw new Error("找不到待修正的回歸測試換行字串");
}
source = source.replace(broken, fixed);
fs.writeFileSync(testPath, source);
console.log("overtime regression test newline fixed");
