from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# Browser API: strict IDs, explicit delete intent, server confirmation.
replace_once(
    "src/renderer/web-api.js",
    '''  function isUuid(value) {\n    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());\n  }\n''',
    '''  function isUuid(value) {\n    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());\n  }\n\n  function optionalUuid(value, label) {\n    const text = String(value || "").trim();\n    if (!text) {\n      return null;\n    }\n    if (!isUuid(text)) {\n      throw new Error(`${label}識別碼格式錯誤`);\n    }\n    return text;\n  }\n''',
    "insert optionalUuid",
)

replace_once(
    "src/renderer/web-api.js",
    '''    async function saveShiftItem(shift, sortOrder = 0) {\n    ensureSignedIn();\n    return callRpc("save_shift_v3", {\n      p_shift: { ...shift, sortOrder }\n    });\n  }\n''',
    '''    async function saveShiftItem(shift, sortOrder = 0) {\n    ensureSignedIn();\n    return callRpc("save_shift_v3", {\n      p_shift: {\n        ...shift,\n        applicableDepartmentId: shift?.applicableDeptId || shift?.applicableDepartmentId || "",\n        sortOrder\n      }\n    });\n  }\n''',
    "normalize shift department field",
)

old_save = '''    async function saveScheduleCells(payloads) {\n    ensureSignedIn();\n    const rows = [];\n    for (const payload of Array.isArray(payloads) ? payloads : []) {\n      const profileMemberId = String(payload.memberId || "").trim();\n      const workDate = nullableDate(payload.dateString || payload.workDate);\n      if (!isUuid(profileMemberId) || !workDate) throw new Error("schedule cell member UUID and date are required");\n      const slot = payload.slot || {};\n      const shiftId = isUuid(slot.shift) ? slot.shift : null;\n      const leaveId = isUuid(slot.leave) ? slot.leave : null;\n      const overtimeId = isUuid(slot.overtime) ? slot.overtime : null;\n      if (!shiftId && !leaveId && !overtimeId) {\n        rows.push({ member_id: profileMemberId, work_date: workDate, delete_entry: true });\n        continue;\n      }\n      const leaveAllDay = slot.leaveMeta?.allDay !== false;\n      rows.push({\n        member_id: profileMemberId,\n        work_date: workDate,\n        shift_type_id: shiftId,\n        leave_type_id: leaveId,\n        leave_all_day: leaveAllDay,\n        leave_start_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.startTime) : null,\n        leave_end_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.endTime) : null,\n        leave_reason: leaveId ? slot.leaveMeta?.reason || null : null,\n        overtime_type_id: overtimeId,\n        overtime_start_time: overtimeId ? nullableTime(slot.overtimeMeta?.startTime) : null,\n        overtime_end_time: overtimeId ? nullableTime(slot.overtimeMeta?.endTime) : null,\n        overtime_use_rest_1: overtimeId ? Boolean(slot.overtimeMeta?.useRest1) : false,\n        overtime_rest_1_start_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,\n        overtime_rest_1_end_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,\n        overtime_use_rest_2: overtimeId ? Boolean(slot.overtimeMeta?.useRest2) : false,\n        overtime_rest_2_start_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,\n        overtime_rest_2_end_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,\n        overtime_reason: overtimeId ? slot.overtimeMeta?.reason || null : null\n      });\n    }\n    const savedRows = await saveScheduleEntryRows(rows);\n    return { ok: true, rows: savedRows };\n  }\n'''
new_save = '''    async function saveScheduleCells(payloads) {\n    ensureSignedIn();\n    const rows = [];\n    for (const payload of Array.isArray(payloads) ? payloads : []) {\n      const profileMemberId = String(payload.memberId || "").trim();\n      const workDate = nullableDate(payload.dateString || payload.workDate);\n      if (!isUuid(profileMemberId) || !workDate) throw new Error("schedule cell member UUID and date are required");\n      const deleteEntry = payload.deleteEntry === true;\n      const slot = payload.slot && typeof payload.slot === "object" ? payload.slot : {};\n      const shiftId = optionalUuid(slot.shift, "班別");\n      const leaveId = optionalUuid(slot.leave, "假別");\n      const overtimeId = optionalUuid(slot.overtime, "加班");\n      if (deleteEntry) {\n        rows.push({ member_id: profileMemberId, work_date: workDate, delete_entry: true });\n        continue;\n      }\n      if (!shiftId && !leaveId && !overtimeId) {\n        throw new Error("班表儲存內容不可空白");\n      }\n      const leaveAllDay = slot.leaveMeta?.allDay !== false;\n      rows.push({\n        member_id: profileMemberId,\n        work_date: workDate,\n        delete_entry: false,\n        shift_type_id: shiftId,\n        leave_type_id: leaveId,\n        leave_all_day: leaveAllDay,\n        leave_start_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.startTime) : null,\n        leave_end_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.endTime) : null,\n        leave_reason: leaveId ? slot.leaveMeta?.reason || null : null,\n        overtime_type_id: overtimeId,\n        overtime_start_time: overtimeId ? nullableTime(slot.overtimeMeta?.startTime) : null,\n        overtime_end_time: overtimeId ? nullableTime(slot.overtimeMeta?.endTime) : null,\n        overtime_use_rest_1: overtimeId ? Boolean(slot.overtimeMeta?.useRest1) : false,\n        overtime_rest_1_start_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,\n        overtime_rest_1_end_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,\n        overtime_use_rest_2: overtimeId ? Boolean(slot.overtimeMeta?.useRest2) : false,\n        overtime_rest_2_start_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,\n        overtime_rest_2_end_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,\n        overtime_reason: overtimeId ? slot.overtimeMeta?.reason || null : null\n      });\n    }\n    const savedRows = await saveScheduleEntryRows(rows);\n    const expectedKeys = new Set(rows\n      .filter((row) => !row.delete_entry)\n      .map((row) => makeScheduleEntryKey(row.member_id, row.work_date)));\n    const savedKeys = new Set((Array.isArray(savedRows) ? savedRows : [])\n      .map((row) => makeScheduleEntryKey(row.member_id, row.work_date)));\n    const missingKeys = [...expectedKeys].filter((key) => !savedKeys.has(key));\n    if (missingKeys.length) {\n      throw new Error("班表資料未成功寫入，請重新操作");\n    }\n    return { ok: true, rows: savedRows };\n  }\n'''
replace_once("src/renderer/web-api.js", old_save, new_save, "replace saveScheduleCells")

# Capture true pre-state before creating an empty slot.
replace_once(
    "src/renderer/renderer-schedule-selection-actions.js",
    '''  const slot = ensureScheduleSlot(memberId, dateString);\n  if (!slot) {\n    return;\n  }\n  const previousSchedule = deepClone(state.schedule || {});\n  const { type, id } = state.selected;\n''',
    '''  const previousSchedule = deepClone(state.schedule || {});\n  const slot = ensureScheduleSlot(memberId, dateString);\n  if (!slot) {\n    return;\n  }\n  const { type, id } = state.selected;\n''',
    "selection snapshot before blank slot",
)

replace_once(
    "src/renderer/renderer-schedule-assignment-modals.js",
    '''    const dateString = normalizeScheduleDateInput(day);\n    const slot = ensureScheduleSlot(memberId, dateString);\n    const leave = getItem("leave", leaveId);\n    if (!slot || !leave) {\n      throw new Error("找不到班表格子或假別");\n    }\n    const previousSchedule = deepClone(state.schedule || {});\n''',
    '''    const dateString = normalizeScheduleDateInput(day);\n    const previousSchedule = deepClone(state.schedule || {});\n    const slot = ensureScheduleSlot(memberId, dateString);\n    const leave = getItem("leave", leaveId);\n    if (!slot || !leave) {\n      throw new Error("找不到班表格子或假別");\n    }\n''',
    "leave assignment snapshot before blank slot",
)

replace_once(
    "src/renderer/renderer-schedule-interaction.js",
    '''    const key = getScheduleKeyForDateString(memberId, dateString);\n    payloads.push({\n      memberId,\n      memberCode: member.code || "",\n      dateString,\n      slot: key ? state.schedule[key] || null : null\n    });\n''',
    '''    const key = getScheduleKeyForDateString(memberId, dateString);\n    const slot = key ? state.schedule[key] || null : null;\n    payloads.push({\n      memberId,\n      memberCode: member.code || "",\n      dateString,\n      slot: slot ? deepClone(slot) : null,\n      deleteEntry: !slot\n    });\n''',
    "explicit schedule delete intent",
)

replace_once(
    "src/renderer/renderer-schedule-interaction.js",
    '''async function finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule) {\n  const nextSchedule = state.schedule || {};\n  if (!getChangedScheduleCells(previousSchedule, nextSchedule).length) {\n    return false;\n  }\n  pushScheduleUndoSnapshot(previousSchedule);\n  await finishScheduleCellMutation(memberId, dateString);\n  return true;\n}\n''',
    '''async function finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule) {\n  const nextSchedule = state.schedule || {};\n  if (!getChangedScheduleCells(previousSchedule, nextSchedule).length) {\n    return false;\n  }\n  const key = getScheduleKeyForDateString(memberId, dateString);\n  pushScheduleUndoSnapshot(previousSchedule);\n  try {\n    await finishScheduleCellMutation(memberId, dateString);\n    return true;\n  } catch (error) {\n    discardLastScheduleUndoSnapshot();\n    if (key && Object.prototype.hasOwnProperty.call(previousSchedule || {}, key)) {\n      state.schedule[key] = deepClone(previousSchedule[key]);\n    } else if (key) {\n      delete state.schedule[key];\n    }\n    renderScheduleCell(memberId, dateString);\n    syncScheduleRangeSelectionUi();\n    throw error;\n  }\n}\n''',
    "rollback failed direct schedule save",
)

# DB contract: a delete is explicit, never inferred from missing assignment ids.
sql_path = Path("supabase/002_current_updates.sql")
sql = sql_path.read_text(encoding="utf-8")
marker = """  if entries is null or jsonb_typeof(entries)<>'array' then
    raise exception '班表資料格式錯誤' using errcode='22023';
  end if;
"""
if sql.count(marker) != 1:
    raise SystemExit(f"SQL format marker count={sql.count(marker)}")
validation = marker + """
  select exists(
    select 1
    from jsonb_to_recordset(entries) as item(delete_entry boolean,shift_type_id uuid,leave_type_id uuid,overtime_type_id uuid)
    where not coalesce(item.delete_entry,false)
      and item.shift_type_id is null
      and item.leave_type_id is null
      and item.overtime_type_id is null
  ) into v_invalid;
  if v_invalid then
    raise exception '班表儲存內容不可空白' using errcode='22023';
  end if;
"""
sql = sql.replace(marker, validation, 1)
old_deleted_member = "or (member.deleted_at is not null and not (coalesce(item.delete_entry,false) or (item.shift_type_id is null and item.leave_type_id is null and item.overtime_type_id is null)))"
if sql.count(old_deleted_member) != 1:
    raise SystemExit(f"SQL deleted-member guard count={sql.count(old_deleted_member)}")
sql = sql.replace(old_deleted_member, "or (member.deleted_at is not null and not coalesce(item.delete_entry,false))", 1)
implicit_delete = "and (coalesce(item.delete_entry,false) or (item.shift_type_id is null and item.leave_type_id is null and item.overtime_type_id is null))"
if sql.count(implicit_delete) != 1:
    raise SystemExit(f"SQL implicit-delete count={sql.count(implicit_delete)}")
sql = sql.replace(implicit_delete, "and coalesce(item.delete_entry,false)", 1)
sql_path.write_text(sql, encoding="utf-8")

# Regression tests.
Path("tests/schedule-empty-cell-persistence.test.js").write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("空白格新增班別或假別不得被轉成刪除請求", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /function optionalUuid\(value, label\)/);
  assert.match(api, /const deleteEntry = payload\.deleteEntry === true/);
  assert.match(api, /if \(deleteEntry\) \{[\s\S]*?delete_entry: true/);
  assert.match(api, /if \(!shiftId && !leaveId && !overtimeId\) \{\s*throw new Error\("班表儲存內容不可空白"\)/);
  assert.doesNotMatch(api, /const shiftId = isUuid\(slot\.shift\) \? slot\.shift : null/);
});

test("新增或更新班表必須取得伺服器實際寫入確認", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /const expectedKeys = new Set/);
  assert.match(api, /const missingKeys = \[\.\.\.expectedKeys\]\.filter/);
  assert.match(api, /throw new Error\("班表資料未成功寫入，請重新操作"\)/);
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

test("資料庫只有明確 delete_entry 才能刪除班表", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.match(sql, /班表儲存內容不可空白/);
  assert.match(sql, /where entry\.member_id=item\.member_id and entry\.work_date=item\.work_date\s+and coalesce\(item\.delete_entry,false\)/);
  assert.doesNotMatch(sql, /and \(coalesce\(item\.delete_entry,false\) or \(item\.shift_type_id is null and item\.leave_type_id is null and item\.overtime_type_id is null\)\)/);
});

test("班別儲存 API 使用正式 applicableDepartmentId 欄位", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /applicableDepartmentId: shift\?\.applicableDeptId \|\| shift\?\.applicableDepartmentId \|\| ""/);
});
''', encoding="utf-8")

spec = Path("規格書.md")
spec_text = spec.read_text(encoding="utf-8")
heading = "### 班表儲存一致性（2026-08-09）"
if heading not in spec_text:
    spec_text += f"""\n\n{heading}\n- 空白格新增班別、假別或加班時，必須以正式班表 RPC 寫入資料庫；HTTP 成功但未回傳對應寫入列視為儲存失敗。\n- 班表刪除只能由前端明確送出 `delete_entry=true`；不得因識別碼無效、資料轉換失敗或空 payload 自動推論為刪除。\n- 直接修改單一班表格若伺服器未確認寫入，畫面必須立即回復該格修改前狀態，不得留下重整後才消失的假成功資料。\n"""
    spec.write_text(spec_text, encoding="utf-8")

print("canonical schedule persistence fix applied")
