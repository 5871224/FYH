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
  for (const oldName of ["attendance-overtime-admin-list", "attendance-admin-list-v2", "personal-records-v2"]) {
    assert.equal(api.includes(oldName), false, `仍有舊 API：${oldName}`);
  }
});

test("舊出勤 Edge Function 原始碼已移除", () => {
  for (const folder of ["attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2"]) {
    assert.equal(fs.existsSync(path.join(root, "supabase", "functions", folder)), false, `仍有舊函式：${folder}`);
  }
});
