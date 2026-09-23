/* 班表列印：日期區間 -> 預覽 -> 瀏覽器列印。
 * 沿用正式班表 renderer；由中央 Renderer 事件系統註冊，不使用 runtime polling / wrapper。
 */
const schedulePrintFeature = (() => {

  const PREVIEW_ID = "schedulePrintPreview";
  const PAGE_STYLE_ID = "schedulePrintPageStyle";
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const PRINT_DEFAULTS = {
    portrait: { datesPerPage: 15, rowsPerPage: 48, contentWidthMm: 202, contentHeightMm: 289 },
    landscape: { datesPerPage: 32, rowsPerPage: 33, contentWidthMm: 289, contentHeightMm: 202 }
  };
  const PRINT_LIMITS = { datesPerPage: [1, 62], rowsPerPage: [1, 60] };
  const PRINT_LEFT_COLUMNS_MM = 25;
  const PRINT_HEADER_HEIGHT_MM = 7.5;
  const PRINT_BASE_ROW_HEIGHT_MM = 5.7;
  let preview = null;

  function canPrint() {
    try {
      if (typeof appView === "undefined" || appView !== "schedule") return false;
      return Boolean(typeof hasCommonPermission === "function" && hasCommonPermission("export"));
    } catch { return false; }
  }

  function overlap(item, startDate, endDate) {
    const start = item?.hireDate || item?.startDate || "";
    const end = item?.leaveDate || item?.endDate || "";
    return (!start || start <= endDate) && (!end || end >= startDate);
  }

  function candidateGroups(startDate, endDate) {
    const groupId = groupFeatureState.currentGroupId;
    return state.departments
      .filter((dept) => !dept.deleted && !dept.hiddenFromSchedule && (!groupId || !dept.groupId || dept.groupId === groupId) && overlap(dept, startDate, endDate))
      .map((department) => ({
        department,
        members: state.members.filter((member) => !member.deleted && member.deptId === department.id && (!groupId || !member.groupId || member.groupId === groupId) && overlap(member, startDate, endDate))
      }));
  }

  function scopeGroups(groups, dates, schedule) {
    const scope = state.tableDeptScopeFilter || "all";
    if (scope === "all") return groups;
    return groups.map(({ department, members }) => ({
      department,
      members: members.filter((member) => {
        if (member.deptId === scope) return true;
        return dates.some((dateString) => {
          if (!isMemberActiveOnDateString(member, dateString)) return false;
          const key = getScheduleKeyForDateString(member.id, dateString);
          const shift = getItem("shift", schedule?.[key]?.shift);
          return Boolean(shift && shiftAllowsDepartment(shift, scope));
        });
      })
    })).filter(({ members }) => members.length);
  }

  function splitRows(groups, maxRows) {
    const pages = [];
    let page = [];
    let rows = 0;
    const flush = () => { if (page.length) pages.push(page); page = []; rows = 0; };
    for (const { department, members } of groups) {
      if (!members.length) {
        if (rows >= maxRows) flush();
        page.push({ department, members: [] }); rows += 1; continue;
      }
      for (let i = 0; i < members.length;) {
        if (rows >= maxRows) flush();
        const take = Math.min(maxRows - rows, members.length - i);
        page.push({ department, members: members.slice(i, i + take) });
        rows += take; i += take;
      }
    }
    flush();
    return pages.length ? pages : [[]];
  }

  function chunks(items, size) {
    const result = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result.length ? result : [[]];
  }

  function clampInteger(value, fallback, [min, max]) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function orientation() {
    if (preview.orientationMode !== "auto") return preview.orientationMode;
    const datesPerPage = Number.isFinite(preview.datesPerPage) ? preview.datesPerPage : preview.dates.length;
    return datesPerPage <= PRINT_DEFAULTS.portrait.datesPerPage ? "portrait" : "landscape";
  }

  function pageSettings(mode) {
    const defaults = PRINT_DEFAULTS[mode];
    return {
      datesPerPage: clampInteger(preview.datesPerPage, defaults.datesPerPage, PRINT_LIMITS.datesPerPage),
      rowsPerPage: clampInteger(preview.rowsPerPage, defaults.rowsPerPage, PRINT_LIMITS.rowsPerPage)
    };
  }

  function pageStyle(mode, { datesPerPage, rowsPerPage }) {
    const defaults = PRINT_DEFAULTS[mode];
    const rowHeight = Math.min(PRINT_BASE_ROW_HEIGHT_MM, (defaults.contentHeightMm - PRINT_HEADER_HEIGHT_MM) / rowsPerPage);
    const innerHeight = Math.max(2.1, rowHeight - 0.6);
    const dateWidth = Math.max(1, (defaults.contentWidthMm - PRINT_LEFT_COLUMNS_MM) / datesPerPage);
    const defaultDateWidth = (defaults.contentWidthMm - PRINT_LEFT_COLUMNS_MM) / defaults.datesPerPage;
    const dateScale = dateWidth / defaultDateWidth;
    const rowScale = rowHeight / PRINT_BASE_ROW_HEIGHT_MM;
    const fontScale = Math.max(0.5, Math.min(1, dateScale, rowScale));
    const headerHeight = Math.max(4.8, PRINT_HEADER_HEIGHT_MM * Math.max(0.7, Math.min(1, dateScale)));
    const cellPadding = Math.max(0.12, 0.3 * fontScale);
    return [
      `--schedule-print-font-scale:${fontScale.toFixed(3)}`,
      `--schedule-print-row-height:${rowHeight.toFixed(2)}mm`,
      `--schedule-print-inner-height:${innerHeight.toFixed(2)}mm`,
      `--schedule-print-header-height:${headerHeight.toFixed(2)}mm`,
      `--schedule-print-cell-padding:${cellPadding.toFixed(2)}mm`
    ].join(";");
  }

  function tableWidthMm(mode, datesPerPage, actualDates) {
    const contentWidth = PRINT_DEFAULTS[mode].contentWidthMm;
    const dateWidth = (contentWidth - PRINT_LEFT_COLUMNS_MM) / datesPerPage;
    return Math.min(contentWidth, PRINT_LEFT_COLUMNS_MM + dateWidth * actualDates);
  }

  function syncPreviewControls(settings) {
    const orientationSelect = document.getElementById("schedulePrintOrientation");
    const rowsInput = document.getElementById("schedulePrintRowsPerPage");
    const datesInput = document.getElementById("schedulePrintDatesPerPage");
    if (orientationSelect instanceof HTMLSelectElement) orientationSelect.value = preview.orientationMode;
    if (rowsInput instanceof HTMLInputElement) rowsInput.value = String(settings.rowsPerPage);
    if (datesInput instanceof HTMLInputElement) datesInput.value = String(settings.datesPerPage);
  }

  function dateHeader(dateString) {
    const date = toDateObject(dateString);
    const weekdayLabels = window.fyhI18n?.isVietnamese?.() ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] : WEEKDAYS;
    return `${date.getMonth() + 1}/${date.getDate()}<span>${weekdayLabels[date.getDay()]}</span>`;
  }

  function renderTable(dates, groups, tableWidth) {
    let html = `<table class="schedule-print-table" style="width:${tableWidth.toFixed(2)}mm"><colgroup><col><col>` + dates.map(() => '<col>').join("") + '</colgroup><thead><tr><th>單位</th><th>姓名</th>';
    html += dates.map((dateString) => {
      const date = toDateObject(dateString);
      const special = state.holidays.some((holiday) => holiday.date === dateString) || date.getDay() === 0 || date.getDay() === 6;
      return `<th class="${special ? "schedule-print-weekend" : ""}">${dateHeader(dateString)}</th>`;
    }).join("") + '</tr></thead><tbody>';
    if (!groups.length) html += `<tr><td class="schedule-print-empty" colspan="${dates.length + 2}">目前沒有符合範圍的人員</td></tr>`;
    for (const { department, members } of groups) {
      if (!members.length) {
        html += `<tr><td class="dept-col">${escapeHtml(department.name)}</td><td class="person-col"></td>${dates.map(() => '<td class="cell inactive-cell"><div class="cell-inner"></div></td>').join("")}</tr>`;
        continue;
      }
      members.forEach((member, index) => {
        html += `<tr>${index === 0 ? `<td class="dept-col" rowspan="${members.length}">${escapeHtml(department.name)}</td>` : ""}<td class="person-col"><div class="member-label">${memberLabel(member)}</div></td>`;
        for (const dateString of dates) {
          if (!isMemberActiveOnDateString(member, dateString)) {
            html += '<td class="cell inactive-cell"><div class="cell-inner"></div></td>'; continue;
          }
          const key = getScheduleKeyForDateString(member.id, dateString);
          html += `<td class="cell">${renderCellInner(key, member.id, dateString, preview.schedule?.[key] || null, true)}</td>`;
        }
        html += '</tr>';
      });
    }
    return html + '</tbody></table>';
  }

  function renderPages() {
    const root = document.querySelector(`#${PREVIEW_ID} .schedule-print-pages`);
    if (!root || !preview) return;
    const mode = orientation();
    const settings = pageSettings(mode);
    const datePages = chunks(preview.dates, settings.datesPerPage);
    const rowPages = splitRows(preview.groups, settings.rowsPerPage);
    const style = pageStyle(mode, settings);
    root.innerHTML = datePages.flatMap((datePage) => {
      const tableWidth = tableWidthMm(mode, settings.datesPerPage, datePage.length);
      return rowPages.map((rowPage) => `<section class="schedule-print-page" data-orientation="${mode}" style="${style}">${renderTable(datePage, rowPage, tableWidth)}</section>`);
    }).join("");
    syncPreviewControls(settings);
    refreshLocalization(document.getElementById(PREVIEW_ID));
  }

  async function loadRange(startDate, endDate) {
    const groups = candidateGroups(startDate, endDate);
    const members = [...new Map(groups.flatMap((group) => group.members.map((member) => [member.id, member]))).values()];
    if (!members.length) return { groups, schedule: {} };
    const payload = await window.schedulerApi.loadScheduleEntries({ startDate, endDate, members: members.map(({ id }) => ({ id })) });
    const raw = payload?.schedule && typeof payload.schedule === "object" ? payload.schedule : {};
    return { groups, schedule: cleanupScheduleEntries(raw, state) };
  }

  function openPreview(startDate, endDate, groups, schedule) {
    const dates = enumerateDateRange(startDate, endDate);
    const group = getCurrentGroup();
    preview = {
      dates,
      groups: scopeGroups(groups, dates, schedule),
      schedule,
      groupName: group?.name || "福圓號",
      orientationMode: "auto",
      rowsPerPage: null,
      datesPerPage: null
    };
    closeModal();
    document.getElementById(PREVIEW_ID)?.remove();
    const root = document.createElement("section");
    root.id = PREVIEW_ID;
    root.innerHTML = `<div class="schedule-print-preview-toolbar"><div><strong>班表列印預覽</strong><span>${startDate} ～ ${endDate}</span></div><div><span class="schedule-print-paper-size">A4</span><label>方向 <select id="schedulePrintOrientation"><option value="auto">自動</option><option value="portrait">直式</option><option value="landscape">橫式</option></select></label><label>每頁人數 <input id="schedulePrintRowsPerPage" type="number" min="1" max="60" step="1" inputmode="numeric"></label><label>每頁日數 <input id="schedulePrintDatesPerPage" type="number" min="1" max="62" step="1" inputmode="numeric"></label><button class="ghost-btn" type="button" data-print-close>返回</button><button class="primary-btn" type="button" data-print-now>列印</button></div></div><div class="schedule-print-pages"></div>`;
    document.body.appendChild(root);
    renderPages();
  }

  function openRangeDialog() {
    if (!canPrint()) { showInfoMessage("沒有班表管理權限"); return; }
    closeCoreActionsMenu();
    const range = getVisibleDateRange();
    openDateRangeActionModal({
      title: "列印班表",
      startDate: range.startDate,
      endDate: range.endDate,
      startId: "schedulePrintStartDate",
      endId: "schedulePrintEndDate",
      actionButton: '<button class="btn-primary" type="button" data-print-range-confirm>預覽列印</button>'
    });
  }

  async function confirmRange(button) {
    const startDate = document.getElementById("schedulePrintStartDate")?.value || "";
    const endDate = document.getElementById("schedulePrintEndDate")?.value || "";
    if (!toDateObject(startDate) || !toDateObject(endDate) || startDate > endDate) { showInfoMessage("請選擇正確的開始日期與結束日期"); return; }
    const text = button.textContent; button.disabled = true; button.textContent = "載入中…";
    try {
      const { groups, schedule } = await loadRange(startDate, endDate);
      openPreview(startDate, endDate, groups, schedule);
    } catch (error) {
      showInfoMessage(`載入列印班表失敗：${error?.message || error}`);
      button.disabled = false; button.textContent = text;
    }
  }

  function doPrint() {
    const mode = orientation();
    let style = document.getElementById(PAGE_STYLE_ID);
    if (!style) { style = document.createElement("style"); style.id = PAGE_STYLE_ID; document.head.appendChild(style); }
    style.textContent = `@page{size:A4 ${mode};margin:0}`;
    document.body.classList.add("schedule-printing");
    requestAnimationFrame(() => window.print());
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const confirm = target.closest("[data-print-range-confirm]");
      if (confirm instanceof HTMLButtonElement) { void confirmRange(confirm); return; }
      if (target.closest("[data-print-close]")) { document.getElementById(PREVIEW_ID)?.remove(); preview = null; return; }
      if (target.closest("[data-print-now]")) doPrint();
    }, true);
    document.addEventListener("change", (event) => {
      if (!preview) return;
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.id === "schedulePrintOrientation") {
        preview.orientationMode = target.value;
        renderPages();
        return;
      }
      if (!(target instanceof HTMLInputElement)) return;
      if (target.id === "schedulePrintRowsPerPage") {
        preview.rowsPerPage = clampInteger(target.value, pageSettings(orientation()).rowsPerPage, PRINT_LIMITS.rowsPerPage);
        renderPages();
        return;
      }
      if (target.id === "schedulePrintDatesPerPage") {
        const fallback = pageSettings(orientation()).datesPerPage;
        preview.datesPerPage = clampInteger(target.value, fallback, PRINT_LIMITS.datesPerPage);
        renderPages();
      }
    });
    window.addEventListener("afterprint", () => document.body.classList.remove("schedule-printing"));
  }

  return {
    openRangeDialog,
    bindEvents
  };
})();

function openSchedulePrintRangeDialog() {
  return schedulePrintFeature.openRangeDialog();
}

function bindSchedulePrintEvents() {
  schedulePrintFeature.bindEvents();
}
