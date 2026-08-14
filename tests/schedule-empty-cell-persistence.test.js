const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("空白格新增班別或假別不得被轉成刪除請求", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /function optionalUuid\(value,label\)/);
  assert.match(api, /if\(payload\.deleteEntry===true\)\{rows\.push\(\{member_id:memberId,work_date:workDate,delete_entry:true\}\);continue;\}/);
  assert.match(api, /const shift=optionalUuid\(slot\.shift,"班別"\),leave=optionalUuid\(slot\.leave,"假別"\),overtime=optionalUuid\(slot\.overtime,"加班"\)/);
  assert.match(api, /if\(!shift&&!leave&&!overtime\)throw new Error\("班表儲存內容不可空白"\)/);
  assert.doesNotMatch(api, /const shiftId = isUuid\(slot\.shift\) \? slot\.shift : null/);
});

test("新增或更新班表必須取得伺服器實際寫入確認", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /const saved=await saveScheduleEntryRows\(rows\)/);
  assert.match(api, /const expected=new Set\(rows\.filter\(\(r\)=>!r\.delete_entry\)\.map\(\(r\)=>entryKey\(r\.member_id,r\.work_date\)\)\)/);
  assert.match(api, /actual=new Set\(\(saved\|\|\[\]\)\.map\(\(r\)=>entryKey\(r\.member_id,r\.work_date\)\)\)/);
  assert.match(api, /if\(\[\.\.\.expected\]\.some\(\(k\)=>!actual\.has\(k\)\)\)throw new Error\("班表資料未成功寫入，請重新操作"\)/);
});

test("直接修改班表失敗時回復該格原始狀態", () => {
  const interaction = read("src/renderer/renderer-schedule-interaction.js");
  assert.match(interaction, /deleteEntry: !slot/);
  assert.match(interaction, /discardLastScheduleUndoSnapshot\(\)/);
  assert.match(interaction, /state\.schedule\[key\] = deepClone\(previousSchedule\[key\]\)/);
  assert.match(interaction, /delete state\.schedule\[key\]/);
});

test("空白格的 undo 快照必須在建立 slot 之前取得", () => {
  const selection = read("src/renderer/renderer-schedule-selection-actions.js");
  const snapshotAt = selection.indexOf("const previousSchedule = deepClone(state.schedule || {});");
  const ensureAt = selection.indexOf("const slot = ensureScheduleSlot(memberId, dateString);");
  assert.ok(snapshotAt >= 0 && ensureAt > snapshotAt);
});

test("後端只有明確 delete_entry 才能刪除班表", () => {
  const repository = read("src/backend/repositories/native-schedule-repository.js");
  assert.match(repository, /SCHEDULE_ENTRY_BLANK/);
  assert.match(repository, /班表儲存內容不可空白/);
  assert.match(repository, /where entry\.member_id = item\.member_id[\s\S]*and entry\.work_date = item\.work_date[\s\S]*and coalesce\(item\.delete_entry, false\)/);
  assert.doesNotMatch(repository, /coalesce\(item\.delete_entry, false\)\s+or\s+\(item\.shift_type_id is null/);
});

test("班別儲存 API 使用正式 applicableDepartmentId 欄位", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /applicableDepartmentId:shift\?\.applicableDeptId\|\|shift\?\.applicableDepartmentId\|\|""/);
  assert.match(api, /request\("\/api\/v1\/settings\/shift",\{method:"PUT",body:\{shift:\{\.\.\.shift,applicableDepartmentId:/);
});
