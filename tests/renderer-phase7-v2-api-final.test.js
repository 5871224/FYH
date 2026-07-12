const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("V2 資料 API 應完成正式化並隔離平板 Session 相容層", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const webApi = fs.readFileSync(path.join(rendererDir, "web-api.js"), "utf8");
  const tabletSession = fs.readFileSync(path.join(rendererDir, "v2-tablet-session.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");

  assert.equal(fs.existsSync(path.join(rendererDir, "v2-api.js")), false);
  assert.equal(build.includes("v2-api.js"), false);
  assert.equal(build.includes("v2-tablet-session.js"), true);

  [
    "async function getEmployeeOvertimeDates",
    "async function getAttendanceOvertimeForDate",
    "async function saveMemberOrder",
    "function applyMemberOrder",
    "async function loadState"
  ].forEach((marker) => assert.equal(webApi.includes(marker), true, `web-api 缺少：${marker}`));

  assert.equal(tabletSession.includes("api.loadState ="), false);
  assert.equal(tabletSession.includes("api.getEmployeeOvertimeDates ="), false);
  assert.equal(tabletSession.includes("api.saveMemberOrder ="), false);
  assert.equal(tabletSession.includes("sessionStorage"), true);
  assert.equal(tabletSession.includes("30 * 60 * 1000"), true);
});
