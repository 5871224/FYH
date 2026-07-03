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
assert(styles.includes(".member-main.shift-eligible-member-name"), "eligible member names should have deep-pink styling");
assert(styles.includes("color: #b51f62;"), "selected shift eligible names should be deep pink");

console.log("selected shift highlight check ok");
