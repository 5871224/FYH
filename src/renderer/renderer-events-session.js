/* 班表選取、鍵盤、返回鍵與 Session 逾時事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindScheduleSessionEvents() {
  document.body.addEventListener("mousedown", beginScheduleHeaderColumnSelection);
  document.body.addEventListener("mouseover", updateScheduleHeaderColumnSelection);
  document.body.addEventListener("mousedown", beginScheduleRangeSelection);
  document.body.addEventListener("mouseover", updateScheduleRangeSelection);
  document.body.addEventListener("mouseup", endScheduleRangeSelection);
  document.body.addEventListener("mouseleave", endScheduleRangeSelection);
  document.addEventListener("keydown", handleScheduleGridKeydown);
  window.addEventListener("popstate", handleAppBackNavigation);
  window.addEventListener("scheduler-session-expired", async () => {
    authErrorMessage = "登入已逾時，請重新登入";
    authPromptMessage = "";
    authModalOpen = true;
    clearAuthIdentity();
    currentMember = null;
    managerDirectoryLoaded = false;
    managerDirectoryLoading = null;
    attendanceState = createAttendanceState();
    mealOrderState = { loading: false, status: null, error: "" };
    recordsState = createRecordsState();
    state = createEmptyState();
    clearScheduleApplicationState();
    appView = "home";
    closeModal();
    closeCoreActionsMenu();
    renderAll();
  });
}
