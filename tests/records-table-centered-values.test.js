const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('個人記錄與簽到審核表格資料置中', () => {
  const source = fs.readFileSync('src/renderer/css/pages.css', 'utf8');
  assert.match(source, /\.attendance-ledger-table tbody td,\s*\n\.attendance-review-table tbody td \{\s*\n\s*text-align: center;/);
  assert.match(source, /\.attendance-ledger-table \.attendance-clock-stack \{\s*\n\s*align-items: center;/);
  assert.match(source, /\.attendance-review-table \.attendance-punch-line \{\s*\n\s*justify-content: center;/);
  assert.match(source, /\.attendance-ledger-table \.attendance-note-input \{\s*\n\s*text-align: center;/);
});

test('發布版 CSS 保留簽到簿表格置中規則', () => {
  for (const file of ['src/renderer/app.css', 'docs/app.css']) {
    const css = fs.readFileSync(file, 'utf8');
    assert.match(css, /\.attendance-ledger-table tbody td,\s*\n\.attendance-review-table tbody td/);
    assert.match(css, /\.attendance-review-table \.attendance-punch-line/);
  }
});
