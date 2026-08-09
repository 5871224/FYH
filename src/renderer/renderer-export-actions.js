/* 班表期間切換與正式匯出操作。 */

const SCHEDULE_WEEK_SCROLL_DAYS = 7;

function getRenderedScheduleWeekDistance() {
  const rows = Array.from(document.querySelectorAll("#mainTable tbody tr"));
  for (const row of rows) {
    const dayCells = Array.from(row.querySelectorAll("td[data-date]"));
    if (dayCells.length > SCHEDULE_WEEK_SCROLL_DAYS) {
      const firstRect = dayCells[0].getBoundingClientRect();
      const nextWeekRect = dayCells[SCHEDULE_WEEK_SCROLL_DAYS].getBoundingClientRect();
      const measuredDistance = Math.abs(nextWeekRect.left - firstRect.left);
      if (measuredDistance > 1) {
        return measuredDistance;
      }
    }
    if (dayCells.length) {
      const measuredWidth = dayCells[0].getBoundingClientRect().width;
      if (measuredWidth > 1) {
        return measuredWidth * SCHEDULE_WEEK_SCROLL_DAYS;
      }
    }
  }

  const stickyDayCell = document.querySelector(".table-sticky-cell-day");
  const stickyDayWidth = stickyDayCell?.getBoundingClientRect?.().width || 0;
  if (stickyDayWidth > 1) {
    return stickyDayWidth * SCHEDULE_WEEK_SCROLL_DAYS;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const fallbackDayWidth = parseFloat(rootStyle.getPropertyValue("--day-col-width")) || 44;
  return fallbackDayWidth * SCHEDULE_WEEK_SCROLL_DAYS;
}

function getScheduleWeekScrollMetrics() {
  const tableWrap = document.getElementById("tableWrap");
  if (!tableWrap) {
    return null;
  }
  return {
    tableWrap,
    weekDistance: getRenderedScheduleWeekDistance(),
    scrollLeft: tableWrap.scrollLeft,
    maxScrollLeft: Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
  };
}

function canScrollScheduleByWeeks(weeks) {
  const direction = Math.sign(Number(weeks) || 0);
  const metrics = getScheduleWeekScrollMetrics();
  if (!direction || !metrics) {
    return false;
  }
  const epsilon = 1;
  return direction < 0
    ? metrics.scrollLeft > epsilon
    : metrics.scrollLeft < metrics.maxScrollLeft - epsilon;
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
      button.disabled = !canScrollScheduleByWeeks(weeks);
    }
  });
}

function scrollScheduleByWeeks(weeks) {
  const direction = Math.sign(Number(weeks) || 0);
  const metrics = getScheduleWeekScrollMetrics();
  if (!direction || !metrics) {
    return;
  }
  const distance = metrics.weekDistance * direction;
  const target = Math.min(metrics.maxScrollLeft, Math.max(0, metrics.scrollLeft + distance));
  if (Math.abs(target - metrics.scrollLeft) < 1) {
    syncScheduleWeekNavigationButtons();
    return;
  }
  if (typeof metrics.tableWrap.scrollTo === "function") {
    metrics.tableWrap.scrollTo({ left: target, behavior: "smooth" });
  } else {
    metrics.tableWrap.scrollLeft = target;
    syncStickyHeaderScroll();
    syncScheduleWeekNavigationButtons();
  }
}

async function changeSchedulePeriodWeeks(weeks) {
  if (Math.abs(Number(weeks) || 0) !== 8) {
    return;
  }
  const startDate = toDateObject(state.scheduleStartDate)
    ? state.scheduleStartDate
    : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
  await ensureVisibleScheduleLoaded();
  renderAll();
  await forceSave();
}

function parseExportDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatExportDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addExportDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function exportPeriodStartForDate(date, startDay) {
  const createStart = (year, month) => new Date(year, month, Math.min(startDay, daysInMonth(year, month)));
  const currentStart = createStart(date.getFullYear(), date.getMonth());
  return date >= currentStart
    ? currentStart
    : createStart(date.getFullYear(), date.getMonth() - 1);
}

function getDefaultExportPeriod() {
  const visible = getVisibleDateRange();
  if (parseExportDate(visible?.startDate) && parseExportDate(visible?.endDate)) {
    return { startDate: visible.startDate, endDate: visible.endDate };
  }
  const today = parseExportDate(getTodayDateString()) || new Date();
  const rawStartDay = Number(getConfiguredMonthStartDay());
  const startDay = Number.isInteger(rawStartDay) && rawStartDay >= 1 && rawStartDay <= 31 ? rawStartDay : 1;
  const currentStart = exportPeriodStartForDate(today, startDay);
  const previousEnd = addExportDays(currentStart, -1);
  const previousStart = exportPeriodStartForDate(previousEnd, startDay);
  return {
    startDate: formatExportDate(previousStart),
    endDate: formatExportDate(previousEnd)
  };
}

function openExportPeriodDialog(type) {
  const defaults = getDefaultExportPeriod();
  const labels = {
    sap: { title: "匯出休例假期間", action: "匯出休例假" },
    leave: { title: "匯出請假期間", action: "匯出請假" },
    overtime: { title: "匯出加班期間", action: "匯出加班" }
  };
  const label = labels[type];
  if (!label) return;
  openEntityListModal({
    title: label.title,
    modalClass: "modal modal-member-form",
    body: `<div class="form-grid">
      <div class="form-row"><label for="exportPeriodStart">開始日期</label><input id="exportPeriodStart" type="date" value="${defaults.startDate}"></div>
      <div class="form-row"><label for="exportPeriodEnd">結束日期</label><input id="exportPeriodEnd" type="date" value="${defaults.endDate}"></div>
    </div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-run-period-export="${type}">${label.action}</button>`,
    hideFooterClose: true
  });
}

async function runPeriodExport(type) {
  const startDate = document.getElementById("exportPeriodStart")?.value || "";
  const endDate = document.getElementById("exportPeriodEnd")?.value || "";
  const start = parseExportDate(startDate);
  const end = parseExportDate(endDate);
  if (!start || !end) {
    reportValidationError("請選擇開始日期與結束日期");
    return;
  }
  if (start > end) {
    reportValidationError("開始日期必須早於或等於結束日期");
    return;
  }
  const method = type === "sap" ? "exportSapCsv" : type === "leave" ? "exportLeave" : "exportOvertime";
  const emptyMessage = type === "sap"
    ? "目前沒有可匯出的休例假資料"
    : type === "leave"
      ? "目前沒有可匯出的請假資料"
      : "目前沒有可匯出的加班資料";
  try {
    setSaveStatus("正在準備匯出資料...", true);
    const exportRows = await window.schedulerApi.loadScheduleExportRows(startDate, endDate);
    const result = await window.schedulerApi[method]({
      state,
      startDate,
      endDate,
      exportRows
    });
    if (result?.empty) showInfoMessage(emptyMessage);
    closeModal();
    setSaveStatus("");
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message || error}`);
  }
}
