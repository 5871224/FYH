const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('越文只套用 Be Vietnam Pro 到實際翻譯文字並限制最粗 600', () => {
  const foundation = fs.readFileSync('src/renderer/css/foundation.css', 'utf8');
  const index = fs.readFileSync('src/renderer/index.html', 'utf8');
  const config = fs.readFileSync('src/renderer/app-config.js', 'utf8');

  assert.match(index, /fonts\.googleapis\.com\/css2\?family=Be\+Vietnam\+Pro:wght@400;500;600&display=swap/);
  assert.doesNotMatch(index, /Be\+Vietnam\+Pro:wght@400;500;600;700;800/);
  assert.match(foundation, /html\[lang="vi"\] \.fyh-vi-text \{[\s\S]*font-family: "Be Vietnam Pro"[\s\S]*font-synthesis: none;/);
  assert.doesNotMatch(foundation, /html\[lang="vi"\] body,[\s\S]*font-family: "Be Vietnam Pro"/);
  assert.match(foundation, /html,\s*body \{[\s\S]*font-family: "Microsoft JhengHei UI", "PingFang TC", sans-serif;/);
  assert.ok(config.includes('parent.classList.add("fyh-vi-text")'));
  assert.ok(config.includes('element.classList.add("fyh-vi-placeholder")'));
});

test('發布版保留越文字體範圍設定', () => {
  const css = fs.readFileSync('docs/app.css', 'utf8');
  const index = fs.readFileSync('docs/index.html', 'utf8');
  assert.match(css, /html\[lang="vi"\] \.fyh-vi-text \{[\s\S]*font-family: "Be Vietnam Pro"/);
  assert.doesNotMatch(css, /html\[lang="vi"\] body,[\s\S]*font-family: "Be Vietnam Pro"/);
  assert.match(index, /family=Be\+Vietnam\+Pro:wght@400;500;600&display=swap/);
});
