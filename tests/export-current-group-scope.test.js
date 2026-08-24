const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表四項匯出只使用目前選取群組", () => {
  const index = read("src/renderer/index.html");

  assert.match(index, /const getSelectedScheduleGroupId = \(\) => String\(/);
  assert.match(index, /const getCurrentGroupExportMembers = \(\) => \{[\s\S]*member\.groupId === groupId/);
  assert.match(index, /const filterExportRowsToCurrentGroup = \(rows\) => \{[\s\S]*row\?\.member_id/);
  assert.match(index, /window\.runPeriodExport = async \(type\) => \{[\s\S]*filterExportRowsToCurrentGroup\([\s\S]*loadScheduleExportRows/);
  assert.match(index, /const buildScheduleRows = async \(startDate, endDate\) => \{[\s\S]*const members = getCurrentGroupExportMembers\(\)/);
  assert.match(index, /for \(const member of members\)/);
});

test("正式發布 index 與 renderer index 保持一致", () => {
  assert.equal(read("docs/index.html"), read("src/renderer/index.html"));
});
