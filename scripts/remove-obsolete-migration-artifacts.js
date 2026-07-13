const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const obsoleteScripts = [
  "scripts/canonicalize-v2-api-data.js",
  "scripts/fix-v2-api-data-test.js",
  "scripts/fix-v2-tablet-check.js"
];
for (const relative of obsoleteScripts) {
  const filePath = path.join(root, relative);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}

const testRenames = new Map([
  ["renderer-admin-data-fixes.test.js", "renderer-admin-data-contracts.test.js"],
  ["renderer-department-patch.test.js", "renderer-department-settings.test.js"],
  ["renderer-overtime-patches.test.js", "renderer-overtime-contracts.test.js"],
  ["renderer-small-api-overrides.test.js", "renderer-small-api-contracts.test.js"]
]);
const testsDir = path.join(root, "tests");
for (const [from, to] of testRenames) {
  const fromPath = path.join(testsDir, from);
  const toPath = path.join(testsDir, to);
  if (!fs.existsSync(fromPath)) continue;
  if (fs.existsSync(toPath)) throw new Error(`測試檔名衝突：${from} -> ${to}`);
  fs.renameSync(fromPath, toPath);
}

const textFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (![".git", "node_modules"].includes(entry.name)) walk(full);
      continue;
    }
    if (/\.(?:js|json|md|yml|yaml)$/.test(entry.name) && !["src/renderer/app.js", "docs/app.js"].includes(relative)) textFiles.push(full);
  }
}
walk(root);
for (const file of textFiles) {
  let source = fs.readFileSync(file, "utf8");
  const original = source;
  for (const [from, to] of testRenames) source = source.split(from).join(to);
  for (const obsolete of obsoleteScripts) source = source.split(obsolete).join("");
  if (source !== original) fs.writeFileSync(file, source, "utf8");
}

const architectureTestPath = path.join(testsDir, "codebase-architecture-finalization.test.js");
let architectureTest = fs.readFileSync(architectureTestPath, "utf8");
if (!architectureTest.includes("正式目錄不得保留一次性遷移腳本與修補命名")) {
  architectureTest += `

test("正式目錄不得保留一次性遷移腳本與修補命名", () => {
  const obsolete = [
    "scripts/canonicalize-v2-api-data.js",
    "scripts/fix-v2-api-data-test.js",
    "scripts/fix-v2-tablet-check.js"
  ].filter((file) => fs.existsSync(path.join(root, file)));
  assert.deepEqual(obsolete, []);
  const invalidTests = fs.readdirSync(path.join(root, "tests"))
    .filter((name) => /phase\\d+|(?:^|-)v2(?:-|\\.)|patch|overrides|data-fixes/i.test(name));
  assert.deepEqual(invalidTests, []);
});
`;
}
fs.writeFileSync(architectureTestPath, architectureTest, "utf8");

const specPath = path.join(root, "規格書.md");
let spec = fs.readFileSync(specPath, "utf8");
if (!spec.includes("一次性遷移腳本完成後必須刪除")) {
  spec += "\n- 一次性遷移腳本完成後必須刪除；正式 `scripts/` 與 `tests/` 檔名不得保留 phase、V2、patch、overrides 或 data-fixes 階段名稱。\n";
}
fs.writeFileSync(specPath, spec, "utf8");

console.log("Obsolete migration artifacts removed.");
