from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "renderer"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


def top_function_span(text: str, name: str, indent: str = "") -> tuple[int, int]:
    pattern = re.compile(rf"(?m)^{re.escape(indent)}(?:async\s+)?function\s+{re.escape(name)}\s*\(")
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"找不到函式：{name}")
    next_pattern = re.compile(rf"(?m)^{re.escape(indent)}(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(")
    next_match = next_pattern.search(text, match.end())
    end = next_match.start() if next_match else len(text)
    return match.start(), end


def replace_top_function(path: str, name: str, replacement: str, indent: str = "") -> None:
    text = read(path)
    start, end = top_function_span(text, name, indent)
    write(path, text[:start] + replacement.rstrip() + "\n\n" + text[end:].lstrip("\n"))


def remove_top_function(path: str, name: str, indent: str = "") -> None:
    text = read(path)
    start, end = top_function_span(text, name, indent)
    write(path, text[:start] + text[end:].lstrip("\n"))


def replace_between(path: str, start_marker: str, end_marker: str, replacement: str) -> None:
    text = read(path)
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise RuntimeError(f"找不到區段：{path}: {start_marker} .. {end_marker}")
    write(path, text[:start] + replacement.rstrip() + "\n\n" + text[end:])


# 1. 單一狀態模型
replace_top_function("src/renderer/renderer-foundation.js", "createAttendanceState", '''function createAttendanceState() {
  return { saving: false, error: "" };
}''')
remove_top_function("src/renderer/renderer-foundation.js", "createAttendanceOvertimeState")
replace_top_function("src/renderer/renderer-foundation.js", "resetLoadedUserRuntimeState", '''function resetLoadedUserRuntimeState() {
  currentMember = null;
  attendanceState = createAttendanceState();
  mealOrderState = createMealOrderState();
  recordsState = createRecordsState();
  appInfo = null;
}''')
replace_top_function("src/renderer/renderer-foundation.js", "createRecordsState", '''function createRecordsState() {
  const today = getTodayDateString();
  return {
    loading: false,
    activeTab: "personal",
    personal: [],
    personalFilters: { fromDate: addDaysToDateString(today, -49), toDate: today },
    personalPage: 1,
    personalTotal: 0,
    personalPageSize: 50,
    mealStats: null,
    mealFilters: { fromDate: today, toDate: today, departmentId: "", memberId: "" },
    attendanceReview: {
      loading: false,
      rows: [],
      members: [],
      issueTypes: [],
      total: 0,
      page: 1,
      pageSize: 50,
      filters: {
        status: "unreviewed",
        fromDate: addDaysToDateString(today, -30),
        toDate: today,
        memberId: "",
        issueType: ""
      },
      error: ""
    },
    mealAdmin: { loading: false, products: [], settings: { daily_cutoff_time: "10:30" }, error: "" },
    error: ""
  };
}''')

renderer_js = read("src/renderer/renderer.js")
renderer_js = renderer_js.replace("let attendanceOvertimeState = createAttendanceOvertimeState();\n", "")
write("src/renderer/renderer.js", renderer_js)

# 2. 首頁移除打卡入口，記錄改為簽到簿
replace_top_function("src/renderer/renderer-main-pages.js", "renderHomeDashboard", '''function renderHomeDashboard() {
  const homeCard = document.getElementById("homeCard");
  if (!homeCard) return;
  if (!isLoggedIn()) {
    homeCard.innerHTML = "";
    return;
  }
  homeCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">福圓號</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      <div class="home-header-actions">
        <button class="ghost-btn home-password-btn" type="button" data-open-change-password="true">修改密碼</button>
        <button class="ghost-btn home-signout-btn" type="button" id="homeSignOutButton">登出</button>
      </div>
    </div>
    <div class="home-action-grid home-action-grid-three">
      <button class="home-action-card" type="button" data-home-action="schedule">
        <span class="home-action-title">班表</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="meal">
        <span class="home-action-title">訂餐</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="records">
        <span class="home-action-title">簽到簿</span>
      </button>
    </div>
  `;
}''')
remove_top_function("src/renderer/renderer-main-pages.js", "renderClockPage")
remove_top_function("src/renderer/renderer-main-pages.js", "getOvertimeStatusLabel")
main_pages = read("src/renderer/renderer-main-pages.js").replace("首頁、打卡頁與今日訂餐頁渲染。", "首頁與今日訂餐頁渲染。")
write("src/renderer/renderer-main-pages.js", main_pages)

# 3. 打卡改成簽到簿表格內共用動作
write("src/renderer/renderer-attendance-page.js", '''/* 簽到簿表格內的定位與上、下班打卡控制。 */

function formatClockTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function getBrowserPosition() {
  const userAgent = navigator.userAgent || "";
  const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0
    && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
  const isPhone = Boolean(navigator.userAgentData?.mobile || narrowTouch
    || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent)));
  if (!isPhone || !navigator.geolocation) return Promise.resolve({});
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "手機定位權限未開啟，請允許瀏覽器定位後再打卡"
          : error.code === error.TIMEOUT
            ? "手機定位逾時，請到空曠處或重新開啟定位後再打卡"
            : "手機無法取得 GPS 定位，請確認定位服務已開啟";
        resolve({ geolocationError: message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function submitAttendanceClock(action, workDate) {
  if (!isLoggedIn()) {
    openSignInDialog();
    return;
  }
  if (workDate !== getTodayDateString()) {
    showInfoMessage("只能在今天的紀錄列打卡");
    return;
  }
  if (attendanceState.saving) return;
  const label = action === "clock_in" ? "上班" : "下班";
  const confirmed = await confirmAction(`確定要${label}打卡嗎？`);
  if (!confirmed) return;
  attendanceState = { saving: true, error: "" };
  renderAll();
  try {
    const position = await getBrowserPosition();
    await window.schedulerApi.clockAttendance(action, position);
    attendanceState = { saving: false, error: "" };
    await loadRecordsPage();
    showInfoMessage(`${label}打卡完成`);
  } catch (error) {
    attendanceState = { saving: false, error: error.message || "打卡失敗" };
    showInfoMessage(attendanceState.error);
    renderAll();
  }
}
''')

# 4. 記錄頁資料讀取只保留個人記錄與簽到審核
write("src/renderer/renderer-records-page.js", '''/* 簽到簿、訂餐統計及訂餐設定資料讀取控制。 */

function ensureRecordsState() {
  const today = getTodayDateString();
  recordsState.personalFilters = recordsState.personalFilters || {
    fromDate: addDaysToDateString(today, -49),
    toDate: today
  };
  recordsState.personalPage = Number(recordsState.personalPage || 1);
  recordsState.personalTotal = Number(recordsState.personalTotal || 0);
  recordsState.personalPageSize = Number(recordsState.personalPageSize || 50);
  recordsState.mealPage = Number(recordsState.mealPage || 1);
  recordsState.mealReportView = recordsState.mealReportView || "detail";
  recordsState.attendanceReview = recordsState.attendanceReview || createRecordsState().attendanceReview;
  return recordsState;
}

function ensureAttendanceReviewState() {
  ensureRecordsState();
  const current = recordsState.attendanceReview || {};
  const filters = current.filters || {};
  recordsState.attendanceReview = {
    loading: Boolean(current.loading),
    rows: current.rows || [],
    members: current.members || [],
    issueTypes: current.issueTypes || [],
    total: Number(current.total || 0),
    page: Number(current.page || 1),
    pageSize: Number(current.pageSize || 50),
    filters: {
      status: filters.status || "unreviewed",
      fromDate: filters.fromDate || addDaysToDateString(getTodayDateString(), -30),
      toDate: filters.toDate || getTodayDateString(),
      memberId: filters.memberId || "",
      issueType: filters.issueType || ""
    },
    error: current.error || ""
  };
  return recordsState.attendanceReview;
}

async function loadRecordsPage() {
  if (!isLoggedIn()) return;
  ensureRecordsState();
  recordsState = { ...recordsState, loading: true, error: "" };
  renderAll();
  try {
    const result = await window.schedulerApi.getPersonalRecords({
      ...recordsState.personalFilters,
      page: recordsState.personalPage
    });
    recordsState = {
      ...recordsState,
      loading: false,
      personal: result.records || [],
      personalTotal: Number(result.total || 0),
      personalPage: Number(result.page || 1),
      personalPageSize: Number(result.pageSize || 50),
      error: ""
    };
    if (isAdmin()) await loadAttendanceReview(false);
  } catch (error) {
    recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取簽到簿失敗" };
  }
  renderAll();
}

async function loadAttendanceReview(shouldRender = true) {
  if (!isAdmin()) return;
  const review = ensureAttendanceReviewState();
  recordsState = {
    ...recordsState,
    attendanceReview: { ...review, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getAttendanceReviewList({
      ...recordsState.attendanceReview.filters,
      page: recordsState.attendanceReview.page
    });
    recordsState = {
      ...recordsState,
      attendanceReview: {
        ...recordsState.attendanceReview,
        loading: false,
        rows: result.rows || [],
        members: result.members || [],
        issueTypes: result.issueTypes || [],
        total: Number(result.total || 0),
        page: Number(result.page || 1),
        pageSize: Number(result.pageSize || 50),
        error: ""
      }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      attendanceReview: {
        ...recordsState.attendanceReview,
        loading: false,
        rows: [],
        error: error.message || "讀取簽到審核失敗"
      }
    };
  }
  if (shouldRender) renderAll();
}

async function loadMealReport(shouldRender = true) {
  if (!isManager()) return;
  ensureRecordsState();
  recordsState = { ...recordsState, mealStats: { ...(recordsState.mealStats || {}), loading: true, error: "" } };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getMealReport({
      ...recordsState.mealFilters,
      page: recordsState.mealPage
    });
    recordsState = { ...recordsState, mealStats: result, mealPage: Number(result.page || 1) };
  } catch (error) {
    recordsState = { ...recordsState, mealStats: { error: error.message || "讀取訂餐統計失敗" } };
  }
  if (shouldRender) renderAll();
}

async function loadMealAdminSettings(shouldRender = true) {
  if (!isManager()) return;
  recordsState = {
    ...recordsState,
    mealAdmin: { ...recordsState.mealAdmin, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getMealAdminSettings();
    recordsState = {
      ...recordsState,
      mealAdmin: { loading: false, products: result.products || [], settings: result.settings || { daily_cutoff_time: "10:30" }, error: "" }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      mealAdmin: { ...recordsState.mealAdmin, loading: false, error: error.message || "讀取訂餐設定失敗" }
    };
  }
  if (shouldRender) renderAll();
}
''')

# 5. 簽到簿畫面
replace_top_function("src/renderer/renderer-records-views.js", "renderRecordsTabs", '''function renderRecordsTabs() {
  const tabs = [
    ["personal", "個人記錄", true],
    ["review", "簽到審核", isAdmin()]
  ].filter((tab) => tab[2]);
  if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
  return `<div class="record-tabs" role="tablist" aria-label="簽到簿分頁">${tabs.map(([id, label]) => `<button class="ghost-btn page-tab-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" role="tab" aria-selected="${recordsState.activeTab === id ? "true" : "false"}" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
}''')

replace_top_function("src/renderer/renderer-records-views.js", "punchLine", '''function attendanceLocationName(location) {
  if (!location || typeof location !== "object") return "";
  return location.name || location.address || location.source || "";
}

function renderPunchLine(label, value, location) {
  if (!value) return "";
  const place = attendanceLocationName(location);
  return `<div class="attendance-punch-line"><span>${escapeHtml(label)} ${escapeHtml(formatRecordDateTime(value))}</span>${place ? `<small>${escapeHtml(place)}</small>` : ""}</div>`;
}

function renderPersonalClockCell(record) {
  const today = record.date === getTodayDateString();
  const editable = today && record.editable !== false && !record.reviewed;
  const lines = [
    renderPunchLine("上班", record.clockIn, record.clockInLocation),
    renderPunchLine("下班", record.clockOut, record.clockOutLocation)
  ].filter(Boolean);
  const buttons = editable ? `<div class="attendance-clock-buttons">
    ${record.clockIn ? "" : `<button class="ghost-btn compact-btn" type="button" data-personal-clock-action="clock_in" data-personal-clock-date="${escapeHtml(record.date)}">上班打卡</button>`}
    ${record.clockOut ? "" : `<button class="ghost-btn compact-btn" type="button" data-personal-clock-action="clock_out" data-personal-clock-date="${escapeHtml(record.date)}">下班打卡</button>`}
  </div>` : "";
  return `<div class="attendance-clock-stack">${lines.join("") || '<span class="attendance-empty-value">-</span>'}${buttons}</div>`;
}

function renderPersonalHoursInput(record, field) {
  const value = record[field];
  const editable = record.editable !== false && !record.reviewed;
  return `<input class="attendance-hours-input" type="number" min="0" step="0.5" inputmode="decimal" value="${value === null || value === undefined ? "" : escapeHtml(String(value))}" data-personal-attendance-field="${field}" data-personal-attendance-date="${escapeHtml(record.date)}" ${editable ? "" : "disabled"}>`;
}

function renderReviewStatus(reviewed) {
  return `<span class="attendance-review-status ${reviewed ? "is-reviewed" : "is-unreviewed"}">${reviewed ? "已審" : "未審"}</span>`;
}''')

replace_top_function("src/renderer/renderer-records-views.js", "renderPersonalRecordsSection", '''function renderPersonalRecordsSection() {
  ensureRecordsState();
  const filters = recordsState.personalFilters;
  const page = Number(recordsState.personalPage || 1);
  const pageSize = Number(recordsState.personalPageSize || 50);
  const total = Number(recordsState.personalTotal || 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return `<section class="records-section">
    <div class="records-admin-toolbar personal-record-toolbar">
      <div class="records-admin-filters personal-record-filters">
        <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-personal-record-filter="fromDate"></label>
        <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-personal-record-filter="toDate"></label>
      </div>
    </div>
    ${attendanceState.error ? `<div class="auth-error">${escapeHtml(attendanceState.error)}</div>` : ""}
    <div class="records-table-wrap"><table class="records-table personal-record-table attendance-ledger-table">
      <thead><tr><th>日期</th><th class="personal-schedule-icon-col">圖示</th><th>班別</th><th>打卡時間</th><th>上班時數</th><th>加班時數</th><th>備註</th><th>訂餐</th><th>審核</th></tr></thead>
      <tbody>${(recordsState.personal || []).map((record) => `<tr class="${record.date === getTodayDateString() ? "is-today-row" : ""}">
        <td>${escapeHtml(record.date || "")}</td>
        <td class="personal-schedule-icon-col">${renderScheduleIcon(record)}</td>
        <td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>
        <td>${renderPersonalClockCell(record)}</td>
        <td>${renderPersonalHoursInput(record, "regularHours")}</td>
        <td>${renderPersonalHoursInput(record, "overtimeHours")}</td>
        <td>${record.editable !== false && !record.reviewed
          ? `<textarea class="attendance-note-input" rows="2" data-personal-attendance-field="note" data-personal-attendance-date="${escapeHtml(record.date)}">${escapeHtml(record.note || "")}</textarea>`
          : escapeHtml(record.note || "")}</td>
        <td><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>
        <td>${renderReviewStatus(record.reviewed)}</td>
      </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>
    </table></div>
    <div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-personal-record-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-personal-record-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>
  </section>`;
}''')

replace_top_function("src/renderer/renderer-records-views.js", "renderOvertimeReviewPagination", '''function renderAttendanceReviewPagination(review) {
  const page = Number(review.page || 1);
  const pageSize = Number(review.pageSize || 50);
  const total = Number(review.total || 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="records-filter-row records-pagination">
    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
    <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
  </div>`;
}''')

replace_top_function("src/renderer/renderer-records-views.js", "renderOvertimeReviewSection", '''function renderAttendanceReviewSection() {
  const review = ensureAttendanceReviewState();
  const filters = review.filters;
  const rows = review.rows || [];
  return `<section class="records-section">
    <div class="records-admin-toolbar overtime-review-toolbar attendance-review-toolbar">
      <div class="records-admin-filters overtime-review-filters attendance-review-filters">
        <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-attendance-review-filter="fromDate"></label>
        <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-attendance-review-filter="toDate"></label>
        <label class="records-admin-field"><span>人員</span><select data-attendance-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select></label>
        <label class="records-admin-field"><span>異常</span><select data-attendance-review-filter="issueType"><option value="" ${!filters.issueType ? "selected" : ""}>全部顯示</option>${(review.issueTypes || []).map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
        <label class="records-admin-field"><span>狀態</span><select data-attendance-review-filter="status">
          <option value="unreviewed" ${filters.status === "unreviewed" ? "selected" : ""}>未審</option>
          <option value="reviewed" ${filters.status === "reviewed" ? "selected" : ""}>已審</option>
          <option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option>
        </select></label>
      </div>
      <div class="records-admin-actions overtime-review-actions attendance-review-actions">
        <button class="ghost-btn compact-btn" type="button" data-open-admin-attendance-create="true">代為申請</button>
        <button class="ghost-btn compact-btn" type="button" data-export-attendance-review="true">匯出加班</button>
        <button class="primary-btn compact-btn" type="button" data-attendance-review-batch="reviewed">批次審核</button>
        <button class="ghost-btn compact-btn" type="button" data-attendance-review-batch="returned">批次退回</button>
      </div>
    </div>
    ${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}
    <div class="records-table-wrap">
      <table class="records-table attendance-review-table">
        <thead><tr><th class="overtime-review-check-col"><input type="checkbox" data-attendance-review-check-all></th><th>日期</th><th>員工</th><th class="attendance-schedule-icon-col">圖示</th><th>班別</th><th>打卡時間</th><th>上班時數</th><th>加班時數</th><th>備註</th><th>異常</th><th>狀態</th><th>操作</th></tr></thead>
        <tbody>${rows.map((row) => {
          const token = `${row.user_id}:${row.work_date}`;
          return `<tr>
            <td class="overtime-review-check-col"><input type="checkbox" data-attendance-review-check="${escapeHtml(token)}"></td>
            <td>${escapeHtml(row.work_date || "")}</td>
            <td>${escapeHtml(row.employee_name || "")}<br><span>${escapeHtml(row.employee_code || "")}</span></td>
            <td class="attendance-schedule-icon-col">${renderScheduleIcon(row)}</td>
            <td>${escapeHtml(row.shiftName || "-")}<br><span>${escapeHtml(row.shiftTime || "")}</span></td>
            <td>${renderPunchLine("上班", row.clock_in_at, row.clock_in_location) || "-"}${renderPunchLine("下班", row.clock_out_at, row.clock_out_location)}</td>
            <td>${row.regularHours === null || row.regularHours === undefined ? "" : escapeHtml(String(row.regularHours))}</td>
            <td>${row.overtimeHours === null || row.overtimeHours === undefined ? "" : escapeHtml(String(row.overtimeHours))}</td>
            <td>${escapeHtml(row.note || "")}</td>
            <td>${escapeHtml((row.issues || []).join("、") || "正常")}</td>
            <td>${renderReviewStatus(row.reviewed)}</td>
            <td><div class="attendance-review-row-actions">
              <button class="ghost-btn compact-btn" type="button" data-edit-attendance-review="${escapeHtml(token)}">編輯</button>
              <button class="compact-btn attendance-review-toggle ${row.reviewed ? "is-reviewed" : "is-unreviewed"}" type="button" data-toggle-attendance-review="${escapeHtml(token)}" data-reviewed="${row.reviewed ? "true" : "false"}">${row.reviewed ? "已審" : "未審"}</button>
              ${row.id ? `<button class="settings-icon-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}" aria-label="歷程" title="歷程"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg></button>` : ""}
            </div></td>
          </tr>`;
        }).join("") || '<tr><td colspan="12">沒有資料</td></tr>'}</tbody>
      </table>
    </div>
    ${renderAttendanceReviewPagination(review)}
  </section>`;
}''')
remove_top_function("src/renderer/renderer-records-views.js", "renderAttendanceAdminSection")
records_views = read("src/renderer/renderer-records-views.js").replace("個人記錄、訂餐統計、加班審核、打卡管理與訂餐設定畫面。", "個人記錄、簽到審核、訂餐統計與訂餐設定畫面。")
write("src/renderer/renderer-records-views.js", records_views)

# 6. 操作函式：員工直接填寫、管理員編輯與兩態審核
record_actions = read("src/renderer/renderer-records-actions.js")
meal_start = record_actions.find("function readMealAdminProducts()")
if meal_start < 0:
    raise RuntimeError("找不到訂餐設定操作區段")
attendance_actions = '''/* 簽到簿、簽到審核與訂餐設定操作。 */

function timeValueFromIso(value) {
  return value ? formatClockTime(value) : "";
}

function findAttendanceReviewRow(token) {
  const [userId, workDate] = String(token || "").split(":");
  return ensureAttendanceReviewState().rows.find((row) => row.user_id === userId && row.work_date === workDate)
    || { user_id: userId, work_date: workDate };
}

function openAttendanceReviewEditModal(token) {
  const row = findAttendanceReviewRow(token);
  openEntityListModal({
    title: "編輯簽到紀錄",
    hideFooterClose: true,
    body: `<div class="form-grid two-col">
      <div class="form-row"><label>上班時間</label><input id="reviewClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>
      <div class="form-row"><label>下班時間</label><input id="reviewClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>
      <div class="form-row"><label>上班時數</label><input id="reviewRegularHours" type="number" min="0" step="0.5" value="${row.regularHours === null || row.regularHours === undefined ? "" : escapeHtml(String(row.regularHours))}"></div>
      <div class="form-row"><label>加班時數</label><input id="reviewOvertimeHours" type="number" min="0" step="0.5" value="${row.overtimeHours === null || row.overtimeHours === undefined ? "" : escapeHtml(String(row.overtimeHours))}"></div>
      <div class="form-row form-row-wide"><label>備註</label><textarea id="reviewAttendanceNote" rows="4">${escapeHtml(row.note || "")}</textarea></div>
      <div class="form-row form-row-wide"><label>本次異動原因</label><textarea id="reviewAttendanceReason" rows="2" placeholder="選填，會保存於修改歷程"></textarea></div>
    </div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-review="${escapeHtml(token)}">儲存</button>`
  });
}

async function saveAttendanceReviewEdit(token) {
  const row = findAttendanceReviewRow(token);
  try {
    await window.schedulerApi.saveAttendanceReviewRecord({
      userId: row.user_id,
      workDate: row.work_date,
      clockInTime: document.getElementById("reviewClockInTime")?.value || "",
      clockOutTime: document.getElementById("reviewClockOutTime")?.value || "",
      regularHours: document.getElementById("reviewRegularHours")?.value ?? "",
      overtimeHours: document.getElementById("reviewOvertimeHours")?.value ?? "",
      note: document.getElementById("reviewAttendanceNote")?.value || "",
      reason: document.getElementById("reviewAttendanceReason")?.value || ""
    });
    closeModal();
    await Promise.all([loadAttendanceReview(false), loadRecordsPage()]);
    renderAll();
    showInfoMessage("簽到資料已更新，狀態已回到未審");
  } catch (error) {
    setSaveStatus(`儲存簽到資料失敗：${error.message}`);
  }
}

async function savePersonalAttendanceInput(input) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  const field = input.dataset.personalAttendanceField || "";
  const workDate = input.dataset.personalAttendanceDate || "";
  input.disabled = true;
  try {
    await window.schedulerApi.savePersonalAttendanceDay({ field, workDate, value: input.value });
    await loadRecordsPage();
  } catch (error) {
    input.disabled = false;
    showInfoMessage(error.message || "儲存簽到資料失敗");
  }
}

async function setAttendanceReviewed(token, reviewed) {
  try {
    await window.schedulerApi.setAttendanceReviewed({ token, reviewed });
    await Promise.all([loadAttendanceReview(false), loadRecordsPage()]);
    renderAll();
    showInfoMessage(reviewed ? "已設為已審" : "已退回未審");
  } catch (error) {
    showInfoMessage(error.message || "審核操作失敗");
  }
}

async function batchReviewAttendance(mode) {
  const tokens = Array.from(document.querySelectorAll("[data-attendance-review-check]:checked"))
    .map((item) => item.dataset.attendanceReviewCheck)
    .filter(Boolean);
  if (!tokens.length) {
    showInfoMessage("請先勾選簽到紀錄");
    return;
  }
  const reviewed = mode === "reviewed";
  const confirmed = await confirmAction(`確定要將 ${tokens.length} 筆紀錄${reviewed ? "設為已審" : "退回未審"}嗎？`);
  if (!confirmed) return;
  try {
    await window.schedulerApi.setAttendanceReviewed({ tokens, reviewed });
    await Promise.all([loadAttendanceReview(false), loadRecordsPage()]);
    renderAll();
    showInfoMessage(reviewed ? "批次審核已完成" : "批次退回已完成");
  } catch (error) {
    showInfoMessage(error.message || "批次審核失敗");
  }
}

function openAdminAttendanceCreateModal() {
  const review = ensureAttendanceReviewState();
  openEntityListModal({
    title: "代為填寫簽到資料",
    hideFooterClose: true,
    body: `<div class="form-grid two-col">
      <div class="form-row"><label>人員</label><select id="adminAttendanceUser">${memberOptions("", review.members)}</select></div>
      <div class="form-row"><label>日期</label><input id="adminAttendanceDate" type="date" value="${escapeHtml(getTodayDateString())}"></div>
      <div class="form-row"><label>上班時間</label><input id="adminAttendanceClockIn" type="time"></div>
      <div class="form-row"><label>下班時間</label><input id="adminAttendanceClockOut" type="time"></div>
      <div class="form-row"><label>上班時數</label><input id="adminAttendanceRegular" type="number" min="0" step="0.5"></div>
      <div class="form-row"><label>加班時數</label><input id="adminAttendanceOvertime" type="number" min="0" step="0.5"></div>
      <div class="form-row form-row-wide"><label>備註</label><textarea id="adminAttendanceNote" rows="3"></textarea></div>
    </div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-admin-attendance-create="true">儲存為未審</button>`
  });
}

async function saveAdminAttendanceCreate() {
  const userId = document.getElementById("adminAttendanceUser")?.value || "";
  const workDate = document.getElementById("adminAttendanceDate")?.value || "";
  if (!userId || !workDate) {
    showInfoMessage("請選擇人員與日期");
    return;
  }
  try {
    await window.schedulerApi.saveAttendanceReviewRecord({
      userId,
      workDate,
      clockInTime: document.getElementById("adminAttendanceClockIn")?.value || "",
      clockOutTime: document.getElementById("adminAttendanceClockOut")?.value || "",
      regularHours: document.getElementById("adminAttendanceRegular")?.value ?? "",
      overtimeHours: document.getElementById("adminAttendanceOvertime")?.value ?? "",
      note: document.getElementById("adminAttendanceNote")?.value || ""
    });
    closeModal();
    await loadAttendanceReview();
    showInfoMessage("簽到資料已建立");
  } catch (error) {
    showInfoMessage(error.message || "建立簽到資料失敗");
  }
}

async function openAttendanceHistoryModal(recordId) {
  try {
    const result = await window.schedulerApi.getAttendanceHistory(recordId);
    openEntityListModal({
      title: "簽到修改歷程",
      body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>操作</th><th>原因</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(log.action || "")}</td><td>${escapeHtml(log.reason || "")}</td><td>${escapeHtml(log.operator_name || "")}</td></tr>`).join("") || '<tr><td colspan="4">沒有歷程</td></tr>'}</tbody></table></div>`
    });
  } catch (error) {
    setSaveStatus(`讀取歷程失敗：${error.message}`);
  }
}

async function exportAttendanceReview() {
  const filters = ensureAttendanceReviewState().filters;
  try {
    setSaveStatus("正在準備已審加班資料...", true);
    const result = await window.schedulerApi.exportAttendanceReview({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId
    });
    if (result.empty) showInfoMessage("所選期間沒有已審資料");
    setSaveStatus("");
  } catch (error) {
    setSaveStatus(`匯出加班失敗：${error.message || error}`);
  }
}

async function cancelMealFromRecords() {
  const confirmed = await confirmAction("確定要取消今日整張訂單嗎？");
  if (!confirmed) return;
  try {
    await window.schedulerApi.cancelTodayMealOrder();
    await loadRecordsPage();
    showInfoMessage("今日訂餐已取消");
  } catch (error) {
    showInfoMessage(error.message || "取消訂餐失敗");
  }
}

'''
write("src/renderer/renderer-records-actions.js", attendance_actions + record_actions[meal_start:])

# 7. 記錄頁事件
write("src/renderer/renderer-records-events.js", '''/* 簽到簿篩選、分頁、員工填寫與批次審核事件。 */

const recordsReloadTimers = new Map();

function scheduleRecordsReload(key, callback) {
  const previous = recordsReloadTimers.get(key);
  if (previous) clearTimeout(previous);
  recordsReloadTimers.set(key, setTimeout(() => {
    recordsReloadTimers.delete(key);
    if (typeof callback === "function") void callback();
  }, 0));
}

function bindRecordsEvents() {
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;

    if (target.dataset.personalAttendanceField !== undefined) {
      void savePersonalAttendanceInput(target);
      return;
    }
    if (target.dataset.personalRecordFilter !== undefined) {
      ensureRecordsState().personalFilters[target.dataset.personalRecordFilter] = target.value;
      recordsState.personalPage = 1;
      scheduleRecordsReload("personal", loadRecordsPage);
      return;
    }
    if (target.dataset.mealReportFilter !== undefined) {
      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";
      recordsState.mealPage = 1;
      scheduleRecordsReload("meal", loadMealReport);
      return;
    }
    if (target.dataset.mealReportView !== undefined) {
      recordsState.mealReportView = target.value || "detail";
      renderAll();
      return;
    }
    if (target.dataset.attendanceReviewFilter !== undefined) {
      ensureAttendanceReviewState().filters[target.dataset.attendanceReviewFilter] = target.value || "";
      recordsState.attendanceReview.page = 1;
      scheduleRecordsReload("attendance-review", loadAttendanceReview);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.attendanceReviewCheckAll !== undefined) {
      document.querySelectorAll("[data-attendance-review-check]").forEach((input) => { input.checked = target.checked; });
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.personalRecordPage) {
      const page = Number(target.dataset.personalRecordPage || 1);
      if (page > 0) { recordsState.personalPage = page; void loadRecordsPage(); }
      return;
    }
    if (target.dataset.mealReportPage) {
      const page = Number(target.dataset.mealReportPage || 1);
      if (page > 0) { recordsState.mealPage = page; void loadMealReport(); }
      return;
    }
    if (target.dataset.attendanceReviewPage) {
      const page = Number(target.dataset.attendanceReviewPage || 1);
      if (page > 0) { ensureAttendanceReviewState().page = page; void loadAttendanceReview(); }
      return;
    }
    if (target.dataset.exportAttendanceReview !== undefined) { void exportAttendanceReview(); return; }
    if (target.dataset.attendanceReviewBatch) { void batchReviewAttendance(target.dataset.attendanceReviewBatch); return; }
    if (target.dataset.cancelRecordMeal) { void cancelMealFromRecords(); }
  });
}
''')

# 8. 主畫面只保留簽到簿，不再渲染 clockCard
write("src/renderer/renderer-app-shell.js", '''/* 簽到簿、主視圖切換與全畫面渲染協調。 */

function renderRecordsPage() {
  const recordsCard = document.getElementById("recordsCard");
  if (!recordsCard) return;
  if (!isLoggedIn()) {
    recordsCard.innerHTML = "";
    return;
  }
  const activeSection = recordsState.activeTab === "review"
    ? renderAttendanceReviewSection()
    : renderPersonalRecordsSection();
  recordsCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">簽到簿</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${renderRecordsTabs()}
    ${recordsState.error ? `<div class="auth-error clock-error">${escapeHtml(recordsState.error)}</div>` : ""}
    ${activeSection}
    ${recordsState.loading ? '<p class="clock-loading">讀取中，請稍候...</p>' : ""}
  `;
}

function syncAppView() {
  const loggedIn = isLoggedIn();
  const homeCard = document.getElementById("homeCard");
  const mealCard = document.getElementById("mealCard");
  const recordsCard = document.getElementById("recordsCard");
  const scheduleCard = document.getElementById("scheduleCard");
  const toolbarCard = document.querySelector(".toolbar-card");
  const showSchedule = loggedIn && appView === "schedule";
  const showToolbar = showSchedule && isManager();
  if (homeCard) homeCard.hidden = !loggedIn || appView !== "home";
  if (mealCard) mealCard.hidden = !loggedIn || appView !== "meal";
  if (recordsCard) recordsCard.hidden = !loggedIn || appView !== "records";
  if (scheduleCard) scheduleCard.hidden = !showSchedule;
  if (toolbarCard) toolbarCard.hidden = !showToolbar;
  document.body.classList.toggle("is-authenticated", loggedIn);
  document.body.classList.toggle("is-home-view", loggedIn && appView === "home");
  document.body.classList.toggle("is-meal-view", loggedIn && appView === "meal");
  document.body.classList.toggle("is-records-view", loggedIn && appView === "records");
  document.body.classList.toggle("is-schedule-view", showSchedule);
}

function renderAll() {
  renderHeader();
  renderToolbar();
  renderHomeDashboard();
  renderMealPage();
  renderRecordsPage();
  renderTable();
  syncAppView();
  renderAuthGate();
}
''')

# 9. 委派點擊事件移除舊打卡頁與舊加班審核，接上新操作
clicks = read("src/renderer/renderer-events-click.js")
clock_branch = '''      if (target.dataset.homeAction === "clock") {
        appView = "clock";
        await loadTodayAttendance();
        return;
      }
'''
clicks = clicks.replace(clock_branch, "")
clicks = clicks.replace('''    if (target.dataset.clockAction) {
      await submitAttendanceClock(target.dataset.clockAction);
      return;
    }
    if (target.dataset.submitTodayOvertime) {
      await submitTodayOvertimeRequest();
      return;
    }
    if (target.dataset.deleteTodayOvertime) {
      await deleteTodayOvertimeRequest();
      return;
    }
''', '''    if (target.dataset.personalClockAction) {
      await submitAttendanceClock(target.dataset.personalClockAction, target.dataset.personalClockDate || "");
      return;
    }
''')
old_start = clicks.find('    if (target.dataset.loadOvertimeReview) {')
old_end = clicks.find('    if (target.dataset.addMealProduct) {', old_start)
if old_start < 0 or old_end < 0:
    raise RuntimeError("找不到舊審核點擊事件區段")
new_clicks = '''    if (target.dataset.editAttendanceReview) {
      openAttendanceReviewEditModal(target.dataset.editAttendanceReview);
      return;
    }
    if (target.dataset.saveAttendanceReview) {
      await saveAttendanceReviewEdit(target.dataset.saveAttendanceReview);
      return;
    }
    if (target.dataset.toggleAttendanceReview) {
      await setAttendanceReviewed(target.dataset.toggleAttendanceReview, target.dataset.reviewed !== "true");
      return;
    }
    if (target.dataset.openAdminAttendanceCreate) {
      openAdminAttendanceCreateModal();
      return;
    }
    if (target.dataset.saveAdminAttendanceCreate !== undefined) {
      await saveAdminAttendanceCreate();
      return;
    }
    if (target.dataset.viewAttendanceHistory) {
      await openAttendanceHistoryModal(target.dataset.viewAttendanceHistory);
      return;
    }
'''
clicks = clicks[:old_start] + new_clicks + clicks[old_end:]
write("src/renderer/renderer-events-click.js", clicks)

# 10. Web API 收斂成 attendance-ledger
web_api = read("src/renderer/web-api.js")
replace_between("src/renderer/web-api.js", "  async function getEmployeeOvertimeDates()", "  async function getMemberOrder()", '''  async function getPersonalRecords(filters = {}) {
    ensureSignedIn();
    return requestFunction("attendance-ledger", { action: "personal_list", ...filters });
  }

  async function savePersonalAttendanceDay(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-ledger", { action: "personal_save", ...payload });
  }

  async function getAttendanceReviewList(filters = {}) {
    ensureManager();
    return requestFunction("attendance-ledger", { action: "review_list", ...filters });
  }

  async function saveAttendanceReviewRecord(payload = {}) {
    ensureManager();
    return requestFunction("attendance-ledger", { action: "review_save", ...payload });
  }

  async function setAttendanceReviewed(payload = {}) {
    ensureManager();
    return requestFunction("attendance-ledger", { action: "review_set", ...payload });
  }

  async function getAttendanceHistory(recordId) {
    ensureManager();
    return requestFunction("attendance-ledger", { action: "history", recordId });
  }
''')
web_api = read("src/renderer/web-api.js")
start = web_api.find("  async function getPersonalRecords(filters = {})", web_api.find("  async function getTodayMealOrder"))
end = web_api.find("        async function cancelTodayMealOrder()", start)
if start < 0 or end < 0:
    raise RuntimeError("找不到舊個人記錄 API 區段")
# 第一個 getPersonalRecords 已在前面新區段建立，刪除這一段中的舊重複及管理 API，只保留訂餐統計別名。
replacement = '''  async function getMealStatsReport(filters = {}) {
    return getMealReport(filters);
  }

'''
web_api = web_api[:start] + replacement + web_api[end:]

export_marker = "  window.schedulerApi = {"
export_pos = web_api.find(export_marker)
if export_pos < 0:
    raise RuntimeError("找不到 schedulerApi 匯出物件")
old_names = [
    "getEmployeeOvertimeDates", "getAttendanceOvertimeForDate", "getTodayAttendanceOvertime",
    "submitAttendanceOvertime", "deleteAttendanceOvertime", "getAttendanceAdminRecords",
    "getAttendanceAdminHistory", "saveAttendanceAdminRecord", "getOvertimeReviewList",
    "getApprovedOvertimeExportRows", "reviewOvertimeRequest", "createAdminOvertimeRequest"
]
for name in old_names:
    web_api = re.sub(rf"(?m)^\s{{4}}{re.escape(name)},\n", "", web_api)
# getPersonalRecords 只保留一次，再接上新 API。
insert_after = "    getPersonalRecords,\n"
if insert_after not in web_api:
    raise RuntimeError("找不到 getPersonalRecords 匯出位置")
web_api = web_api.replace(insert_after, insert_after + '''    savePersonalAttendanceDay,
    getAttendanceReviewList,
    saveAttendanceReviewRecord,
    setAttendanceReviewed,
    getAttendanceHistory,
''', 1)

# 在匯出工具區加入已審加班 Excel。
export_function_anchor = "  async function exportMembers(payload) {"
export_function_pos = web_api.find(export_function_anchor)
if export_function_pos < 0:
    raise RuntimeError("找不到 Excel 匯出函式插入點")
export_function = '''  async function exportAttendanceReview(filters = {}) {
    ensureManager();
    const result = await requestFunction("attendance-ledger", {
      action: "review_export",
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId || ""
    });
    const rows = Array.isArray(result.rows) ? result.rows : [];
    if (!rows.length) return { canceled: true, empty: true };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("已審加班");
    sheet.addRow(["日期", "員工編號", "員工姓名", "上班時數", "加班時數", "上班打卡", "下班打卡", "備註"]);
    rows.forEach((row) => sheet.addRow([
      row.work_date || "",
      row.employee_code || "",
      row.employee_name || "",
      row.regularHours ?? "",
      row.overtimeHours ?? "",
      row.clock_in_at ? formatTaipeiDateTime(row.clock_in_at) : "",
      row.clock_out_at ? formatTaipeiDateTime(row.clock_out_at) : "",
      row.note || ""
    ]));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.columns = [14, 14, 18, 12, 12, 20, 20, 36].map((width) => ({ width }));
    const blob = await exporter.workbookToBlob(workbook);
    const fileName = `已審加班_${filters.fromDate || ""}-${filters.toDate || ""}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

'''
web_api = web_api[:export_function_pos] + export_function + web_api[export_function_pos:]
# exportAttendanceReview 加入物件。
web_api = web_api.replace("    exportSapCsv,\n", "    exportSapCsv,\n    exportAttendanceReview,\n", 1)
write("src/renderer/web-api.js", web_api)

# 11. HTML、建置清單與舊模組清理
index_html = read("src/renderer/index.html")
index_html = index_html.replace('    <section class="clock-card" id="clockCard" hidden></section>\n', "")
write("src/renderer/index.html", index_html)

build_js = read("scripts/build-js.js").replace('  "renderer-overtime-employee.js",\n', "")
write("scripts/build-js.js", build_js)
old_employee_module = SRC / "renderer-overtime-employee.js"
if old_employee_module.exists():
    old_employee_module.unlink()

for folder in [
    "attendance-overtime",
    "attendance-overtime-employee",
    "attendance-overtime-admin-list",
    "attendance-overtime-admin-action",
    "attendance-admin-list-v2",
    "attendance-admin-action-v2",
    "personal-records-v2",
    "attendance-clock-safe"
]:
    target = ROOT / "supabase" / "functions" / folder
    if target.exists():
        shutil.rmtree(target)

# 12. 樣式
pages_css = read("src/renderer/css/pages.css")
style_block = '''

/* ===== 簽到簿 ===== */
.home-action-grid-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.attendance-ledger-table th,
.attendance-ledger-table td,
.attendance-review-table th,
.attendance-review-table td {
  vertical-align: middle;
}

.attendance-ledger-table .is-today-row {
  background: rgba(55, 138, 221, 0.06);
}

.attendance-clock-stack,
.attendance-punch-line,
.attendance-clock-buttons,
.attendance-review-row-actions {
  display: flex;
  gap: 6px;
}

.attendance-clock-stack,
.attendance-punch-line {
  flex-direction: column;
  align-items: flex-start;
}

.attendance-punch-line small {
  color: var(--muted-text, #667085);
  line-height: 1.25;
}

.attendance-clock-buttons,
.attendance-review-row-actions {
  align-items: center;
  flex-wrap: wrap;
}

.attendance-hours-input {
  width: 78px;
  min-width: 70px;
  text-align: center;
}

.attendance-note-input {
  width: 180px;
  min-width: 140px;
  resize: vertical;
}

.attendance-review-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}

.attendance-review-status.is-unreviewed,
.attendance-review-toggle.is-unreviewed {
  background: #fff4d6;
  color: #8a5a00;
  border: 1px solid #efc66a;
}

.attendance-review-status.is-reviewed,
.attendance-review-toggle.is-reviewed {
  background: #e8f7ef;
  color: #176b45;
  border: 1px solid #8bc9aa;
}

.attendance-review-toggle {
  min-height: 34px;
  border-radius: 8px;
  font-weight: 800;
  cursor: pointer;
}

.attendance-empty-value {
  color: var(--muted-text, #667085);
}

@media (max-width: 768px) {
  .home-action-grid-three {
    grid-template-columns: 1fr;
  }
  .attendance-hours-input {
    width: 68px;
  }
  .attendance-note-input {
    width: 150px;
  }
  .attendance-ledger-table,
  .attendance-review-table {
    min-width: 1050px;
  }
}
'''
if "/* ===== 簽到簿 ===== */" not in pages_css:
    pages_css += style_block
write("src/renderer/css/pages.css", pages_css)

# 13. 規格書同步
spec_path = "福圓號排班系統擴充規格書.txt"
spec = read(spec_path)
spec_block = '''

# 簽到簿整合規格（2026-08-04）

## 頁面與導覽
- 首頁移除「打卡」按鈕，「記錄」更名為「簽到簿」。
- 移除獨立打卡頁。
- 簽到簿只保留「個人記錄」與管理員可見的「簽到審核」。
- 原「加班審核」與「打卡管理」合併為「簽到審核」，以原加班審核版面為主。

## 個人記錄欄位
欄位依序為：日期、圖示、班別、打卡時間、上班時數、加班時數、備註、訂餐、審核。
- 今日尚未打卡時，上班打卡與下班打卡按鈕同時顯示。
- 上、下班打卡彼此獨立，可只有其中一筆；完成後顯示時間與打卡地點。
- 非今日資料不顯示打卡按鈕。
- 上班時數與加班時數皆由員工填寫，以 0.5 小時為單位，且不與打卡時間或班別強制連動。
- 打卡備註與加班備註合併為單一備註欄。
- 訂餐維持原功能。
- 審核狀態只有「未審」與「已審」；已審資料員工不可修改。

## 簽到審核欄位與操作
欄位依序為：選取、日期、員工、圖示、班別、打卡時間、上班時數、加班時數、備註、異常、狀態、操作。
- 圖示直接使用班表同日圖示。
- 異常沿用既有判斷，不新增重複打卡或跨日打卡。
- 編輯可修改上、下班時間、上班時數、加班時數與備註；工時不因打卡時間變更而重算。
- 管理員修改已審資料後，自動回到未審。
- 操作欄提供編輯及未審／已審切換按鈕。
- 「批次核准」更名為「批次審核」；「批次退回」維持原名，作用為改回未審。

## Supabase 資料模型
- 出勤資料統一使用 `attendance_days`，每位員工每日最多一筆。
- 上班與加班工時以分鐘保存，NULL 代表未填，0 代表確認為 0，且只接受 30 分鐘倍數。
- 上、下班地點分別以 JSON 保存。
- 審核狀態由 `reviewed_at` 是否有值判斷，不另存文字狀態。
- 修改歷程統一保存於 `attendance_audit_logs`。
- 班別、圖示與訂餐仍讀取原資料來源，不複製到簽到資料。
- 舊打卡、加班申請與舊審核資料表及程式不保留相容層。
'''
if "# 簽到簿整合規格（2026-08-04）" not in spec:
    spec += spec_block
write(spec_path, spec)

# 14. 清理舊測試並加入新架構檢查
legacy_tokens = [
    "attendance-overtime-employee",
    "attendance-overtime-admin-list",
    "attendance-overtime-admin-action",
    "attendance-admin-list-v2",
    "attendance-admin-action-v2",
    "personal-records-v2",
    "getOvertimeReviewList",
    "renderOvertimeReviewSection",
    "renderAttendanceAdminSection",
    "attendanceOvertimeState"
]
for test_file in (ROOT / "tests").glob("*.test.js"):
    content = test_file.read_text(encoding="utf-8-sig")
    if any(token in content for token in legacy_tokens):
        test_file.unlink()

check_file = ROOT / "scripts" / "check-v2-final.js"
if check_file.exists():
    text = check_file.read_text(encoding="utf-8-sig")
    lines = [line for line in text.splitlines() if not any(token in line for token in legacy_tokens)]
    text = "\n".join(lines)
    # 移除仍引用已刪除變數的單行 assert。
    text = re.sub(r"(?m)^assert\([^\n]*(?:sourceOvertime|sourceAttendanceAdmin)[^\n]*\);\n?", "", text)
    check_file.write_text(text.rstrip() + "\n", encoding="utf-8")

write("tests/attendance-ledger-refactor.test.js", '''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首頁與簽到簿使用新導覽", () => {
  const home = read("src/renderer/renderer-main-pages.js");
  const shell = read("src/renderer/renderer-app-shell.js");
  assert.equal(home.includes('data-home-action="clock"'), false);
  assert.equal(home.includes("簽到簿"), true);
  assert.equal(shell.includes("renderClockPage"), false);
});

test("個人記錄與簽到審核欄位完整", () => {
  const views = read("src/renderer/renderer-records-views.js");
  for (const label of ["日期", "圖示", "班別", "打卡時間", "上班時數", "加班時數", "備註", "訂餐", "審核", "異常", "狀態", "操作"]) {
    assert.equal(views.includes(label), true, `缺少欄位：${label}`);
  }
  assert.equal(views.includes("簽到審核"), true);
  assert.equal(views.includes("批次審核"), true);
  assert.equal(views.includes("批次退回"), true);
});

test("前端只呼叫統一 attendance-ledger API", () => {
  const api = read("src/renderer/web-api.js");
  assert.equal(api.includes('requestFunction("attendance-ledger"'), true);
  for (const oldName of ["attendance-overtime-admin-list", "attendance-admin-list-v2", "personal-records-v2"]) {
    assert.equal(api.includes(oldName), false, `仍有舊 API：${oldName}`);
  }
});

test("舊出勤 Edge Function 原始碼已移除", () => {
  for (const folder of ["attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2"]) {
    assert.equal(fs.existsSync(path.join(root, "supabase", "functions", folder)), false, `仍有舊函式：${folder}`);
  }
});
''')

# 15. 最終靜態保證：正式來源不可殘留舊流程識別字
source_files = list(SRC.glob("*.js"))
for source_file in source_files:
    if source_file.name == "app.js":
        continue
    content = source_file.read_text(encoding="utf-8-sig")
    for token in legacy_tokens:
        if token in content:
            raise RuntimeError(f"{source_file.relative_to(ROOT)} 仍殘留舊流程識別字：{token}")

print("Attendance ledger source refactor completed")
