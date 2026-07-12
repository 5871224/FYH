const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const testPath = path.join(root, "tests", "renderer-phase7-auto-fill-schedule.test.js");
let source = fs.readFileSync(testPath, "utf8");
const oldRead = '  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");';
const newRead = '  const toolbarEvents = fs.readFileSync(path.join(root, "src", "renderer", "renderer-events-toolbar.js"), "utf8");';
const oldAssert = '  assert.equal(renderer.includes("bindAutoFillScheduleControls();"), true);';
const newAssert = '  assert.equal(toolbarEvents.includes("bindAutoFillScheduleControls();"), true);';
if (!source.includes(oldRead) || !source.includes(oldAssert)) {
  throw new Error("找不到自動補班舊結構測試更新點");
}
source = source.replace(oldRead, newRead).replace(oldAssert, newAssert);
fs.writeFileSync(testPath, source, "utf8");
