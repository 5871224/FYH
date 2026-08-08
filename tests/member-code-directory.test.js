const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表與管理人員名錄使用正式權限 RPC", () => {
  const webApi = read("src/renderer/web-api.js");
  const sql = read("supabase/002_current_updates.sql");
  assert.match(webApi, /callRpc\("get_scheduler_bootstrap_v3"/);
  assert.match(webApi, /callRpc\("get_employee_admin_directory_v3"/);
  assert.match(sql, /function public\.get_employee_admin_directory_v3\(\)/i);
  assert.doesNotMatch(webApi, /get_schedule_directory_v2|get_employee_admin_directory_v2|get_department_directory_v2/);
});

test("排班儲存只提交 UUID 主鍵，不以工號當外鍵", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function saveScheduleCells");
  const end = webApi.indexOf("async function reorderSettings", start);
  const block = webApi.slice(start, end);
  assert.match(block, /member_id: profileMemberId/);
  assert.match(block, /saveScheduleEntryRows\(rows\)/);
  const helperStart = webApi.indexOf("async function saveScheduleEntryRows");
  const helperEnd = webApi.indexOf("async function saveScheduleCells", helperStart);
  const helperBlock = webApi.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "缺少正式排班寫入 helper");
  assert.match(helperBlock, /callRpc\(\"save_schedule_entries_v3\"/);
  assert.doesNotMatch(block, /employee_code\s*:/);
});
