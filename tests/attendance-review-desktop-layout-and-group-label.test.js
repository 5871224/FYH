const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核桌面版六個篩選欄位同列且清單員工名稱帶群組前綴", () => {
  // 版面 CSS 已由 index.html 抽離，測試正式樣式來源而不是依賴內嵌 <style>。
  const shellCss = read("src/renderer/app-shell.css");
  const edge = read("supabase/functions/attendance-review-groups/index.ts");

  assert.match(shellCss, /@media \(min-width: 981px\)[\s\S]*?\.attendance-review-filters\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(shellCss, /\.attendance-review-table \.attendance-review-employee-col\s*\{[\s\S]*?width:\s*112px/);
  assert.match(edge, /const groupName = current\?\.group_name_snapshot \|\| groupNames\.get\(member\.group_id\) \|\| "";/);
  assert.match(edge, /employee_name:\s*exportOnly[\s\S]*?\? \(member\.full_name \|\| ""\)[\s\S]*?: \[groupName, member\.full_name \|\| ""\]\.filter\(Boolean\)\.join\("-"\)/);
});
