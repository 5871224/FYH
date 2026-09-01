const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const config = fs.readFileSync(path.join(root, "src/renderer/app-config.js"), "utf8");

test("語系切換初始化需要的正式 helper 必須完整存在", () => {
  assert.match(config, /function installApiIntegration\(\)/);
  assert.match(config, /async function saveLabel\(/);
  assert.match(config, /function ensureLanguageControl\(\)/);
  assert.match(config, /actions\.insertBefore\(shell, passwordButton\)/);
  assert.doesNotMatch(config, /function\s+(?:addLocalizedField|ensureLocalizedFormFields|ensureMealLocalizedColumn)\b/);
});
