const fs = require('node:fs');

const cssPath = 'src/renderer/css/pages.css';
const testPath = 'tests/personal-record-clock-buttons-layout.test.js';

let css = fs.readFileSync(cssPath, 'utf8');
const cssBlock = `

/* 越文打卡文字較長：維持既有按鈕高度，僅在越文模式限制寬度並允許兩行。 */
html[lang="vi"] .attendance-ledger-table .attendance-clock-buttons [data-personal-clock-action] {
  width: 96px;
  max-width: 96px;
  white-space: normal !important;
  line-height: 1.2;
  text-align: center;
}
`;
if (!css.includes('html[lang="vi"] .attendance-ledger-table .attendance-clock-buttons [data-personal-clock-action]')) {
  css = css.trimEnd() + cssBlock + '\n';
  fs.writeFileSync(cssPath, css);
}

let testSource = fs.readFileSync(testPath, 'utf8');
const testBlock = `

test('越文上下班打卡按鈕允許兩行顯示', () => {
  const sourceCss = fs.readFileSync('src/renderer/css/pages.css', 'utf8');
  assert.match(sourceCss, /html\\[lang="vi"\\] \\.attendance-ledger-table \\.attendance-clock-buttons \\[data-personal-clock-action\\] \\{[\\s\\S]*width: 96px;[\\s\\S]*max-width: 96px;[\\s\\S]*white-space: normal !important;[\\s\\S]*line-height: 1\\.2;/);

  for (const file of ['src/renderer/app.css', 'docs/app.css']) {
    const publishedCss = fs.readFileSync(file, 'utf8');
    assert.match(publishedCss, /html\\[lang="vi"\\] \\.attendance-ledger-table \\.attendance-clock-buttons \\[data-personal-clock-action\\] \\{[\\s\\S]*white-space: normal !important;/);
  }
});
`;
if (!testSource.includes("越文上下班打卡按鈕允許兩行顯示")) {
  testSource = testSource.trimEnd() + testBlock + '\n';
  fs.writeFileSync(testPath, testSource);
}
