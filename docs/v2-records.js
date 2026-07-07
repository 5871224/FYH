(function installV2RecordsUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const originalExportMealReport = window.schedulerApi.exportMealReport;

  async function call(name, payload = {}) {
    const session = window.schedulerApi.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "讀取資料失敗");
    return result;
  }

  window.schedulerApi.getPersonalRecords = (filters = {}) => call("personal-records-v2", filters);
  window.schedulerApi.getMealReport = (filters = {}) => call("meal-report-v2", filters);
  window.schedulerApi.cancelTodayMealOrder = () => call("meal-cancel-v2", {});
  window.schedulerApi.exportMealReport = (report) => originalExportMealReport({
    ...report,
    details: report?.exportDetails || report?.details || []
  });

  function ensureState() {
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
    return recordsState;
  }

  loadRecordsPage = async function loadV2RecordsPage() {
    if (!isLoggedIn()) return;
    ensureState();
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
      if (isAdmin()) await Promise.all([loadOvertimeReview(false), loadAttendanceAdmin(false)]);
    } catch (error) {
      recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取記錄失敗" };
    }
    renderAll();
  };

  loadMealReport = async function loadV2MealReport(shouldRender = true) {
    if (!isManager()) return;
    ensureState();
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
  };

  renderRecordsTabs = function renderV2RecordsTabs() {
    const tabs = [
      ["personal", "個人記錄", true],
      ["overtime", "加班審核", isAdmin()],
      ["attendance", "打卡管理", isAdmin()]
    ].filter((tab) => tab[2]);
    if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
    return `<div class="record-tabs">${tabs.map(([id, label]) => `<button class="ghost-btn compact-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
  };

  renderPersonalRecordsSection = function renderV2PersonalRecordsSection() {
    ensureState();
    const filters = recordsState.personalFilters;
    const page = Number(recordsState.personalPage || 1);
    const pageSize = Number(recordsState.personalPageSize || 50);
    const total = Number(recordsState.personalTotal || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<section class="records-section">
      <h2>個人記錄</h2>
      <div class="records-filter-row">
        <input type="date" value="${escapeHtml(filters.fromDate || "")}" data-v2-personal-filter="fromDate">
        <input type="date" value="${escapeHtml(filters.toDate || "")}" data-v2-personal-filter="toDate">
        <button class="primary-btn compact-btn" type="button" data-v2-personal-search>查詢</button>
      </div>
      <div class="records-table-wrap"><table class="records-table">
        <thead><tr><th>日期</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>加班</th><th>打卡備註</th><th>加班備註</th><th>訂餐</th><th>操作</th></tr></thead>
        <tbody>${recordsState.personal.map((record) => `<tr>
          <td>${escapeHtml(record.date || "")}</td>
          <td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>
          <td>${formatRecordDateTime(record.clockIn)}<br><span>${escapeHtml(record.clockInDepartment || "")}${record.clockInSource ? `（${escapeHtml(record.clockInSource)}）` : ""}</span></td>
          <td>${formatRecordDateTime(record.clockOut)}<br><span>${escapeHtml(record.clockOutDepartment || "")}${record.clockOutSource ? `（${escapeHtml(record.clockOutSource)}）` : ""}</span></td>
          <td>${escapeHtml((record.issues || []).join("、") || "正常")}</td>
          <td>${escapeHtml(getOvertimeStatusLabel(record.overtimeStatus || ""))}<br><span>${Number(record.overtimeHours || 0)} 小時</span></td>
          <td>${escapeHtml(record.attendanceNote || "")}</td>
          <td>${escapeHtml(record.overtimeNote || "")}</td>
          <td><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>
          <td>${record.canDeleteOvertime ? `<button class="ghost-btn compact-btn" type="button" data-v2-delete-record-overtime="${escapeHtml(record.date)}">刪除加班</button>` : ""}${record.canCancelMeal ? `<button class="ghost-btn compact-btn" type="button" data-v2-cancel-record-meal="${escapeHtml(record.date)}">取消訂餐</button>` : ""}</td>
        </tr>`).join("") || '<tr><td colspan="10">沒有資料</td></tr>'}</tbody>
      </table></div>
      <div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-v2-personal-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-v2-personal-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>
    </section>`;
  };

  renderMealReportSection = function renderV2MealReportSection() {
    ensureState();
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
      <div class="records-filter-row"><input type="date" value="${escapeHtml(filters.fromDate)}" data-meal-report-filter="fromDate"><input type="date" value="${escapeHtml(filters.toDate)}" data-meal-report-filter="toDate"><select data-meal-report-filter="departmentId">${departmentOptions(filters.departmentId)}</select><select data-meal-report-filter="memberId">${memberOptions(filters.memberId)}</select><select data-meal-report-view><option value="detail" ${view === "detail" ? "selected" : ""}>明細</option><option value="item" ${view === "item" ? "selected" : ""}>品項</option><option value="member" ${view === "member" ? "selected" : ""}>人員</option></select><button class="primary-btn compact-btn" type="button" data-load-meal-report="true">查詢</button><button class="ghost-btn compact-btn" type="button" data-export-meal-report="true">匯出</button></div>
      ${report.error ? `<div class="auth-error">${escapeHtml(report.error)}</div>` : ""}
      <div class="meal-stats-grid"><div><strong>${Number(report.totals?.quantity || 0)}</strong><span>期間總數量</span></div><div><strong>$${Number(report.totals?.amount || 0).toFixed(0)}</strong><span>期間總金額</span></div></div>
      ${table}
      ${view === "detail" ? `<div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-v2-meal-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-v2-meal-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>` : ""}
    </section>`;
  };

  renderRecordsPage = function renderV2RecordsPage() {
    const recordsCard = document.getElementById("recordsCard");
    if (!recordsCard) return;
    if (!isLoggedIn()) { recordsCard.innerHTML = ""; return; }
    const activeSection = recordsState.activeTab === "overtime"
        ? renderOvertimeReviewSection()
        : recordsState.activeTab === "attendance"
          ? renderAttendanceAdminSection()
          : renderPersonalRecordsSection();
    recordsCard.innerHTML = `<div class="clock-page-header"><div><p class="home-eyebrow">記錄</p><h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1><p class="home-subtitle">個人記錄與管理作業。</p></div>${renderHomeIconButton()}</div>${renderRecordsTabs()}${recordsState.error ? `<div class="auth-error clock-error">${escapeHtml(recordsState.error)}</div>` : ""}${activeSection}${recordsState.loading ? '<p class="clock-loading">讀取中，請稍候...</p>' : ""}`;
  };

  async function cancelMeal() {
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

  document.addEventListener("change", (event) => {
    const target = event.target;
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.v2PersonalFilter) {
      ensureState().personalFilters[target.dataset.v2PersonalFilter] = target.value;
      recordsState.personalPage = 1;
    }
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.mealReportFilter) {
      recordsState.mealPage = 1;
    }
    if (target instanceof HTMLSelectElement && target.dataset.mealReportView !== undefined) {
      recordsState.mealReportView = target.value || "detail";
      renderAll();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.v2PersonalSearch !== undefined) void loadRecordsPage();
    if (target.dataset.v2PersonalPage) {
      const page = Number(target.dataset.v2PersonalPage || 1);
      if (page > 0) { recordsState.personalPage = page; void loadRecordsPage(); }
    }
    if (target.dataset.v2MealPage) {
      const page = Number(target.dataset.v2MealPage || 1);
      if (page > 0) { recordsState.mealPage = page; void loadMealReport(); }
    }
    if (target.dataset.v2DeleteRecordOvertime) {
      void (async () => {
        const confirmed = await confirmAction(`確定刪除 ${target.dataset.v2DeleteRecordOvertime} 的加班申請嗎？`);
        if (!confirmed) return;
        try { await window.schedulerApi.deleteAttendanceOvertime(target.dataset.v2DeleteRecordOvertime); await loadRecordsPage(); }
        catch (error) { showInfoMessage(error.message || "刪除加班申請失敗"); }
      })();
    }
    if (target.dataset.v2CancelRecordMeal) void cancelMeal();
  });
})();
