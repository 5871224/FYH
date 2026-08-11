const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("群組設定單位欄使用可換行膠囊標籤並取得主要寬度", () => {
  const renderer = read("src/renderer/renderer-groups-permissions-archive.js");
  const css = read("src/renderer/css/pages.css");
  const spec = read("規格書.md");

  assert.match(renderer, /function renderGroupUnitTags\(group\)/);
  assert.match(renderer, /class="group-unit-tags"/);
  assert.match(renderer, /class="group-unit-tag"/);
  assert.match(renderer, /class="group-units-col"/);
  assert.match(renderer, /class="group-units-cell"[^>]*>\$\{renderGroupUnitTags\(group\)\}/);

  assert.match(css, /\.group-settings-table \{[^}]*table-layout:\s*fixed/);
  assert.match(css, /\.group-settings-table \.group-units-col \{\s*width:\s*auto/);
  assert.match(css, /\.group-unit-tags \{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.group-unit-tag \{[^}]*border-radius:\s*999px/);
  assert.match(spec, /單位欄為主要寬欄/);
  assert.match(spec, /膠囊標籤/);
});
