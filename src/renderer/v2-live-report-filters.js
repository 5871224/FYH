(function installV2LiveReportFilters() {
  const timers = new Map();
  const exporter = window.schedulerBrowserExporter;
  const api = window.schedulerApi;
  const originalExporters = exporter ? {
    getSapLeaveExportRows: exporter.getSapLeaveExportRows,
    getOvertimeExportRows: exporter.getOvertimeExportRows,
    getLeaveExportRows: exporter.getLeaveExportRows
  } : null;

  function scheduleReload(key, callback) {
    const previous = timers.get(key);
    if (previous) clearTimeout(previous);
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      if (typeof callback === "function") void callback();
    }, 0));
  }

  function parseIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function dateAtMonthStartDay(year, month, startDay) {
    return new Date(year, month, Math.min(startDay, daysInMonth(year, month)));
  }

  function getPeriodStartForDate(date, startDay) {
    const thisMonthStart = dateAtMonthStartDay(date.getFullYear(), date.getMonth(), startDay);
    return date >= thisMonthStart
      ? thisMonthStart
      : dateAtMonthStartDay(date.getFullYear(), date.getMonth() - 1, startDay);
  }

  function getPreviousPeriodDefaults() {
    const today = parseIsoDate(typeof getTodayDateString === "function" ? getTodayDateString() : "") || new Date();
    const rawStartDay = Number(typeof getConfiguredMonthStartDay === "function"
      ? getConfiguredMonthStartDay()
      : state?.rules?.monthStartDay || 1);
    const startDay = Number.isInteger(rawStartDay) && rawStartDay >= 1 && rawStartDay <= 31 ? rawStartDay : 1;
    const currentPeriodStart = getPeriodStartForDate(today, startDay);
    const previousEnd = addDays(currentPeriodStart, -1);
    const previousStart = getPeriodStartForDate(previousEnd, startDay);
    return {
      startDay,
      startDate: formatIsoDate(previousStart),
      endDate: formatIsoDate(previousEnd)
    };
  }

  function compactDate(isoDate) {
    return String(isoDate || "").replaceAll("-", "");
  }

  function enumerateMonths(startDate, endDate) {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end || start > end) return [];
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  function aggregateRows(payload, original, dateColumnIndex) {
    if (!payload?.startDate || !payload?.endDate || typeof original !== "function") {
      return typeof original === "function" ? original(payload) : [];
    }
    const start = compactDate(payload.startDate);
    const end = compactDate(payload.endDate);
    return enumerateMonths(payload.startDate, payload.endDate).flatMap(({ year, month }) => (
      original({ ...payload, startDate: "", endDate: "", year, month })
        .filter((row) => {
          const value = String(row?.[dateColumnIndex] || "");
          return value >= start && value <= end;
        })
    ));
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function styleWorksheet(sheet, widths) {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = widths.map((width) => ({ width }));
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD8D2C7" } },
          left: { style: "thin", color: { argb: "FFD8D2C7" } },
          bottom: { style: "thin", color: { argb: "FFD8D2C7" } },
          right: { style: "thin", color: { argb: "FFD8D2C7" } }
        };
        cell.alignment = cell.alignment || { horizontal: "center", vertical: "middle", wrapText: true };
      });
    });
  }

  function installRangeExporters() {
    if (!exporter || !api || !originalExporters) return;

    exporter.getSapLeaveExportRows = (payload) => aggregateRows(payload, originalExporters.getSapLeaveExportRows, 2);
    exporter.getOvertimeExportRows = (payload) => aggregateRows(payload, originalExporters.getOvertimeExportRows, 1);
    exporter.getLeaveExportRows = (payload) => aggregateRows(payload, originalExporters.getLeaveExportRows, 1);
    exporter.buildSapLeaveCsvContent = (payload) => {
      const rows = exporter.getSapLeaveExportRows(payload);
      const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
      return rows.length ? `\uFEFF${csv}\r\n` : "\uFEFF";
    };
    exporter.createOvertimeWorkbook = async (payload) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("匯出加班");
      const headers = ["員工編號", "加班日期", "加班時間(起)", "加班時間(迄)", "前一日", "加班補貼類型", "休息1(起)", "休息1(迄)", "支薪1", "休息2(起)", "休息2(迄)", "支薪2"];
      sheet.addRow(headers);
      exporter.getOvertimeExportRows(payload).forEach((row) => sheet.addRow(row));
      styleWorksheet(sheet, headers.map((_, index) => index === 0 ? 14 : [4, 5, 8, 11].includes(index) ? 10 : 14));
      return workbook;
    };
    exporter.createLeaveWorkbook = async (payload) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("匯出請假");
      const headers = ["員工編號", "請假日期(起)", "請假日期(迄)", "請假時間(起)", "請假時間(迄)", "假別", "說明"];
      sheet.addRow(headers);
      exporter.getLeaveExportRows(payload).forEach((row) => sheet.addRow(row));
      styleWorksheet(sheet, [14, 14, 14, 14, 14, 12, 28]);
      return workbook;
    };

    function downloadBlob(blob, fileName) {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    function rangeFileName(prefix, payload, extension) {
      return `${prefix}_${compactDate(payload.startDate)}-${compactDate(payload.endDate)}.${extension}`;
    }

    api.exportSapCsv = async (payload) => {
      const rows = exporter.getSapLeaveExportRows(payload);
      if (!rows.length) return { canceled: true, empty: true };
      const blob = new Blob([exporter.buildSapLeaveCsvContent(payload)], { type: "text/csv;charset=utf-8" });
      const fileName = rangeFileName("sap請假", payload, "csv");
      downloadBlob(blob, fileName);
      return { canceled: false, filePath: fileName };
    };
    api.exportOvertime = async (payload) => {
      if (!exporter.getOvertimeExportRows(payload).length) return { canceled: true, empty: true };
      const blob = await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload));
      const fileName = rangeFileName("匯出加班", payload, "xlsx");
      downloadBlob(blob, fileName);
      return { canceled: false, filePath: fileName };
    };
    api.exportLeave = async (payload) => {
      if (!exporter.getLeaveExportRows(payload).length) return { canceled: true, empty: true };
      const blob = await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload));
      const fileName = rangeFileName("匯出請假", payload, "xlsx");
      downloadBlob(blob, fileName);
      return { canceled: false, filePath: fileName };
    };
  }

  async function ensureScheduleRangeLoaded(startDate, endDate) {
    if (!api?.loadScheduleEntries) return;
    const loaded = await api.loadScheduleEntries({ startDate, endDate, members: state.members });
    state.schedule = { ...(state.schedule || {}), ...(loaded?.schedule || {}) };
    state.scheduleLoadedRanges = [
      ...(Array.isArray(state.scheduleLoadedRanges) ? state.scheduleLoadedRanges : []),
      ...(Array.isArray(loaded?.scheduleLoadedRanges) ? loaded.scheduleLoadedRanges : [])
    ];
  }

  function openExportPeriodDialog(type) {
    const defaults = getPreviousPeriodDefaults();
    const labels = {
      sap: { title: "匯出休例假期間", action: "匯出休例假" },
      leave: { title: "匯出請假期間", action: "匯出請假" },
      overtime: { title: "匯出加班期間", action: "匯出加班" }
    };
    const label = labels[type];
    if (!label || typeof openEntityListModal !== "function") return;
    openEntityListModal({
      title: label.title,
      modalClass: "modal modal-wide",
      body: `<div class="form-grid two-col">
        <div class="form-row"><label for="v2ExportPeriodStart">開始日期</label><input id="v2ExportPeriodStart" type="date" value="${defaults.startDate}"></div>
        <div class="form-row"><label for="v2ExportPeriodEnd">結束日期</label><input id="v2ExportPeriodEnd" type="date" value="${defaults.endDate}"></div>
      </div>
      <div class="result-item">
        <div class="result-title">預設期間</div>
        <div class="result-detail">依週期設定的每月開始日 ${defaults.startDay} 日，預設為今天所在期間的上一期。</div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-v2-run-period-export="${type}">${label.action}</button>`,
      hideFooterClose: true
    });
  }

  async function runPeriodExport(type) {
    const startDate = document.getElementById("v2ExportPeriodStart")?.value || "";
    const endDate = document.getElementById("v2ExportPeriodEnd")?.value || "";
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end) {
      if (typeof reportValidationError === "function") reportValidationError("請選擇開始日期與結束日期");
      return;
    }
    if (start > end) {
      if (typeof reportValidationError === "function") reportValidationError("開始日期必須早於或等於結束日期");
      return;
    }
    const method = type === "sap" ? "exportSapCsv" : type === "leave" ? "exportLeave" : "exportOvertime";
    const emptyMessage = type === "sap" ? "目前沒有可匯出的休例假資料" : type === "leave" ? "目前沒有可匯出的請假資料" : "目前沒有可匯出的加班資料";
    try {
      if (typeof setSaveStatus === "function") setSaveStatus("正在準備匯出資料...", true);
      await ensureScheduleRangeLoaded(startDate, endDate);
      const result = await api[method]({
        state,
        startDate,
        endDate,
        year: start.getFullYear(),
        month: start.getMonth()
      });
      if (result?.empty && typeof showInfoMessage === "function") showInfoMessage(emptyMessage);
      if (typeof closeModal === "function") closeModal();
      if (typeof setSaveStatus === "function") setSaveStatus("");
    } catch (error) {
      if (typeof setSaveStatus === "function") setSaveStatus(`匯出失敗：${error.message || error}`);
    }
  }

  async function loadPersonalRecordsLive() {
  if (!api?.getPersonalRecords) return;
  recordsState = { ...recordsState, loading: true, error: "" };
  if (typeof renderAll === "function") renderAll();
  try {
    const result = await api.getPersonalRecords({
      ...(recordsState.personalFilters || {}),
      page: Number(recordsState.personalPage || 1)
    });
    recordsState = {
      ...recordsState,
      loading: false,
      personal: result.records || [],
      personalTotal: Number(result.total || 0),
      personalPage: Number(result.page || 1),
      personalPageSize: Number(result.pageSize || 50),
      error: ""
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      loading: false,
      personal: [],
      error: error.message || "讀取記錄失敗"
    };
  }
  if (typeof renderAll === "function") renderAll();
}

  installRangeExporters();

  const style = document.createElement("style");
  style.textContent = "[data-v2-personal-search]{display:none!important}";
  document.head.appendChild(style);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target.dataset.v2PersonalFilter !== undefined) {
      recordsState.personalPage = 1;
      scheduleReload("personal", loadPersonalRecordsLive);
      return;
    }

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

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button) return;
    const type = button.id === "exportSapButton" ? "sap" : button.id === "exportLeaveButton" ? "leave" : button.id === "exportOvertimeButton" ? "overtime" : "";
    if (type) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openExportPeriodDialog(type);
      return;
    }
    if (button.dataset.v2RunPeriodExport) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void runPeriodExport(button.dataset.v2RunPeriodExport);
    }
  }, true);
})();
