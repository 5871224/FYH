const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");

assert(
  renderer.includes("event.shiftKey && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)") &&
    renderer.includes("setScheduleRangeSelection(scheduleRangeSelection.anchor, point)"),
  "Shift-click should extend the existing schedule range anchor to the clicked cell"
);

console.log("shift range selection check passed");
