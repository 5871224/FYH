/* 簽到簿篩選、分頁、員工填寫與批次審核事件。 */

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
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.dataset.personalAttendanceField === undefined) return;
    setPersonalAttendanceDraft(
      target.dataset.personalAttendanceDate || "",
      target.dataset.personalAttendanceField || "",
      target.value
    );
  });

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
