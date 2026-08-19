/* 個人記錄、簽到審核、訂餐統計與訂餐設定畫面。
 * 每種畫面只保留一份正式實作。
 */

function formatRecordDateTime(value) {
  return value ? formatClockTime(value) : "-";
}

function renderHomeIconButton() {
  return `<button class="settings-icon-btn page-home-btn" type="button" data-home-action="home" aria-label="返回首頁" title="返回首頁"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>`;
}

function renderRecordsTabs() {
  const tabs = [
    ["personal", "個人記錄", true],
    ["review", "簽到審核", canManagePermissions()]
  ].filter((tab) => tab[2]);
  if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
  return `<div class="record-tabs" role="tablist" aria-label="簽到簿分頁">${tabs.map(([id, label]) => `<button class="ghost-btn page-tab-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" role="tab" aria-selected="${recordsState.activeTab === id ? "true" : "false"}" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
}

function memberOptions(selectedValue, members = state.members) {
  return `<option value="">全部人員</option>${(members || []).map((member) => `<option value="${escapeHtml(member.id)}" ${selectedValue === member.id ? "selected" : ""}>${escapeHtml(member.full_name || member.name || member.employee_code || member.code || "")}</option>`).join("")}`;
}

function departmentOptions(selectedValue) {
  return `<option value="">全部單位</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${selectedValue === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}`;
}

function renderRecordsDateSortButton(direction, scope) {
  const normalized = direction === "asc" ? "asc" : "desc";
  const arrow = normalized === "asc" ? "↑" : "↓";
  const label = normalized === "asc" ? "升冪" : "降冪";
  return `<button class="records-date-sort-btn" type="button" data-record-date-sort="${scope}" aria-label="日期${label}，點擊切換排序" title="日期${label}，點擊切換排序">日期 <span aria-hidden="true">${arrow}</span></button>`;
}

function attendanceReviewGroupOptions(selectedValue) {
  const groups = typeof getSelectableGroups === "function" ? getSelectableGroups() : [];
  return `<option value="">全部群組</option>${groups.map((group) => `<option value="${escapeHtml(group.id)}" ${selectedValue === group.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}`;
}


function findSegmentItem(segment) {
    const itemId = String(segment?.itemId || "");
    if (!itemId) return null;
    if (segment.category === "shift") return (state.shifts || []).find((item) => item.id === itemId) || null;
    if (segment.category === "leave") return (state.leaves || []).find((item) => item.id === itemId) || null;
    if (segment.category === "overtime") return (state.overtime || []).find((item) => item.id === itemId) || null;
    return null;
  }

function normalizeScheduleSegments(record) {
    const source = Array.isArray(record?.scheduleSegments) ? record.scheduleSegments : [];
    if (source.length) return source.slice(0, 3);
    if (!record?.shiftName) return [];
    const shift = (state.shifts || []).find((item) => item.name === record.shiftName) || null;
    return [{
      category: "shift",
      itemId: shift?.id || "",
      name: record.shiftName,
      color: shift?.color || "#888780",
      textColor: shift?.textColor || ""
    }];
  }

function renderScheduleIcon(record) {
    const segments = normalizeScheduleSegments(record);
    if (!segments.length) return '<div class="cell-inner personal-record-schedule-cell"></div>';
    const hasShift = segments.some((segment) => segment.category === "shift");
    return `<div class="cell-inner personal-record-schedule-cell">${segments.map((segment) => {
      const item = findSegmentItem(segment);
      const color = item?.color || segment.color || (segment.category === "overtime" ? "#D85A30" : "#888780");
      const itemText = item ? getItemTextColor(item, color) : (segment.textColor || textColor(color));
      const segmentCode = String(segment.code || item?.code || "");
      const specialLeaveText = segment.category === "leave" && segmentCode === "0047" && hasShift;
      const regularHolidayWorkClass = segment.category === "leave" && segmentCode === "0036" && hasShift
        ? " regular-holiday-work-seg"
        : "";
      const foreground = specialLeaveText ? "rgb(112, 112, 112)" : itemText;
      const name = item?.name || segment.name || (segment.category === "overtime" ? "加班" : "");
      return `<div class="seg${regularHolidayWorkClass}" style="background-color:${escapeHtml(color)};color:${escapeHtml(foreground)}"><span class="seg-label ${getScheduleSegmentSizeClass({ name }, segments.length)}">${escapeHtml(name)}</span></div>`;
    }).join("")}</div>`;
  }

function attendanceLocationName(location) {
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
  return `<div class="attendance-clock-stack">${lines.join("")}${buttons}</div>`;
}

function renderPersonalHoursInput(record, field) {
  const value = getPersonalAttendanceValue(record, field);
  const editable = record.editable !== false && !record.reviewed;
  const displayValue = value === null || value === undefined ? "" : escapeHtml(String(value));
  if (!editable) return `<span class="attendance-hours-value">${displayValue}</span>`;
  return `<input class="attendance-hours-input" type="number" min="0" step="0.5" inputmode="decimal" value="${displayValue}" data-personal-attendance-field="${field}" data-personal-attendance-date="${escapeHtml(record.date)}">`;
}

function renderPersonalNoteInput(record) {
  const value = String(getPersonalAttendanceValue(record, "note") ?? "");
  const editable = record.editable !== false && !record.reviewed;
  if (!editable) return escapeHtml(value);
  return `<input class="attendance-note-input" type="text" list="personalAttendanceCommonNotes" value="${escapeHtml(value)}" data-personal-attendance-field="note" data-personal-attendance-date="${escapeHtml(record.date)}">`;
}

function renderReviewStatus(reviewed) {
  return `<span class="attendance-review-status ${reviewed ? "is-reviewed" : "is-unreviewed"}">${reviewed ? "已審" : "未審"}</span>`;
}

function renderPersonalRecordsSection() {
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
    <datalist id="personalAttendanceCommonNotes">${(recordsState.commonAttendanceNotes || []).map((note) => `<option value="${escapeHtml(note)}"></option>`).join("")}</datalist>
    <div class="records-table-wrap"><table class="records-table personal-record-table attendance-ledger-table">
      <thead><tr><th class="personal-record-date-col">${renderRecordsDateSortButton(filters.sortDirection, "personal")}</th><th class="personal-schedule-icon-col">圖示</th><th class="personal-record-shift-col">班別</th><th class="personal-record-clock-col">打卡時間</th><th class="personal-record-hours-col">上班時數</th><th class="personal-record-hours-col">加班時數</th><th class="personal-record-note-col">備註</th><th class="personal-record-review-col">審核</th></tr></thead>
      <tbody>${(recordsState.personal || []).map((record) => `<tr class="${record.date === getTodayDateString() ? "is-today-row" : ""}">
        <td class="personal-record-date-col">${escapeHtml(record.date || "")}</td>
        <td class="personal-schedule-icon-col">${renderScheduleIcon(record)}</td>
        <td class="personal-record-shift-col">${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>
        <td class="personal-record-clock-col">${renderPersonalClockCell(record)}</td>
        <td class="personal-record-hours-col">${renderPersonalHoursInput(record, "regularHours")}</td>
        <td class="personal-record-hours-col">${renderPersonalHoursInput(record, "overtimeHours")}</td>
        <td class="personal-record-note-col">${renderPersonalNoteInput(record)}</td>
        <td class="personal-record-review-col">${renderReviewStatus(record.reviewed)}</td>
      </tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody>
    </table></div>
    <div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-personal-record-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-personal-record-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>
  </section>`;
}

function renderMealReportSection() {
    ensureRecordsState();
    const report = recordsState.mealStats || {};
    const filters = recordsState.mealFilters;
    const view = recordsState.mealReportView || "detail";
    const page = Number(report.page || recordsState.mealPage || 1);
    const pageSize = Number(report.pageSize || 50);
    const total = Number(report.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const allDetails = Array.isArray(report.exportDetails) ? report.exportDetails : (report.details || []);
    const details = report.details || [];
    const companySubsidy = Number(report.companySubsidy || 55);
    const withWarningNote = (row) => [row.note || "", row.clockDeletedWarning ? "上班打卡已刪除" : ""].filter(Boolean).join("；");
    const itemRows = Array.from(allDetails.reduce((map, row) => {
      const key = `${row.productName || ""}:${Number(row.unitPrice || 0)}`;
      const current = map.get(key) || { productName: row.productName || "", quantity: 0, unitPrice: Number(row.unitPrice || 0), amount: 0 };
      current.quantity += Number(row.quantity || 0);
      current.amount += Number(row.amount || 0);
      map.set(key, current);
      return map;
    }, new Map()).values()).sort((a, b) => String(a.productName).localeCompare(String(b.productName)));
    const memberRows = (Array.isArray(report.memberSummary) ? report.memberSummary : [])
      .slice()
      .sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)));
    const table = view === "item"
      ? `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>品項</th><th>數量</th><th>單價</th><th>小計</th></tr></thead><tbody>${itemRows.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.unitPrice || 0).toFixed(0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td></tr>`).join("") || '<tr><td colspan="4">沒有訂餐資料</td></tr>'}</tbody></table></div>`
      : view === "member"
        ? `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>姓名</th><th>訂餐日數</th><th>金額</th><th>自付額</th></tr></thead><tbody>${memberRows.map((row) => `<tr><td>${escapeHtml(row.employeeName)}</td><td>${Number(row.days || 0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>$${Number(row.selfPay || 0).toFixed(0)}</td></tr>`).join("") || '<tr><td colspan="4">沒有訂餐資料</td></tr>'}</tbody></table></div>`
        : `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>單位</th><th>員工</th><th>品項</th><th>數量</th><th>單價</th><th>小計</th><th>備註</th></tr></thead><tbody>${details.map((row) => `<tr><td>${escapeHtml(row.date || "")}</td><td>${escapeHtml(row.departmentName || "")}</td><td>${escapeHtml(row.employeeName || "")}</td><td>${escapeHtml(row.productName || "")}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.unitPrice || 0).toFixed(0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>${escapeHtml(withWarningNote(row))}</td></tr>`).join("") || '<tr><td colspan="8">沒有訂餐資料</td></tr>'}</tbody></table></div>`;
    return `<section class="records-section">
      <div class="meal-admin-toolbar meal-report-toolbar">
        <div class="meal-toolbar-fields meal-report-fields">
          <label class="meal-toolbar-field meal-field-from">
            <span>開始日期</span>
            <input type="date" value="${escapeHtml(filters.fromDate)}" data-meal-report-filter="fromDate">
          </label>
          <label class="meal-toolbar-field meal-field-to">
            <span>結束日期</span>
            <input type="date" value="${escapeHtml(filters.toDate)}" data-meal-report-filter="toDate">
          </label>
          <label class="meal-toolbar-field meal-field-department">
            <span>單位</span>
            <select data-meal-report-filter="departmentId">${departmentOptions(filters.departmentId)}</select>
          </label>
          <label class="meal-toolbar-field meal-field-member">
            <span>人員</span>
            <select data-meal-report-filter="memberId">${memberOptions(filters.memberId)}</select>
          </label>
          <label class="meal-toolbar-field meal-field-view">
            <span>報表內容</span>
            <select data-meal-report-view>
              <option value="detail" ${view === "detail" ? "selected" : ""}>明細</option>
              <option value="item" ${view === "item" ? "selected" : ""}>品項</option>
              <option value="member" ${view === "member" ? "selected" : ""}>人員</option>
            </select>
          </label>
          <div class="meal-toolbar-field meal-field-export">
            <span aria-hidden="true">操作</span>
            <button class="ghost-btn" type="button" data-export-meal-report="true">匯出 Excel</button>
          </div>
        </div>
      </div>
      ${report.error ? `<div class="auth-error">${escapeHtml(report.error)}</div>` : ""}
      <div class="meal-stats-grid"><div><span>總數量</span><strong>${Number(report.totals?.quantity || 0)}</strong></div><div><span>總金額</span><strong>$ ${Number(report.totals?.amount || 0).toFixed(0)}</strong></div></div>
      ${table}
      ${view === "detail" ? `<div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-meal-report-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-meal-report-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>` : ""}
    </section>`;
  }

function formatHours(value) {
    const hours = Number(value || 0);
    return Number.isFinite(hours) ? String(hours) : "0";
  }

function formatPunchTime(value) {
    return value ? formatClockTime(value) : "-";
  }

function renderAttendanceReviewToggleIcon(reviewed) {
  return reviewed
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01"></path><path d="M10.3 4.7 3.9 16a2 2 0 0 0 1.7 3h12.8a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6"></path></svg>';
}

function renderAttendanceReviewPagination(review) {
  const page = Number(review.page || 1);
  const pageSize = Number(review.pageSize || 50);
  const total = Number(review.total || 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="records-filter-row records-pagination">
    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page - 1}" ${(page <= 1 || review.loading) ? "disabled" : ""}>上一頁</button>
    <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page + 1}" ${(page >= pages || review.loading) ? "disabled" : ""}>下一頁</button>
  </div>`;
}

function renderAttendanceReviewSection() {
  const review = ensureAttendanceReviewState();
  const filters = review.filters;
  const rows = review.rows || [];
  return `<section class="records-section">
    <div class="records-admin-toolbar overtime-review-toolbar attendance-review-toolbar">
      <div class="records-admin-filters overtime-review-filters attendance-review-filters">
        <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-attendance-review-filter="fromDate"></label>
        <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-attendance-review-filter="toDate"></label>
        <label class="records-admin-field"><span>群組</span><select data-attendance-review-filter="groupId">${attendanceReviewGroupOptions(filters.groupId)}</select></label>
        <label class="records-admin-field"><span>人員</span><select data-attendance-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select></label>
        <label class="records-admin-field"><span>異常</span><select data-attendance-review-filter="issueType"><option value="" ${!filters.issueType ? "selected" : ""}>全部顯示</option>${(review.issueTypes || []).map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
        <label class="records-admin-field"><span>狀態</span><select data-attendance-review-filter="status">
          <option value="unreviewed" ${filters.status === "unreviewed" ? "selected" : ""}>未審</option>
          <option value="reviewed" ${filters.status === "reviewed" ? "selected" : ""}>已審</option>
          <option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option>
        </select></label>
      </div>
      <div class="records-admin-actions overtime-review-actions attendance-review-actions">
        <button class="ghost-btn compact-btn" type="button" data-attendance-common-notes="true">常用備註</button>
        <button class="ghost-btn compact-btn" type="button" data-export-attendance-review="true">匯出加班</button>
        <button class="ghost-btn compact-btn" type="button" data-print-attendance-review="true">列印</button>
        <button class="primary-btn compact-btn" type="button" data-attendance-review-batch="reviewed">批次審核</button>
        <button class="ghost-btn compact-btn" type="button" data-attendance-review-batch="returned">批次退回</button>
      </div>
    </div>
    ${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}
    <div class="records-table-wrap">
      <table class="records-table attendance-review-table">
        <thead><tr><th class="attendance-review-check-col"><input type="checkbox" data-attendance-review-check-all></th><th class="attendance-review-date-col">${renderRecordsDateSortButton(filters.sortDirection, "review")}</th><th class="attendance-review-employee-col">員工</th><th class="attendance-schedule-icon-col">圖示</th><th class="attendance-review-shift-col">班別</th><th class="attendance-review-clock-col">打卡時間</th><th class="attendance-review-hours-col">上班時數</th><th class="attendance-review-hours-col">加班時數</th><th class="attendance-review-note-col">備註</th><th class="attendance-review-issue-col">異常</th><th class="attendance-review-status-col">狀態</th><th class="attendance-review-operation-col">操作</th></tr></thead>
        <tbody>${rows.map((row) => {
          const token = `${row.user_id}:${row.work_date}`;
          return `<tr>
            <td class="attendance-review-check-col"><input type="checkbox" data-attendance-review-check="${escapeHtml(token)}"></td>
            <td class="attendance-review-date-col">${escapeHtml(row.work_date || "")}</td>
            <td class="attendance-review-employee-col">${escapeHtml(row.employee_name || "")}</td>
            <td class="attendance-schedule-icon-col">${renderScheduleIcon(row)}</td>
            <td class="attendance-review-shift-col">${escapeHtml(row.shiftName || "-")}<br><span>${escapeHtml(row.shiftTime || "")}</span></td>
            <td class="attendance-review-clock-col">${renderPunchLine("上班", row.clock_in_at, row.clock_in_location) || "-"}${renderPunchLine("下班", row.clock_out_at, row.clock_out_location)}</td>
            <td class="attendance-review-hours-col">${row.regularHours === null || row.regularHours === undefined ? "" : escapeHtml(String(row.regularHours))}</td>
            <td class="attendance-review-hours-col">${row.overtimeHours === null || row.overtimeHours === undefined ? "" : escapeHtml(String(row.overtimeHours))}</td>
            <td class="attendance-review-note-col">${escapeHtml(row.note || "")}</td>
            <td class="attendance-review-issue-col">${escapeHtml((row.issues || []).join("、"))}</td>
            <td class="attendance-review-status-col">${renderReviewStatus(row.reviewed)}</td>
            <td class="attendance-review-operation-col"><div class="attendance-review-row-actions">
              <button class="settings-icon-btn attendance-review-action-btn" type="button" data-edit-attendance-review="${escapeHtml(token)}" aria-label="編輯" title="編輯"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>
              <button class="settings-icon-btn attendance-review-action-btn attendance-review-toggle ${row.reviewed ? "is-set-unreviewed" : "is-set-reviewed"}" type="button" data-toggle-attendance-review="${escapeHtml(token)}" data-reviewed="${row.reviewed ? "true" : "false"}" aria-label="${row.reviewed ? "設為未審" : "設為已審"}" title="${row.reviewed ? "設為未審" : "設為已審"}">${renderAttendanceReviewToggleIcon(row.reviewed)}</button>
              ${row.id ? `<button class="settings-icon-btn attendance-review-action-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}" aria-label="歷程" title="歷程"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg></button>` : ""}
            </div></td>
          </tr>`;
        }).join("") || '<tr><td colspan="12">沒有資料</td></tr>'}</tbody>
      </table>
    </div>
    ${renderAttendanceReviewPagination(review)}
  </section>`;
}

function renderMealSettingsSection() {
    const mealAdmin = recordsState.mealAdmin;
    const subsidy = Number(mealAdmin.settings?.company_subsidy || 55);
    return `<section class="records-section">
      <div class="meal-admin-toolbar meal-settings-toolbar">
        <div class="meal-toolbar-fields meal-settings-fields">
          <label class="meal-toolbar-field meal-settings-toolbar-label">
            <span>截止時間</span>
            <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time>
          </label>
          <label class="meal-toolbar-field meal-settings-toolbar-label">
            <span>公司補助（元）</span>
            <input type="number" min="1" step="1" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeHtml(String(subsidy))}" data-meal-company-subsidy data-last-valid-company-subsidy="${escapeHtml(String(subsidy))}">
          </label>
        </div>
        <div class="meal-toolbar-actions">
          <button class="ghost-btn" type="button" data-add-meal-product="true">新增商品</button>
          <button class="primary-btn" type="button" data-save-meal-settings="true">儲存設定</button>
        </div>
      </div>
      ${mealAdmin.error ? `<div class="auth-error">${escapeHtml(mealAdmin.error)}</div>` : ""}
      <div class="meal-settings-table-wrap">
        <table class="meal-settings-table">
          <thead><tr><th class="meal-settings-drag-col"></th><th class="meal-settings-name-col">品項</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th><th class="meal-settings-operation-col">操作</th></tr></thead>
          <tbody>${mealAdmin.products.map((product, index) => `<tr data-meal-product-row="${index}">
            <td class="meal-settings-drag-col"><span class="meal-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span></td>
            <td class="meal-settings-name-col"><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td>
            <td class="meal-settings-price-col"><input type="number" min="0" step="1" value="${escapeHtml(String(product.price || 0))}" data-meal-product-field="price"></td>
            <td class="meal-settings-active-col"><input type="checkbox" ${product.is_active !== false ? "checked" : ""} data-meal-product-field="isActive"><input type="hidden" value="${escapeHtml(product.id || "")}" data-meal-product-field="id"></td>
            <td class="meal-settings-operation-col"><button class="settings-icon-btn settings-icon-btn-danger" type="button" data-delete-meal-product="${escapeHtml(String(index))}" aria-label="刪除" title="刪除"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 13h8l1-13"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg></button></td>
          </tr>`).join("") || '<tr><td colspan="5">尚無商品</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  }
