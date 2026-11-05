const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("首頁三個原有入口有一致的暖棕 SVG 圖示且功能動作不變", () => {
  const html = read("src/renderer/renderer-main-pages.js");
  const css = read("src/renderer/css/foundation.css");
  for (const action of ["schedule", "meal", "records"]) {
    assert.match(html, new RegExp('data-home-action="' + action + '"'));
  }
  assert.equal((html.match(/class="home-action-icon"/g) || []).length, 3);
  assert.match(html, /showMeal \? `<button class="home-action-card"/);
  assert.match(html, /class="home-account-menu"/);
  assert.match(html, /class="home-account-trigger"/);
  assert.match(html, /data-open-change-password="true"/);
  assert.match(html, /id="homeSignOutButton"/);
  assert.match(css, /home-action-icon/);
});

test("簽到簿配色限於原有頁面，班表及訂餐不受影響", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const components = read("src/renderer/css/components.css");
  const card = foundation.match(/\.records-card \{([^}]+)\}/);
  assert.ok(card);
  assert.match(card[1], /--fyh-records-tab-band: #dcc4a7;/);
  assert.match(card[1], /--fyh-records-filter-bg: #e9d8c1;/);
  assert.match(card[1], /--fyh-records-table-head-bg: #d8bd9c;/);
  assert.match(components, /background: var\(--fyh-records-tab-band,/);
  assert.match(components, /background: var\(--fyh-records-filter-bg,/);
  assert.match(components, /background: var\(--fyh-records-table-head-bg,/);
});
