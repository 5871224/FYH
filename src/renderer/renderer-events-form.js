/* 輸入欄位與選單異動的委派事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindDelegatedFormEvents() {
  document.body.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (target.dataset.memberSettingsFilterField === "name") {
      memberSettingsFilters.name = target.value || "";
      refreshMemberSettingsList();
      return;
    }
    if (target.dataset.mealProductId) {
      target.value = String(Math.max(0, Math.floor(Number(target.value || 0) || 0)));
      updateMealOrderLiveSummary();
      return;
    }
    if (target.id === "shiftName") {
      syncNamedColorUi();
      return;
    }
    if (target.id === "leaveCatalogName") {
      syncNamedColorUi();
      return;
    }
    if (target.id === "namedItemName") {
      syncNamedColorUi();
      return;
    }
    if (target.dataset.itemColorInput === "bg") {
      modalColor = target.value;
      if (modalTextColorAuto) {
        modalTextColor = autoLeaveTextColor(modalColor);
      }
      syncNamedColorUi();
      return;
    }
    if (target.dataset.itemColorInput === "text") {
      modalTextColor = target.value;
      modalTextColorAuto = false;
      syncNamedColorUi();
    }
  });

  document.body.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.dataset.memberSettingsFilterField) {
      const field = target.dataset.memberSettingsFilterField;
      memberSettingsFilters[field] = target.value || (field === "employment" ? "active" : "all");
      openMemberSettings();
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.mealReportFilter) {
      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.overtimeReviewFilter) {
      recordsState.overtimeReview.filters[target.dataset.overtimeReviewFilter] = target.value || "";
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.attendanceFilter) {
      const field = target.dataset.attendanceFilter;
      if (field === "issueType") {
        const showAll = target.value === "__all__";
        recordsState.attendanceAdmin.filters.abnormalOnly = !showAll;
        recordsState.attendanceAdmin.filters.issueType = showAll ? "" : target.value || "";
      } else {
        recordsState.attendanceAdmin.filters[field] = target.value || "";
      }
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.toggleOvertimePanel) {
      attendanceOvertimeState = { ...attendanceOvertimeState, expanded: target.checked };
      if (target.checked && !attendanceOvertimeState.status && !attendanceOvertimeState.loading) {
        void loadTodayAttendanceOvertime();
      } else {
        renderAll();
      }
      return;
    }
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.dataset.mealReportFilter) {
      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";
      return;
    }
    if (target.dataset.overtimeReviewFilter) {
      recordsState.overtimeReview.filters[target.dataset.overtimeReviewFilter] = target.value || "";
      return;
    }
    if (target.dataset.attendanceFilter) {
      const field = target.dataset.attendanceFilter;
      recordsState.attendanceAdmin.filters[field] = target.type === "checkbox" ? target.checked : target.value || "";
      return;
    }
    const toggleMap = {
      overtimeUseRest1: ["overtimeRest1StartTime", "overtimeRest1EndTime"],
      overtimeUseRest2: ["overtimeRest2StartTime", "overtimeRest2EndTime"]
    };
    if (target.id === "leaveAssignmentAllDay" || target.id === "leaveAssignmentReasonEnabled") {
      syncLeaveAssignmentModalUi();
      return;
    }
    if (target.id === "scheduleOvertimeUseRest1" || target.id === "scheduleOvertimeUseRest2") {
      syncScheduleOvertimeFormUi();
      return;
    }
    if (target.id === "overtimeUseRest1" || target.id === "overtimeUseRest2") {
      syncOvertimeFormUi();
      return;
    }
    if (target.closest("#memberScheduleShiftList")) {
      syncScheduleShiftSelectorRanks();
      syncScheduleShiftSummary();
      return;
    }
    const targets = toggleMap[target.id];
    if (!targets) {
      return;
    }
    targets.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = !target.checked;
      }
    });
  });
}
