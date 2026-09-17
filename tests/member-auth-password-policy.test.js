const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("人員 Supabase Auth 預設與重設密碼固定為六碼 000000", () => {
  const edge = read("supabase/functions/member-auth-admin/index.ts");
  assert.match(edge, /const DEFAULT_PASSWORD = "000000";/);
  assert.match(edge, /const password = DEFAULT_PASSWORD;/);
  assert.doesNotMatch(edge, /const password = String\(body\?\.password \|\| DEFAULT_PASSWORD\)/);
});

test("重設密碼六碼文字由正式 Renderer 直接產生，不再由語系層補寫", () => {
  const memberSettings = read("src/renderer/renderer-settings-member.js");
  const groupSettings = read("src/renderer/renderer-groups-permissions-archive.js");
  const config = read("src/renderer/app-config.js");

  assert.match(groupSettings, />重設密碼為 000000<\/button>/);
  assert.doesNotMatch(groupSettings, />重設密碼為 0000<\/button>/);
  assert.match(memberSettings, /密碼重設為 000000 嗎？/);
  assert.match(memberSettings, /密碼已重設為 000000/);
  assert.doesNotMatch(memberSettings, /密碼重設為 0000 嗎？/);
  assert.doesNotMatch(memberSettings, /密碼已重設為 0000(?:[^0]|$)/);

  assert.doesNotMatch(config, /normalizePasswordUiText/);
  assert.doesNotMatch(config, /\.replace\(\/重設密碼為 0000\/g/);
  assert.doesNotMatch(config, /\.replace\(\/密碼已重設為 0000\/g/);
  assert.doesNotMatch(config, /\.replace\(\/密碼重設為 0000\/g/);
});

test("Supabase 密碼長度錯誤與重設提示支援繁中與越文", () => {
  const edge = read("supabase/functions/member-auth-admin/index.ts");
  const config = read("src/renderer/app-config.js");
  assert.match(edge, /Password should be at least 6 characters/i);
  assert.match(edge, /密碼至少需要 6 個字元。/);
  assert.match(config, /重設密碼為 000000/);
  assert.match(config, /Mật khẩu phải có ít nhất 6 ký tự\./);
  assert.match(config, /Đặt lại mật khẩu thành 000000/);
  assert.match(config, /normalizeAuthErrorText/);
});
