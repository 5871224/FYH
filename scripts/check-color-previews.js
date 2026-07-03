const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const styles = fs.readFileSync(path.join(rootDir, "src", "renderer", "styles.css"), "utf8");

assert(renderer.includes('data-open-item-color="bg"'), "shared preview controls should expose a background color trigger");
assert(renderer.includes('data-open-item-color="text"'), "shared preview controls should expose a text color trigger");
assert(renderer.includes("自動字色"), "preview controls should label auto text color explicitly");
assert(renderer.includes('function syncNamedColorUi()'), "shared preview sync helper should exist");
assert(renderer.includes('class="settings-table-preview"'), "settings list should render preview pills");
assert(renderer.includes('const style = `color:${foreground};background:${item.color};border-color:${item.color};`;'), "toolbar chips should use filled preview colors");
assert(renderer.includes("textColor: getItemTextColor(shift, shift.color)"), "shift segments should reuse preview text color");
assert(renderer.includes("textColor: getItemTextColor(overtime, color)"), "overtime segments should reuse preview text color");
assert(renderer.includes('leave.code === "0047" && cellState.shift ? "rgb(112, 112, 112)"'), "rest-day leave text should turn gray when a shift is scheduled");

assert(styles.includes(".settings-table-preview"), "preview pill styles should exist");
assert(styles.includes(".settings-table-row-shift"), "shift settings grid should still be defined");
assert(styles.includes(".settings-table-row-overtime"), "overtime settings grid should still be defined");

console.log("color preview checks passed");
