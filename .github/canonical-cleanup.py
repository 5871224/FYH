from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected exactly one literal match, got {text.count(old)}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, got {count}")
    return next_text


# --------------------------------------------------------------------------------------
# 前端：匯出器只接受正式 API exportRows，不再保留本機資料與特殊 payload 相容分支。
# --------------------------------------------------------------------------------------
exporter_path = "src/renderer/browser-exporter.js"
exporter = read(exporter_path)

canonical_export_helpers = '''  function requireExportRows(payload) {
    if (!Array.isArray(payload?.exportRows)) {
      throw new Error("匯出資料必須由正式 API 提供 exportRows");
    }
    return payload.exportRows;
  }

  function compactIsoDate(value) {
    return String(value || "").replaceAll("-", "");
  }

  function getSapLeaveRowsFromExport(payload) {
    const sapCodeMap = new Map([["0036", "OFF"], ["0047", "REST"], ["休息日", "REST"], ["休假", "REST"], ["例假", "OFF"]]);
    return requireExportRows(payload).flatMap((row) => {
      if (row.pay_by_day || !row.leave_type_id) return [];
      const sapCode = sapCodeMap.get(row.leave_code) || sapCodeMap.get(row.leave_name);
      if (!sapCode) return [];
      const date = compactIsoDate(row.work_date);
      return [[row.employee_name || "", row.employee_code || "", date, date, sapCode]];
    });
  }

  function getOvertimeRowsFromExport(payload) {
    return requireExportRows(payload).flatMap((row) => {
      if (!row.overtime_type_id) return [];
      return [[
        row.employee_code || "",
        compactIsoDate(row.work_date),
        formatCompactTime(row.overtime_start_time),
        formatCompactTime(row.overtime_end_time),
        Number(row.overtime_previous_day || 0),
        Number(row.overtime_subsidy_type || 1),
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_start_time) : "",
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_end_time) : "",
        row.overtime_use_rest_1 ? Number(row.overtime_rest_1_paid || 0) : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_start_time) : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_end_time) : "",
        row.overtime_use_rest_2 ? Number(row.overtime_rest_2_paid || 0) : ""
      ]];
    });
  }

  function getLeaveRowsFromExport(payload) {
    const excludedLeaveCodes = new Set(["0036", "0047"]);
    const hiddenDepartmentIds = new Set((payload.state?.departments || []).filter((department) => department?.hiddenFromSchedule).map((department) => department.id));
    return requireExportRows(payload).flatMap((row) => {
      if (!row.leave_type_id || excludedLeaveCodes.has(row.leave_code) || hiddenDepartmentIds.has(row.home_department_id)) return [];
      const date = compactIsoDate(row.work_date);
      const allDay = row.leave_all_day !== false;
      return [[
        row.employee_code || "",
        date,
        date,
        allDay ? "" : formatCompactTime(row.leave_start_time),
        allDay ? "" : formatCompactTime(row.leave_end_time),
        row.leave_code || "",
        row.leave_reason || row.leave_name || ""
      ]];
    });
  }

  function csvEscape(value) {'''

exporter = regex_once(
    exporter,
    r"  function hasOfficialScheduleExportRows\(payload\) \{.*?\n  function csvEscape\(value\) \{",
    canonical_export_helpers,
    "browser exporter helper block",
)

exporter = regex_once(
    exporter,
    r"  function getSapLeaveExportRows\(payload\) \{.*?\n  function buildSapLeaveCsvContent",
    '''  function getSapLeaveExportRows(payload) {
    return getSapLeaveRowsFromExport(payload);
  }

  function buildSapLeaveCsvContent''',
    "canonical SAP export rows",
)

exporter = regex_once(
    exporter,
    r"  function getOvertimeExportRows\(payload\) \{.*?\n  function getLeaveExportRows",
    '''  function getOvertimeExportRows(payload) {
    return getOvertimeRowsFromExport(payload);
  }

  function getLeaveExportRows''',
    "canonical overtime export rows",
)

exporter = regex_once(
    exporter,
    r"  function getLeaveExportRows\(payload\) \{.*?\n  function applySheetBorder",
    '''  function getLeaveExportRows(payload) {
    return getLeaveRowsFromExport(payload);
  }

  function applySheetBorder''',
    "canonical leave export rows",
)

for forbidden in [
    "approvedOvertimeRows",
    "hasOfficialScheduleExportRows",
    "getOfficialOvertimeRows",
    "getOfficialLeaveRows",
    "getOfficialSapLeaveRows",
    "formatApprovedOvertimeDuration",
]:
    if forbidden in exporter:
        raise RuntimeError(f"browser-exporter still contains compatibility symbol: {forbidden}")
write(exporter_path, exporter)


# --------------------------------------------------------------------------------------
# 前端 API：日期區間與十二欄格式只走一條正式資料路徑。
# --------------------------------------------------------------------------------------
web_api_path = "src/renderer/web-api.js"
web_api = read(web_api_path)

web_api = regex_once(
    web_api,
    r"  function makeFileName\(prefix, payload, extension\) \{.*?\n  \}",
    '''  function compactExportDate(value) {
    return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
  }

  function makeRangeExportFileName(prefix, payload, extension) {
    return `${prefix}_${compactExportDate(payload.startDate)}-${compactExportDate(payload.endDate)}.${extension}`;
  }

  function formatOvertimeHoursAsTime(value) {
    const totalMinutes = Math.round(Number(value) * 60);
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "";
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }''',
    "range export helpers",
)

web_api = regex_once(
    web_api,
    r'''      let members = mapMemberDirectoryRows\(profileRows\);\n      if \(currentSession\?\.access_token\) \{\n        try \{\n          const result = await requestFunction\("member-order-v2", \{ action: "list" \}\);\n          members = applyMemberOrder\(members, result.memberIds\);\n        \} catch \{\n          // Keep database sort order until member-order-v2 is available\.\n        \}\n      \}''',
    '''      let members = mapMemberDirectoryRows(profileRows);
      if (currentSession?.access_token) {
        const result = await requestFunction("member-order-v2", { action: "list" });
        members = applyMemberOrder(members, result.memberIds);
      }''',
    "remove member order availability fallback",
)

web_api = regex_once(
    web_api,
    r"  async function exportSapCsv\(payload\) \{.*?\n  function compactMealExportDate",
    '''  async function exportSapCsv(payload) {
    if (!exporter.getSapLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = new Blob(
      [exporter.buildSapLeaveCsvContent(payload)],
      { type: "text/csv;charset=utf-8" }
    );
    const fileName = makeRangeExportFileName("sap請假", payload, "csv");
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  async function exportOvertime(payload) {
    if (!exporter.getOvertimeExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload));
    const fileName = makeRangeExportFileName("匯出加班", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  async function exportLeave(payload) {
    if (!exporter.getLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload));
    const fileName = makeRangeExportFileName("匯出請假", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  function compactMealExportDate''',
    "canonical web export functions",
)

web_api = regex_once(
    web_api,
    r"  async function exportAttendanceReview\(filters = \{\}\) \{.*?\n  \}\n\n  async function exportMembers",
    '''  async function exportAttendanceReview(filters = {}) {
    ensureManager();
    const result = await requestFunction("attendance-ledger-export", {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId || ""
    });
    const exportRows = (Array.isArray(result.rows) ? result.rows : [])
      .filter((row) => Number(row.overtimeHours) > 0)
      .map((row) => ({
        employee_code: row.employee_code || "",
        work_date: row.work_date || "",
        overtime_type_id: "attendance-ledger",
        overtime_start_time: "00:00",
        overtime_end_time: formatOvertimeHoursAsTime(row.overtimeHours),
        overtime_previous_day: 0,
        overtime_subsidy_type: 1,
        overtime_use_rest_1: false,
        overtime_use_rest_2: false
      }));
    return exportOvertime({
      startDate: filters.fromDate,
      endDate: filters.toDate,
      exportRows
    });
  }

  async function exportMembers''',
    "canonical attendance review export",
)

for forbidden in ["approvedOvertimeRows", "makeFileName(", "until member-order-v2 is available"]:
    if forbidden in web_api:
        raise RuntimeError(f"web-api still contains compatibility symbol: {forbidden}")
write(web_api_path, web_api)


# --------------------------------------------------------------------------------------
# 前端正式匯出操作：直接整合期間視窗與 API 呼叫，不再後載入覆寫。
# --------------------------------------------------------------------------------------
write("src/renderer/renderer-export-actions.js", '''/* 班表期間切換與正式匯出操作。 */

function getScheduleWeekNavigationBounds(startDate) {
  const cycleStartDate = getEightWeekCycleStartForDate(startDate);
  return {
    minStartDate: cycleStartDate,
    maxStartDate: addDaysToDateString(cycleStartDate, 49)
  };
}

function canChangeScheduleWindowWeeks(weeks) {
  if (Math.abs(weeks) !== 1) {
    return true;
  }
  const startDate = toDateObject(state.scheduleStartDate)
    ? state.scheduleStartDate
    : getEightWeekCycleStartForDate(getTodayDateString());
  const targetDate = addDaysToDateString(startDate, weeks * 7);
  const { minStartDate, maxStartDate } = getScheduleWeekNavigationBounds(startDate);
  return Boolean(targetDate && targetDate >= minStartDate && targetDate <= maxStartDate);
}

function syncScheduleWeekNavigationButtons() {
  const controls = [
    ["prevWeekButton", -1],
    ["tablePrevWeekButton", -1],
    ["nextWeekButton", 1],
    ["tableNextWeekButton", 1]
  ];
  controls.forEach(([id, weeks]) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !canChangeScheduleWindowWeeks(weeks);
    }
  });
}

async function changeScheduleWindowWeeks(weeks) {
  if (!canChangeScheduleWindowWeeks(weeks)) {
    syncScheduleWeekNavigationButtons();
    return;
  }
  const startDate = toDateObject(state.scheduleStartDate)
    ? state.scheduleStartDate
    : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
  await ensureVisibleScheduleLoaded();
  renderAll();
  await forceSave();
}

function parseExportDate(value) {
  const match = String(value || "").match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatExportDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addExportDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function exportPeriodStartForDate(date, startDay) {
  const createStart = (year, month) => new Date(year, month, Math.min(startDay, daysInMonth(year, month)));
  const currentStart = createStart(date.getFullYear(), date.getMonth());
  return date >= currentStart
    ? currentStart
    : createStart(date.getFullYear(), date.getMonth() - 1);
}

function getDefaultExportPeriod() {
  const visible = getVisibleDateRange();
  if (parseExportDate(visible?.startDate) && parseExportDate(visible?.endDate)) {
    return { startDate: visible.startDate, endDate: visible.endDate };
  }
  const today = parseExportDate(getTodayDateString()) || new Date();
  const rawStartDay = Number(getConfiguredMonthStartDay());
  const startDay = Number.isInteger(rawStartDay) && rawStartDay >= 1 && rawStartDay <= 31 ? rawStartDay : 1;
  const currentStart = exportPeriodStartForDate(today, startDay);
  const previousEnd = addExportDays(currentStart, -1);
  const previousStart = exportPeriodStartForDate(previousEnd, startDay);
  return {
    startDate: formatExportDate(previousStart),
    endDate: formatExportDate(previousEnd)
  };
}

function openExportPeriodDialog(type) {
  const defaults = getDefaultExportPeriod();
  const labels = {
    sap: { title: "匯出休例假期間", action: "匯出休例假" },
    leave: { title: "匯出請假期間", action: "匯出請假" },
    overtime: { title: "匯出加班期間", action: "匯出加班" }
  };
  const label = labels[type];
  if (!label) return;
  openEntityListModal({
    title: label.title,
    modalClass: "modal modal-member-form",
    body: `<div class="form-grid">
      <div class="form-row"><label for="exportPeriodStart">開始日期</label><input id="exportPeriodStart" type="date" value="${defaults.startDate}"></div>
      <div class="form-row"><label for="exportPeriodEnd">結束日期</label><input id="exportPeriodEnd" type="date" value="${defaults.endDate}"></div>
    </div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-run-period-export="${type}">${label.action}</button>`,
    hideFooterClose: true
  });
}

async function runPeriodExport(type) {
  const startDate = document.getElementById("exportPeriodStart")?.value || "";
  const endDate = document.getElementById("exportPeriodEnd")?.value || "";
  const start = parseExportDate(startDate);
  const end = parseExportDate(endDate);
  if (!start || !end) {
    reportValidationError("請選擇開始日期與結束日期");
    return;
  }
  if (start > end) {
    reportValidationError("開始日期必須早於或等於結束日期");
    return;
  }
  const method = type === "sap" ? "exportSapCsv" : type === "leave" ? "exportLeave" : "exportOvertime";
  const emptyMessage = type === "sap"
    ? "目前沒有可匯出的休例假資料"
    : type === "leave"
      ? "目前沒有可匯出的請假資料"
      : "目前沒有可匯出的加班資料";
  try {
    setSaveStatus("正在準備匯出資料...", true);
    const exportRows = await window.schedulerApi.loadScheduleExportRows(startDate, endDate);
    const result = await window.schedulerApi[method]({
      state,
      startDate,
      endDate,
      exportRows
    });
    if (result?.empty) showInfoMessage(emptyMessage);
    closeModal();
    setSaveStatus("");
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message || error}`);
  }
}
''')

toolbar_path = "src/renderer/renderer-events-toolbar.js"
toolbar = read(toolbar_path)
toolbar = replace_once(toolbar, '''  bindClick("exportSapButton", () => {
    closeCoreActionsMenu();
    exportSapCsv();
  });
  bindClick("exportOvertimeButton", () => {
    closeCoreActionsMenu();
    exportOvertime();
  });
  bindClick("exportLeaveButton", () => {
    closeCoreActionsMenu();
    exportLeave();
  });''', '''  bindClick("exportSapButton", () => {
    closeCoreActionsMenu();
    openExportPeriodDialog("sap");
  });
  bindClick("exportOvertimeButton", () => {
    closeCoreActionsMenu();
    openExportPeriodDialog("overtime");
  });
  bindClick("exportLeaveButton", () => {
    closeCoreActionsMenu();
    openExportPeriodDialog("leave");
  });''', "toolbar export handlers")
write(toolbar_path, toolbar)

click_path = "src/renderer/renderer-events-click.js"
click = read(click_path)
click = replace_once(click, '''    if (target.dataset.exportMealReport) {
      const result = await window.schedulerApi.exportMealReport(recordsState.mealStats);
      if (result.empty) showInfoMessage("目前沒有可匯出的訂餐資料");
      return;
    }
''', '''    if (target.dataset.exportMealReport) {
      const result = await window.schedulerApi.exportMealReport(recordsState.mealStats);
      if (result.empty) showInfoMessage("目前沒有可匯出的訂餐資料");
      return;
    }
    if (target.dataset.runPeriodExport) {
      await runPeriodExport(target.dataset.runPeriodExport);
      return;
    }
''', "delegated period export handler")
write(click_path, click)

build_path = "scripts/build-js.js"
build = read(build_path)
for module_line in ['  "renderer-export-availability.js",\n', '  "renderer-period-exports.js",\n']:
    if module_line not in build:
        raise RuntimeError(f"build-js missing expected module line: {module_line.strip()}")
    build = build.replace(module_line, "", 1)
write(build_path, build)

for obsolete in [
    ROOT / "src/renderer/renderer-export-availability.js",
    ROOT / "src/renderer/renderer-period-exports.js",
]:
    if not obsolete.exists():
        raise RuntimeError(f"expected obsolete module is missing: {obsolete}")
    obsolete.unlink()


# --------------------------------------------------------------------------------------
# Supabase SQL：全新系統只保留 001 + 002，移除舊資料遷移與雙軌結構。
# --------------------------------------------------------------------------------------
def split_sql_statements(text: str):
    statements = []
    start = 0
    i = 0
    state = "normal"
    dollar_tag = ""
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if state == "normal":
            if ch == "'":
                state = "single"
            elif ch == '"':
                state = "double"
            elif ch == "-" and nxt == "-":
                state = "line_comment"
                i += 1
            elif ch == "/" and nxt == "*":
                state = "block_comment"
                i += 1
            elif ch == "$":
                match = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", text[i:])
                if match:
                    dollar_tag = match.group(0)
                    state = "dollar"
                    i += len(dollar_tag) - 1
            elif ch == ";":
                statements.append(text[start:i + 1])
                start = i + 1
        elif state == "single":
            if ch == "'":
                if nxt == "'":
                    i += 1
                else:
                    state = "normal"
        elif state == "double":
            if ch == '"':
                if nxt == '"':
                    i += 1
                else:
                    state = "normal"
        elif state == "line_comment":
            if ch == "\n":
                state = "normal"
        elif state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "normal"
                i += 1
        elif state == "dollar":
            if text.startswith(dollar_tag, i):
                i += len(dollar_tag) - 1
                state = "normal"
        i += 1
    if start < len(text):
        statements.append(text[start:])
    return statements


legacy_sql_tokens = [
    "attendance_records",
    "attendance_action_logs",
    "attendance_overtime_requests",
    "overtime_review_logs",
    "admin_review_overtime_requests_v2",
    "admin_update_attendance_record",
    "save_attendance_overtime_request",
    "get_next_overtime_version",
    "delete_member_account_v3",
]


def remove_legacy_sql(text: str) -> str:
    kept = []
    for statement in split_sql_statements(text):
        lowered = statement.lower()
        if any(token in lowered for token in legacy_sql_tokens):
            continue
        kept.append(statement)
    cleaned = "".join(kept)
    cleaned = "\n".join(
        line for line in cleaned.splitlines()
        if not any(token in line.lower() for token in legacy_sql_tokens)
        and "舊出勤" not in line
        and "舊打卡" not in line
        and "舊加班" not in line
        and "legacy attendance" not in line.lower()
    )
    return cleaned.strip() + "\n"


ledger = read("supabase/003_attendance_ledger.sql")
ledger = regex_once(
    ledger,
    r"-- =+\n-- 舊打卡、加班與稽核資料非破壞性遷移\n-- =+\n.*?(?=-- =+\n-- 每日簽到原子打卡 RPC)",
    "",
    "remove attendance migration section",
)
ledger = re.sub(
    r"\A-- 福圓號 Supabase 每日簽到簿正式更新\n--\n-- 執行順序：.*?\n-- 舊資料表暫時保留供發布切換與回滾使用；正式前端切換完成後再另行清除。\n",
    "-- 福圓號 Supabase 每日簽到簿正式結構\n-- 本區段為全新環境的唯一簽到資料模型，不包含資料遷移、雙寫或回滾相容層。\n",
    ledger,
    count=1,
    flags=re.S,
)

cleanup = read("supabase/004_remove_legacy_attendance.sql")
v4_match = re.search(
    r"create or replace function public\.delete_member_account_v4\(p_target_id uuid\).*?\n\$\$;",
    cleanup,
    flags=re.S,
)
if not v4_match:
    raise RuntimeError("cannot extract delete_member_account_v4")
member_delete_sql = v4_match.group(0) + '''

revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
'''
ledger = ledger.rstrip() + '''

-- ============================================================================================
-- 人員刪除歷史保護
-- ============================================================================================

''' + member_delete_sql
ledger = remove_legacy_sql(ledger)

schema = remove_legacy_sql(read("supabase/001_current_schema.sql"))
updates = remove_legacy_sql(read("supabase/002_current_updates.sql"))

schema = schema.rstrip() + '''


-- ============================================================================================
-- 每日簽到簿正式結構
-- ============================================================================================

''' + ledger

for label, sql in [("schema", schema), ("updates", updates)]:
    lowered = sql.lower()
    remaining = [token for token in legacy_sql_tokens if token in lowered]
    if remaining:
        raise RuntimeError(f"{label} still contains legacy SQL tokens: {remaining}")

write("supabase/001_current_schema.sql", schema)
write("supabase/002_current_updates.sql", updates)
(ROOT / "supabase/003_attendance_ledger.sql").unlink()
(ROOT / "supabase/004_remove_legacy_attendance.sql").unlink()


# --------------------------------------------------------------------------------------
# 文件：正式格式、資料模型與建置規則只描述目前唯一版本。
# --------------------------------------------------------------------------------------
write("README.md", '''# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋班表、簽到簿、訂餐、個人記錄、簽到審核與管理設定。前端由 GitHub Pages 發布；登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

詳細功能、資料、安全、介面與驗收規格以 [`規格書.md`](規格書.md) 為唯一正式依據。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ Supabase Auth Token
Supabase Edge Functions／REST／RPC
  ↓ 身分、角色、伺服器時間、位置與交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 靜態檔案。
- 前端正式原始碼位於 `src/renderer/`。
- `src/renderer/app.css`、`src/renderer/app.js` 與 `docs/` 都是自動產生檔，不直接修改。
- Supabase Auth 負責登入身分。
- PostgreSQL、RLS、限制與 RPC 負責正式資料、權限與交易一致性。
- `supabase/functions/` 只保存目前正式 Edge Function；資料夾清單必須與 `scripts/deploy-edge-functions.ps1` 一致。

## 單一正式版本原則

本系統尚未正式上線，因此程式庫只維護目前正式資料模型與 API 契約：

- 不保留舊資料表、舊欄位、舊端點、舊 payload 或雙軌讀寫。
- 不以 `try/catch` 靜默退回舊流程；必要正式服務不可用時直接回報錯誤。
- 不以後載入模組覆寫既有函式，不新增 `fix`、`patch`、`override` 或相容代理模組。
- 格式調整直接修改正式匯出器、正式 API 與正式事件處理器。

## 主要頁面

- **首頁：** 登入者姓名、角色、簽到簿、班表、訂餐、修改密碼與登出。
- **簽到簿：**
  - 個人記錄：班表、上下班打卡、上班時數、加班時數、備註與訂餐。
  - 簽到審核：管理員補登／修改、批次審核、批次退回、歷程與正式加班匯出。
  - 今日列直接提供上班及下班打卡。
- **班表：** 八週班表、班別／假別／班表加班、排班工具與各項設定。
- **訂餐：** 今日訂餐、訂餐統計與訂餐設定。

## 專案結構

```text
FYH/
├─ .github/workflows/deploy-pages.yml
├─ docs/                              # GitHub Pages 發布成品
├─ scripts/                           # 建置、檢查、稽核與部署工具
├─ src/
│  ├─ web-server.js
│  └─ renderer/                       # 前端唯一正式原始碼
│     └─ css/                         # CSS 模組原始碼
├─ supabase/
│  ├─ 001_current_schema.sql          # 全新環境完整結構
│  ├─ 002_current_updates.sql         # 仍有效的冪等更新
│  └─ functions/                      # 正式 Edge Function 原始碼
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

## 資料庫建置順序

全新資料庫固定依序執行：

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
```

`001_current_schema.sql` 必須直接建立目前正式資料表、索引、RLS、限制、Trigger 與核心 RPC；不得先建立已淘汰結構再刪除。`002_current_updates.sql` 只保存仍有效且可重複執行的正式更新。Edge Function 部署不會自動執行 SQL。

## 正式 Edge Functions

部署清單以 `scripts/deploy-edge-functions.ps1` 為準，目前包括：

- `member-auth-admin`
- `catalog-admin`
- `attendance-clock`
- `attendance-ledger`
- `attendance-ledger-export`
- `meal-order`
- `department-attendance-v2`
- `member-delete-v2`
- `member-order-v2`
- `meal-report-v2`
- `meal-cancel-v2`

未列入部署清單的端點不得保留原始碼、代理包裝或呼叫分支。

## 本機執行

需要 Node.js 22 或相容版本。在儲存庫根目錄執行：

```bash
npm run css:build
npm run css:check
npm run js:build
npm run js:check
npm run web
npm run web:check
npm run web:publish
npm run scope:check
npm test
npm run renderer:check
npm run css:architecture
npm run js:architecture
npm run ci:check
```

常用指令：

- `npm run web`：建立 bundle 後啟動本機預覽。
- `npm run web:publish`：依來源完整重建 `docs/`。
- `npm test`：執行功能與架構守門測試。
- `npm run renderer:check`：檢查前端 bundle、發布對齊與正式契約。
- `npm run ci:check`：執行正式 CI 的完整本機檢查。

## 修改位置

| 內容 | 正式位置 |
|---|---|
| HTML、前端功能與互動 | `src/renderer/` |
| CSS | `src/renderer/css/` |
| 資料庫、RLS、RPC | `supabase/*.sql` |
| 後端 API | `supabase/functions/` |
| 建置與驗證 | `scripts/` |
| 測試 | `tests/` |
| 正式規格 | `規格書.md` |
| 發布成品 | 由 `npm run web:publish` 產生至 `docs/` |

## 發布流程

1. 修改正式來源。
2. 執行 `npm run web:publish`。
3. 執行 `npm run ci:check`。
4. 依順序套用 SQL。
5. 部署正式 Edge Functions。
6. 合併至 `main`。
7. GitHub Pages 由內建 `pages-build-deployment` 發布 `main/docs`。
8. 以員工、主管與管理員測試登入、簽到簿、班表、訂餐與主要管理入口。

`.github/workflows/deploy-pages.yml` 是唯一正式 GitHub Actions 驗證流程；不得新增重複監聽或自動改寫程式碼的 workflow。
''')

agents_path = "AGENTS.md"
agents = read(agents_path)
agents = replace_once(
    agents,
    "8. 新增或重構 API 時，需定義穩定錯誤碼、角色、Request／Response、切換與回滾方式；正式程式不得永久保留舊端點、雙軌欄位、代理包裝或只供測試使用的出口。",
    "8. 新增或重構 API 時，需直接更新唯一正式的錯誤碼、角色與 Request／Response 契約；本系統尚未上線，不保留切換期雙軌、舊端點、舊欄位、相容代理或回滾分支。",
    "AGENTS API compatibility rule",
)
agents = replace_once(
    agents,
    "4. 不新增零散的一次性 SQL、migration 子檔或額外 SQL 順序文件。",
    "4. 不新增零散的一次性 SQL、migration 子檔或額外 SQL 順序文件；全新環境不得先建立淘汰結構再執行清理。",
    "AGENTS SQL canonical rule",
)
write(agents_path, agents)

spec_path = "規格書.md"
spec = read(spec_path)
spec = replace_once(
    spec,
    "5. 簽到審核的「匯出加班」只輸出已審且加班時數大於 0 的資料，並沿用既有 12 欄格式：員工編號、加班日期、加班時間(起)、加班時間(迄)、前一日、加班補貼類型、休息1(起)、休息1(迄)、支薪1、休息2(起)、休息2(迄)、支薪2。",
    "5. 簽到審核的「匯出加班」只輸出已審且加班時數大於 0 的資料；正式唯一格式為 12 欄：員工編號、加班日期、加班時間(起)、加班時間(迄)、前一日、加班補貼類型、休息1(起)、休息1(迄)、支薪1、休息2(起)、休息2(迄)、支薪2。",
    "spec canonical overtime format wording",
)
spec = replace_once(
    spec,
    "前端不得再呼叫已淘汰的個人記錄、加班或打卡管理端點。",
    "前端只呼叫上述正式端點；不得保留舊端點分支，也不得由後載入模組覆寫 `schedulerApi` 或 `schedulerBrowserExporter` 的正式函式。",
    "spec no runtime override rule",
)
spec = regex_once(
    spec,
    r"## 4\.3 舊結構清理決策\n.*?Edge Function 部署不會自動執行 SQL；SQL 任何一步失敗時立即停止，不可跳過錯誤。",
    '''## 4.3 唯一正式資料結構

1. 簽到資料只使用 `attendance_days` 與 `attendance_audit_logs`。
2. 不建立舊出勤資料表、舊加班申請資料表或舊審核紀錄表。
3. 不進行資料遷移、雙寫、欄位猜測、相容代理或舊端點轉送。
4. 必要正式服務不可用時直接回報錯誤，不得靜默退回本機資料或替代流程。

## 4.4 SQL 建置順序

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
```

`001_current_schema.sql` 必須直接建立唯一正式結構；`002_current_updates.sql` 只保存仍有效且具冪等性的更新。Edge Function 部署不會自動執行 SQL；SQL 任何一步失敗時立即停止，不可跳過錯誤。''',
    "spec canonical schema section",
)
write(spec_path, spec)


# --------------------------------------------------------------------------------------
# 測試與架構守門。
# --------------------------------------------------------------------------------------
write("tests/browser-exporter.test.js", '''const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function loadExporter() {
  const previousWindow = global.window;
  global.window = {};
  const modulePath = path.resolve(__dirname, "../src/renderer/browser-exporter.js");
  delete require.cache[modulePath];
  require(modulePath);
  const exporter = global.window.schedulerBrowserExporter;
  if (previousWindow === undefined) delete global.window;
  else global.window = previousWindow;
  return exporter;
}

const exporter = loadExporter();

test("正式請假匯出排除休例假、隱藏單位與無假別資料", () => {
  const rows = exporter.getLeaveExportRows({
    state: { departments: [{ id: "hidden", hiddenFromSchedule: true }] },
    exportRows: [
      { employee_code: "A001", work_date: "2026-07-17", home_department_id: "visible", leave_type_id: "leave-1", leave_code: "0010", leave_name: "事假", leave_reason: "家庭因素", leave_all_day: true },
      { employee_code: "A002", work_date: "2026-07-18", home_department_id: "visible", leave_type_id: "leave-2", leave_code: "0020", leave_name: "病假", leave_all_day: false, leave_start_time: "08:05:00", leave_end_time: "12:30:00" },
      { employee_code: "A003", work_date: "2026-07-19", home_department_id: "visible", leave_type_id: "leave-rest", leave_code: "0036", leave_name: "例假" },
      { employee_code: "A004", work_date: "2026-07-20", home_department_id: "hidden", leave_type_id: "leave-hidden", leave_code: "0010", leave_name: "事假" },
      { employee_code: "A005", work_date: "2026-07-21", home_department_id: "visible", leave_type_id: null, leave_code: "0010", leave_name: "事假" }
    ]
  });
  assert.deepEqual(rows, [
    ["A001", "20260717", "20260717", "", "", "0010", "家庭因素"],
    ["A002", "20260718", "20260718", "0805", "1230", "0020", "病假"]
  ]);
});

test("正式加班匯出輸出十二欄時間與休息區段", () => {
  const rows = exporter.getOvertimeExportRows({
    exportRows: [{
      employee_code: "A001",
      work_date: "2026-07-17",
      overtime_type_id: "ot-1",
      overtime_start_time: "18:00:00",
      overtime_end_time: "21:30:00",
      overtime_use_rest_1: true,
      overtime_rest_1_start_time: "19:00:00",
      overtime_rest_1_end_time: "19:30:00",
      overtime_use_rest_2: false
    }]
  });
  assert.deepEqual(rows, [["A001", "20260717", "1800", "2130", 0, 1, "1900", "1930", 0, "", "", ""]]);
});

test("正式 SAP 休例假匯出套用代碼並排除日薪人員", () => {
  const rows = exporter.getSapLeaveExportRows({
    exportRows: [
      { employee_name: "王小明", employee_code: "A001", work_date: "2026-07-17", pay_by_day: false, leave_type_id: "leave-rest", leave_code: "0047", leave_name: "休息日" },
      { employee_name: "陳小華", employee_code: "A002", work_date: "2026-07-18", pay_by_day: false, leave_type_id: "leave-off", leave_code: "", leave_name: "例假" },
      { employee_name: "日薪人員", employee_code: "A003", work_date: "2026-07-19", pay_by_day: true, leave_type_id: "leave-rest", leave_code: "0047", leave_name: "休息日" }
    ]
  });
  assert.deepEqual(rows, [
    ["王小明", "A001", "20260717", "20260717", "REST"],
    ["陳小華", "A002", "20260718", "20260718", "OFF"]
  ]);
});

test("SAP CSV 保留 BOM 並正確跳脫逗號與雙引號", () => {
  const csv = exporter.buildSapLeaveCsvContent({
    exportRows: [{ employee_name: '王,小"明', employee_code: "A001", work_date: "2026-05-02", pay_by_day: false, leave_type_id: "rest", leave_code: "0047", leave_name: "休息日" }]
  });
  assert.equal(csv.startsWith("\\uFEFF"), true);
  assert.equal(csv.includes('"王,小""明"'), true);
  assert.equal(csv.includes("A001,20260502,20260502,REST"), true);
});
''')

write("tests/attendance-review-overtime-export-format.test.js", '''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核匯出使用正式 exportRows 十二欄契約", () => {
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  const spec = read("規格書.md");

  assert.match(webApi, /async function exportAttendanceReview[\\s\\S]*const exportRows =/);
  assert.match(webApi, /overtime_type_id: "attendance-ledger"/);
  assert.match(webApi, /return exportOvertime\\(\\{/);
  assert.doesNotMatch(webApi + exporter, /approvedOvertimeRows/);
  assert.match(exporter, /function requireExportRows/);
  assert.match(exporter, /"員工編號",[\\s\\S]*"加班日期",[\\s\\S]*"加班時間\\(起\\)",[\\s\\S]*"加班時間\\(迄\\)"/);
  assert.match(spec, /正式唯一格式為 12 欄/);
  assert.match(spec, /2\\.5 小時輸出 `0230`/);
});
''')

architecture_path = "tests/codebase-architecture-guards.test.js"
architecture = read(architecture_path)
architecture = replace_once(
    architecture,
    '    "supabase/functions/member-auth-admin-v2/index.ts"\n',
    '    "supabase/functions/member-auth-admin-v2/index.ts",\n    "src/renderer/renderer-period-exports.js",\n    "src/renderer/renderer-export-availability.js",\n    "supabase/003_attendance_ledger.sql",\n    "supabase/004_remove_legacy_attendance.sql"\n',
    "architecture obsolete file guards",
)
architecture = architecture.rstrip() + '''

test("匯出流程不得由後載入模組覆寫正式 API 或匯出器", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const offenders = fs.readdirSync(rendererDir)
    .filter((name) => name.endsWith(".js") && !["app.js", "browser-exporter.js", "web-api.js"].includes(name))
    .filter((name) => /(?:schedulerBrowserExporter|schedulerApi)\.[A-Za-z0-9_]+\s*=/.test(read(`src/renderer/${name}`)));
  assert.deepEqual(offenders, []);
  const exporter = read("src/renderer/browser-exporter.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotMatch(exporter + webApi, /approvedOvertimeRows|hasOfficialScheduleExportRows|originalExporters/);
});
'''
write(architecture_path, architecture)

write("tests/canonical-schema.test.js", '''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("全新資料庫只保留兩個正式 SQL 檔與每日簽到模型", () => {
  const schema = read("supabase/001_current_schema.sql");
  const updates = read("supabase/002_current_updates.sql");
  const combined = schema + updates;
  assert.equal(fs.existsSync(path.join(root, "supabase/003_attendance_ledger.sql")), false);
  assert.equal(fs.existsSync(path.join(root, "supabase/004_remove_legacy_attendance.sql")), false);
  assert.match(schema, /create table if not exists public\.attendance_days/);
  assert.match(schema, /create table if not exists public\.attendance_audit_logs/);
  for (const name of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs", "delete_member_account_v3"]) {
    assert.equal(combined.includes(name), false, `SQL 仍包含淘汰結構：${name}`);
  }
});

test("正式文件不得描述切換期相容或補丁式執行", () => {
  const docs = [read("README.md"), read("AGENTS.md"), read("規格書.md")].join("\\n");
  assert.match(docs, /單一正式版本原則|唯一正式資料結構/);
  assert.doesNotMatch(docs, /004_remove_legacy_attendance|沿用既有 12 欄格式|平台暫時無法實體刪除/);
});
''')

normalized_path = "scripts/check-normalized-storage.js"
normalized = read(normalized_path)
normalized = regex_once(
    normalized,
    r'''assert\(schema\.includes\("create table if not exists public\.attendance_records"\), "schema should create attendance records"\);.*?assert\(schema\.includes\("create table if not exists public\.overtime_review_logs"\), "schema should create overtime review logs"\);''',
    '''assert(schema.includes("create table if not exists public.attendance_days"), "schema should create daily attendance rows");
assert(schema.includes("create table if not exists public.attendance_audit_logs"), "schema should create attendance audit logs");
assert(schema.includes("regular_minutes smallint") && schema.includes("overtime_minutes smallint"), "attendance days should store half-hour work totals");
assert(!schema.includes("attendance_records") && !schema.includes("attendance_action_logs"), "schema should not create retired attendance tables");
assert(!schema.includes("attendance_overtime_requests") && !schema.includes("overtime_review_logs"), "schema should not create retired overtime review tables");''',
    "normalized storage attendance assertions",
)
normalized = normalized.rstrip() + '''

assert(!fs.existsSync(path.join(rootDir, "supabase", "003_attendance_ledger.sql")), "canonical schema should not keep a third attendance migration file");
assert(!fs.existsSync(path.join(rootDir, "supabase", "004_remove_legacy_attendance.sql")), "canonical schema should not keep a legacy cleanup file");
assert(!webApi.includes("approvedOvertimeRows"), "attendance export should use the canonical exportRows contract");
assert(!fs.existsSync(path.join(rootDir, "src", "renderer", "renderer-period-exports.js")), "period export runtime override module still exists");
'''
write(normalized_path, normalized)

ledger_test_path = "tests/attendance-ledger-refactor.test.js"
ledger_test = read(ledger_test_path)
ledger_test = ledger_test.rstrip() + '''

test("正式 SQL 不保留舊出勤結構或遷移檔", () => {
  const schema = read("supabase/001_current_schema.sql");
  const updates = read("supabase/002_current_updates.sql");
  for (const oldName of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
    assert.equal((schema + updates).includes(oldName), false, `仍有舊 SQL 結構：${oldName}`);
  }
  assert.equal(fs.existsSync(path.join(root, "supabase", "003_attendance_ledger.sql")), false);
  assert.equal(fs.existsSync(path.join(root, "supabase", "004_remove_legacy_attendance.sql")), false);
});
'''
write(ledger_test_path, ledger_test)


# 最終靜態守門：不得留下相容層或補丁模組名稱。
for path in [
    "src/renderer/browser-exporter.js",
    "src/renderer/web-api.js",
    "src/renderer/renderer-export-actions.js",
    "scripts/build-js.js",
]:
    source = read(path)
    for forbidden in ["approvedOvertimeRows", "originalExporters", "installRangeExporters"]:
        if forbidden in source:
            raise RuntimeError(f"{path} still contains forbidden compatibility symbol: {forbidden}")
