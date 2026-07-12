const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  extractScopeSection,
  matchesAny,
  assessScope,
  getChangedFiles
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
  assert.equal(matchesAny("src/renderer/renderer.js", ["src/renderer/**/*.js"]), true);
  assert.equal(matchesAny("src/renderer/features/member/editor.js", ["src/renderer/**/*.js"]), true);
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

test("Git 修改清單應保留中文檔名而不是引號跳脫碼", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scope-unicode-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: directory });
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: directory });
    execFileSync("git", ["config", "user.email", "scope@example.com"], { cwd: directory });
    fs.writeFileSync(path.join(directory, "README.md"), "base\n");
    execFileSync("git", ["add", "README.md"], { cwd: directory });
    execFileSync("git", ["commit", "-q", "-m", "base"], { cwd: directory });
    const baseSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" }).trim();

    fs.writeFileSync(path.join(directory, "規格書.md"), "規格\n");
    execFileSync("git", ["add", "規格書.md"], { cwd: directory });
    execFileSync("git", ["commit", "-q", "-m", "unicode"], { cwd: directory });
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" }).trim();

    assert.deepEqual(getChangedFiles(baseSha, headSha, directory), ["規格書.md"]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
