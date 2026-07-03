const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const styles = fs.readFileSync(path.join(rootDir, "src", "renderer", "styles.css"), "utf8");

assert(renderer.includes("function memberMatchesSelectedShift"), "selected shift eligibility helper should exist");
assert(renderer.includes('state.selected.type !== "shift"'), "member highlight should only apply while a shift is selected");
assert(renderer.includes("memberCanScheduleShift(member, shift.id)"), "selected shift highlight should use member schedule shifts");
assert(renderer.includes("renderToolbar();\n  renderTable();"), "selecting a chip should refresh the schedule table highlight");
assert(renderer.includes('event.key === "Escape"'), "Escape should clear the selected toolbar chip");
assert(renderer.includes("function clearSelectedChip"), "selected toolbar chip clearing should be centralized");
assert(renderer.includes("shift-eligible-person-col"), "eligible members should mark the person column");
assert(styles.includes(".person-col.shift-eligible-person-col"), "eligible member name cells should have a distinct background");
assert(styles.includes("background: #fff0f6;"), "selected shift eligible name cells should use the highlight background");

console.log("selected shift highlight check ok");
