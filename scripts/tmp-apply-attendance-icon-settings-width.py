from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"找不到修改位置：{label}")
    return text.replace(old, new, 1)


# 1. 打卡管理後端補齊班表圖示資料。
edge_path = "supabase/functions/attendance-admin-list-v2/index.ts"
edge = read(edge_path)
edge = replace_once(
    edge,
    '''function nowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

async function requireAdmin(ctx: any) {''',
    '''function nowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function catalogSegment(category: string, item: any) {
  if (!item) return null;
  return {
    category,
    itemId: item.id || "",
    code: item.code || "",
    name: item.name || (category === "overtime" ? "加班" : ""),
    color: item.color || (category === "overtime" ? "#D85A30" : "#888780"),
    textColor: item.text_color || "",
    autoTextColor: item.auto_text_color !== false
  };
}

async function requireAdmin(ctx: any) {''',
    "attendance catalogSegment",
)
edge = replace_once(
    edge,
    '''    ctx.supabaseAdmin.from("schedule_entries").select("member_id,work_date,shift_type_id").gte("work_date", fromDate).lte("work_date", toDate)
  ]);''',
    '''    ctx.supabaseAdmin.from("schedule_entries").select("member_id,work_date,shift_type_id,leave_type_id,overtime_type_id").gte("work_date", fromDate).lte("work_date", toDate)
  ]);''',
    "attendance schedule fields",
)
edge = replace_once(
    edge,
    '''  const shiftIds = [...new Set((scheduleResult.data || []).map((row: any) => row.shift_type_id).filter(Boolean))];
  const shiftResult = shiftIds.length
    ? await ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id").in("id", shiftIds)
    : { data: [], error: null };
  if (shiftResult.error) throw shiftResult.error;

  const members = memberResult.data || [];
  const shifts = new Map((shiftResult.data || []).map((row: any) => [row.id, row]));
  const schedules = new Map((scheduleResult.data || []).map((row: any) => [`${row.member_id}:${row.work_date}`, { ...row, shift: shifts.get(row.shift_type_id) || null }]));
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));''',
    '''  const scheduleRows = scheduleResult.data || [];
  const shiftIds = [...new Set(scheduleRows.map((row: any) => row.shift_type_id).filter(Boolean))];
  const leaveIds = [...new Set(scheduleRows.map((row: any) => row.leave_type_id).filter(Boolean))];
  const overtimeTypeIds = [...new Set(scheduleRows.map((row: any) => row.overtime_type_id).filter(Boolean))];
  const [shiftResult, leaveResult, overtimeTypeResult] = await Promise.all([
    shiftIds.length
      ? ctx.supabaseAdmin.from("set_shift").select("id,name,start_time,end_time,applicable_department_id,color,text_color,auto_text_color").in("id", shiftIds)
      : Promise.resolve({ data: [], error: null }),
    leaveIds.length
      ? ctx.supabaseAdmin.from("set_leave").select("id,code,name,color,text_color,auto_text_color").in("id", leaveIds)
      : Promise.resolve({ data: [], error: null }),
    overtimeTypeIds.length
      ? ctx.supabaseAdmin.from("set_overtime").select("id,name,color,text_color,auto_text_color").in("id", overtimeTypeIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  for (const result of [shiftResult, leaveResult, overtimeTypeResult]) if (result.error) throw result.error;

  const members = memberResult.data || [];
  const shifts = new Map((shiftResult.data || []).map((row: any) => [row.id, row]));
  const leaves = new Map((leaveResult.data || []).map((row: any) => [row.id, row]));
  const overtimeTypes = new Map((overtimeTypeResult.data || []).map((row: any) => [row.id, row]));
  const schedules = new Map(scheduleRows.map((row: any) => [`${row.member_id}:${row.work_date}`, row]));
  const attendance = new Map((attendanceResult.data || []).map((row: any) => [`${row.user_id}:${row.work_date}`, row]));''',
    "attendance catalog queries",
)
edge = replace_once(
    edge,
    '''      const schedule = schedules.get(key) || null;
      const currentIssues = issues(current, schedule?.shift || null, today);''',
    '''      const schedule: any = schedules.get(key) || null;
      const shift: any = schedule?.shift_type_id ? shifts.get(schedule.shift_type_id) || null : null;
      const leave: any = schedule?.leave_type_id ? leaves.get(schedule.leave_type_id) || null : null;
      const overtimeType: any = schedule?.overtime_type_id ? overtimeTypes.get(schedule.overtime_type_id) || null : null;
      const scheduleSegments = [
        catalogSegment("shift", shift),
        catalogSegment("leave", leave),
        catalogSegment("overtime", overtimeType)
      ].filter(Boolean);
      const currentIssues = issues(current, shift, today);''',
    "attendance row schedule segments",
)
edge = replace_once(
    edge,
    '''        shift_name: schedule?.shift?.name || "",
        shift_start_time: schedule?.shift?.start_time || "",
        shift_end_time: schedule?.shift?.end_time || "",
        shift_department_id: schedule?.shift?.applicable_department_id || "",
        issues: currentIssues''',
    '''        shift_name: shift?.name || "",
        shift_start_time: shift?.start_time || "",
        shift_end_time: shift?.end_time || "",
        shift_department_id: shift?.applicable_department_id || "",
        scheduleSegments,
        issues: currentIssues''',
    "attendance row output",
)
write(edge_path, edge)


# 2. 打卡管理表格新增班表圖示欄，且圖示沿用班表例假黃色規則。
views_path = "src/renderer/renderer-records-views.js"
views = read(views_path)
views = replace_once(
    views,
    '''      const specialLeaveText = segment.category === "leave" && String(segment.code || item?.code || "") === "0047" && hasShift;
      const foreground = specialLeaveText ? "rgb(112, 112, 112)" : itemText;
      const name = item?.name || segment.name || (segment.category === "overtime" ? "加班" : "");
      return `<div class="seg" style="background-color:${escapeHtml(color)};color:${escapeHtml(foreground)}"><span class="seg-label ${getScheduleSegmentSizeClass({ name }, segments.length)}">${escapeHtml(name)}</span></div>`;''',
    '''      const segmentCode = String(segment.code || item?.code || "");
      const specialLeaveText = segment.category === "leave" && segmentCode === "0047" && hasShift;
      const regularHolidayWorkClass = segment.category === "leave" && segmentCode === "0036" && hasShift
        ? " regular-holiday-work-seg"
        : "";
      const foreground = specialLeaveText ? "rgb(112, 112, 112)" : itemText;
      const name = item?.name || segment.name || (segment.category === "overtime" ? "加班" : "");
      return `<div class="seg${regularHolidayWorkClass}" style="background-color:${escapeHtml(color)};color:${escapeHtml(foreground)}"><span class="seg-label ${getScheduleSegmentSizeClass({ name }, segments.length)}">${escapeHtml(name)}</span></div>`;''',
    "record schedule regular holiday color",
)
views = replace_once(
    views,
    '''        <thead><tr><th>日期</th><th>員工</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th class="attendance-admin-action-col">操作</th></tr></thead>''',
    '''        <thead><tr><th>日期</th><th>員工</th><th class="attendance-schedule-icon-col">圖示</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th class="attendance-admin-action-col">操作</th></tr></thead>''',
    "attendance table header icon",
)
views = replace_once(
    views,
    '''          <td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td>
          <td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td>''',
    '''          <td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td>
          <td class="attendance-schedule-icon-col">${renderScheduleIcon(row)}</td>
          <td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td>''',
    "attendance table row icon",
)
views = replace_once(
    views,
    '''        </tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody>''',
    '''        </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>''',
    "attendance empty colspan",
)
write(views_path, views)


# 3. 設定表格貼合彈窗寬度，並新增打卡管理圖示欄樣式。
pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
append_css = '''

/* ===== 打卡管理班表圖示與設定表格視窗寬度 ===== */
.attendance-admin-table .attendance-schedule-icon-col {
  width: var(--day-col-width);
  min-width: var(--day-col-width);
  max-width: var(--day-col-width);
  padding: 2px;
  text-align: center;
  vertical-align: middle;
}

.attendance-admin-table th.attendance-schedule-icon-col {
  padding-right: 2px;
  padding-left: 2px;
}

.attendance-admin-table .attendance-schedule-icon-col .personal-record-schedule-cell {
  width: 100%;
  min-height: 36px;
}

:is(.catalog-settings-modal, .member-settings-modal) :is(.settings-table-wrap, .member-table-wrap),
:is(.catalog-settings-modal, .member-settings-modal) :is(.settings-table-scroll, .member-table-scroll),
.catalog-settings-modal .settings-table,
.member-settings-modal .member-table {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.catalog-settings-modal .settings-table-scroll,
.member-settings-modal .member-table-scroll {
  overflow-x: hidden;
  overflow-y: auto;
}

.catalog-settings-modal .settings-table-row-shift {
  width: 100%;
  min-width: 0;
  grid-template-columns:
    var(--settings-drag-column-width)
    minmax(0, .72fr)
    minmax(0, .9fr)
    minmax(0, .56fr)
    minmax(0, 2.25fr)
    minmax(0, .78fr)
    minmax(0, .68fr)
    var(--settings-action-column-width);
}

.member-settings-modal .member-table-row {
  width: 100%;
  min-width: 0;
  grid-template-columns:
    var(--settings-drag-column-width)
    minmax(0, .82fr)
    minmax(0, .82fr)
    minmax(0, 1.72fr)
    minmax(0, .56fr)
    minmax(0, .88fr)
    minmax(0, .68fr)
    minmax(0, .65fr)
    var(--settings-action-column-width);
}

.catalog-settings-modal .settings-table-row-shift > *,
.member-settings-modal .member-table-row > * {
  min-width: 0;
}
'''
if "/* ===== 打卡管理班表圖示與設定表格視窗寬度 ===== */" in pages:
    raise RuntimeError("頁面樣式已存在")
pages = pages.rstrip() + append_css + "\n"
write(pages_path, pages)


# 4. 正式規格同步更新。
spec_path = "規格書.md"
spec = read(spec_path)
spec = replace_once(
    spec,
    '''- 拖曳排序同步影響班表人員顯示順序並永久保存。

權限：''',
    '''- 拖曳排序同步影響班表人員顯示順序並永久保存。
- 人員設定表格左右寬度必須貼合彈出視窗可用寬度，不得出現下方水平捲軸。

權限：''',
    "member settings width spec",
)
spec = replace_once(
    spec,
    '''5. 可匯入及匯出設定。
6. 設定列表與新增班別視窗的主要新增按鈕文字統一為「新增」。''',
    '''5. 可匯入及匯出設定。
6. 設定列表與新增班別視窗的主要新增按鈕文字統一為「新增」。
7. 班別設定表格左右寬度必須貼合彈出視窗可用寬度，不得出現下方水平捲軸。''',
    "shift settings width spec",
)
spec = replace_once(
    spec,
    '''1. 日期。
2. 員工姓名與工號。
3. 班別與班表時間。
4. 上班時間與單位。
5. 下班時間與單位。
6. 異常。
7. 每日打卡備註。
8. 操作。''',
    '''1. 日期。
2. 員工姓名與工號。
3. 班表圖示；顯示該員工當日班表格中的班別、假別與班表加班分段圖示，排列、底色及文字色規則與班表格一致。
4. 班別與班表時間。
5. 上班時間與單位。
6. 下班時間與單位。
7. 異常。
8. 每日打卡備註。
9. 操作。''',
    "attendance table fields spec",
)
spec = replace_once(
    spec,
    '''5. 打卡管理清單由 `attendance-admin-list-v2` 讀取。
6. 打卡管理寫入及歷程由 `attendance-admin-action-v2` 處理。
7. 查詢結果依日期倒序顯示。
8. 任何管理員異動都需由後端再次驗證角色與帳號有效期間。''',
    '''5. 打卡管理清單由 `attendance-admin-list-v2` 讀取。
6. 打卡管理後端同時讀取班別、假別與班表加班，回傳當日班表圖示分段資料。
7. 打卡管理寫入及歷程由 `attendance-admin-action-v2` 處理。
8. 查詢結果依日期倒序顯示。
9. 任何管理員異動都需由後端再次驗證角色與帳號有效期間。''',
    "attendance API spec",
)
spec = replace_once(
    spec,
    '''3. 設定表格使用內部橫向捲動與不透明黏性表頭。
4. 目前最小表格寬度：單位設定 720px、班別設定 1040px、假別設定 880px、加班設定 1060px。''',
    '''3. 人員設定與班別設定表格必須依彈出視窗可用寬度分配欄位，表格左右寬度與視窗一致，不顯示下方水平捲軸；表頭仍維持不透明黏性定位。
4. 假別與加班設定在窄螢幕無法合理容納所有欄位時，可保留表格內部橫向捲動；不得把人員設定與班別設定重新改回固定最小寬度。''',
    "settings table shared width spec",
)
write(spec_path, spec)


# 5. 新增回歸測試。
test_path = ROOT / "tests/attendance-admin-icon-settings-width.test.js"
test_path.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("打卡管理在員工欄後顯示當日班表圖示", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const edge = read("supabase/functions/attendance-admin-list-v2/index.ts");
  assert.match(views, /<th>員工<\\/th><th class="attendance-schedule-icon-col">圖示<\\/th><th>班別<\\/th>/);
  assert.match(views, /<td class="attendance-schedule-icon-col">\\$\\{renderScheduleIcon\\(row\\)\\}<\\/td>/);
  assert.match(views, /regularHolidayWorkClass[\\s\\S]*?segmentCode === "0036"/);
  assert.match(edge, /shift_type_id,leave_type_id,overtime_type_id/);
  assert.match(edge, /function catalogSegment\\(category: string, item: any\\)/);
  assert.match(edge, /scheduleSegments = \\[[\\s\\S]*?catalogSegment\\("shift", shift\\)[\\s\\S]*?catalogSegment\\("leave", leave\\)[\\s\\S]*?catalogSegment\\("overtime", overtimeType\\)/);
  assert.match(edge, /scheduleSegments,\\n\\s*issues: currentIssues/);
});

test("班別與人員設定表格貼合彈窗且不顯示水平捲軸", () => {
  const css = read("src/renderer/css/pages.css");
  const spec = read("規格書.md");
  assert.match(css, /\\.catalog-settings-modal \\.settings-table-scroll,[\\s\\S]*?\\.member-settings-modal \\.member-table-scroll \\{[\\s\\S]*?overflow-x: hidden;/);
  assert.match(css, /\\.catalog-settings-modal \\.settings-table-row-shift \\{[\\s\\S]*?width: 100%;[\\s\\S]*?min-width: 0;/);
  assert.match(css, /\\.member-settings-modal \\.member-table-row \\{[\\s\\S]*?width: 100%;[\\s\\S]*?min-width: 0;/);
  assert.match(spec, /人員設定表格左右寬度必須貼合彈出視窗可用寬度，不得出現下方水平捲軸/);
  assert.match(spec, /班別設定表格左右寬度必須貼合彈出視窗可用寬度，不得出現下方水平捲軸/);
});
''', encoding="utf-8")

print("Applied attendance schedule icon and settings width changes")
