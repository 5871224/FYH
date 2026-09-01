const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("src/renderer/css/responsive.css", "utf8");

test("mobile settings tables keep readable width and scroll horizontally", () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*department-settings-table-department[\s\S]*min-width: 900px/);
  assert.match(css, /member-settings-modal \.member-table[\s\S]*min-width: 980px/);
  assert.match(css, /settings-table-row-shift[\s\S]*min-width: 920px/);
  assert.match(css, /settings-table-row-leave[\s\S]*min-width: 760px/);
  assert.match(css, /member-table-scroll[\s\S]*overflow-x: auto/);
});
