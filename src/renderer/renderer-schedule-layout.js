/* 班表固定表頭與欄寬版面計算
 * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。
 */

function renderStickyTableHeader(dates) {
  const container = document.getElementById("tableStickyHeaderDays");
  const stickyHeader = document.getElementById("tableStickyHeader");
  if (!container || !stickyHeader) {
    return;
  }
  renderStickyHeaderTitleCells();
  const today = getTodayDateString();
  const cells = [];
  dates.forEach((dateString, index) => {
    const date = toDateObject(dateString);
    if (!date) {
      return;
    }
    const day = date.getDate();
    const weekday = date.getDay();
    const cls = weekday === 0 ? "sun" : weekday === 6 ? "sat" : "";
    const weekStripeClass = getWeekStripeClassForDate(dateString);
    const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, index, dates.length);
    cells.push(
      `<div class="table-sticky-cell table-sticky-cell-day ${cls} ${weekStripeClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-schedule-column="${index}" data-date="${dateString}">${date.getMonth() + 1}/${day}<span>${WEEKDAY_LABELS[weekday]}</span></div>`
    );
  });
  container.innerHTML = cells.join("");
  requestAnimationFrame(() => {
    syncStickyHeaderLayout();
    syncStickyHeaderScroll();
  });
}

function renderStickyHeaderTitleCells() {
  const deptCell = document.querySelector(".table-sticky-cell-dept");
  const personCell = document.querySelector(".table-sticky-cell-person");
  const statsCell = document.querySelector(".table-sticky-cell-stats");
  if (!deptCell || !personCell) {
    return;
  }
  const renderCell = (label, dataAttr = "") => `
    <div class="table-sticky-cell-title">
      <span class="table-sticky-cell-label">${label}</span>
      ${hasManagementAccess() && dataAttr ? renderActionIconButton("edit", `${dataAttr}=\"true\"`, "table-header-settings-btn") : ""}
    </div>
  `;
  if (state.tableView === "shift") {
    deptCell.innerHTML = renderCell("班別");
    personCell.innerHTML = renderCell("需求人數");
    if (statsCell) {
      statsCell.innerHTML = "";
      statsCell.hidden = true;
    }
    return;
  }
  deptCell.innerHTML = renderCell("單位", "data-open-department-settings");
  personCell.innerHTML = renderCell("人員", "data-open-member-settings");
  if (statsCell) {
    statsCell.innerHTML = renderCell("統計");
    statsCell.hidden = !state.tableStatsVisible;
  }
}

function syncStickyHeaderLayout() {
  const deptCell = document.querySelector(".table-sticky-cell-dept");
  const personCell = document.querySelector(".table-sticky-cell-person");
  const statsCell = document.querySelector(".table-sticky-cell-stats");
  const prevWeekButton = document.getElementById("tablePrevWeekButton");
  const dayCells = Array.from(document.querySelectorAll(".table-sticky-cell-day"));
  const rootStyle = getComputedStyle(document.documentElement);
  const deptWidth = parseFloat(rootStyle.getPropertyValue("--dept-col-width")) || 72;
  const personWidth = parseFloat(rootStyle.getPropertyValue("--person-col-width")) || 92;
  const statsWidth = parseFloat(rootStyle.getPropertyValue("--stats-col-width")) || 86;
  const dayWidth = parseFloat(rootStyle.getPropertyValue("--day-col-width")) || 44;
  if (!deptCell || !personCell) {
    return;
  }

  const setWidth = (element, width) => {
    const px = `${Math.round(width)}px`;
    element.style.width = px;
    element.style.minWidth = px;
    element.style.maxWidth = px;
  };

  setWidth(deptCell, deptWidth);
  setWidth(personCell, personWidth);
  if (statsCell) {
    if (state.tableView === "member" && state.tableStatsVisible) {
      statsCell.hidden = false;
      setWidth(statsCell, statsWidth);
    } else {
      statsCell.hidden = true;
      setWidth(statsCell, 0);
    }
  }
  if (prevWeekButton) {
    const frozenWidth = deptWidth + personWidth + (state.tableView === "member" && state.tableStatsVisible ? statsWidth : 0);
    prevWeekButton.style.left = `${Math.round(frozenWidth)}px`;
    document.documentElement.style.setProperty("--schedule-frozen-width", `${Math.round(frozenWidth)}px`);
  }
  dayCells.forEach((cell) => setWidth(cell, dayWidth));
  const topScrollbarContent = document.getElementById("tableTopScrollbarContent");
  if (topScrollbarContent) {
    topScrollbarContent.style.width = `${Math.round(dayCells.length * dayWidth)}px`;
  }
}

function syncStickyHeaderScroll() {
  const tableWrap = document.getElementById("tableWrap");
  const container = document.getElementById("tableStickyHeaderDays");
  if (!tableWrap || !container) {
    return;
  }
  container.style.marginLeft = `${-tableWrap.scrollLeft}px`;
  const topScrollbar = document.getElementById("tableTopScrollbar");
  if (topScrollbar && Math.abs(topScrollbar.scrollLeft - tableWrap.scrollLeft) > 0.5) {
    topScrollbar.scrollLeft = tableWrap.scrollLeft;
  }
}

function scrollScheduleHorizontallyFromTopScrollbar(event) {
  const tableWrap = document.getElementById("tableWrap");
  const topScrollbar = event.target;
  if (!tableWrap || !(topScrollbar instanceof HTMLElement)) {
    return;
  }
  const targetScrollLeft = topScrollbar.scrollLeft;
  // 主班表使用 smooth scroll 時，每個動畫 frame 都會同步上方捲軸。
  // 上方捲軸因此觸發 scroll 事件；若位置本來就相同，不能再寫回主班表，
  // 否則瀏覽器會把尚未完成的 smooth scroll 中斷在第一小段。
  if (Math.abs(tableWrap.scrollLeft - targetScrollLeft) <= 0.5) {
    return;
  }
  tableWrap.scrollLeft = targetScrollLeft;
  syncStickyHeaderScroll();
}

function scrollScheduleHorizontallyFromHeader(event) {
  const tableWrap = document.getElementById("tableWrap");
  if (!tableWrap) {
    return;
  }
  if (!event.deltaY && !event.deltaX) {
    return;
  }
  event.preventDefault();
  tableWrap.scrollLeft += event.deltaX || event.deltaY;
  syncStickyHeaderScroll();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultState() {
  return deepClone(DEFAULT_STATE);
}

function createEmptyState() {
  const empty = createDefaultState();
  empty.departments = [];
  empty.members = [];
  empty.shifts = [];
  empty.leaves = [];
  empty.overtime = [];
  empty.holidays = [];
  empty.schedule = {};
  empty.selected = { type: null, id: null };
  empty.deptFilter = "all";
  empty.tableView = "member";
  empty.tableDeptScopeFilter = "all";
  empty.scheduleStartDate = "";
  return empty;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid(_prefix) {
  return crypto.randomUUID();
}

function getMeasureTextContext() {
  if (!measureTextContext) {
    measureTextContext = document.createElement("canvas").getContext("2d");
  }
  return measureTextContext;
}

function measureTextWidth(text, computedStyle) {
  const context = getMeasureTextContext();
  if (!context) {
    return String(text || "").length * 16;
  }
  context.font = [
    computedStyle.fontStyle,
    computedStyle.fontVariant,
    computedStyle.fontWeight,
    computedStyle.fontSize,
    computedStyle.fontFamily
  ].filter(Boolean).join(" ");
  return context.measureText(String(text || "")).width;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function syncScheduleColumnWidths() {
  const root = document.documentElement;
  const deptSample = document.querySelector(".dept-col");
  const personSample = document.querySelector(".person-col .member-main") || document.querySelector(".person-col");
  const tableWrap = document.getElementById("tableWrap");
  if (!root || !deptSample || !personSample) {
    return;
  }

  const deptStyle = getComputedStyle(deptSample);
  const personStyle = getComputedStyle(personSample);
  const headerStyle = getComputedStyle(document.querySelector(".table-sticky-cell") || deptSample);
  const managerButtonAllowance = hasManagementAccess() && state.tableView !== "shift" ? 28 : 0;
  let deptWidth = 72;
  let personWidth = 92;
  const statsWidth = state.tableView === "member" && state.tableStatsVisible ? 86 : 0;
  if (state.tableView === "shift") {
    const visibleShifts = getVisibleShiftRows();
    const shiftContentWidth = visibleShifts.reduce((max, shift) => Math.max(max, measureTextWidth(getLocalizedName(shift), deptStyle)), 0);
    const demandValues = visibleShifts.map((shift) => String(shift.requiredStaffCount ?? 0));
    const demandContentWidth = demandValues.reduce((max, text) => Math.max(max, measureTextWidth(text, personStyle)), 0);
    const shiftHeaderWidth = measureTextWidth("班別", headerStyle);
    const demandHeaderWidth = measureTextWidth("需求人數", headerStyle);
    deptWidth = clamp(Math.ceil(Math.max(shiftContentWidth, shiftHeaderWidth) + 18), 64, 118);
    personWidth = clamp(Math.ceil(Math.max(demandContentWidth, demandHeaderWidth) + 18), 74, 104);
  } else {
    const visibleGroups = getVisibleTableGroups();
    const visibleDepartments = visibleGroups.map(({ department }) => getLocalizedName(department));
    const visibleMembers = visibleGroups.flatMap(({ members }) => (
      members.map((member) => `${getLocalizedName(member)}${member.payByDay ? "PT" : ""}`)
    ));
    const deptContentWidth = visibleDepartments.reduce((max, text) => Math.max(max, measureTextWidth(text, deptStyle)), 0);
    const personContentWidth = visibleMembers.reduce((max, text) => Math.max(max, measureTextWidth(text, personStyle)), 0);
    const deptHeaderWidth = measureTextWidth("單位", headerStyle) + managerButtonAllowance;
    const personHeaderWidth = measureTextWidth("人員", headerStyle) + managerButtonAllowance;
    deptWidth = clamp(Math.ceil(Math.max(deptContentWidth, deptHeaderWidth) + 18), 52, 88);
    personWidth = Math.max(Math.ceil(Math.max(personContentWidth, personHeaderWidth) + 18), 64);
  }
  const days = getVisibleDates().length;
  const availableDayWidth = tableWrap
    ? Math.floor((tableWrap.clientWidth - deptWidth - personWidth - statsWidth - 2) / Math.max(days, 1))
    : 0;
  const dayWidth = clamp(availableDayWidth || 44, 44, 56);
  root.style.setProperty("--dept-col-width", `${deptWidth}px`);
  root.style.setProperty("--person-col-width", `${personWidth}px`);
  root.style.setProperty("--stats-col-width", `${statsWidth}px`);
  root.style.setProperty("--day-col-width", `${dayWidth}px`);
}
