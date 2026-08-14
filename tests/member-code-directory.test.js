const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表與管理人員名錄使用正式 FYH API", () => {
  const webApi = read("src/renderer/web-api.js");
  assert.match(webApi, /request\(`\/api\/v1\/schedule\/bootstrap\$\{qs\(\{documentId\}\)\}`\)/);
  assert.match(webApi, /loadEmployeeAdminDirectory[\s\S]*?request\("\/api\/v1\/members"\)/);
  assert.doesNotMatch(webApi, /callRpc\(|get_scheduler_bootstrap_v3|get_employee_admin_directory_v3|get_schedule_directory_v2|get_employee_admin_directory_v2|get_department_directory_v2/);
});

test("排班儲存只提交 UUID 主鍵，不以工號當外鍵", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function saveScheduleCells");
  const end = webApi.indexOf("async function getGroupAccessBundle", start);
  const block = webApi.slice(start, end);
  assert.ok(start >= 0 && end > start, "缺少正式排班寫入流程");
  assert.match(block, /if\(!isUuid\(memberId\)\|\|!workDate\)throw new Error\("schedule cell member UUID and date are required"\)/);
  assert.match(block, /member_id:memberId/);
  assert.match(block, /saveScheduleEntryRows\(rows\)/);
  const helperStart = webApi.indexOf("async function saveScheduleEntryRows");
  const helperEnd = webApi.indexOf("async function saveScheduleCells", helperStart);
  const helperBlock = webApi.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "缺少正式排班寫入 helper");
  assert.match(helperBlock, /request\("\/api\/v1\/schedule\/entries",\{method:"PUT",body:\{entries\}\}\)/);
  assert.doesNotMatch(block, /employee_code\s*:/);
  assert.doesNotMatch(helperBlock, /callRpc\(|\/rest\/v1\/rpc/);
});
