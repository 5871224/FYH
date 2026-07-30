/* 班表期間切換與 SAP、加班、假別匯出操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function getScheduleWeekNavigationBounds(startDate) {
  const cycleStartDate = getEightWeekCycleStartForDate(startDate);
  return {
    minStartDate: cycleStartDate,
    maxStartDate: addDaysToDateString(cycleStartDate, 49)
  };
}

function canChangeScheduleWindowWeeks(weeks) {
  if (Math.abs(weeks) !== 1) {
    return true;
  }
  const startDate = toDateObject(state.scheduleStartDate)
    ? state.scheduleStartDate
    : getEightWeekCycleStartForDate(getTodayDateString());
  const targetDate = addDaysToDateString(startDate, weeks * 7);
  const { minStartDate, maxStartDate } = getScheduleWeekNavigationBounds(startDate);
  return Boolean(targetDate && targetDate >= minStartDate && targetDate <= maxStartDate);
}

function syncScheduleWeekNavigationButtons() {
  const controls = [
    ["prevWeekButton", -1],
    ["tablePrevWeekButton", -1],
    ["nextWeekButton", 1],
    ["tableNextWeekButton", 1]
  ];
  controls.forEach(([id, weeks]) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !canChangeScheduleWindowWeeks(weeks);
    }
  });
}

async function changeScheduleWindowWeeks(weeks) {
  if (!canChangeScheduleWindowWeeks(weeks)) {
    syncScheduleWeekNavigationButtons();
    return;
  }
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
