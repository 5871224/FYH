/* 班表期間切換與 SAP、加班、假別匯出操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

async function changeScheduleWindowWeeks(weeks) {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
  await ensureVisibleScheduleLoaded();
  renderAll();
  await forceSave();
}

async function exportSapCsv() {
  if (!hasSapLeaveRows()) {
    showInfoMessage("目前沒有可匯出的休例假資料");
    return;
  }
  try {
    const result = await window.schedulerApi.exportSapCsv({
      state,
      year: state.year,
      month: state.month
    });
    if (result.empty) {
      showInfoMessage("目前沒有可匯出的休例假資料");
      return;
    }
    if (result.canceled) {
      return;
    }
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function exportOvertime() {
  if (!hasOvertimeRows()) {
    showInfoMessage("目前沒有可匯出的加班資料");
    return;
  }
  try {
    const result = await window.schedulerApi.exportOvertime({
      state,
      year: state.year,
      month: state.month
    });
    if (result.empty) {
      showInfoMessage("目前沒有可匯出的加班資料");
      return;
    }
    if (result.canceled) {
      return;
    }
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function exportLeave() {
  if (!hasLeaveRows()) {
    showInfoMessage("目前沒有可匯出的請假資料");
    return;
  }
  try {
    const result = await window.schedulerApi.exportLeave({
      state,
      year: state.year,
      month: state.month
    });
    if (result.empty) {
      showInfoMessage("目前沒有可匯出的請假資料");
      return;
    }
    if (result.canceled) {
      return;
    }
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}
