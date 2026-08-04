const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首頁與簽到簿使用新導覽", () => {
  const home = read("src/renderer/renderer-main-pages.js");
  const shell = read("src/renderer/renderer-app-shell.js");
  assert.equal(home.includes('data-home-action="clock"'), false);
  assert.equal(home.includes("簽到簿"), true);
  assert.equal(shell.includes("renderClockPage"), false);
});

test("個人記錄與簽到審核欄位完整", () => {
  const views = read("src/renderer/renderer-records-views.js");
  for (const label of ["日期", "圖示", "班別", "打卡時間", "上班時數", "加班時數", "備註", "訂餐", "審核", "異常", "狀態", "操作"]) {
    assert.equal(views.includes(label), true, `缺少欄位：${label}`);
  }
  assert.equal(views.includes("簽到審核"), true);
  assert.equal(views.includes("批次審核"), true);
  assert.equal(views.includes("批次退回"), true);
});

test("前端只呼叫統一 attendance-ledger API", () => {
  const api = read("src/renderer/web-api.js");
  assert.equal(api.includes('requestFunction("attendance-ledger"'), true);
  assert.equal(api.includes('requestFunction("attendance-ledger-export"'), true);
  for (const oldName of ["attendance-overtime-admin-list", "attendance-admin-list-v2", "personal-records-v2"]) {
    assert.equal(api.includes(oldName), false, `仍有舊 API：${oldName}`);
  }
});

test("每日簽到與訂餐後端只使用新資料模型", () => {
  const clock = read("supabase/functions/attendance-clock/index.ts");
  const ledger = read("supabase/functions/attendance-ledger/index.ts");
  const exportApi = read("supabase/functions/attendance-ledger-export/index.ts");
  const meal = read("supabase/functions/meal-order/index.ts");
  for (const source of [clock, ledger, exportApi, meal]) {
    assert.equal(source.includes("attendance_records"), false);
  }
  assert.equal(clock.includes('.from("attendance_days")'), true);
  assert.equal(ledger.includes('.from("attendance_days")'), true);
  assert.equal(ledger.includes('.from("attendance_audit_logs")'), true);
  assert.equal(exportApi.includes('.from("attendance_days")'), true);
  assert.equal(meal.includes('.from("attendance_days")'), true);
  assert.equal(meal.includes("clock_in_location?.departmentId"), true);
});

test("Edge Function 部署清單只包含新簽到端點", () => {
  const deploy = read("scripts/deploy-edge-functions.ps1");
  for (const name of ["attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order"]) {
    assert.equal(deploy.includes(`"${name}"`), true, `部署清單缺少：${name}`);
  }
  for (const oldName of ["attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2"]) {
    assert.equal(deploy.includes(oldName), false, `部署清單仍有舊端點：${oldName}`);
  }
});

test("舊出勤 Edge Function 原始碼已移除", () => {
  for (const folder of ["attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2"]) {
    assert.equal(fs.existsSync(path.join(root, "supabase", "functions", folder)), false, `仍有舊函式：${folder}`);
  }
});
