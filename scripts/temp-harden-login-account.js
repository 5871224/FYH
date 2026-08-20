const fs = require("node:fs");

const file = "src/renderer/web-api.js";
let source = fs.readFileSync(file, "utf8");

const emailStart = source.indexOf("  function buildLocalLoginEmail(employeeCode) {");
const emailEnd = source.indexOf('  ["pointerdown", "keydown", "touchstart"]', emailStart);
if (emailStart < 0 || emailEnd < 0) {
  throw new Error("buildLocalLoginEmail section not found");
}
const strictEmailBlock = [
  "  function buildLocalLoginEmail(employeeCode) {",
  '    const exactCode = String(employeeCode ?? "");',
  '    if (!exactCode || exactCode !== exactCode.trim() || !/^[A-Za-z0-9._-]+$/.test(exactCode)) {',
  '      return "";',
  "    }",
  '    return `${exactCode.toLowerCase()}@local.invalid`;',
  "  }",
  "",
  ""
].join("\n");
source = source.slice(0, emailStart) + strictEmailBlock + source.slice(emailEnd);

const signInStart = source.indexOf("  async function signIn(loginAccount, password) {");
const payloadMarker = '    const payload = await requestJson("/auth/v1/token?grant_type=password", {';
const payloadIndex = source.indexOf(payloadMarker, signInStart);
if (signInStart < 0 || payloadIndex < 0) {
  throw new Error("signIn section not found");
}
const strictSignInPrefix = [
  "  async function signIn(loginAccount, password) {",
  '    const employeeCode = String(loginAccount ?? "");',
  "    const email = buildLocalLoginEmail(employeeCode);",
  "    if (!email) {",
  '      throw new Error("工號格式錯誤");',
  "    }",
  ""
].join("\n");
source = source.slice(0, signInStart) + strictSignInPrefix + source.slice(payloadIndex);

fs.writeFileSync(file, source);
