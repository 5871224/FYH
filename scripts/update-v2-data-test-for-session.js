const fs = require("node:fs");

const file = "tests/renderer-phase7-v2-api-data.test.js";
let source = fs.readFileSync(file, "utf8");
const before = `test("資料 API 應由正式 web-api 提供，平板相容層不得改寫資料方法", () => {
  const source = readWebApi();
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const tablet = fs.readFileSync(path.join(root, "src", "renderer", "v2-tablet-session.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-api.js")), false);
  assert.equal(build.includes("v2-api.js"), false);
  assert.equal(build.includes("v2-tablet-session.js"), true);
  assert.equal(tablet.includes("api.loadState ="), false);
  assert.equal(tablet.includes("api.getEmployeeOvertimeDates ="), false);
  assert.equal(source.includes("async function getEmployeeOvertimeDates"), true);
  assert.equal(source.includes("async function saveMemberOrder"), true);
});`;
const after = `test("資料 API 應由正式 web-api 提供且不再依賴 V2 相容層", () => {
  const source = readWebApi();
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-api.js")), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-tablet-session.js")), false);
  assert.equal(build.includes("v2-api.js"), false);
  assert.equal(build.includes("v2-tablet-session.js"), false);
  assert.equal(source.includes("async function getEmployeeOvertimeDates"), true);
  assert.equal(source.includes("async function saveMemberOrder"), true);
});`;
if (!source.includes(before)) {
  throw new Error("找不到待更新的 V2 資料 API 測試");
}
source = source.replace(before, after);
fs.writeFileSync(file, source);
console.log("V2 data API test updated for canonical tablet session");
