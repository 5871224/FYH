const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(rootDir, "src", "renderer", "styles.css"), "utf8");

assert(styles.includes(".table-top-scrollbar") && styles.includes(".table-top-scrollbar-content"), "schedule table should expose the horizontal scrollbar above the date header");
assert(styles.includes("--schedule-radius: 18px;"), "schedule table radius should be a single shared token");
assert(styles.includes("border-radius: var(--schedule-radius) var(--schedule-radius) 0 0;"), "sticky header should own rounded top corners");
assert(styles.includes(".table-sticky-header::after"), "sticky header should draw its rounded top border with an overlay");
assert(styles.includes(".table-sticky-header-left::after"), "sticky left header should keep its rounded corner border while horizontally scrolled");
assert(styles.includes("border-radius: 0 0 var(--schedule-radius) var(--schedule-radius);"), "schedule table wrapper should own rounded bottom corners");
assert(styles.includes(".table-wrap::after"), "schedule table wrapper should draw its rounded bottom border with an overlay");
assert(styles.includes(".table-sticky-cell-day:last-child"), "sticky header should not draw an extra outer right grid line");
assert(styles.includes("#mainTable tr > :last-child"), "schedule body should not draw an extra outer right grid line");
assert(styles.includes("#mainTable tbody tr:last-child > *"), "schedule body should not draw an extra bottom grid line");

console.log("schedule table rounded corners check ok");
