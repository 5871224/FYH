const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('越文模式載入並套用 Be Vietnam Pro', () => {
  const foundation = fs.readFileSync('src/renderer/css/foundation.css', 'utf8');
  const index = fs.readFileSync('src/renderer/index.html', 'utf8');

  assert.match(index, /fonts\.googleapis\.com\/css2\?family=Be\+Vietnam\+Pro:wght@400;500;600;700;800&display=swap/);
  assert.match(index, /fonts\.gstatic\.com/);
  assert.match(foundation, /html\[lang="vi"\] body,[\s\S]*font-family: "Be Vietnam Pro", "Segoe UI", Arial, sans-serif;/);
  assert.match(foundation, /html,\s*body \{[\s\S]*font-family: "Microsoft JhengHei UI", "PingFang TC", sans-serif;/);
});

test('發布版保留越文字體設定', () => {
  const css = fs.readFileSync('docs/app.css', 'utf8');
  const index = fs.readFileSync('docs/index.html', 'utf8');
  assert.match(css, /html\[lang="vi"\] body,[\s\S]*font-family: "Be Vietnam Pro"/);
  assert.match(index, /family=Be\+Vietnam\+Pro/);
});
