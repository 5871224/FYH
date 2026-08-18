const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const groupSource = fs.readFileSync(path.join(__dirname, "../src/renderer/renderer-groups-permissions-archive.js"), "utf8");
const memberSource = fs.readFileSync(path.join(__dirname, "../src/renderer/renderer-settings-member.js"), "utf8");
const formEventsSource = fs.readFileSync(path.join(__dirname, "../src/renderer/renderer-events-form.js"), "utf8");

test("修改人員頁班別依勾選順序顯示並從 1 連號", () => {
  assert.ok(groupSource.includes('...orderedSelectedIds.map((shiftId) => shiftById.get(shiftId)).filter(Boolean)'));
  assert.ok(groupSource.includes('[shiftId, index + 1]'));
  assert.ok(groupSource.includes('${checked ? rank : "-"}'));
});

test("新勾選班別接在目前已勾選班別最後", () => {
  assert.ok(memberSource.includes('function moveChangedScheduleShiftOptionToSelectionOrder(input)'));
  assert.ok(memberSource.includes('lastChecked.after(row)'));
  assert.ok(memberSource.includes('let rank = 1;'));
  assert.ok(formEventsSource.includes('moveChangedScheduleShiftOptionToSelectionOrder(target);'));
});
