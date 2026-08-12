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

function getSettingsExportPayload() {
  return {
    state,
    year: state.year,
    month: state.month
  };
}

async function exportDepartmentsFromSettings() {
  try {
    await window.schedulerApi.exportDepartments(getSettingsExportPayload());
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message || error}`);
  }
}

async function exportListSettings(category) {
  const methodByCategory = {
    shift: "exportShifts",
    leave: "exportLeaveSettings",
    overtime: "exportOvertimeSettings"
  };
  const method = methodByCategory[category];
  if (!method || typeof window.schedulerApi?.[method] !== "function") {
    setSaveStatus("匯出失敗：不支援的設定類型");
    return;
  }
  try {
    await window.schedulerApi[method](getSettingsExportPayload());
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message || error}`);
  }
}

function getImportTextColor(color, textColor, autoTextColor) {
  if (autoTextColor || !textColor) {
    return autoLeaveTextColor(color || "#888780");
  }
  return textColor;
}

function showSettingsImportSummary(label, imported, updated, skipped, failed, firstError = "") {
  const parts = [`新增 ${imported} 筆`, `更新 ${updated} 筆`];
  if (skipped) parts.push(`略過 ${skipped} 筆`);
  if (failed) parts.push(`失敗 ${failed} 筆`);
  const suffix = failed && firstError ? `\n第一筆錯誤：${firstError}` : "";
  showInfoMessage(`${label}匯入完成：${parts.join("，")}${suffix}`);
}

async function importDepartmentsFromSettings() {
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  try {
    const result = await window.schedulerApi.importDepartments();
    if (result?.canceled) return;
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let firstError = "";

    for (const row of rows) {
      const name = String(row?.name || "").trim();
      const startDate = row?.startDate || "";
      const endDate = row?.endDate || "";
      if (!name || (startDate && endDate && !isValidDateRange(startDate, endDate))) {
        skipped += 1;
        continue;
      }
      const existing = state.departments.find((item) => !item.deleted && String(item.name || "").trim() === name) || null;
      const groupId = existing?.groupId || groupFeatureState.currentGroupId || "";
      if (!groupId) {
        skipped += 1;
        continue;
      }
      const payload = {
        ...(existing || {}),
        id: existing?.id || uid("d"),
        name,
        groupId,
        startDate,
        endDate,
        hiddenFromSchedule: Boolean(row?.hiddenFromSchedule),
        deleted: false,
        address: existing?.address || "",
        latitude: existing?.latitude ?? "",
        longitude: existing?.longitude ?? "",
        publicIp: existing?.publicIp || "",
        attendanceEnabled: Boolean(existing?.attendanceEnabled)
      };
      const sortOrder = existing ? Math.max(0, state.departments.indexOf(existing)) : state.departments.length;
      try {
        await window.schedulerApi.saveDepartmentItem(payload, sortOrder);
        if (existing) {
          state.departments = state.departments.map((item) => item.id === existing.id ? payload : item);
          updated += 1;
        } else {
          state.departments.push(payload);
          imported += 1;
        }
      } catch (error) {
        failed += 1;
        if (!firstError) firstError = error.message || String(error);
      }
    }

    renderAll();
    await reopenSettingsModalPreservingScroll(returnTo);
    showSettingsImportSummary("單位", imported, updated, skipped, failed, firstError);
  } catch (error) {
    setSaveStatus(`匯入失敗：${error.message || error}`);
    showInfoMessage(`單位匯入失敗：${error.message || error}`);
  }
}

async function importShiftSettings() {
  const result = await window.schedulerApi.importShifts();
  if (result?.canceled) return null;
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const departmentMap = new Map(
    state.departments
      .filter((item) => !item.deleted)
      .map((item) => [String(item.name || "").trim(), item.id])
  );
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let firstError = "";

  for (const row of rows) {
    const name = String(row?.name || "").trim();
    const departmentName = String(row?.departmentName || "").trim();
    const applicableDeptId = departmentMap.get(departmentName) || "";
    const startTime = row?.startTime || "";
    const endTime = row?.endTime || "";
    if (!name || !applicableDeptId || !isValidTimeRange(startTime, endTime)) {
      skipped += 1;
      continue;
    }
    const existing = state.shifts.find((item) => !item.deleted && String(item.name || "").trim() === name) || null;
    const color = String(row?.color || existing?.color || COLORS[0].hex);
    const autoTextColor = Boolean(row?.autoTextColor);
    const payload = {
      ...(existing || {}),
      id: existing?.id || uid("s"),
      name,
      color,
      textColor: getImportTextColor(color, String(row?.textColor || existing?.textColor || ""), autoTextColor),
      autoTextColor,
      startTime,
      endTime,
      hiddenFromToolbar: Boolean(row?.hiddenFromToolbar),
      requiredStaffCount: Math.max(0, Number(row?.requiredStaffCount) || 0),
      applicableDeptId,
      positionRequirements: existing?.positionRequirements || [],
      groupId: existing?.groupId || groupFeatureState.currentGroupId || "",
      deleted: false
    };
    const sortOrder = existing ? Math.max(0, state.shifts.indexOf(existing)) : state.shifts.length;
    try {
      const saved = await window.schedulerApi.saveShiftItem(payload, sortOrder);
      const savedId = String(saved?.id || "").trim();
      const savedItem = savedId && savedId !== payload.id ? { ...payload, id: savedId } : payload;
      if (existing) {
        state.shifts = state.shifts.map((item) => item.id === existing.id ? savedItem : item);
        updated += 1;
      } else {
        state.shifts.push(savedItem);
        imported += 1;
      }
    } catch (error) {
      failed += 1;
      if (!firstError) firstError = error.message || String(error);
    }
  }
  return { imported, updated, skipped, failed, firstError };
}

async function importNamedCatalogSettings(category) {
  const method = category === "leave" ? "importLeaveSettings" : "importOvertimeSettings";
  const result = await window.schedulerApi[method]();
  if (result?.canceled) return null;
  const rows = Array.isArray(result?.result?.items) ? result.result.items : [];
  const list = getItemList(category);
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let firstError = "";

  for (const row of rows) {
    const name = String(row?.name || "").trim();
    const code = category === "leave" ? String(row?.code || "").trim() : "";
    if (!name || (category === "leave" && (!code || !LEAVE_CATALOG.some((item) => item.code === code)))) {
      skipped += 1;
      continue;
    }
    if (category === "overtime") {
      if (!isValidTimeRange(row?.startTime || "", row?.endTime || "")) {
        skipped += 1;
        continue;
      }
      if (row?.useRest1 && !isValidTimeRange(row?.rest1StartTime || "", row?.rest1EndTime || "")) {
        skipped += 1;
        continue;
      }
      if (row?.useRest2 && !isValidTimeRange(row?.rest2StartTime || "", row?.rest2EndTime || "")) {
        skipped += 1;
        continue;
      }
    }
    const existing = list.find((item) => !item.deleted && (
      category === "leave"
        ? String(item.code || "").trim() === code
        : String(item.name || "").trim() === name
    )) || null;
    const defaultColor = category === "leave" ? "#888780" : "#D85A30";
    const color = String(row?.color || existing?.color || defaultColor);
    const autoTextColor = Boolean(row?.autoTextColor);
    const payload = category === "leave"
      ? {
        ...(existing || {}),
        id: existing?.id || uid("l"),
        code,
        name,
        requiresTime: Boolean(row?.requiresTime),
        requiresReason: Boolean(row?.requiresReason),
        color,
        textColor: getImportTextColor(color, String(row?.textColor || existing?.textColor || ""), autoTextColor),
        autoTextColor,
        hiddenFromToolbar: Boolean(row?.hiddenFromToolbar),
        deleted: false
      }
      : {
        ...(existing || {}),
        id: existing?.id || uid("o"),
        name,
        startTime: row?.startTime || "",
        endTime: row?.endTime || "",
        useRest1: Boolean(row?.useRest1),
        rest1StartTime: row?.useRest1 ? (row?.rest1StartTime || "") : "",
        rest1EndTime: row?.useRest1 ? (row?.rest1EndTime || "") : "",
        useRest2: Boolean(row?.useRest2),
        rest2StartTime: row?.useRest2 ? (row?.rest2StartTime || "") : "",
        rest2EndTime: row?.useRest2 ? (row?.rest2EndTime || "") : "",
        color,
        textColor: getImportTextColor(color, String(row?.textColor || existing?.textColor || ""), autoTextColor),
        autoTextColor,
        hiddenFromToolbar: Boolean(row?.hiddenFromToolbar),
        deleted: false
      };
    const sortOrder = existing ? Math.max(0, list.indexOf(existing)) : list.length;
    try {
      const saved = await window.schedulerApi.saveCatalogItem(category, payload, sortOrder);
      const savedId = String(saved?.id || "").trim();
      const savedItem = savedId && savedId !== payload.id ? { ...payload, id: savedId } : payload;
      if (existing) {
        const next = getItemList(category).map((item) => item.id === existing.id ? savedItem : item);
        if (category === "leave") state.leaves = next;
        else state.overtime = next;
        updated += 1;
      } else {
        if (category === "leave") state.leaves.push(savedItem);
        else state.overtime.push(savedItem);
        imported += 1;
      }
    } catch (error) {
      failed += 1;
      if (!firstError) firstError = error.message || String(error);
    }
  }
  return { imported, updated, skipped, failed, firstError };
}

async function importListSettings(category) {
  const labelByCategory = { shift: "班別", leave: "假別", overtime: "加班" };
  const label = labelByCategory[category];
  if (!label) {
    setSaveStatus("匯入失敗：不支援的設定類型");
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "list-settings", listCategory: category });
  try {
    const summary = category === "shift"
      ? await importShiftSettings()
      : await importNamedCatalogSettings(category);
    if (!summary) return;
    renderAll();
    await reopenSettingsModalPreservingScroll(returnTo);
    showSettingsImportSummary(label, summary.imported, summary.updated, summary.skipped, summary.failed, summary.firstError);
  } catch (error) {
    setSaveStatus(`匯入失敗：${error.message || error}`);
    showInfoMessage(`${label}匯入失敗：${error.message || error}`);
  }
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
