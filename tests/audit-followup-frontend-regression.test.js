const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("toolbar quick edit keeps shift and leave permissions separate", () => {
  const source = read("src/renderer/renderer-events-click.js");
  assert.match(source, /type === "shift" && !canEditSchedule\(\)/);
  assert.match(source, /requireCurrentGroupUiPermission\("schedule_manage", "修改班別"\)/);
  assert.match(source, /type === "leave" && !hasCommonPermission\("leave_settings"\)/);
  assert.match(source, /requireCommonUiPermission\("leave_settings", "修改假別"\)/);
  assert.doesNotMatch(source, /修改\$\{type === "shift" \? "班別" : "假別"\}/);
});

test("schedule group selector and archive banner are canonical static markup", () => {
  const html = read("src/renderer/index.html");
  const source = read("src/renderer/renderer-groups-permissions-archive.js");
  assert.match(html, /<select id="scheduleGroupSelect" aria-label="群組" hidden><\/select>/);
  assert.match(html, /<div class="schedule-archive-banner" id="scheduleArchiveBanner" role="status" hidden><\/div>/);
  assert.match(source, /function renderGroupSelector\(\)/);
  assert.match(source, /banner\.hidden = !archivedVisible/);
  assert.doesNotMatch(source, /ensureGroupSelector/);
  assert.doesNotMatch(source, /insertAdjacentElement/);
  assert.doesNotMatch(source, /document\.createElement\("select"\)/);
  assert.doesNotMatch(source, /scheduleArchiveBanner"\);\s*banner\?\.remove/);
});
