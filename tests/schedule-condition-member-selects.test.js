const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("排班條件人員改為逐一追加且不可重複的下拉選單", () => {
  const source = read("src/renderer/renderer-schedule-conditions.js");
  const events = read("src/renderer/renderer-events-form.js");
  const spec = read("規格書.md");

  assert.doesNotMatch(source, /data-schedule-condition-member="/);
  assert.match(source, /function renderScheduleConditionMemberSelects\(selectedIds = \[\]\)/);
  assert.match(source, /if \(!values\.length \|\| values\.length < members\.length\) values\.push\(""\)/);
  assert.match(source, /member\.id === value \|\| !selectedSet\.has\(member\.id\)/);
  assert.match(source, /data-schedule-condition-member-selects/);
  assert.match(source, /const memberIds = getSelectedScheduleConditionMemberIds\(\)/);
  assert.match(events, /target\.matches\("\[data-schedule-condition-member-select\]"\)[\s\S]*?refreshScheduleConditionMemberSelects\(\)/);
  assert.match(spec, /人員欄改用逐一追加的下拉選單/);
});
