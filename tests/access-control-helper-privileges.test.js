const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const sql = fs.readFileSync("supabase/migrations/2026090203_access_control_helper_privileges.sql", "utf8");

test("role permission helpers are not executable by browser roles", () => {
  for (const signature of [
    "role_has_common_permission(uuid,text)",
    "role_has_group_permission(uuid,uuid,text)",
    "role_has_any_group_permission(uuid,text)",
  ]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${signature.replace(/[()]/g, "\\$&")} from public,anon,authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to service_role;`));
  }
});

test("RLS user predicates reject anonymous execution but remain available to authenticated policies", () => {
  for (const signature of [
    "has_common_permission(uuid,text)",
    "has_group_permission(uuid,uuid,text)",
    "has_any_group_permission(uuid,text)",
    "has_group_access(uuid,uuid)",
  ]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${signature.replace(/[()]/g, "\\$&")} from public,anon;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to authenticated,service_role;`));
  }
});
