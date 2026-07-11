const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "scripts", "check-v2-final.js");
let source = fs.readFileSync(file, "utf8");
const oldLine = 'assert(!databaseUpdates.includes("block_direct_member_deactivation_v2"), "人員停用 trigger 尚未移除");';
const newLines = [
  'assert(!databaseUpdates.includes("create or replace function public.block_direct_member_deactivation_v2"), "人員停用函式仍會被建立");',
  'assert(!databaseUpdates.includes("create trigger block_direct_member_deactivation_v2"), "人員停用 trigger 仍會被建立");',
  'assert(databaseUpdates.includes("drop trigger if exists block_direct_member_deactivation_v2") && databaseUpdates.includes("drop function if exists public.block_direct_member_deactivation_v2"), "人員停用 trigger 清理 migration 缺失");'
].join("\n");
if (!source.includes(oldLine)) throw new Error("找不到停用 trigger 驗證");
source = source.replace(oldLine, newLines);
fs.writeFileSync(file, source, "utf8");

for (const relative of [
  "remove-employee-is-active-validation.txt",
  ".github/workflows/validate-remove-employee-is-active-once.yml"
]) {
  const target = path.join(root, relative);
  if (fs.existsSync(target)) fs.rmSync(target);
}

console.log("employee is_active checks fixed");
