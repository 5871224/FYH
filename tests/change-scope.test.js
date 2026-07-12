const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractScopeSection,
  matchesAny,
  assessScope
} = require("../scripts/check-change-scope.js");

test("可從 PR 說明讀取允許與禁止修改範圍", () => {
  const body = `
## 需求摘要
調整手機版間距。

## 允許修改範圍

\`\`\`text
src/renderer/css/**
- 規格書.md
\`\`\`

## 禁止修改範圍

\`\`\`text
src/renderer/**/*.js
\`\`\`

## 驗收案例
完成。
`;

  assert.deepEqual(extractScopeSection(body, "允許修改範圍"), [
    "src/renderer/css/**",
    "規格書.md"
  ]);
  assert.deepEqual(extractScopeSection(body, "禁止修改範圍"), [
    "src/renderer/**/*.js"
  ]);
});

test("路徑規則支援精確檔案、單層萬用字元與遞迴目錄", () => {
  assert.equal(matchesAny("規格書.md", ["規格書.md"]), true);
  assert.equal(matchesAny("src/renderer/css/pages.css", ["src/renderer/css/**"]), true);
  assert.equal(matchesAny("src/renderer/pages.css", ["src/renderer/*.css"]), true);
  assert.equal(matchesAny("src/renderer/css/pages.css", ["src/renderer/*.css"]), false);
});

test("超出允許範圍或命中禁止範圍時應失敗", () => {
  const result = assessScope({
    allowedPatterns: ["src/renderer/css/**", "規格書.md"],
    forbiddenPatterns: ["src/renderer/css/foundation.css"],
    changedFiles: [
      "src/renderer/css/pages.css",
      "src/renderer/css/foundation.css",
      "src/renderer/renderer.js"
    ]
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.outsideAllowed, ["src/renderer/renderer.js"]);
  assert.deepEqual(result.explicitlyForbidden, ["src/renderer/css/foundation.css"]);
});

test("禁止使用允許整個儲存庫的過度寬泛規則", () => {
  assert.throws(
    () => assessScope({ allowedPatterns: ["**"], changedFiles: ["README.md"] }),
    /過度寬泛/
  );
});
