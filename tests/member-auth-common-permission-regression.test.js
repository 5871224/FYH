const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../supabase/functions/member-auth-admin/index.ts"),
  "utf8"
);

test("最後管理員計數使用 common_permissions", () => {
  assert.match(source, /select\("id,common_permissions"\)/);
  assert.match(source, /Array\.isArray\(role\.common_permissions\) && role\.common_permissions\.includes\(SETTINGS_PERMISSION\)/);
  assert.doesNotMatch(source, /Array\.isArray\(role\.permissions\)/);
});
