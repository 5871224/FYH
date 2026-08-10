const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('個人記錄上下班打卡按鈕置中左右併排並加高', () => {
  const css = fs.readFileSync('src/renderer/css/pages.css', 'utf8');
  const view = fs.readFileSync('src/renderer/renderer-records-views.js', 'utf8');

  assert.match(view, /<div class="attendance-clock-buttons">[\s\S]*data-personal-clock-action="clock_in"[\s\S]*data-personal-clock-action="clock_out"[\s\S]*<\/div>/);
  assert.match(css, /\.attendance-ledger-table \.attendance-clock-buttons \{[\s\S]*display: flex;[\s\S]*flex-direction: row;[\s\S]*flex-wrap: nowrap;[\s\S]*justify-content: center;/);
  assert.match(css, /\.attendance-ledger-table \.attendance-clock-buttons \.compact-btn \{[\s\S]*min-width: 76px;[\s\S]*min-height: 48px !important;/);
  assert.match(css, /\.attendance-ledger-table \.personal-record-clock-col \{\s*width: 176px;/);
});

test('發布版保留個人記錄打卡按鈕版面', () => {
  for (const file of ['src/renderer/app.css', 'docs/app.css']) {
    const css = fs.readFileSync(file, 'utf8');
    assert.match(css, /\.attendance-ledger-table \.attendance-clock-buttons \{[\s\S]*justify-content: center;/);
    assert.match(css, /\.attendance-ledger-table \.attendance-clock-buttons \.compact-btn \{[\s\S]*min-height: 48px !important;/);
    assert.match(css, /\.attendance-ledger-table \.personal-record-clock-col \{\s*width: 176px;/);
  }
});
