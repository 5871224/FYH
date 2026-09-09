const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核人員與異常下拉選單只列查詢期間實際資料", () => {
  const edgeFunction = read("supabase/functions/attendance-review-groups/index.ts");
  const spec = read("規格書.md");

  assert.match(edgeFunction, /const availableMemberIds = new Set<string>\(\)/);
  assert.match(edgeFunction, /const availableIssueTypeSet = new Set<string>\(\)/);
  assert.match(edgeFunction, /if \(!current && !schedule\.schedule\) continue;[\s\S]*?availableMemberIds\.add/);
  assert.match(edgeFunction, /const availableMembers = members\.filter/);
  assert.match(edgeFunction, /const availableIssueTypes = ISSUE_TYPES\.filter/);
  assert.match(edgeFunction, /members: availableMembers\.map/);
  assert.match(edgeFunction, /issueTypes: availableIssueTypes/);
  assert.match(edgeFunction, /const effectiveMemberId = memberId && availableMemberIds\.has\(memberId\) \? memberId : ""/);
  assert.match(edgeFunction, /issueType && availableIssueTypeSet\.has\(issueType\) \? issueType : ""/);
  assert.match(spec, /人員與異常下拉選單只列出目前開始日期至結束日期及所選群組範圍內實際有班表或簽到資料的項目/);
});
