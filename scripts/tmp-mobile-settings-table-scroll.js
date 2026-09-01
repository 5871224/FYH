const fs = require('node:fs');

const responsivePath = 'src/renderer/css/responsive.css';
let css = fs.readFileSync(responsivePath, 'utf8');

const oldBlock = `  /* 假別與加班設定在手機保留可讀欄寬，由既有設定表格容器提供水平捲動。 */
  .catalog-settings-modal .settings-table-row-leave {
    min-width: 720px;
  }

  .catalog-settings-modal .settings-table-row-overtime {
    min-width: 840px;
  }
`;

const newBlock = `  /* 手機版設定表格維持可讀欄寬，超出畫面時由表格容器水平捲動，不再硬塞進單一螢幕。 */
  .department-settings-modal .department-settings-table-wrap,
  .member-settings-modal .member-table-scroll,
  .catalog-settings-modal .settings-table-scroll {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }

  .department-settings-modal .department-settings-table-department,
  .department-settings-modal .department-settings-table-department .department-settings-row {
    min-width: 900px;
  }

  .member-settings-modal .member-table,
  .member-settings-modal .member-table-row {
    min-width: 980px;
  }

  .catalog-settings-modal .settings-table-row-shift {
    min-width: 920px;
  }

  .catalog-settings-modal .settings-table-row-leave {
    min-width: 760px;
  }

  .catalog-settings-modal .settings-table-row-overtime {
    min-width: 840px;
  }
`;

if (!css.includes(oldBlock)) {
  throw new Error('mobile catalog width block not found');
}
css = css.replace(oldBlock, newBlock);
fs.writeFileSync(responsivePath, css, 'utf8');

const testPath = 'tests/settings-mobile-table-scroll.test.js';
fs.writeFileSync(testPath, `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("src/renderer/css/responsive.css", "utf8");

test("mobile settings tables keep readable width and scroll horizontally", () => {
  assert.match(css, /@media \\(max-width: 640px\\)[\\s\\S]*department-settings-table-department[\\s\\S]*min-width: 900px/);
  assert.match(css, /member-settings-modal \\.member-table[\\s\\S]*min-width: 980px/);
  assert.match(css, /settings-table-row-shift[\\s\\S]*min-width: 920px/);
  assert.match(css, /settings-table-row-leave[\\s\\S]*min-width: 760px/);
  assert.match(css, /member-table-scroll[\\s\\S]*overflow-x: auto/);
});
`, 'utf8');
