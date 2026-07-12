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

    if (target.dataset.v2PersonalFilter !== undefined) {
      ensureRecordsState().personalFilters[target.dataset.v2PersonalFilter] = target.value;
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
    if (target instanceof HTMLInputElement && target.dataset.v2OvertimeCheckAll !== undefined) {
      document.querySelectorAll("[data-v2-overtime-check]").forEach((input) => { input.checked = target.checked; });
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.v2PersonalPage) {
      const page = Number(target.dataset.v2PersonalPage || 1);
      if (page > 0) { recordsState.personalPage = page; void loadRecordsPage(); }
      return;
    }
    if (target.dataset.v2MealPage) {
      const page = Number(target.dataset.v2MealPage || 1);
      if (page > 0) { recordsState.mealPage = page; void loadMealReport(); }
      return;
    }
    if (target.dataset.v2OvertimePage) {
      const page = Number(target.dataset.v2OvertimePage || 1);
      if (page > 0) { ensureOvertimeReviewState().page = page; void loadOvertimeReview(); }
      return;
    }
    if (target.dataset.v2AttendancePage) {
      const page = Number(target.dataset.v2AttendancePage || 1);
      if (page > 0) { recordsState.attendanceAdmin.page = page; void loadAttendanceAdmin(); }
      return;
    }
    if (target.dataset.v2OvertimeBatch) { void batchReviewOvertime(target.dataset.v2OvertimeBatch); return; }
    if (target.dataset.v2AdminOvertimeCreate) { void createAdminOvertimeForEmployee(target.dataset.v2AdminOvertimeCreate); return; }
    if (target.dataset.v2DeleteRecordOvertime) { void deleteRecordOvertime(target.dataset.v2DeleteRecordOvertime); return; }
    if (target.dataset.v2CancelRecordMeal) { void cancelMealFromRecords(); }
  });
}
