const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("新增假別代碼重複時應直接顯示提示", () => {
  const source = read("src/renderer/renderer-settings-catalog.js");
  const published = read("docs/app.js");
  assert.match(source, /const duplicateLeave = Boolean\(selectedLeave\?\.code\) && state\.leaves\.some/);
  assert.match(source, /item\.code === selectedLeave\.code/);
  assert.match(source, /mode !== "edit" \|\| item\.id !== modalContext\.targetId/);
  assert.match(source, /reportValidationError\(`假別代碼 \${selectedLeave\.code} 已存在，請選擇其他假別。`\)/);
  assert.match(published, /假別代碼 \${selectedLeave\.code} 已存在，請選擇其他假別。/);
});
