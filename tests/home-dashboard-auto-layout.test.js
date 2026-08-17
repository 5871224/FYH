const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("首頁功能按鈕依實際顯示數量自動填滿可用寬度", () => {
  const css = fs.readFileSync(path.join(__dirname, "../src/renderer/css/pages.css"), "utf8");
  assert.match(css, /\.home-action-grid-three\s*\{\s*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\);/);
  assert.doesNotMatch(css, /\.home-action-grid-three\s*\{\s*grid-template-columns:\s*repeat\(3,/);
});
