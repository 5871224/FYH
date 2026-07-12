const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定目前已生效的規則：下班完成後不自動詢問，員工仍可手動申請。
const root = path.resolve(__dirname, "..");

test("下班打卡後不應自動彈出加班建議", async () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const start = renderer.indexOf("async function maybePromptOvertimeAfterClockOut");
  const end = renderer.indexOf("async function submitAttendanceClock", start);
  const source = renderer.slice(start, end);
  const api = vm.runInNewContext(source + "\n;({ maybePromptOvertimeAfterClockOut })");
  assert.equal(await api.maybePromptOvertimeAfterClockOut({ eligibility: { eligible: true, earlyHours: 2, lateHours: 2 } }), false);
  assert.equal(source.includes("confirmAction"), false);
});

test("取消加班建議應由正式函式提供而非後載入覆蓋", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-no-overtime-suggestion.js")), false);
  assert.equal(build.includes("v2-no-overtime-suggestion.js"), false);
  assert.equal((renderer.match(/async function maybePromptOvertimeAfterClockOut/g) || []).length, 1);
  assert.equal(renderer.includes("maybePromptOvertimeAfterClockOut = async function"), false);
});
