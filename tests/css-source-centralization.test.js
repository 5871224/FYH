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
  assert.doesNotMatch(html, /app-shell\.css/, "正式頁面不得額外載入 shell CSS");
  assert.match(html, /<link rel="stylesheet" href="\.\/app\.css\?v=[^"]+">/);
  assert.match(html, /<div class="toolbar-grid" id="toolbarGrid" hidden>/);
});

test("shell CSS 應納入正式 app.css 建置來源與重複稽核", () => {
  const source = read("src/renderer/css/app-shell.css");
  const buildScript = read("scripts/build-css.js");
  const auditScript = read("scripts/audit-css-duplicates.js");
  assert.equal(fs.existsSync(path.join(root, "src/renderer/app-shell.css")), false);
  assert.equal(fs.existsSync(path.join(root, "docs/app-shell.css")), false);
  assert.match(buildScript, /\["app-shell\.css", "Renderer shell styles"\]/);
  assert.match(auditScript, /"app-shell\.css"/);
  assert.match(source, /\.core-actions-menu-trigger\s*\{/);
  assert.match(source, /\.permission-group-summary-row\s*\{/);
  assert.match(source, /\.attendance-review-filters\s*\{/);
});
