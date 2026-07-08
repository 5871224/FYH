(function installV2LiveReportFilters() {
  const timers = new Map();

  function scheduleReload(key, callback) {
    const previous = timers.get(key);
    if (previous) clearTimeout(previous);
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      if (typeof callback === "function") void callback();
    }, 0));
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target.dataset.mealReportFilter !== undefined) {
      recordsState.mealPage = 1;
      scheduleReload("meal", typeof loadMealReport === "function" ? loadMealReport : null);
      return;
    }

    if (target.dataset.overtimeReviewFilter !== undefined) {
      recordsState.overtimeReview.page = 1;
      scheduleReload("overtime", typeof loadOvertimeReview === "function" ? loadOvertimeReview : null);
      return;
    }

    if (target.dataset.attendanceFilter !== undefined) {
      recordsState.attendanceAdmin.page = 1;
      scheduleReload("attendance", typeof loadAttendanceAdmin === "function" ? loadAttendanceAdmin : null);
    }
  });
})();
