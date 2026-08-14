const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROUTES } = require("../src/backend/api-contract");

const source = fs.readFileSync(path.join(__dirname, "../src/backend/native-schedule-extra.js"), "utf8");

test("假日與匯出維持薄 Backend 且不含 Supabase transport", () => {
  for (const marker of ["auth.uid()", "/rest/v1/", "/auth/v1/", "/functions/v1/", "access_token", "refresh_token", "apikey"]) {
    assert.equal(source.includes(marker), false, `不應包含 ${marker}`);
  }
  assert.ok(ROUTES.scheduleHolidaysSave);
  assert.ok(ROUTES.scheduleExportRows);
});

test("假日儲存保留單一 transaction，匯出直接查 PostgreSQL", () => {
  assert.match(source, /saveHolidays[\s\S]*database\.transaction/);
  assert.match(source, /exportRows[\s\S]*database\.query/);
  assert.equal(source.includes("createNativeScheduleExtra"), true);
});
