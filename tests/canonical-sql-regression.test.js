const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/002_current_updates.sql"), "utf8");

test("canonical SQL 不保留已知損壞的 dollar quote 或拼接函式", () => {
  assert.doesNotMatch(sql, /\bas \$\s*\nbegin/i);
  assert.doesNotMatch(sql, /end \$;/i);
  assert.doesNotMatch(sql, /\[0-9\]create or replace function/i);
  assert.doesNotMatch(sql, /\[0-9\]create\s+or\s+replace\s+function/i);
});

test("訂餐設定與越文函式各有完整 canonical 定義", () => {
  assert.match(sql, /create or replace function public\.save_meal_admin_settings[\s\S]*as \$\$[\s\S]*end\n\$\$;/i);
  assert.match(sql, /create or replace function public\.get_vietnamese_labels_v1\(\)[\s\S]*end\n\$\$;/i);
  assert.match(sql, /create or replace function public\.save_vietnamese_label_v1[\s\S]*end\n\$\$;/i);
});

test("canonical 班表匯出使用共用 export 與精確 schedule_view", () => {
  const matches = [...sql.matchAll(/create or replace function public\.get_schedule_export_rows_v2[\s\S]*?end\n\$\$;/gi)];
  assert.ok(matches.length >= 1);
  const block = matches.at(-1)[0];
  assert.match(block, /has_common_permission\([\s\S]*'export'/);
  assert.match(block, /has_group_permission\([\s\S]*schedule\.group_id,'schedule_view'/);
});
