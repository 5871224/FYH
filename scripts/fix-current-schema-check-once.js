const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const file = path.join(root, "scripts", "check-v2-final.js");
let source = fs.readFileSync(file, "utf8");
const marker = 'const databaseUpdates = read("supabase/002_current_updates.sql");';
if (!source.includes('const currentSchema = read("supabase/001_current_schema.sql");')) {
  if (!source.includes(marker)) throw new Error("找不到資料庫更新變數");
  source = source.replace(marker, 'const currentSchema = read("supabase/001_current_schema.sql");\n' + marker);
}
fs.writeFileSync(file, source, "utf8");
for (const relative of [
  "remove-is-active-final-report.txt",
  ".github/workflows/report-remove-is-active-validation.yml"
]) {
  const target = path.join(root, relative);
  if (fs.existsSync(target)) fs.rmSync(target);
}
console.log("current schema check fixed");
