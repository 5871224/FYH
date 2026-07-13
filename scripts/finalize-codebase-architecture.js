const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
const write = (file, content) => fs.writeFileSync(path.join(root, file), `${content.trimEnd()}\n`, "utf8");

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到正式化位置：${label}`);
  return source.replace(from, to);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// 1. 正式化 renderer 檢查腳本名稱。
const renamePairs = [
  ["scripts/check-v2-alignment.js", "scripts/check-renderer-alignment.js"],
  ["scripts/check-v2-final.js", "scripts/check-renderer-contracts.js"]
];
for (const [from, to] of renamePairs) {
  const fromPath = path.join(root, from);
  const toPath = path.join(root, to);
  if (!fs.existsSync(fromPath)) throw new Error(`找不到待重新命名檔案：${from}`);
  if (fs.existsSync(toPath)) throw new Error(`正式檔案已存在：${to}`);
  fs.renameSync(fromPath, toPath);
}

// 2. 測試檔名移除歷史 phase / v2 階段標記。
const testsDir = path.join(root, "tests");
const testRenames = [];
for (const name of fs.readdirSync(testsDir).filter((file) => file.endsWith(".test.js"))) {
  let next = name
    .replace(/^renderer-phase\d+-/, "renderer-")
    .replace(/^renderer-v2-/, "renderer-")
    .replace(/^v2-/, "renderer-")
    .replace(/-phase\d+-/g, "-")
    .replace(/-v2-/g, "-");
  if (next === name) continue;
  const fromPath = path.join(testsDir, name);
  const toPath = path.join(testsDir, next);
  if (fs.existsSync(toPath)) throw new Error(`測試重新命名衝突：${name} -> ${next}`);
  fs.renameSync(fromPath, toPath);
  testRenames.push([name, next]);
}

// 3. 更新檔案引用與正式名稱。
const textExtensions = new Set([".js", ".json", ".yml", ".yaml", ".md"]);
const textFiles = walk(root).filter((file) => {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative.startsWith(".git/") || relative.startsWith("node_modules/")) return false;
  if (["src/renderer/app.js", "docs/app.js"].includes(relative)) return false;
  return textExtensions.has(path.extname(file));
});
const replacements = [
  ["check-v2-alignment.js", "check-renderer-alignment.js"],
  ["check-v2-final.js", "check-renderer-contracts.js"],
  ["v2:check", "renderer:check"],
  ["Check V2 bundles", "Check renderer bundles"],
  ["V2 bundles", "renderer bundles"],
  ["V2 bundle", "renderer bundle"],
  ["V2 alignment", "renderer alignment"],
  ["V2 final", "renderer contracts"]
];
for (const file of textFiles) {
  let source = fs.readFileSync(file, "utf8");
  const original = source;
  for (const [from, to] of replacements) source = source.split(from).join(to);
  for (const [from, to] of testRenames) source = source.split(from).join(to);
  if (source !== original) fs.writeFileSync(file, source, "utf8");
}

// 4. package.json 改用正式 renderer 檢查名稱。
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const oldRendererCheck = packageJson.scripts["renderer:check"] || packageJson.scripts["v2:check"];
if (!oldRendererCheck) throw new Error("找不到 renderer bundle 檢查命令");
packageJson.scripts["renderer:check"] = oldRendererCheck
  .replaceAll("check-v2-alignment.js", "check-renderer-alignment.js")
  .replaceAll("check-v2-final.js", "check-renderer-contracts.js");
delete packageJson.scripts["v2:check"];
packageJson.scripts["ci:check"] = packageJson.scripts["ci:check"].replaceAll("npm run v2:check", "npm run renderer:check");
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

// 5. 正式化 bundle 建置說明與動態載入檢查。
let build = read("scripts/build-js.js");
build = mustReplace(build,
  "// 第一階段先保留既有執行順序與全域相依性；後續再逐步轉為 ES Modules。",
  "// 正式 bundle 依宣告順序載入全域與獨立模組，並驗證來源清單完整性。",
  "bundle 建置說明"
);
build = mustReplace(build,
  "    || /data-v2-module/.test(content)\n",
  "",
  "舊版動態模組標記"
);
build = mustReplace(build,
  " * This transitional bundle preserves the legacy global execution order.",
  " * This generated bundle preserves the declared module execution order.",
  "bundle 檔頭說明"
);
write("scripts/build-js.js", build);

let dateUtils = read("src/renderer/renderer-date-utils.js");
dateUtils = dateUtils.replace(
  "/* 班表日期、週期、時間與區間工具\n * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。\n */",
  "/* 班表日期、週期、時間與區間工具。\n * 由正式 bundle 依宣告順序載入。\n */"
);
dateUtils = dateUtils.replaceAll("// ponytail:", "//");
write("src/renderer/renderer-date-utils.js", dateUtils);

let webApi = read("src/renderer/web-api.js");
webApi = webApi.replaceAll("// ponytail:", "//");
write("src/renderer/web-api.js", webApi);

// 6. JavaScript 稽核只把共享全域模組互相比較；獨立 IIFE 保留自己的私有工具。
let audit = read("scripts/audit-js-duplicates.js");
audit = mustReplace(audit,
  "const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(rendererDir, file), \"utf8\")]));\nconst functions = files.flatMap((file) => extractFunctions(sources.get(file), file));",
  `const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(rendererDir, file), "utf8")]));
const isolatedModules = new Set(["browser-exporter.js", "rest-compliance.js", "web-api.js", "renderer-period-exports.js"]);
const sharedFiles = files.filter((file) => !isolatedModules.has(file));
const functions = files.flatMap((file) => extractFunctions(sources.get(file), file));
const sharedFunctions = functions.filter((fn) => !isolatedModules.has(fn.file));`,
  "稽核模組範圍"
);
audit = mustReplace(audit,
  "const duplicateNames = [...functions.reduce((map, fn) => {",
  "const duplicateNames = [...sharedFunctions.reduce((map, fn) => {",
  "共享函式同名稽核"
);
audit = mustReplace(audit,
  "const exactBodies = [...functions.reduce((map, fn) => {",
  "const exactBodies = [...sharedFunctions.reduce((map, fn) => {",
  "共享函式內容稽核"
);
audit = mustReplace(audit,
  "for (const file of files) {\n  const rawLines = stripComments(sources.get(file)).split(\"\\n\");",
  "for (const file of sharedFiles) {\n  const rawLines = stripComments(sources.get(file)).split(\"\\n\");",
  "共享重複區塊稽核"
);
audit = mustReplace(audit,
  "const legacyPattern = /\\b(v2|legacy|deprecated|compat(?:ibility)?|patch|oldVersion|old[A-Z]\\w*)\\b|補丁|舊版|相容層/gi;",
  "const legacyPattern = /\\b(legacy|deprecated|compat(?:ibility)?|patch|oldVersion)\\b|補丁|舊版|相容層/gi;",
  "舊版標記誤判"
);
audit = mustReplace(audit,
  "  if (assignmentOverrides.length) {",
  `  if (duplicateNames.length) {
    console.error(\`Found \${duplicateNames.length} duplicate shared function name group(s).\`);
    process.exitCode = 1;
  }
  if (exactBodies.length) {
    console.error(\`Found \${exactBodies.length} duplicate shared function body group(s).\`);
    process.exitCode = 1;
  }
  if (assignmentOverrides.length) {`,
  "共享函式重複阻擋"
);
write("scripts/audit-js-duplicates.js", audit);

// 7. 正式化檢查腳本輸出文字，但保留後端函式 endpoint 的 -v2 契約名稱。
for (const file of ["scripts/check-renderer-alignment.js", "scripts/check-renderer-contracts.js"]) {
  let source = read(file);
  source = source
    .replaceAll("V2", "renderer")
    .replaceAll("v2 UI", "正式 UI")
    .replaceAll("v2 module", "renderer module")
    .replaceAll("v2 JavaScript", "renderer JavaScript");
  write(file, source);
}

// 8. 新增最終架構測試。
const finalTest = `const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("正式檢查與 workflow 不再使用 V2 階段命名", () => {
  const packageJson = JSON.parse(read("package.json"));
  const workflow = read(".github/workflows/deploy-pages.yml");
  assert.equal(typeof packageJson.scripts["renderer:check"], "string");
  assert.equal(packageJson.scripts["v2:check"], undefined);
  assert.match(packageJson.scripts["renderer:check"], /check-renderer-alignment\\.js/);
  assert.match(packageJson.scripts["renderer:check"], /check-renderer-contracts\\.js/);
  assert.doesNotMatch(workflow, /V2|v2:check/);
  assert.equal(fs.existsSync(path.join(root, "scripts/check-v2-alignment.js")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts/check-v2-final.js")), false);
});

test("測試檔名不再保留 phase 或 v2 階段名稱", () => {
  const invalid = fs.readdirSync(path.join(root, "tests"))
    .filter((name) => /phase\\d+|(?:^|-)v2(?:-|\\.)/i.test(name));
  assert.deepEqual(invalid, []);
});

test("bundle 說明不再標示過渡或 legacy 執行模式", () => {
  const build = read("scripts/build-js.js");
  assert.doesNotMatch(build, /第一階段|transitional bundle|legacy global|data-v2-module/);
  assert.match(build, /declared module execution order/);
});

test("JavaScript 架構檢查阻擋共享模組重複函式", () => {
  const audit = read("scripts/audit-js-duplicates.js");
  assert.match(audit, /isolatedModules/);
  assert.match(audit, /duplicate shared function name group/);
  assert.match(audit, /duplicate shared function body group/);
  childProcess.execFileSync(process.execPath, ["scripts/audit-js-duplicates.js", "--check"], { cwd: root, stdio: "pipe" });
});
`;
write("tests/codebase-architecture-finalization.test.js", finalTest);

let spec = read("規格書.md");
if (!spec.includes("### 程式庫正式命名與模組邊界")) {
  spec += `\n\n### 程式庫正式命名與模組邊界\n\n- 前端正式檢查統一使用 ` + "`renderer:check`" + `、` + "`check-renderer-alignment.js`" + ` 與 ` + "`check-renderer-contracts.js`" + `，不得再使用階段性的 V2 檢查名稱。\n- 測試檔名不得保留 ` + "`phaseN`" + ` 或 ` + "`v2`" + ` 階段名稱。\n- ` + "`browser-exporter.js`" + `、` + "`rest-compliance.js`" + `、` + "`web-api.js`" + ` 與 ` + "`renderer-period-exports.js`" + ` 為獨立 IIFE；其私有工具可與共享 renderer 工具同名，但不得以全域覆蓋方式安裝。\n- 共享 renderer 模組不得存在同名函式或完全相同函式內容；正式 CI 由 JavaScript 架構稽核阻擋。\n- 後端函式 endpoint 名稱中的 ` + "`-v2`" + ` 屬目前 API 契約，除非同步遷移後端，前端不得自行更名。\n`;
}
write("規格書.md", spec);

console.log(JSON.stringify({ testRenames }, null, 2));
console.log("Codebase architecture finalized.");
