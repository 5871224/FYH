/* 記錄頁篩選、分頁、批次審核與個人操作事件。 */

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
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

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
    if (target.dataset.overtimeReviewFilter !== undefined) {
      ensureOvertimeReviewState().filters[target.dataset.overtimeReviewFilter] = target.value || "";
      recordsState.overtimeReview.page = 1;
      scheduleRecordsReload("overtime", loadOvertimeReview);
      return;
    }
    if (target.dataset.attendanceFilter !== undefined) {
      const field = target.dataset.attendanceFilter;
      if (field === "issueType") {
        const showAll = target.value === "__all__";
        recordsState.attendanceAdmin.filters.abnormalOnly = !showAll;
        recordsState.attendanceAdmin.filters.issueType = showAll ? "" : target.value || "";
      } else {
        recordsState.attendanceAdmin.filters[field] = target.value || "";
      }
      recordsState.attendanceAdmin.page = 1;
      scheduleRecordsReload("attendance", loadAttendanceAdmin);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.overtimeReviewCheckAll !== undefined) {
      document.querySelectorAll("[data-overtime-review-check]").forEach((input) => { input.checked = target.checked; });
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
    if (target.dataset.overtimeReviewPage) {
      const page = Number(target.dataset.overtimeReviewPage || 1);
      if (page > 0) { ensureOvertimeReviewState().page = page; void loadOvertimeReview(); }
      return;
    }
    if (target.dataset.attendanceAdminPage) {
      const page = Number(target.dataset.attendanceAdminPage || 1);
      if (page > 0) { recordsState.attendanceAdmin.page = page; void loadAttendanceAdmin(); }
      return;
    }
    if (target.dataset.exportApprovedOvertime !== undefined) { void exportApprovedOvertimeReview(); return; }
    if (target.dataset.overtimeReviewBatch) { void batchReviewOvertime(target.dataset.overtimeReviewBatch); return; }
    if (target.dataset.adminOvertimeCreate) { void createAdminOvertimeForEmployee(target.dataset.adminOvertimeCreate); return; }
    if (target.dataset.deleteRecordOvertime) { void deleteRecordOvertime(target.dataset.deleteRecordOvertime); return; }
    if (target.dataset.cancelRecordMeal) { void cancelMealFromRecords(); }
  });
}
