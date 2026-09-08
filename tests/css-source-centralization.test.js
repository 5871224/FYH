const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("renderer HTML 不得再內嵌靜態 CSS", () => {
  const html = read("src/renderer/index.html");
  assert.doesNotMatch(html, /<style\b/i, "index.html 不得保留 <style> 區塊");
  assert.doesNotMatch(html, /\sstyle\s*=/i, "index.html 不得使用行內 style 屬性");
  assert.match(html, /<link rel="stylesheet" href="\.\/app-shell\.css\?v=[^"]+">/);
  assert.match(html, /<div class="toolbar-grid" id="toolbarGrid" hidden>/);
});

test("shell CSS 應集中於獨立樣式表並同步發布", () => {
  const source = read("src/renderer/app-shell.css");
  const published = read("docs/app-shell.css");
  assert.equal(published, source);
  assert.match(source, /\.core-actions-menu-trigger\s*\{/);
  assert.match(source, /\.permission-group-summary-row\s*\{/);
  assert.match(source, /\.attendance-review-filters\s*\{/);
});
