const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const auth = fs.readFileSync("src/renderer/renderer-auth-context.js", "utf8");
const recordsViews = fs.readFileSync("src/renderer/renderer-records-views.js", "utf8");
const recordsPage = fs.readFileSync("src/renderer/renderer-records-page.js", "utf8");
const mealPage = fs.readFileSync("src/renderer/renderer-main-pages.js", "utf8");

test("簽到審核與訂餐管理不會被視為班表管理功能", () => {
  const helper = auth.match(/function hasManagementAccess\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(helper.includes('permission === "schedule_manage"'));
  assert.ok(helper.includes('permission === "department_settings"'));
  assert.ok(!helper.includes('permission !== "schedule_view"'));
  assert.ok(!helper.includes('attendance_review'));
  assert.ok(!helper.includes('meal_admin'));
});

test("簽到審核頁籤只看 attendance_review 群組權限", () => {
  assert.ok(recordsViews.includes('["review", "簽到審核", hasAnyGroupPermission("attendance_review")]'));
  assert.ok(recordsPage.includes('if (!hasAnyGroupPermission("attendance_review")) return false;'));
});

test("訂餐管理畫面與資料只看 meal_admin 群組權限", () => {
  assert.ok(mealPage.includes('const canAdminMeal = hasAnyGroupPermission("meal_admin");'));
  assert.equal((recordsPage.match(/if \(!hasAnyGroupPermission\("meal_admin"\)\) return;/g) || []).length, 2);
});
