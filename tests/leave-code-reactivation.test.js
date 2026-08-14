const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("新增已停用假別代碼時由後端恢復原 ID 並覆寫新資料", () => {
  const repository = read("src/backend/repositories/native-master-data-repository.js");
  assert.match(repository, /async function saveCatalogItem\(/);
  assert.match(repository, /where code = \$1\s+for update/);
  assert.match(repository, /if \(!existingByCode\.deleted_at \|\| inputById\?\.id\)/);
  assert.match(repository, /targetId = String\(existingByCode\.id\)/);
  assert.match(repository, /restored = true/);
  assert.match(repository, /deleted_at = null/);
  assert.match(repository, /return \{ ok: true, id: String\(row\.id\), category, restored \}/);
});

test("啟用中的相同假別代碼仍然拒絕重複新增", () => {
  const repository = read("src/backend/repositories/native-master-data-repository.js");
  assert.match(repository, /LEAVE_CODE_DUPLICATE/);
  assert.match(repository, /假別代碼已存在/);
  const settings = read("src/renderer/renderer-settings-catalog.js");
  assert.match(settings, /!item\.deleted/);
  assert.match(settings, /假別代碼 \$\{selectedLeave\.code\} 已存在/);
});

test("恢復停用假別後前端必須採用後端回傳的原 ID", () => {
  const settings = read("src/renderer/renderer-settings-catalog.js");
  const published = read("docs/app.js");
  for (const source of [settings, published]) {
    assert.match(source, /const result = await window\.schedulerApi\.saveCatalogItem/);
    assert.match(source, /const persistedId = String\(result\?\.id \|\| ""\)\.trim\(\)/);
    assert.match(source, /savedItem = \{ \.\.\.payload, id: persistedId \}/);
    assert.match(source, /\[\.\.\.currentList, savedItem\]/);
  }
});
