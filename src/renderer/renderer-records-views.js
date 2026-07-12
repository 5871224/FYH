/* 個人記錄、訂餐統計、加班審核、打卡管理與訂餐設定畫面。
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
      ["overtime", "加班審核", isAdmin()],
      ["attendance", "打卡管理", isAdmin()]
    ].filter((tab) => tab[2]);
    if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
    return `<div class="record-tabs">${tabs.map(([id, label]) => `<button class="ghost-btn compact-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
  }

function memberOptions(selectedValue, members = state.members) {
  return `<option value="">全部人員</option>${(members || []).map((member) => `<option value="${escapeHtml(member.id)}" ${selectedValue === member.id ? "selected" : ""}>${escapeHtml(member.full_name || member.name || member.employee_code || member.code || "")}</option>`).join("")}`;
}

function departmentOptions(selectedValue) {
  return `<option value="">全部單位</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${selectedValue === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}`;
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
      const specialLeaveText = segment.category === "leave" && String(segment.code || item?.code || "") === "0047" && hasShift;
      const foreground = specialLeaveText ? "rgb(112, 112, 112)" : itemText;
      const name = item?.name || segment.name || (segment.category === "overtime" ? "加班" : "");
      return `<div class="seg" style="background-color:${escapeHtml(color)};color:${escapeHtml(foreground)}"><span class="seg-label ${getScheduleSegmentSizeClass({ name }, segments.length)}">${escapeHtml(name)}</span></div>`;
    }).join("")}</div>`;
  }

function punchLine(value, department) {
    if (!value) return "-";
    return `${formatRecordDateTime(value)}${department ? ` ${escapeHtml(department)}` : ""}`;
  }

function renderPersonalRecordsSection() {
    const today = getTodayDateString();
    recordsState.personalFilters = recordsState.personalFilters || {
      fromDate: addDaysToDateString(today, -49),
      toDate: today
    };
    recordsState.personalPage = Number(recordsState.personalPage || 1);
    recordsState.personalTotal = Number(recordsState.personalTotal || 0);
    recordsState.personalPageSize = Number(recordsState.personalPageSize || 50);

    const filters = recordsState.personalFilters;
    const page = Number(recordsState.personalPage || 1);
    const pageSize = Number(recordsState.personalPageSize || 50);
    const total = Number(recordsState.personalTotal || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return `<section class="records-section">
      <h2>個人記錄</h2>
      <div class="records-admin-toolbar personal-record-toolbar">
        <div class="records-admin-filters personal-record-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-personal-record-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-personal-record-filter="toDate"></label>
        </div>
      </div>
      <div class="records-table-wrap"><table class="records-table personal-record-table">
        <thead><tr><th>日期</th><th class="personal-schedule-icon-col">圖示</th><th>班別</th><th>打卡時間</th><th>異常</th><th>加班</th><th>打卡備註</th><th>加班備註</th><th>訂餐</th></tr></thead>
        <tbody>${(recordsState.personal || []).map((record) => `<tr>
          <td>${escapeHtml(record.date || "")}</td>
          <td class="personal-schedule-icon-col">${renderScheduleIcon(record)}</td>
          <td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>
          <td class="personal-punch-stack"><div>${punchLine(record.clockIn, record.clockInDepartment)}</div><div>${punchLine(record.clockOut, record.clockOutDepartment)}</div></td>
          <td>${escapeHtml((record.issues || []).join("、") || "正常")}</td>
          <td>${escapeHtml(getOvertimeStatusLabel(record.overtimeStatus || ""))}<br><span>${Number(record.overtimeHours || 0)} 小時</span></td>
          <td>${escapeHtml(record.attendanceNote || "")}</td>
          <td>${escapeHtml(record.overtimeNote || "")}</td>
          <td><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>
        </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>
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
    const fallbackMemberRows = Array.from(allDetails.reduce((map, row) => {
      const key = row.employeeId || row.employeeName || "";
      const current = map.get(key) || { employeeName: row.employeeName || "", dates: new Set(), amount: 0 };
      if (Number(row.quantity || 0) > 0 && row.date) current.dates.add(row.date);
      current.amount += Number(row.amount || 0);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((row) => {
      const days = row.dates.size;
      return { employeeName: row.employeeName, days, amount: row.amount, selfPay: row.amount - days * companySubsidy };
    });
    const memberRows = (Array.isArray(report.memberSummary) && report.memberSummary.length
      ? report.memberSummary
      : fallbackMemberRows
    ).slice().sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)));
    const table = view === "item"
      ? `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>品項</th><th>數量</th><th>單價</th><th>小計</th></tr></thead><tbody>${itemRows.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.unitPrice || 0).toFixed(0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td></tr>`).join("") || '<tr><td colspan="4">沒有訂餐資料</td></tr>'}</tbody></table></div>`
      : view === "member"
        ? `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>姓名</th><th>訂餐日數</th><th>金額</th><th>自付額</th></tr></thead><tbody>${memberRows.map((row) => `<tr><td>${escapeHtml(row.employeeName)}</td><td>${Number(row.days || 0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>$${Number(row.selfPay || 0).toFixed(0)}</td></tr>`).join("") || '<tr><td colspan="4">沒有訂餐資料</td></tr>'}</tbody></table></div>`
        : `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>單位</th><th>員工</th><th>品項</th><th>數量</th><th>單價</th><th>小計</th><th>備註</th></tr></thead><tbody>${details.map((row) => `<tr><td>${escapeHtml(row.date || "")}</td><td>${escapeHtml(row.departmentName || "")}</td><td>${escapeHtml(row.employeeName || "")}</td><td>${escapeHtml(row.productName || "")}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.unitPrice || 0).toFixed(0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>${escapeHtml(withWarningNote(row))}</td></tr>`).join("") || '<tr><td colspan="8">沒有訂餐資料</td></tr>'}</tbody></table></div>`;
    return `<section class="records-section">
      <h2>訂餐統計</h2>
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
      <div class="meal-stats-grid"><div><strong>${Number(report.totals?.quantity || 0)}</strong><span>總數量</span></div><div><strong>$${Number(report.totals?.amount || 0).toFixed(0)}</strong><span>總金額</span></div></div>
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

function renderOvertimeReviewPagination(review) {
    const page = Number(review.page || 1);
    const pageSize = Number(review.pageSize || 20);
    const total = Number(review.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<div class="records-filter-row records-pagination">
      <button class="ghost-btn compact-btn" type="button" data-overtime-review-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
      <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
      <button class="ghost-btn compact-btn" type="button" data-overtime-review-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
    </div>`;
  }

function renderOvertimeReviewSection() {
    const review = ensureOvertimeReviewState();
    const filters = review.filters;
    const rows = review.requests || [];
    return `<section class="records-section">
      <h2>加班審核</h2>
      <div class="records-admin-toolbar overtime-review-toolbar">
        <div class="records-admin-filters overtime-review-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-overtime-review-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-overtime-review-filter="toDate"></label>
          <label class="records-admin-field"><span>人員</span><select data-overtime-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select></label>
          <label class="records-admin-field"><span>狀態</span><select data-overtime-review-filter="status">
            <option value="pending" ${filters.status === "pending" ? "selected" : ""}>待審</option>
            <option value="approved" ${filters.status === "approved" ? "selected" : ""}>核准</option>
            <option value="returned" ${filters.status === "returned" ? "selected" : ""}>退回</option>
            <option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option>
          </select></label>
        </div>
        <div class="records-admin-actions overtime-review-actions">
          <button class="ghost-btn compact-btn" type="button" data-open-admin-overtime-create="true">代為申請</button>
          <button class="primary-btn compact-btn" type="button" data-overtime-review-batch="approved">批次核准</button>
          <button class="ghost-btn compact-btn" type="button" data-overtime-review-batch="returned">批次退回</button>
        </div>
      </div>
      ${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}
      <div class="records-table-wrap">
        <table class="records-table overtime-review-table">
          <thead><tr><th class="overtime-review-check-col"><input type="checkbox" data-overtime-review-check-all></th><th class="overtime-review-date-col">日期</th><th>員工</th><th>班別</th><th>打卡時間</th><th>加班時數</th><th>備註</th><th class="overtime-review-status-col">狀態</th><th class="overtime-review-action-col">操作</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td class="overtime-review-check-col"><input type="checkbox" data-overtime-review-check="${escapeHtml(row.id)}"></td>
            <td class="overtime-review-date-col">${escapeHtml(row.work_date || "")}${row.attendance_changed_warning ? '<br><span class="auth-error-inline">打卡時間已異動</span>' : ""}</td>
            <td>${escapeHtml(row.employee?.full_name || "")}</td>
            <td>${escapeHtml(row.shift?.name || "-")}<br><span>${escapeHtml(`${String(row.shift?.start_time || "").slice(0, 5)}-${String(row.shift?.end_time || "").slice(0, 5)}`)}</span></td>
            <td>上班 ${formatPunchTime(row.attendance?.clock_in_at)}<br>下班 ${formatPunchTime(row.attendance?.clock_out_at)}</td>
            <td>${formatHours(row.early_overtime_hours)}＋${formatHours(row.late_overtime_hours)}=${formatHours(row.total_overtime_hours)}</td>
            <td>${escapeHtml(row.employee_note || "")}</td>
            <td class="overtime-review-status-col">${escapeHtml(getOvertimeStatusLabel(row.status || ""))}</td>
            <td class="overtime-review-action-col"><div class="overtime-review-action-buttons"><button class="ghost-btn compact-btn" type="button" data-open-overtime-review="${escapeHtml(row.id)}">調整</button><button class="primary-btn compact-btn" type="button" data-approve-overtime="${escapeHtml(row.id)}">核准</button><button class="ghost-btn compact-btn" type="button" data-return-overtime="${escapeHtml(row.id)}">退回</button></div></td>
          </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>
        </table>
      </div>
      ${renderOvertimeReviewPagination(review)}
    </section>`;
  }

function renderAttendanceAdminSection() {
    const admin = recordsState.attendanceAdmin;
    const filters = admin.filters;
    const page = Number(admin.page || 1);
    const pageSize = Number(admin.pageSize || 50);
    const total = Number(admin.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<section class="records-section">
      <h2>打卡管理</h2>
      <div class="records-admin-toolbar attendance-admin-toolbar">
        <div class="records-admin-filters attendance-admin-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate)}" data-attendance-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate)}" data-attendance-filter="toDate"></label>
          <label class="records-admin-field"><span>人員</span><select data-attendance-filter="memberId">${memberOptions(filters.memberId, admin.members)}</select></label>
          <label class="records-admin-field"><span>異常類型</span><select data-attendance-filter="issueType"><option value="__all__" ${filters.abnormalOnly ? "" : "selected"}>全部顯示</option><option value="" ${filters.abnormalOnly && !filters.issueType ? "selected" : ""}>全部異常</option>${admin.issueTypes.map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
        </div>
      </div>
      ${admin.error ? `<div class="auth-error">${escapeHtml(admin.error)}</div>` : ""}
      <div class="records-table-wrap"><table class="records-table">
        <thead><tr><th>日期</th><th>員工</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th>操作</th></tr></thead>
        <tbody>${admin.rows.map((row) => `<tr>
          <td>${escapeHtml(row.work_date || "")}</td>
          <td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td>
          <td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td>
          <td>${formatRecordDateTime(row.clock_in_at)}<br><span>${escapeHtml(row.clock_in_department_name_snapshot || "")}</span></td>
          <td>${formatRecordDateTime(row.clock_out_at)}<br><span>${escapeHtml(row.clock_out_department_name_snapshot || "")}</span></td>
          <td>${escapeHtml((row.issues || []).join("、") || "正常")}</td>
          <td>${escapeHtml(row.attendance_note || "")}</td>
          <td><button class="ghost-btn compact-btn" type="button" data-edit-attendance="${escapeHtml(row.user_id)}:${escapeHtml(row.work_date)}:${escapeHtml(row.id || "")}">編輯</button>${row.id ? `<button class="ghost-btn compact-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}">歷程</button>` : ""}</td>
        </tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody>
      </table></div>
      <div class="records-filter-row records-pagination">
        <button class="ghost-btn compact-btn" type="button" data-attendance-admin-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
        <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
        <button class="ghost-btn compact-btn" type="button" data-attendance-admin-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
      </div>
    </section>`;
  }

function renderMealSettingsSection() {
    const mealAdmin = recordsState.mealAdmin;
    const subsidy = Number(mealAdmin.settings?.company_subsidy || 55);
    return `<section class="records-section">
      <h2>訂餐設定</h2>
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
            <td class="meal-settings-operation-col"><button class="ghost-btn compact-btn" type="button" data-delete-meal-product="${escapeHtml(String(index))}">刪除</button></td>
          </tr>`).join("") || '<tr><td colspan="5">尚無商品</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  }
