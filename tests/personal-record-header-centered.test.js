const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('個人記錄表格欄標題置中', () => {
  const source = fs.readFileSync('src/renderer/css/pages.css', 'utf8');
  assert.match(source, /\.attendance-ledger-table thead th \{\s*\n\s*text-align: center;/);
});

test('發布版 CSS 保留個人記錄表頭置中規則', () => {
  for (const file of ['src/renderer/app.css', 'docs/app.css']) {
    const css = fs.readFileSync(file, 'utf8');
    assert.match(css, /\.attendance-ledger-table thead th \{\s*\n\s*text-align: center;/);
  }
});
