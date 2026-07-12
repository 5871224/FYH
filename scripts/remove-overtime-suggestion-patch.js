const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const patchPath = path.join(rendererDir, "v2-no-overtime-suggestion.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const finalCheckPath = path.join(root, "scripts", "check-v2-final.js");
const testPath = path.join(root, "tests", "renderer-phase7-no-overtime-suggestion.test.js");

let renderer = fs.readFileSync(rendererPath, "utf8");
const startMarker = "async function maybePromptOvertimeAfterClockOut(status) {";
const endMarker = "async function submitAttendanceClock(action) {";
const start = renderer.indexOf(startMarker);
const end = renderer.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end <= start) throw new Error("找不到加班自動建議函式區段");
renderer = renderer.slice(0, start)
  + "async function maybePromptOvertimeAfterClockOut() {\n  return false;\n}\n\n"
  + renderer.slice(end);
fs.writeFileSync(rendererPath, renderer);

if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的加班建議補丁");
fs.unlinkSync(patchPath);

let build = fs.readFileSync(buildPath, "utf8");
build = build.replace(/^\s*"v2-no-overtime-suggestion\.js",?\r?\n/m, "");
fs.writeFileSync(buildPath, build);

let finalCheck = fs.readFileSync(finalCheckPath, "utf8");
finalCheck = finalCheck.replace(/^\s*"src\/renderer\/v2-no-overtime-suggestion\.js",?\r?\n/m, "");
finalCheck = finalCheck.replace(
  'const noOvertimeSuggestion = read("src/renderer/v2-no-overtime-suggestion.js");\nassert(noOvertimeSuggestion.includes("return false"), "下班打卡後仍可能自動建議加班");',
  'const overtimePromptSource = sourceRenderer.slice(sourceRenderer.indexOf("async function maybePromptOvertimeAfterClockOut"), sourceRenderer.indexOf("async function submitAttendanceClock"));\nassert(overtimePromptSource.includes("return false") && !overtimePromptSource.includes("confirmAction"), "下班打卡後仍可能自動建議加班");'
);
fs.writeFileSync(finalCheckPath, finalCheck);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("下班打卡後不應自動彈出加班建議", async () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const start = renderer.indexOf("async function maybePromptOvertimeAfterClockOut");
  const end = renderer.indexOf("async function submitAttendanceClock", start);
  const source = renderer.slice(start, end);
  const api = vm.runInNewContext(source + "\\n;({ maybePromptOvertimeAfterClockOut })");
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
`;
fs.writeFileSync(testPath, testSource);
console.log("overtime suggestion patch merged into canonical behavior");
