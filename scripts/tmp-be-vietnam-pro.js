const fs = require('node:fs');

const foundationPath = 'src/renderer/css/foundation.css';
const indexPath = 'src/renderer/index.html';
const testPath = 'tests/vietnamese-font.test.js';

let foundation = fs.readFileSync(foundationPath, 'utf8');
const bodyMarker = `body {\n  min-width: 0;`;
if (!foundation.includes(bodyMarker)) throw new Error('foundation body marker not found');
if (!foundation.includes('html[lang="vi"] body')) {
  foundation = foundation.replace(bodyMarker, `/* 越文模式使用針對越南文字形優化的 Be Vietnam Pro；載入失敗時回退系統字體。 */\nhtml[lang="vi"] body,\nhtml[lang="vi"] button,\nhtml[lang="vi"] input,\nhtml[lang="vi"] select,\nhtml[lang="vi"] textarea {\n  font-family: "Be Vietnam Pro", "Segoe UI", Arial, sans-serif;\n}\n\n${bodyMarker}`);
}
fs.writeFileSync(foundationPath, foundation);

let index = fs.readFileSync(indexPath, 'utf8');
const titleMarker = '  <title>福圓號</title>\n';
if (!index.includes(titleMarker)) throw new Error('index title marker not found');
if (!index.includes('family=Be+Vietnam+Pro')) {
  index = index.replace(titleMarker, `${titleMarker}  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n`);
}
fs.writeFileSync(indexPath, index);

fs.writeFileSync(testPath, `const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\n\ntest('越文模式載入並套用 Be Vietnam Pro', () => {\n  const foundation = fs.readFileSync('src/renderer/css/foundation.css', 'utf8');\n  const index = fs.readFileSync('src/renderer/index.html', 'utf8');\n\n  assert.match(index, /fonts\\.googleapis\\.com\\/css2\\?family=Be\\+Vietnam\\+Pro:wght@400;500;600;700;800&display=swap/);\n  assert.match(index, /fonts\\.gstatic\\.com/);\n  assert.match(foundation, /html\\[lang="vi"\\] body,[\\s\\S]*font-family: "Be Vietnam Pro", "Segoe UI", Arial, sans-serif;/);\n  assert.match(foundation, /html,\\s*body \\{[\\s\\S]*font-family: "Microsoft JhengHei UI", "PingFang TC", sans-serif;/);\n});\n\ntest('發布版保留越文字體設定', () => {\n  const css = fs.readFileSync('docs/app.css', 'utf8');\n  const index = fs.readFileSync('docs/index.html', 'utf8');\n  assert.match(css, /html\\[lang="vi"\\] body,[\\s\\S]*font-family: "Be Vietnam Pro"/);\n  assert.match(index, /family=Be\\+Vietnam\\+Pro/);\n});\n`);
