from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:160]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Canonical records state carries shared common attendance notes.
replace_once(
    "src/renderer/renderer-foundation.js",
    '''    personal: [],\n    personalDrafts: {},\n    personalFilters: { fromDate: addDaysToDateString(today, -49), toDate: today },\n''',
    '''    personal: [],\n    personalDrafts: {},\n    commonAttendanceNotes: [],\n    personalFilters: { fromDate: addDaysToDateString(today, -49), toDate: today },\n''',
)


# Personal records: notes become a datalist-backed free text input; remove meal column.
replace_once(
    "src/renderer/renderer-records-views.js",
    '''function renderReviewStatus(reviewed) {\n  return `<span class="attendance-review-status ${reviewed ? "is-reviewed" : "is-unreviewed"}">${reviewed ? "已審" : "未審"}</span>`;\n}\n''',
    '''function renderPersonalNoteInput(record) {\n  const value = String(getPersonalAttendanceValue(record, "note") ?? "");\n  const editable = record.editable !== false && !record.reviewed;\n  if (!editable) return escapeHtml(value);\n  return `<input class="attendance-note-input" type="text" list="personalAttendanceCommonNotes" value="${escapeHtml(value)}" data-personal-attendance-field="note" data-personal-attendance-date="${escapeHtml(record.date)}">`;\n}\n\nfunction renderReviewStatus(reviewed) {\n  return `<span class="attendance-review-status ${reviewed ? "is-reviewed" : "is-unreviewed"}">${reviewed ? "已審" : "未審"}</span>`;\n}\n''',
)
replace_once(
    "src/renderer/renderer-records-views.js",
    '''    ${attendanceState.error ? `<div class="auth-error">${escapeHtml(attendanceState.error)}</div>` : ""}\n    <div class="records-table-wrap"><table class="records-table personal-record-table attendance-ledger-table">\n      <thead><tr><th class="personal-record-date-col">日期</th><th class="personal-schedule-icon-col">圖示</th><th class="personal-record-shift-col">班別</th><th class="personal-record-clock-col">打卡時間</th><th class="personal-record-hours-col">上班時數</th><th class="personal-record-hours-col">加班時數</th><th class="personal-record-note-col">備註</th><th class="personal-record-meal-col">訂餐</th><th class="personal-record-review-col">審核</th></tr></thead>\n''',
    '''    ${attendanceState.error ? `<div class="auth-error">${escapeHtml(attendanceState.error)}</div>` : ""}\n    <datalist id="personalAttendanceCommonNotes">${(recordsState.commonAttendanceNotes || []).map((note) => `<option value="${escapeHtml(note)}"></option>`).join("")}</datalist>\n    <div class="records-table-wrap"><table class="records-table personal-record-table attendance-ledger-table">\n      <thead><tr><th class="personal-record-date-col">日期</th><th class="personal-schedule-icon-col">圖示</th><th class="personal-record-shift-col">班別</th><th class="personal-record-clock-col">打卡時間</th><th class="personal-record-hours-col">上班時數</th><th class="personal-record-hours-col">加班時數</th><th class="personal-record-note-col">備註</th><th class="personal-record-review-col">審核</th></tr></thead>\n''',
)
replace_once(
    "src/renderer/renderer-records-views.js",
    '''        <td class="personal-record-hours-col">${renderPersonalHoursInput(record, "overtimeHours")}</td>\n        <td class="personal-record-note-col">${record.editable !== false && !record.reviewed\n          ? `<input class="attendance-note-input" type="text" value="${escapeHtml(String(getPersonalAttendanceValue(record, "note") ?? ""))}" data-personal-attendance-field="note" data-personal-attendance-date="${escapeHtml(record.date)}">`\n          : escapeHtml(record.note || "")}</td>\n        <td class="personal-record-meal-col"><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>\n        <td class="personal-record-review-col">${renderReviewStatus(record.reviewed)}</td>\n      </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>\n''',
    '''        <td class="personal-record-hours-col">${renderPersonalHoursInput(record, "overtimeHours")}</td>\n        <td class="personal-record-note-col">${renderPersonalNoteInput(record)}</td>\n        <td class="personal-record-review-col">${renderReviewStatus(record.reviewed)}</td>\n      </tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody>\n''',
)

# Attendance review toolbar gets Common Notes management button.
replace_once(
    "src/renderer/renderer-records-views.js",
    '''      <div class="records-admin-actions overtime-review-actions attendance-review-actions">\n        <button class="ghost-btn compact-btn" type="button" data-export-attendance-review="true">匯出加班</button>\n''',
    '''      <div class="records-admin-actions overtime-review-actions attendance-review-actions">\n        <button class="ghost-btn compact-btn" type="button" data-attendance-common-notes="true">常用備註</button>\n        <button class="ghost-btn compact-btn" type="button" data-export-attendance-review="true">匯出加班</button>\n''',
)


# Common notes modal + save action.
replace_once(
    "src/renderer/renderer-records-actions.js",
    '''async function savePersonalAttendanceInput(input) {\n''',
    '''function normalizeAttendanceCommonNotes(value) {\n  const source = Array.isArray(value) ? value : String(value || "").split(/\\r?\\n/);\n  return [...new Set(source.map((note) => String(note || "").trim()).filter(Boolean))];\n}\n\nfunction openAttendanceCommonNotesModal() {\n  const notes = normalizeAttendanceCommonNotes(ensureRecordsState().commonAttendanceNotes || []);\n  openEntityListModal({\n    title: "常用備註",\n    hideFooterClose: true,\n    body: `<div class="form-row"><label>常用備註</label><textarea id="attendanceCommonNotesInput" rows="10" placeholder="每行一個常用備註">${escapeHtml(notes.join("\\n"))}</textarea></div>`,\n    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-common-notes="true">儲存</button>`\n  });\n}\n\nasync function saveAttendanceCommonNotes() {\n  const input = document.getElementById("attendanceCommonNotesInput");\n  const notes = normalizeAttendanceCommonNotes(input?.value || "");\n  try {\n    const result = await window.schedulerApi.saveAttendanceCommonNotes({ notes });\n    ensureRecordsState().commonAttendanceNotes = normalizeAttendanceCommonNotes(result?.commonNotes || notes);\n    closeModal();\n    renderAll();\n    showInfoMessage("常用備註已儲存");\n  } catch (error) {\n    setSaveStatus(`儲存常用備註失敗：${error.message}`);\n  }\n}\n\nasync function savePersonalAttendanceInput(input) {\n''',
)


# Wire common notes buttons.
replace_once(
    "src/renderer/renderer-records-events.js",
    '''    if (target.dataset.exportAttendanceReview !== undefined) { void exportAttendanceReview(); return; }\n''',
    '''    if (target.dataset.attendanceCommonNotes !== undefined) { openAttendanceCommonNotesModal(); return; }\n    if (target.dataset.saveAttendanceCommonNotes !== undefined) { void saveAttendanceCommonNotes(); return; }\n    if (target.dataset.exportAttendanceReview !== undefined) { void exportAttendanceReview(); return; }\n''',
)


# Page state receives common notes from either personal or review endpoint.
replace_once(
    "src/renderer/renderer-records-page.js",
    '''  recordsState.personalDrafts = recordsState.personalDrafts || {};\n''',
    '''  recordsState.personalDrafts = recordsState.personalDrafts || {};\n  recordsState.commonAttendanceNotes = Array.isArray(recordsState.commonAttendanceNotes) ? recordsState.commonAttendanceNotes : [];\n''',
)
replace_once(
    "src/renderer/renderer-records-page.js",
    '''      personal: result.records || [],\n      personalTotal: Number(result.total || 0),\n''',
    '''      personal: result.records || [],\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\n      personalTotal: Number(result.total || 0),\n''',
)
replace_once(
    "src/renderer/renderer-records-page.js",
    '''    recordsState = {\n      ...recordsState,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n''',
    '''    recordsState = {\n      ...recordsState,\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n''',
)


# Web API exposes review-side common notes save endpoint.
replace_once(
    "src/renderer/web-api.js",
    '''  async function saveAttendanceReviewRecord(payload = {}) {\n''',
    '''  async function saveAttendanceCommonNotes(payload = {}) {\n    ensureSignedIn();\n    return requestFunction("attendance-review-groups", { action: "common_notes_save", ...payload });\n  }\n\n  async function saveAttendanceReviewRecord(payload = {}) {\n''',
)
replace_once(
    "src/renderer/web-api.js",
    '''    getAttendanceReviewList,\n    saveAttendanceReviewRecord,\n''',
    '''    getAttendanceReviewList,\n    saveAttendanceCommonNotes,\n    saveAttendanceReviewRecord,\n''',
)


# Personal ledger: any unreviewed employed date is editable; include common notes.
replace_once(
    "supabase/functions/attendance-ledger/index.ts",
    '''async function personalList(ctx: any, body: any, actor: any) {\n''',
    '''function normalizeCommonNotes(value: unknown) {\n  return [...new Set(String(value || "").split(/\\r?\\n/).map((note) => note.trim()).filter(Boolean))];\n}\n\nasync function getCommonNotes(ctx: any) {\n  const result = await ctx.supabaseAdmin.from("scheduler_settings")\n    .select("attendance_common_notes").eq("id", "default").maybeSingle();\n  if (result.error) throw result.error;\n  return normalizeCommonNotes(result.data?.attendance_common_notes);\n}\n\nasync function personalList(ctx: any, body: any, actor: any) {\n''',
)
replace_once(
    "supabase/functions/attendance-ledger/index.ts",
    '''  const page = pageNumber(body?.page);\n  const [attendanceResult, mealResult, scheduleContext, mealSettingResult] = await Promise.all([\n''',
    '''  const page = pageNumber(body?.page);\n  const commonNotes = await getCommonNotes(ctx);\n  const [attendanceResult, mealResult, scheduleContext, mealSettingResult] = await Promise.all([\n''',
)
replace_once(
    "supabase/functions/attendance-ledger/index.ts",
    '''        editable: date === today && !row?.reviewed_at,\n''',
    '''        editable: !row?.reviewed_at,\n''',
)
replace_once(
    "supabase/functions/attendance-ledger/index.ts",
    '''  return { ok: true, records: records.slice(offset, offset + PAGE_SIZE), total: records.length, page, pageSize: PAGE_SIZE, fromDate, toDate, serverDate: today };\n''',
    '''  return { ok: true, records: records.slice(offset, offset + PAGE_SIZE), commonNotes, total: records.length, page, pageSize: PAGE_SIZE, fromDate, toDate, serverDate: today };\n''',
)
replace_once(
    "supabase/functions/attendance-ledger/index.ts",
    '''async function personalSave(ctx: any, body: any, actor: any) {\n  const today = taipeiDate();\n  const workDate = validDate(body?.workDate, "");\n  if (!workDate || workDate !== today) throw new Error("員工只能修改今天的簽到資料");\n''',
    '''async function personalSave(ctx: any, body: any, actor: any) {\n  const workDate = validDate(body?.workDate, "");\n  if (!workDate || !employedOn(actor, workDate)) throw new Error("只能修改任職期間的簽到資料");\n''',
)


# Review endpoint can read/save shared newline-separated notes.
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '''async function getActor(ctx: any) {\n''',
    '''function normalizeCommonNotes(value: unknown) {\n  const source = Array.isArray(value) ? value : String(value || "").split(/\\r?\\n/);\n  return [...new Set(source.map((note) => String(note || "").trim()).filter(Boolean))];\n}\n\nasync function getCommonNotes(ctx: any) {\n  const result = await ctx.supabaseAdmin.from("scheduler_settings")\n    .select("attendance_common_notes").eq("id", "default").maybeSingle();\n  if (result.error) throw result.error;\n  return normalizeCommonNotes(result.data?.attendance_common_notes);\n}\n\nasync function saveCommonNotes(ctx: any, body: any) {\n  const notes = normalizeCommonNotes(body?.notes);\n  const result = await ctx.supabaseAdmin.from("scheduler_settings")\n    .update({ attendance_common_notes: notes.join("\\n"), updated_at: new Date().toISOString() })\n    .eq("id", "default");\n  if (result.error) throw result.error;\n  return { ok: true, commonNotes: notes };\n}\n\nasync function getActor(ctx: any) {\n''',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '''  const page = pageNumber(body?.page);\n  if (!groupIds.length) return { ok: true, members: [], departments: [], issueTypes: ISSUE_TYPES, rows: [], total: 0, page, pageSize: PAGE_SIZE };\n''',
    '''  const page = pageNumber(body?.page);\n  const commonNotes = await getCommonNotes(ctx);\n  if (!groupIds.length) return { ok: true, members: [], departments: [], issueTypes: ISSUE_TYPES, commonNotes, rows: [], total: 0, page, pageSize: PAGE_SIZE };\n''',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '''    issueTypes: ISSUE_TYPES,\n    rows: exportOnly ? rows : rows.slice(offset, offset + PAGE_SIZE),\n''',
    '''    issueTypes: ISSUE_TYPES,\n    commonNotes,\n    rows: exportOnly ? rows : rows.slice(offset, offset + PAGE_SIZE),\n''',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '''      if (body?.action === "history") return Response.json(await history(ctx, body, actor));\n''',
    '''      if (body?.action === "history") return Response.json(await history(ctx, body, actor));\n      if (body?.action === "common_notes_save") return Response.json(await saveCommonNotes(ctx, body));\n''',
)


# Canonical SQL schema and current update script.
replace_once(
    "supabase/001_current_schema.sql",
    '''  eight_week_start_date date,\n  updated_at timestamptz not null default now()\n''',
    '''  eight_week_start_date date,\n  attendance_common_notes text not null default '',\n  updated_at timestamptz not null default now()\n''',
)
updates_path = Path("supabase/002_current_updates.sql")
updates = updates_path.read_text(encoding="utf-8")
marker = "attendance_common_notes text not null default ''"
if marker not in updates:
    updates = updates.rstrip() + '''\n\n-- 簽到審核常用備註（每行一個項目）\nalter table public.scheduler_settings\n  add column if not exists attendance_common_notes text not null default '';\n'''
    updates_path.write_text(updates, encoding="utf-8")


# Focused regression guards.
test_path = Path("tests/attendance-common-notes-personal-edit.test.js")
test_path.write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核可維護共用常用備註，個人記錄可選擇或自由輸入", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const events = read("src/renderer/renderer-records-events.js");
  const api = read("src/renderer/web-api.js");
  const review = read("supabase/functions/attendance-review-groups/index.ts");
  const ledger = read("supabase/functions/attendance-ledger/index.ts");
  const schema = read("supabase/001_current_schema.sql");

  assert.match(views, /data-attendance-common-notes="true">常用備註<\/button>/);
  assert.match(views, /list="personalAttendanceCommonNotes"/);
  assert.match(views, /<datalist id="personalAttendanceCommonNotes">/);
  assert.match(actions, /attendanceCommonNotesInput/);
  assert.match(actions, /data-save-attendance-common-notes="true">儲存<\/button>/);
  assert.match(actions, /split\(\/\\r\?\\n\//);
  assert.match(events, /openAttendanceCommonNotesModal/);
  assert.match(events, /saveAttendanceCommonNotes/);
  assert.match(api, /action: "common_notes_save"/);
  assert.match(review, /attendance_common_notes/);
  assert.match(ledger, /attendance_common_notes/);
  assert.match(schema, /attendance_common_notes text not null default ''/);
});

test("個人未審紀錄不限當日可修改工時與備註，且個人頁移除訂餐欄", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const ledger = read("supabase/functions/attendance-ledger/index.ts");
  const personalSection = views.split("function renderPersonalRecordsSection", 2)[1]
    .split("function renderMealReportSection", 2)[0];

  assert.match(ledger, /editable: !row\?\.reviewed_at/);
  assert.equal(ledger.includes("workDate !== today"), false);
  assert.match(ledger, /!employedOn\(actor, workDate\)/);
  assert.match(ledger, /if \(old\.reviewed_at\) throw new Error\("此日簽到紀錄已審，無法修改"\)/);
  assert.equal(personalSection.includes("personal-record-meal-col"), false);
  assert.equal(personalSection.includes(">訂餐<"), false);
  assert.match(personalSection, /colspan="8"/);
});
''', encoding="utf-8")

# Sanity checks for old constraint/UI remnants in the scoped implementation.
ledger = Path("supabase/functions/attendance-ledger/index.ts").read_text(encoding="utf-8")
if "workDate !== today" in ledger:
    raise SystemExit("personal save is still limited to today")
views = Path("src/renderer/renderer-records-views.js").read_text(encoding="utf-8")
personal = views.split("function renderPersonalRecordsSection", 1)[1].split("function renderMealReportSection", 1)[0]
if "personal-record-meal-col" in personal:
    raise SystemExit("personal records still contain meal column")
