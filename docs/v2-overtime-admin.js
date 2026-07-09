(function installV2OvertimeAdminUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;


  function ensureReviewState() {
    const current = recordsState.overtimeReview || {};
    const filters = current.filters || {};
    recordsState.overtimeReview = {
      loading: Boolean(current.loading),
      requests: current.requests || [],
      members: current.members || [],
      total: Number(current.total || 0),
      page: Number(current.page || 1),
      pageSize: Number(current.pageSize || 20),
      filters: {
        status: filters.status || "pending",
        fromDate: filters.fromDate || addDaysToDateString(getTodayDateString(), -30),
        toDate: filters.toDate || getTodayDateString(),
        memberId: filters.memberId || ""
      },
      error: current.error || ""
    };
    return recordsState.overtimeReview;
  }

  loadOvertimeReview = async function loadV2OvertimeReview(shouldRender = true) {
    if (!isAdmin()) return;
    const review = ensureReviewState();
    recordsState = {
      ...recordsState,
      overtimeReview: { ...review, loading: true, error: "" }
    };
    if (shouldRender) renderAll();
    try {
      const result = await window.schedulerApi.getOvertimeReviewList({
        ...recordsState.overtimeReview.filters,
        page: recordsState.overtimeReview.page
      });
      recordsState = {
        ...recordsState,
        overtimeReview: {
          ...recordsState.overtimeReview,
          loading: false,
          requests: result.requests || [],
          members: result.members || [],
          total: Number(result.total || 0),
          page: Number(result.page || 1),
          pageSize: Number(result.pageSize || 20),
          error: ""
        }
      };
    } catch (error) {
      recordsState = {
        ...recordsState,
        overtimeReview: {
          ...recordsState.overtimeReview,
          loading: false,
          requests: [],
          error: error.message || "讀取加班審核失敗"
        }
      };
    }
    if (shouldRender) renderAll();
  };

  function formatHours(value) {
    const hours = Number(value || 0);
    return Number.isFinite(hours) ? String(hours) : "0";
  }

  function formatPunchTime(value) {
    return value ? formatClockTime(value) : "-";
  }

  function pageButtons(review) {
    const page = Number(review.page || 1);
    const pageSize = Number(review.pageSize || 20);
    const total = Number(review.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<div class="records-filter-row records-pagination">
      <button class="ghost-btn compact-btn" type="button" data-v2-overtime-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
      <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
      <button class="ghost-btn compact-btn" type="button" data-v2-overtime-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
    </div>`;
  }

  renderOvertimeReviewSection = function renderV2OvertimeReviewSection() {
    const review = ensureReviewState();
    const filters = review.filters;
    const rows = review.requests || [];
    return `<section class="records-section">
      <h2>加班審核</h2>
      <div class="records-filter-row">
        <input type="date" value="${escapeHtml(filters.fromDate || "")}" data-overtime-review-filter="fromDate">
        <input type="date" value="${escapeHtml(filters.toDate || "")}" data-overtime-review-filter="toDate">
        <select data-overtime-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select>
        <select data-overtime-review-filter="status">
          <option value="pending" ${filters.status === "pending" ? "selected" : ""}>待審</option>
          <option value="approved" ${filters.status === "approved" ? "selected" : ""}>核准</option>
          <option value="returned" ${filters.status === "returned" ? "selected" : ""}>退回</option>
          <option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option>
        </select>
        
        <button class="ghost-btn compact-btn" type="button" data-open-admin-overtime-create="true">代為申請</button>
        <button class="primary-btn compact-btn" type="button" data-v2-overtime-batch="approved">批次核准</button>
        <button class="ghost-btn compact-btn" type="button" data-v2-overtime-batch="returned">批次退回</button>
      </div>
      ${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}
      <div class="records-table-wrap">
        <table class="records-table v2-overtime-review-table">
          <thead><tr><th class="v2-overtime-check-col"><input type="checkbox" data-v2-overtime-check-all></th><th class="v2-overtime-date-col">日期</th><th>員工</th><th>班別</th><th>打卡時間</th><th>加班時數</th><th>備註</th><th class="v2-overtime-status-col">狀態</th><th class="v2-overtime-action-col">操作</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td class="v2-overtime-check-col"><input type="checkbox" data-v2-overtime-check="${escapeHtml(row.id)}"></td>
            <td class="v2-overtime-date-col">${escapeHtml(row.work_date || "")}${row.attendance_changed_warning ? '<br><span class="auth-error-inline">打卡時間已異動</span>' : ""}</td>
            <td>${escapeHtml(row.employee?.full_name || "")}</td>
            <td>${escapeHtml(row.shift?.name || "-")}<br><span>${escapeHtml(`${String(row.shift?.start_time || "").slice(0, 5)}-${String(row.shift?.end_time || "").slice(0, 5)}`)}</span></td>
            <td>上班 ${formatPunchTime(row.attendance?.clock_in_at)}<br>下班 ${formatPunchTime(row.attendance?.clock_out_at)}</td>
            <td>${formatHours(row.early_overtime_hours)}＋${formatHours(row.late_overtime_hours)}=${formatHours(row.total_overtime_hours)}</td>
            <td>${escapeHtml(row.employee_note || "")}</td>
            <td class="v2-overtime-status-col">${escapeHtml(getOvertimeStatusLabel(row.status || ""))}</td>
            <td class="v2-overtime-action-col"><div class="v2-overtime-action-buttons"><button class="ghost-btn compact-btn" type="button" data-open-overtime-review="${escapeHtml(row.id)}">調整</button><button class="primary-btn compact-btn" type="button" data-approve-overtime="${escapeHtml(row.id)}">核准</button><button class="ghost-btn compact-btn" type="button" data-return-overtime="${escapeHtml(row.id)}">退回</button></div></td>
          </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>
        </table>
      </div>
      ${pageButtons(review)}
    </section>`;
  };

  openOvertimeReviewModal = function openV2OvertimeReviewModal(id) {
    const row = ensureReviewState().requests.find((item) => item.id === id);
    if (!row) return;
    openEntityListModal({
      title: "調整加班",
      hideFooterClose: true,
      body: `<div class="form-grid two-col">
        <div class="form-row"><label>提早上班</label><input id="reviewEarlyHours" type="number" min="0" step="0.5" value="${Number(row.early_overtime_hours || 0)}"></div>
        <div class="form-row"><label>延後下班</label><input id="reviewLateHours" type="number" min="0" step="0.5" value="${Number(row.late_overtime_hours || 0)}"></div>
        <div class="form-row form-row-wide"><label>備註</label><textarea id="reviewEmployeeNote" rows="4">${escapeHtml(row.employee_note || "")}</textarea></div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-overtime-review="${escapeHtml(id)}">儲存為待審</button>`
    });
  };

  reviewOvertime = async function reviewV2Overtime(id, status, readHours = false) {
    try {
      await window.schedulerApi.reviewOvertimeRequest({
        id,
        status,
        earlyHours: readHours ? document.getElementById("reviewEarlyHours")?.value : undefined,
        lateHours: readHours ? document.getElementById("reviewLateHours")?.value : undefined,
        employeeNote: readHours ? document.getElementById("reviewEmployeeNote")?.value || "" : undefined
      });
      closeModal();
      await loadOvertimeReview();
      showInfoMessage("加班審核已更新");
    } catch (error) {
      setSaveStatus(`加班審核失敗：${error.message}`);
    }
  };

  openAdminOvertimeCreateModal = function openV2AdminOvertimeCreateModal() {
    const review = ensureReviewState();
    openEntityListModal({
      title: "代為申請加班",
      hideFooterClose: true,
      body: `<div class="form-grid two-col">
        <div class="form-row"><label>人員</label><select id="adminOvertimeUser">${memberOptions("", review.members)}</select></div>
        <div class="form-row"><label>日期</label><input id="adminOvertimeDate" type="date" value="${escapeHtml(getTodayDateString())}"></div>
        <div class="form-row"><label>提早上班</label><input id="adminOvertimeEarly" type="number" min="0" step="0.5" value="0"></div>
        <div class="form-row"><label>延後下班</label><input id="adminOvertimeLate" type="number" min="0" step="0.5" value="0"></div>
        <div class="form-row form-row-wide"><label>備註</label><textarea id="adminOvertimeNote" rows="3"></textarea></div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="ghost-btn" type="button" data-v2-admin-overtime-create="pending">建立待審</button><button class="btn-primary" type="button" data-v2-admin-overtime-create="approved">建立並核准</button>`
    });
  };

  async function createForEmployee(status) {
    try {
      await window.schedulerApi.createAdminOvertimeRequest({
        userId: document.getElementById("adminOvertimeUser")?.value || "",
        workDate: document.getElementById("adminOvertimeDate")?.value || getTodayDateString(),
        earlyHours: document.getElementById("adminOvertimeEarly")?.value || 0,
        lateHours: document.getElementById("adminOvertimeLate")?.value || 0,
        note: document.getElementById("adminOvertimeNote")?.value || "",
        status,
        approve: status === "approved"
      });
      closeModal();
      await loadOvertimeReview();
      showInfoMessage(status === "approved" ? "已建立並核准" : "已建立待審申請");
    } catch (error) {
      setSaveStatus(`建立代申請失敗：${error.message}`);
    }
  }

  async function batchReview(status) {
    const ids = Array.from(document.querySelectorAll("[data-v2-overtime-check]:checked")).map((item) => item.dataset.v2OvertimeCheck).filter(Boolean);
    if (!ids.length) {
      showInfoMessage("請先勾選加班申請");
      return;
    }
    const confirmed = await confirmAction(`確定要將 ${ids.length} 筆申請${status === "approved" ? "核准" : "退回"}嗎？`);
    if (!confirmed) return;
    try {
      await window.schedulerApi.reviewOvertimeRequest({ ids, status });
      await loadOvertimeReview();
      showInfoMessage("批次審核已完成");
    } catch (error) {
      showInfoMessage(error.message || "批次審核失敗");
    }
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.v2OvertimeCheckAll !== undefined) {
      document.querySelectorAll("[data-v2-overtime-check]").forEach((input) => { input.checked = target.checked; });
    }
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.overtimeReviewFilter) {
      ensureReviewState().page = 1;
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.v2OvertimePage) {
      const page = Number(target.dataset.v2OvertimePage || 1);
      if (page > 0) {
        ensureReviewState().page = page;
        void loadOvertimeReview();
      }
    }
    if (target.dataset.v2OvertimeBatch) void batchReview(target.dataset.v2OvertimeBatch);
    if (target.dataset.v2AdminOvertimeCreate) void createForEmployee(target.dataset.v2AdminOvertimeCreate);
  });
})();
