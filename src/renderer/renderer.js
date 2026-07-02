const COLORS = [
  { hex: "#378ADD", label: "藍色" },
  { hex: "#185FA5", label: "深藍" },
  { hex: "#23395B", label: "海軍藍" },
  { hex: "#355070", label: "鋼藍" },
  { hex: "#1D9E75", label: "綠色" },
  { hex: "#2F6F4F", label: "墨綠" },
  { hex: "#2A9D8F", label: "青綠" },
  { hex: "#3A5A40", label: "森林綠" },
  { hex: "#E24B4A", label: "紅色" },
  { hex: "#9C2F2F", label: "深紅" },
  { hex: "#A44A3F", label: "磚紅" },
  { hex: "#D85A30", label: "橘紅" },
  { hex: "#EF9F27", label: "橙色" },
  { hex: "#C46B2D", label: "土橘" },
  { hex: "#BA7517", label: "琥珀" },
  { hex: "#639922", label: "草綠" },
  { hex: "#7F77DD", label: "紫色" },
  { hex: "#5B4B8A", label: "深紫" },
  { hex: "#8F3B76", label: "莓紫" },
  { hex: "#6D597A", label: "灰紫" },
  { hex: "#D4537E", label: "粉紅" },
  { hex: "#5DCAA5", label: "薄荷" },
  { hex: "#888780", label: "石灰" }
];

const LEAVE_CATALOG = [
  { code: "0010", name: "事假" },
  { code: "0011", name: "病假" },
  { code: "0012", name: "婚假" },
  { code: "0013", name: "喪假" },
  { code: "0014", name: "公假" },
  { code: "0015", name: "公傷假" },
  { code: "0016", name: "產假" },
  { code: "0017", name: "特休假" },
  { code: "0018", name: "陪產(檢)假" },
  { code: "0019", name: "補休假" },
  { code: "0020", name: "產檢假" },
  { code: "0022", name: "無薪病假(時)" },
  { code: "0023", name: "彈性假" },
  { code: "0024", name: "特准半薪病假" },
  { code: "0026", name: "家庭照顧假" },
  { code: "0027", name: "半薪生理假" },
  { code: "0028", name: "全薪流產假" },
  { code: "0029", name: "半薪流產假" },
  { code: "0031", name: "無薪病假(天)" },
  { code: "0033", name: "特准事假" },
  { code: "0034", name: "刷卡遲到" },
  { code: "0035", name: "刷卡早退" },
  { code: "0036", name: "例假" },
  { code: "0038", name: "公傷假(天)" },
  { code: "0039", name: "曠職" },
  { code: "0040", name: "教育訓練假" },
  { code: "0041", name: "颱風豪雨假" },
  { code: "0042", name: "選舉假" },
  { code: "0043", name: "國定假日假" },
  { code: "0044", name: "颱風豪雨假(不扣薪)" },
  { code: "0045", name: "內部會議假" },
  { code: "0046", name: "原住民祭儀假" },
  { code: "0047", name: "休息日" },
  { code: "0048", name: "無薪生理假" },
  { code: "0049", name: "防疫假(有薪)" },
  { code: "0050", name: "防疫假(無薪)" },
  { code: "0051", name: "特別補休假" },
  { code: "0052", name: "遲到/早退(SK)" },
  { code: "0053", name: "婚假(天)(SK)" },
  { code: "0054", name: "公傷假(半薪)(時)(SK)" },
  { code: "0090", name: "系統使用的假" },
  { code: "0091", name: "家庭照顧假(扣事假用)" },
  { code: "0092", name: "半薪生理假(扣病假用)" }
];

const LEGACY_LEAVE_NAME_MAP = {
  "特休": "0017",
  "病假": "0011",
  "事假": "0010",
  "例假": "0036",
  "休假": "0047"
};

const DEFAULT_STATE = {
  role: "manager",
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selected: { type: null, id: null },
  deptFilter: "all",
  tableView: "member",
  tableDeptScopeFilter: "all",
  tableStatsVisible: true,
  scheduleStartDate: "",
  departments: [],
  positions: [],
  members: [],
  shifts: [],
  leaves: [],
  overtime: [],
  holidays: [],
  rules: {
    maxConsecutiveWorkDays: 6,
    weekStart: 0,
    monthStartDay: 1,
    eightWeekStartDate: "",
    forbidProxyLeaveConflict: true,
    requireEmploymentWindow: true
  },
  schedule: {}
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
const WEEK_START_OPTIONS = [
  { value: 0, label: "星期日" },
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" }
];
const REST_WEEKDAY_OPTIONS = [
  { value: 1, label: "週一" },
  { value: 2, label: "週二" },
  { value: 3, label: "週三" },
  { value: 4, label: "週四" },
  { value: 5, label: "週五" },
  { value: 6, label: "週六" },
  { value: 0, label: "週日" }
];

let state = createEmptyState();
let modalColor = COLORS[0].hex;
let modalTextColor = "#ffffff";
let modalTextColorAuto = true;
let modalContext = {};
let saveTimer = null;
let isSaving = false;
let latestSaveStatus = "";
let appInfo = null;
let dragMemberId = "";
let dragScheduleDeptId = "";
let leaveTooltipTimer = null;
let coreActionsOpen = false;
let departmentSettingsView = "department";
let currentSession = null;
let currentProfile = null;
let currentMember = null;
let memberSettingsFilters = {
  name: "",
  department: "all",
  role: "all",
  employment: "active",
  salaryType: "all"
};
let authErrorMessage = "";
let authPromptMessage = "";
let authModalOpen = false;
let eventsBound = false;
let dragSortItemId = "";
let dragSortCategory = "";
let dragPreviewElement = null;
let dragScheduleTableDeptId = "";
let dragScheduleTableMemberId = "";
let toolbarCollapsed = false;
let toolbarCollapseInitialized = false;
let measureTextContext = null;
let scheduleRangeSelection = null;
let scheduleDragSelecting = false;
let scheduleSuppressNextCellClick = false;
let scheduleClipboard = null;
let scheduleUndoSnapshot = null;
let scheduleRedoSnapshot = null;
let autoSchedulePreview = null;

function getSettingsScrollElement(selector = "") {
  if (selector) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  const candidates = [
    ".department-settings-modal .modal-body",
    ".member-settings-modal .member-table-scroll",
    ".catalog-settings-modal .settings-table-scroll",
    ".member-settings-modal .member-table-wrap",
    ".catalog-settings-modal .settings-table-wrap",
    ".settings-table-scroll",
    ".member-table-scroll",
    ".settings-table-wrap",
    ".member-table-wrap",
    ".modal-body"
  ];
  return candidates
    .map((candidate) => document.querySelector(candidate))
    .find((element) => element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1)
    || candidates.map((candidate) => document.querySelector(candidate)).find((element) => element instanceof HTMLElement)
    || null;
}

function captureSettingsReturnContext(fallback = null) {
  const scrollElement = getSettingsScrollElement();
  return {
    ...(fallback || {}),
    scrollSelector: scrollElement?.matches(".department-settings-modal .modal-body")
      ? ".department-settings-modal .modal-body"
      : scrollElement?.matches(".member-settings-modal .member-table-scroll")
        ? ".member-settings-modal .member-table-scroll"
        : scrollElement?.matches(".catalog-settings-modal .settings-table-scroll")
          ? ".catalog-settings-modal .settings-table-scroll"
          : "",
    scrollTop: scrollElement?.scrollTop || 0
  };
}

function restoreSettingsScroll(context) {
  if (!context || !Number.isFinite(Number(context.scrollTop))) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollElement = getSettingsScrollElement(context.scrollSelector || "");
      if (scrollElement) {
        scrollElement.scrollTop = Number(context.scrollTop) || 0;
      }
    });
  });
}

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
      `<div class="table-sticky-cell table-sticky-cell-day ${cls} ${weekStripeClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}">${date.getMonth() + 1}/${day}<span>${WEEKDAY_LABELS[weekday]}</span></div>`
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
      ${isManager() && dataAttr ? renderActionIconButton("edit", `${dataAttr}=\"true\"`, "table-header-settings-btn") : ""}
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
  }
  dayCells.forEach((cell) => setWidth(cell, dayWidth));
}

function syncStickyHeaderScroll() {
  const tableWrap = document.getElementById("tableWrap");
  const container = document.getElementById("tableStickyHeaderDays");
  if (!tableWrap || !container) {
    return;
  }
  container.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
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
  tableWrap.scrollBy({
    left: event.deltaX || event.deltaY,
    top: 0,
    behavior: "auto"
  });
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

function uid(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
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
  const managerButtonAllowance = isManager() && state.tableView !== "shift" ? 28 : 0;
  let deptWidth = 72;
  let personWidth = 92;
  const statsWidth = state.tableView === "member" && state.tableStatsVisible ? 86 : 0;
  if (state.tableView === "shift") {
    const visibleShifts = getVisibleShiftRows();
    const shiftContentWidth = visibleShifts.reduce((max, shift) => Math.max(max, measureTextWidth(shift.name, deptStyle)), 0);
    const demandValues = visibleShifts.map((shift) => String(shift.requiredStaffCount ?? 0));
    const demandContentWidth = demandValues.reduce((max, text) => Math.max(max, measureTextWidth(text, personStyle)), 0);
    const shiftHeaderWidth = measureTextWidth("班別", headerStyle);
    const demandHeaderWidth = measureTextWidth("需求人數", headerStyle);
    deptWidth = clamp(Math.ceil(Math.max(shiftContentWidth, shiftHeaderWidth) + 18), 64, 118);
    personWidth = clamp(Math.ceil(Math.max(demandContentWidth, demandHeaderWidth) + 18), 74, 104);
  } else {
    const visibleGroups = getVisibleTableGroups();
    const visibleDepartments = visibleGroups.map(({ department }) => department.name);
    const visibleMembers = visibleGroups.flatMap(({ members }) => (
      members.map((member) => `${member.name || ""}${member.payByDay ? "PT" : ""}`)
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

function scheduleKey(memberId, year, month, day) {
  return `${memberId}_${year}_${month}_${day}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function weekdayOf(day) {
  return new Date(state.year, state.month, day).getDay();
}

function getConfiguredWeekStart() {
  const value = Number(state.rules?.weekStart);
  return Number.isInteger(value) && value >= 0 && value <= 6 ? value : 0;
}

function getWeekIndexForDay(day) {
  const offset = (weekdayOf(1) - getConfiguredWeekStart() + 7) % 7;
  return Math.floor((day + offset - 1) / 7);
}

function getWeekStripeClass(day) {
  return getWeekIndexForDay(day) % 2 === 1 ? "week-alt" : "";
}

function getWeekIndexForDate(dateString) {
  const dates = getVisibleDates();
  const index = dates.indexOf(dateString);
  return index >= 0 ? Math.floor(index / 7) : 0;
}

function getWeekStripeClassForDate(dateString) {
  return getWeekIndexForDate(dateString) % 2 === 1 ? "week-alt" : "";
}

function getWeekBoundaryClass(day, daysInCurrentMonth) {
  const classes = [];
  const weekday = weekdayOf(day);
  const weekStart = getConfiguredWeekStart();
  const weekEnd = (weekStart + 6) % 7;
  if (weekday === weekStart && day !== 1) {
    classes.push("week-boundary-start");
  }
  if (weekday === weekEnd && day !== daysInCurrentMonth) {
    classes.push("week-boundary-end");
  }
  return classes.join(" ");
}

function getWeekBoundaryClassForDate(dateString, index, totalDays) {
  const classes = [];
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  const weekday = date.getDay();
  const weekStart = getConfiguredWeekStart();
  const weekEnd = (weekStart + 6) % 7;
  if (weekday === weekStart && index !== 0) {
    classes.push("week-boundary-start");
  }
  if (weekday === weekEnd && index !== totalDays - 1) {
    classes.push("week-boundary-end");
  }
  return classes.join(" ");
}

function toDateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toDateStringFromDate(date) {
  return toDateString(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayDateString() {
  return toDateStringFromDate(new Date());
}

function addDaysToDateString(dateString, count) {
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  date.setDate(date.getDate() + count);
  return toDateStringFromDate(date);
}

function diffDays(startDateString, endDateString) {
  const start = toDateObject(startDateString);
  const end = toDateObject(endDateString);
  if (!start || !end) {
    return 0;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / dayMs);
}

function getConfiguredEightWeekAnchorDate() {
  return toDateObject(state.rules?.eightWeekStartDate) ? state.rules.eightWeekStartDate : getTodayDateString();
}

function getEightWeekCycleStartForDate(dateString) {
  const anchorDate = getConfiguredEightWeekAnchorDate();
  const offset = diffDays(anchorDate, dateString);
  const periodLength = 56;
  const periods = Math.floor(offset / periodLength);
  return addDaysToDateString(anchorDate, periods * periodLength) || dateString;
}

function syncVisibleDatePartsFromStart() {
  const start = toDateObject(state.scheduleStartDate);
  if (!start) {
    return;
  }
  state.year = start.getFullYear();
  state.month = start.getMonth();
}

function resetScheduleWindowToToday() {
  const today = getTodayDateString();
  if (!toDateObject(state.rules?.eightWeekStartDate)) {
    state.rules.eightWeekStartDate = today;
  }
  state.scheduleStartDate = getEightWeekCycleStartForDate(today);
  state.tableView = "member";
  state.tableDeptScopeFilter = "all";
  syncVisibleDatePartsFromStart();
}

function getVisibleDates() {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  return enumerateDateRange(startDate, addDaysToDateString(startDate, 55));
}

function getVisibleDateRange() {
  const dates = getVisibleDates();
  return {
    startDate: dates[0] || getTodayDateString(),
    endDate: dates[dates.length - 1] || getTodayDateString()
  };
}

function getScheduleKeyForDateString(memberId, dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  return scheduleKey(memberId, date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeScheduleDateInput(value) {
  if (typeof value === "string" && toDateObject(value)) {
    return value;
  }
  return toDateString(state.year, state.month, Number(value) || 1);
}

function isMemberCurrentlyActive(member) {
  const today = new Date();
  const todayString = toDateString(today.getFullYear(), today.getMonth(), today.getDate());
  if (member.hireDate && member.hireDate > todayString) {
    return false;
  }
  return !member.leaveDate || member.leaveDate >= todayString;
}

function toDateObject(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function enumerateDateRange(startDate, endDate) {
  const start = toDateObject(startDate);
  const end = toDateObject(endDate);
  if (!start || !end || start > end) {
    return [];
  }
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateString(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isMemberActiveOnDateString(member, dateString) {
  if (!dateString) {
    return false;
  }
  if (member.hireDate && dateString < member.hireDate) {
    return false;
  }
  if (member.leaveDate && dateString > member.leaveDate) {
    return false;
  }
  return true;
}

function normalizeTimeText(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return "";
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) {
    return null;
  }
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidTimeRange(start, end) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
}

function isValidDateRange(start, end) {
  return Boolean(start && end && start < end);
}

function isValidDateTimeRange(startDate, startTime, endDate, endTime) {
  const normalizedStartTime = normalizeTimeText(startTime);
  const normalizedEndTime = normalizeTimeText(endTime);
  if (!startDate || !endDate || !normalizedStartTime || !normalizedEndTime) {
    return false;
  }
  return `${startDate}T${normalizedStartTime}` < `${endDate}T${normalizedEndTime}`;
}

function reportValidationError(message) {
  setSaveStatus(message);
  if (window.schedulerApi?.showMessage) {
    window.schedulerApi.showMessage("提示", message);
    return;
  }
  window.alert(message);
}

function syncCoreActionsMenu() {
  const menu = document.getElementById("coreActionsMenu");
  const toggle = document.getElementById("coreActionsToggle");
  if (!menu || !toggle) {
    return;
  }
  menu.classList.toggle("open", coreActionsOpen);
  menu.setAttribute("aria-hidden", coreActionsOpen ? "false" : "true");
  toggle.setAttribute("aria-expanded", coreActionsOpen ? "true" : "false");
}

function toggleCoreActionsMenu(force) {
  coreActionsOpen = typeof force === "boolean" ? force : !coreActionsOpen;
  syncCoreActionsMenu();
}

function closeCoreActionsMenu() {
  if (!coreActionsOpen) {
    return;
  }
  coreActionsOpen = false;
  syncCoreActionsMenu();
}

function showInfoMessage(message) {
  if (window.schedulerApi?.showMessage) {
    window.schedulerApi.showMessage("提示", message);
    return;
  }
  window.alert(message);
}

function formatSchedulerError(error, fallback = "操作失敗") {
  const message = String(error?.message || error || "").trim();
  if (
    message.includes("Could not find the 'overtime_end_time' column of 'schedule_entries'") ||
    message.includes("Could not find the 'overtime_start_time' column of 'schedule_entries'")
  ) {
    return "加班資料庫尚未套用新版欄位，請先確認 supabase/001_current_schema.sql 與 024_schedule_entries_rpc.sql 已套用。";
  }
  return message || fallback;
}

async function confirmAction(message) {
  if (window.schedulerApi?.confirmAction) {
    return window.schedulerApi.confirmAction("確認", message);
  }
  return window.confirm(message);
}

function buildTimeOptions(selectedValue, values) {
  const options = ['<option value=""></option>'];
  values.forEach((value) => {
    options.push(`<option value="${value}" ${value === selectedValue ? "selected" : ""}>${value}</option>`);
  });
  return options.join("");
}

function splitTimeValue(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) {
    return ["", ""];
  }
  return normalized.split(":");
}

function timeInputMarkup(id, value, disabled = false) {
  const [hour, minute] = splitTimeValue(value);
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = ["00", "10", "20", "30", "40", "50"];
  return `
    <div class="time-picker" data-time-field="${id}">
      <select id="${id}Hour" ${disabled ? "disabled" : ""}>
        ${buildTimeOptions(hour, hours)}
      </select>
      <span class="time-picker-separator">:</span>
      <select id="${id}Minute" ${disabled ? "disabled" : ""}>
        ${buildTimeOptions(minute, minutes)}
      </select>
    </div>
  `;
}

function readTimeInputValue(id) {
  const hour = document.getElementById(`${id}Hour`)?.value || "";
  const minute = document.getElementById(`${id}Minute`)?.value || "";
  if (!hour || !minute) {
    return "";
  }
  return normalizeTimeText(`${hour}:${minute}`);
}

function setTimeInputDisabled(id, disabled) {
  const hourInput = document.getElementById(`${id}Hour`);
  const minuteInput = document.getElementById(`${id}Minute`);
  if (hourInput) {
    hourInput.disabled = disabled;
  }
  if (minuteInput) {
    minuteInput.disabled = disabled;
  }
}

function isMemberActiveOnDate(member, year, month, day) {
  const date = toDateString(year, month, day);
  if (member.hireDate && date < member.hireDate) {
    return false;
  }
  if (member.leaveDate && date > member.leaveDate) {
    return false;
  }
  return true;
}

function doesDateRangeOverlapMonth(startDate, endDate, year, month) {
  const monthStart = toDateString(year, month, 1);
  const monthEnd = toDateString(year, month, daysInMonth(year, month));
  if (startDate && startDate > monthEnd) {
    return false;
  }
  if (endDate && endDate < monthStart) {
    return false;
  }
  return true;
}

function isDepartmentActiveInMonth(department, year, month) {
  return doesDateRangeOverlapMonth(department?.startDate || "", department?.endDate || "", year, month);
}

function isMemberActiveInMonth(member, year, month) {
  return doesDateRangeOverlapMonth(member?.hireDate || "", member?.leaveDate || "", year, month);
}

function doesDateRangeOverlapRange(startDate, endDate, rangeStart, rangeEnd) {
  if (startDate && startDate > rangeEnd) {
    return false;
  }
  if (endDate && endDate < rangeStart) {
    return false;
  }
  return true;
}

function isDepartmentActiveInVisibleRange(department) {
  const { startDate, endDate } = getVisibleDateRange();
  return doesDateRangeOverlapRange(department?.startDate || "", department?.endDate || "", startDate, endDate);
}

function isDepartmentVisibleInSchedule(department) {
  return Boolean(department) && !department.hiddenFromLeave;
}

function isDepartmentVisibleInScheduleRange(department) {
  return isDepartmentVisibleInSchedule(department) && isDepartmentActiveInVisibleRange(department);
}

function isDepartmentOperatingOnDate(department, dateString) {
  if (!department || !dateString) {
    return false;
  }
  if (department.startDate && dateString < department.startDate) {
    return false;
  }
  if (department.endDate && dateString > department.endDate) {
    return false;
  }
  return true;
}

function isMemberActiveInVisibleRange(member) {
  const { startDate, endDate } = getVisibleDateRange();
  return doesDateRangeOverlapRange(member?.hireDate || "", member?.leaveDate || "", startDate, endDate);
}

function textColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2b241c" : "#ffffff";
}

function autoLeaveTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000000" : "#ffffff";
}

function sanitizeDepartment(department, fallbackIndex) {
  return {
    id: department?.id || uid(`d${fallbackIndex}`),
    name: department?.name || `單位 ${fallbackIndex + 1}`,
    startDate: department?.startDate || "",
    endDate: department?.endDate || "",
    hiddenFromLeave: Boolean(department?.hiddenFromLeave)
  };
}

function sanitizePosition(position, fallbackIndex) {
  return {
    id: position?.id || uid(`p${fallbackIndex}`),
    code: position?.code || `P${String(fallbackIndex + 1).padStart(2, "0")}`,
    name: position?.name || `職位 ${fallbackIndex + 1}`
  };
}

function normalizeScheduleDeptIds(member, departments) {
  const validDeptIds = new Set((departments || []).map((department) => department.id));
  const ids = Array.isArray(member?.scheduleDeptIds)
    ? member.scheduleDeptIds
    : Array.isArray(member?.departmentIds)
      ? member.departmentIds
      : [];
  const normalized = ids
    .map((deptId) => String(deptId || ""))
    .filter((deptId, index, list) => validDeptIds.has(deptId) && list.indexOf(deptId) === index);
  const fallbackDeptId = member?.deptId && validDeptIds.has(member.deptId)
    ? member.deptId
    : departments[0]?.id || "";
  if (fallbackDeptId && !normalized.includes(fallbackDeptId)) {
    normalized.unshift(fallbackDeptId);
  }
  return normalized;
}

function sanitizeMember(member, fallbackIndex, merged) {
  const scheduleDeptIds = normalizeScheduleDeptIds(member, merged.departments);
  return {
    id: member?.id || uid(`m${fallbackIndex}`),
    code: member?.code || `M${String(fallbackIndex + 1).padStart(3, "0")}`,
    name: member?.name || `人員 ${fallbackIndex + 1}`,
    deptId: scheduleDeptIds[0] || "",
    scheduleDeptIds,
    positionId: member?.positionId && merged.positions.some((position) => position.id === member.positionId)
      ? member.positionId
      : merged.positions[0]?.id || "",
    proxyMemberId: member?.proxyMemberId || "",
    hireDate: member?.hireDate || "",
    leaveDate: member?.leaveDate || "",
    payByDay: Boolean(member?.payByDay),
    fixedRestWeekday: normalizeRestWeekday(member?.fixedRestWeekday),
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    role: member?.role === "manager" ? "manager" : "employee"
  };
}

function sanitizeShift(shift, fallbackIndex, merged) {
  const applicableDeptIds = Array.isArray(shift?.applicableDeptIds)
    ? shift.applicableDeptIds.filter((deptId) => merged.departments.some((department) => department.id === deptId))
    : [];
  const applicableDeptId = shift?.applicableDeptId && merged.departments.some((department) => department.id === shift.applicableDeptId)
    ? shift.applicableDeptId
    : applicableDeptIds[0] || merged.departments[0]?.id || "";
  const color = shift?.color || COLORS[fallbackIndex % COLORS.length].hex;
  const autoText = shift?.autoTextColor ?? !shift?.textColor;
    return {
      id: shift?.id || uid(`s${fallbackIndex}`),
      name: shift?.name || `班別 ${fallbackIndex + 1}`,
      color,
      textColor: shift?.textColor || autoLeaveTextColor(color),
      autoTextColor: Boolean(autoText),
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      hiddenFromToolbar: Boolean(shift?.hiddenFromToolbar),
      requiredStaffCount: Math.max(0, Number(shift?.requiredStaffCount) || 0),
      applicableDeptIds: applicableDeptId ? [applicableDeptId] : [],
      positionRequirements: Array.isArray(shift?.positionRequirements)
        ? shift.positionRequirements
        .filter((item) => item && item.positionId)
        .map((item) => ({ positionId: item.positionId, count: Math.max(0, Number(item.count) || 0) }))
      : []
  };
}

function sanitizeNamedColorItem(item, fallbackIndex, prefix, label) {
  return {
    id: item?.id || uid(`${prefix}${fallbackIndex}`),
    name: item?.name || `${label} ${fallbackIndex + 1}`,
    color: item?.color || COLORS[fallbackIndex % COLORS.length].hex
  };
}

function resolveLeaveCatalogEntry(item, fallbackIndex) {
  const requestedCode = item?.code || LEGACY_LEAVE_NAME_MAP[item?.name] || "";
  const byCode = LEAVE_CATALOG.find((entry) => entry.code === requestedCode);
  if (byCode) {
    return byCode;
  }
  const byName = LEAVE_CATALOG.find((entry) => entry.name === item?.name);
  if (byName) {
    return byName;
  }
  return LEAVE_CATALOG[fallbackIndex % LEAVE_CATALOG.length];
}

function sanitizeLeaveItem(item, fallbackIndex) {
  const catalogEntry = resolveLeaveCatalogEntry(item, fallbackIndex);
  const color = item?.color || COLORS[fallbackIndex % COLORS.length].hex;
  const autoText = item?.autoTextColor ?? !item?.textColor;
  return {
    id: item?.id || uid(`l${fallbackIndex}`),
    code: catalogEntry.code,
    name: item?.name || catalogEntry.name,
    color,
    textColor: item?.textColor || autoLeaveTextColor(color),
    autoTextColor: Boolean(autoText),
    hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),
    defaultAllDay: Boolean(item?.defaultAllDay),
    requireReason: Boolean(item?.requireReason)
  };
}

function sanitizeOvertimeItem(item, fallbackIndex) {
    const color = item?.color || COLORS[fallbackIndex % COLORS.length].hex;
    const autoText = item?.autoTextColor ?? !item?.textColor;
    return {
      id: item?.id || uid(`o${fallbackIndex}`),
      name: item?.name || "加班",
      color,
      textColor: item?.textColor || autoLeaveTextColor(color),
      autoTextColor: Boolean(autoText),
      hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),
      startTime: item?.startTime || "",
      endTime: item?.endTime || "",
      useRest1: Boolean(item?.useRest1),
      rest1StartTime: item?.rest1StartTime || "",
      rest1EndTime: item?.rest1EndTime || "",
      useRest2: Boolean(item?.useRest2),
      rest2StartTime: item?.rest2StartTime || "",
      rest2EndTime: item?.rest2EndTime || ""
    };
  }

function sanitizeHoliday(holiday, fallbackIndex) {
  return {
    id: holiday?.id || uid(`h${fallbackIndex}`),
    date: holiday?.date || "",
    name: holiday?.name || `國定假日 ${fallbackIndex + 1}`
  };
}

function cleanupScheduleEntries(schedule, merged) {
  const validShiftIds = new Set(merged.shifts.map((shift) => shift.id));
  const validLeaveIds = new Set(merged.leaves.map((leave) => leave.id));
  const validOvertimeIds = new Set(merged.overtime.map((item) => item.id));
  const fallbackOvertimeId = merged.overtime[0]?.id || null;
  const nextSchedule = {};

  Object.entries(schedule || {}).forEach(([key, slot]) => {
    const hasOvertimeMeta = slot?.overtimeMeta && typeof slot.overtimeMeta === "object";
    const overtimeId = validOvertimeIds.has(slot?.overtime)
      ? slot.overtime
      : hasOvertimeMeta
        ? fallbackOvertimeId
        : null;
    const nextSlot = {
      shift: validShiftIds.has(slot?.shift) ? slot.shift : null,
      leave: validLeaveIds.has(slot?.leave) ? slot.leave : null,
      overtime: overtimeId,
      leaveMeta: validLeaveIds.has(slot?.leave) && slot?.leaveMeta && typeof slot.leaveMeta === "object"
        ? {
          leaveCode: slot.leaveMeta.leaveCode || "",
          displayName: slot.leaveMeta.displayName || "",
          displayColor: slot.leaveMeta.displayColor || "",
          displayTextColor: slot.leaveMeta.displayTextColor || "",
          allDay: slot.leaveMeta.allDay !== false,
          startTime: slot.leaveMeta.allDay === false ? (slot.leaveMeta.startTime || "") : "",
          endTime: slot.leaveMeta.allDay === false ? (slot.leaveMeta.endTime || "") : "",
          reasonEnabled: Boolean(slot.leaveMeta.reasonEnabled),
          reason: slot.leaveMeta.reasonEnabled ? (slot.leaveMeta.reason || "") : ""
        }
        : null,
      overtimeMeta: overtimeId && hasOvertimeMeta
        ? {
          displayName: slot.overtimeMeta.displayName || "",
          displayColor: slot.overtimeMeta.displayColor || "",
          displayTextColor: slot.overtimeMeta.displayTextColor || "",
          startTime: slot.overtimeMeta.startTime || "",
          endTime: slot.overtimeMeta.endTime || "",
          useRest1: Boolean(slot.overtimeMeta.useRest1),
          rest1StartTime: slot.overtimeMeta.useRest1 ? (slot.overtimeMeta.rest1StartTime || "") : "",
          rest1EndTime: slot.overtimeMeta.useRest1 ? (slot.overtimeMeta.rest1EndTime || "") : "",
          useRest2: Boolean(slot.overtimeMeta.useRest2),
          rest2StartTime: slot.overtimeMeta.useRest2 ? (slot.overtimeMeta.rest2StartTime || "") : "",
          rest2EndTime: slot.overtimeMeta.useRest2 ? (slot.overtimeMeta.rest2EndTime || "") : "",
          reason: slot.overtimeMeta.reason || ""
        }
        : null
    };
    if (nextSlot.shift || nextSlot.leave || nextSlot.overtime) {
      nextSchedule[key] = nextSlot;
    }
  });

  return nextSchedule;
}

function normalizeState(payload) {
  if (!payload || typeof payload !== "object") {
    return createEmptyState();
  }

  const merged = createEmptyState();
  merged.role = "manager";
  merged.year = Number.isInteger(payload.year) ? payload.year : merged.year;
  merged.month = Number.isInteger(payload.month) ? payload.month : merged.month;
  merged.departments = Array.isArray(payload.departments)
    ? payload.departments.map((department, index) => sanitizeDepartment(department, index))
    : merged.departments;
  merged.positions = Array.isArray(payload.positions) && payload.positions.length
    ? payload.positions.map((position, index) => sanitizePosition(position, index))
    : merged.positions;
  merged.members = Array.isArray(payload.members)
    ? payload.members.map((member, index) => sanitizeMember(member, index, merged))
    : merged.members;
  merged.shifts = Array.isArray(payload.shifts)
    ? payload.shifts.map((shift, index) => sanitizeShift(shift, index, merged))
    : merged.shifts;
  merged.shifts = merged.shifts.filter((shift) => shift.name !== "休息");
  merged.leaves = Array.isArray(payload.leaves)
    ? payload.leaves.map((item, index) => sanitizeLeaveItem(item, index))
    : merged.leaves;
  merged.overtime = Array.isArray(payload.overtime)
    ? payload.overtime.map((item, index) => sanitizeOvertimeItem(item, index))
    : merged.overtime;
  merged.holidays = Array.isArray(payload.holidays)
    ? payload.holidays.map((holiday, index) => sanitizeHoliday(holiday, index)).filter((holiday) => holiday.date)
    : merged.holidays;
  merged.rules = {
    maxConsecutiveWorkDays: Math.max(1, Number(payload.rules?.maxConsecutiveWorkDays) || merged.rules.maxConsecutiveWorkDays),
    weekStart: Number.isInteger(Number(payload.rules?.weekStart)) ? Math.min(6, Math.max(0, Number(payload.rules?.weekStart))) : merged.rules.weekStart,
    monthStartDay: Number.isInteger(Number(payload.rules?.monthStartDay)) ? Math.min(31, Math.max(1, Number(payload.rules?.monthStartDay))) : merged.rules.monthStartDay,
    eightWeekStartDate: toDateObject(payload.rules?.eightWeekStartDate) ? payload.rules.eightWeekStartDate : merged.rules.eightWeekStartDate,
    forbidProxyLeaveConflict: payload.rules?.forbidProxyLeaveConflict !== false,
    requireEmploymentWindow: payload.rules?.requireEmploymentWindow !== false
  };
  merged.deptFilter = typeof payload.deptFilter === "string" ? payload.deptFilter : merged.deptFilter;
  merged.tableView = payload.tableView === "shift" ? "shift" : "member";
  merged.tableDeptScopeFilter = typeof payload.tableDeptScopeFilter === "string" ? payload.tableDeptScopeFilter : merged.tableDeptScopeFilter;
  merged.tableStatsVisible = payload.tableStatsVisible !== false;
  merged.scheduleStartDate = toDateObject(payload.scheduleStartDate) ? payload.scheduleStartDate : merged.scheduleStartDate;
  merged.schedule = cleanupScheduleEntries(payload.schedule && typeof payload.schedule === "object" ? payload.schedule : merged.schedule, merged);

  if (!merged.departments.some((department) => department.id === merged.deptFilter)) {
    merged.deptFilter = "all";
  }
  if (!merged.departments.some((department) => department.id === merged.tableDeptScopeFilter)) {
    merged.tableDeptScopeFilter = "all";
  }

  return merged;
}

function setSaveStatus(message, saving = false) {
  latestSaveStatus = message;
  isSaving = saving;
}

function getDepartmentName(deptId) {
  return state.departments.find((department) => department.id === deptId)?.name || "未指定單位";
}

function getPositionName(positionId) {
  return state.positions.find((position) => position.id === positionId)?.name || "未指定職位";
}

function getSalaryTypeLabel(member) {
  return member?.payByDay ? "日薪" : "月薪";
}

function normalizeRestWeekday(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 6 ? numericValue : 0;
}

function getRestWeekdayLabel(value) {
  return REST_WEEKDAY_OPTIONS.find((option) => option.value === normalizeRestWeekday(value))?.label || "週日";
}

function getDepartmentSummary(deptIds) {
  if (!Array.isArray(deptIds) || !deptIds.length) {
    return "全部單位";
  }
  return getDepartmentName(deptIds[0]);
}

function getMemberScheduleDeptIds(member) {
  const validDeptIds = new Set(state.departments.map((department) => department.id));
  const ids = Array.isArray(member?.scheduleDeptIds) ? member.scheduleDeptIds : [member?.deptId || ""];
  const normalized = ids
    .map((deptId) => String(deptId || ""))
    .filter((deptId, index, list) => validDeptIds.has(deptId) && list.indexOf(deptId) === index);
  if (member?.deptId && validDeptIds.has(member.deptId) && !normalized.includes(member.deptId)) {
    normalized.unshift(member.deptId);
  }
  return normalized;
}

function getMemberHomeDeptId(member) {
  return getMemberScheduleDeptIds(member)[0] || "";
}

function getMemberScheduleDeptNames(member) {
  const names = getMemberScheduleDeptIds(member).map((deptId) => getDepartmentName(deptId)).filter(Boolean);
  return names.length ? names.join("、") : "未指定";
}

function memberCanScheduleDepartment(member, departmentId) {
  return getMemberScheduleDeptIds(member).includes(departmentId);
}

function shiftAllowsDepartment(shift, deptId) {
  return !Array.isArray(shift?.applicableDeptIds) || !shift.applicableDeptIds.length || shift.applicableDeptIds.includes(deptId);
}

function getItemList(category) {
  if (category === "shift") return state.shifts;
  if (category === "leave") return state.leaves;
  return state.overtime;
}

function getItem(category, id) {
  return getItemList(category).find((item) => item.id === id);
}

function getItemTextColor(item, fallback = "#000000") {
  if (!item) {
    return autoLeaveTextColor(fallback);
  }
  if (item.textColor) {
    return item.textColor;
  }
  return autoLeaveTextColor(item.color || fallback);
}

function getSlot(memberId, day) {
  const key = getScheduleKeyForDateString(memberId, normalizeScheduleDateInput(day));
  return key ? state.schedule[key] || null : null;
}

function getPreviewSlotByKey(key) {
  return autoSchedulePreview?.slots?.[key] || null;
}

function getDisplayedSlot(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  const key = getScheduleKeyForDateString(memberId, dateString);
  return key ? (getPreviewSlotByKey(key) || state.schedule[key] || null) : null;
}

function getScheduleCellFromEvent(event) {
  const target = event.target;
  const cell = target instanceof Element ? target.closest("#mainTable .cell") : null;
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  if (!canEditSchedule() || state.tableView !== "member" || state.selected.type || cell.dataset.readonly) {
    return null;
  }
  if (!cell.dataset.memberId || !cell.dataset.date) {
    return null;
  }
  return cell;
}

function getScheduleCellPoint(cell) {
  return {
    row: Number(cell.dataset.rowIndex),
    col: Number(cell.dataset.colIndex),
    memberId: cell.dataset.memberId || "",
    date: cell.dataset.date || ""
  };
}

function isValidScheduleCellPoint(point) {
  return point
    && Number.isInteger(point.row)
    && Number.isInteger(point.col)
    && point.memberId
    && toDateObject(point.date);
}

function getScheduleSelectionBounds() {
  if (!scheduleRangeSelection || !isValidScheduleCellPoint(scheduleRangeSelection.anchor) || !isValidScheduleCellPoint(scheduleRangeSelection.focus)) {
    return null;
  }
  return {
    rowMin: Math.min(scheduleRangeSelection.anchor.row, scheduleRangeSelection.focus.row),
    rowMax: Math.max(scheduleRangeSelection.anchor.row, scheduleRangeSelection.focus.row),
    colMin: Math.min(scheduleRangeSelection.anchor.col, scheduleRangeSelection.focus.col),
    colMax: Math.max(scheduleRangeSelection.anchor.col, scheduleRangeSelection.focus.col)
  };
}

function clearScheduleRangeSelection() {
  scheduleRangeSelection = null;
  document.querySelectorAll("#mainTable .cell.range-selected").forEach((cell) => {
    cell.classList.remove("range-selected", "range-anchor");
  });
}

function syncScheduleRangeSelectionUi() {
  const bounds = getScheduleSelectionBounds();
  document.querySelectorAll("#mainTable .cell.range-selected, #mainTable .cell.range-anchor").forEach((cell) => {
    cell.classList.remove("range-selected", "range-anchor");
  });
  if (!bounds) {
    return;
  }
  document.querySelectorAll("#mainTable .cell[data-member-id][data-date]").forEach((cell) => {
    if (!(cell instanceof HTMLElement)) {
      return;
    }
    const row = Number(cell.dataset.rowIndex);
    const col = Number(cell.dataset.colIndex);
    if (row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax) {
      cell.classList.add("range-selected");
      if (row === scheduleRangeSelection.anchor.row && col === scheduleRangeSelection.anchor.col) {
        cell.classList.add("range-anchor");
      }
    }
  });
}

function setScheduleRangeSelection(anchor, focus = anchor) {
  if (!isValidScheduleCellPoint(anchor) || !isValidScheduleCellPoint(focus)) {
    clearScheduleRangeSelection();
    return;
  }
  scheduleRangeSelection = { anchor, focus };
  syncScheduleRangeSelectionUi();
}

function getSelectedScheduleCells() {
  const bounds = getScheduleSelectionBounds();
  if (!bounds) {
    return [];
  }
  return Array.from(document.querySelectorAll("#mainTable .cell[data-member-id][data-date]"))
    .filter((cell) => {
      if (!(cell instanceof HTMLElement) || cell.classList.contains("inactive-cell")) {
        return false;
      }
      const row = Number(cell.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      return row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax;
    })
    .sort((a, b) => Number(a.dataset.rowIndex) - Number(b.dataset.rowIndex) || Number(a.dataset.colIndex) - Number(b.dataset.colIndex));
}

function cleanSlotMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return null;
  }
  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => !key.startsWith("request"))
  );
}

function serializeScheduleSlotForClipboard(slot) {
  if (!slot) {
    return { shift: null, leave: null, leaveMeta: null, overtime: null, overtimeMeta: null };
  }
  return {
    shift: slot.shift || null,
    leave: slot.leave || null,
    leaveMeta: slot.leave ? cleanSlotMeta(slot.leaveMeta) : null,
    overtime: slot.overtime || null,
    overtimeMeta: slot.overtime ? cleanSlotMeta(slot.overtimeMeta) : null
  };
}

async function applyClipboardSlotToScheduleCell(memberId, dateString, clipboardSlot) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || !isMemberActiveOnDateString(member, dateString)) {
    return false;
  }
  const slot = ensureScheduleSlot(memberId, dateString);
  if (!slot) {
    return false;
  }
  const nextShiftId = clipboardSlot?.shift || null;
  slot.shift = nextShiftId;
  slot.leave = clipboardSlot?.leave || null;
  if (clipboardSlot?.leaveMeta) {
    slot.leaveMeta = { ...clipboardSlot.leaveMeta };
  } else {
    delete slot.leaveMeta;
  }
  slot.overtime = clipboardSlot?.overtime || null;
  if (clipboardSlot?.overtimeMeta) {
    slot.overtimeMeta = { ...clipboardSlot.overtimeMeta };
  } else {
    delete slot.overtimeMeta;
  }
  return true;
}

async function clearScheduleCellEditableParts(memberId, dateString) {
  return applyClipboardSlotToScheduleCell(memberId, dateString, {
    shift: null,
    leave: null,
    leaveMeta: null,
    overtime: null,
    overtimeMeta: null
  });
}

function rememberScheduleUndoSnapshot() {
  scheduleUndoSnapshot = deepClone(state.schedule || {});
  scheduleRedoSnapshot = null;
}

function getScheduleCellElement(memberId, dateString) {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-member-id][data-date]"))
    .find((cell) => cell instanceof HTMLElement && cell.dataset.memberId === memberId && cell.dataset.date === dateString) || null;
}

function renderScheduleCell(memberId, dateString) {
  const cell = getScheduleCellElement(memberId, dateString);
  if (!(cell instanceof HTMLElement)) {
    return;
  }
  const key = getScheduleKeyForDateString(memberId, dateString);
  cell.innerHTML = renderCellInner(key, memberId, dateString, state.schedule[key] || null, false);
}

async function persistScheduleCell(memberId, dateString) {
  await persistScheduleCells([{ memberId, dateString }]);
}

async function persistScheduleCells(cells) {
  const payloads = [];
  (Array.isArray(cells) ? cells : []).forEach(({ memberId, dateString }) => {
    const member = state.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    const key = getScheduleKeyForDateString(memberId, dateString);
    payloads.push({
      memberId,
      memberCode: member.code || "",
      dateString,
      slot: key ? state.schedule[key] || null : null
    });
  });
  if (payloads.length) {
    await window.schedulerApi.saveScheduleCells(payloads);
  }
}

async function finishScheduleCellMutation(memberId, dateString) {
  pruneEmptySchedule();
  renderScheduleCell(memberId, dateString);
  syncScheduleRangeSelectionUi();
  await persistScheduleCell(memberId, dateString);
}

async function finishScheduleGridMutation() {
  pruneEmptySchedule();
  renderTable();
  syncScheduleRangeSelectionUi();
  await forceSave();
}

function copyScheduleRangeToClipboard() {
  const cells = getSelectedScheduleCells();
  const bounds = getScheduleSelectionBounds();
  if (!cells.length || !bounds) {
    return false;
  }
  const rows = bounds.rowMax - bounds.rowMin + 1;
  const cols = bounds.colMax - bounds.colMin + 1;
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => serializeScheduleSlotForClipboard(null)));
  cells.forEach((cell) => {
    const row = Number(cell.dataset.rowIndex) - bounds.rowMin;
    const col = Number(cell.dataset.colIndex) - bounds.colMin;
    matrix[row][col] = serializeScheduleSlotForClipboard(getSlot(cell.dataset.memberId || "", cell.dataset.date || ""));
  });
  scheduleClipboard = { rows, cols, matrix };
  return true;
}

async function clearSelectedScheduleCells() {
  const cells = getSelectedScheduleCells();
  if (!cells.length) {
    return false;
  }
  let changed = false;
  const changedCells = [];
  for (const cell of cells) {
    const memberId = cell.dataset.memberId || "";
    const dateString = cell.dataset.date || "";
    const cellChanged = await clearScheduleCellEditableParts(memberId, dateString);
    if (cellChanged) {
      changedCells.push({ memberId, dateString });
      changed = true;
    }
  }
  if (changed) {
    pruneEmptySchedule();
    changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
    syncScheduleRangeSelectionUi();
    await persistScheduleCells(changedCells);
  }
  return changed;
}

async function pasteScheduleClipboard() {
  if (!scheduleClipboard || !scheduleRangeSelection) {
    return false;
  }
  if (scheduleClipboard.rows === 1 && scheduleClipboard.cols === 1) {
    const [clipboardSlot] = scheduleClipboard.matrix[0] || [];
    let changed = false;
    const changedCells = [];
    for (const cell of getSelectedScheduleCells()) {
      const memberId = cell.dataset.memberId || "";
      const dateString = cell.dataset.date || "";
      const cellChanged = await applyClipboardSlotToScheduleCell(memberId, dateString, clipboardSlot);
      if (cellChanged) {
        changedCells.push({ memberId, dateString });
        changed = true;
      }
    }
    if (changed) {
      pruneEmptySchedule();
      changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
      syncScheduleRangeSelectionUi();
      await persistScheduleCells(changedCells);
    }
    return changed;
  }
  let changed = false;
  const changedCells = [];
  for (let rowOffset = 0; rowOffset < scheduleClipboard.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < scheduleClipboard.cols; colOffset += 1) {
      const row = scheduleRangeSelection.anchor.row + rowOffset;
      const col = scheduleRangeSelection.anchor.col + colOffset;
      const cell = document.querySelector(`#mainTable .cell[data-row-index="${row}"][data-col-index="${col}"]`);
      if (!(cell instanceof HTMLElement) || cell.classList.contains("inactive-cell") || !cell.dataset.memberId || !cell.dataset.date) {
        continue;
      }
      const cellChanged = await applyClipboardSlotToScheduleCell(cell.dataset.memberId, cell.dataset.date, scheduleClipboard.matrix[rowOffset][colOffset]);
      if (cellChanged) {
        changedCells.push({ memberId: cell.dataset.memberId, dateString: cell.dataset.date });
        changed = true;
      }
    }
  }
  if (changed) {
    pruneEmptySchedule();
    changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
    syncScheduleRangeSelectionUi();
    await persistScheduleCells(changedCells);
  }
  return changed;
}

async function restoreScheduleSnapshot(snapshot) {
  if (!snapshot) {
    return false;
  }
  state.schedule = deepClone(snapshot);
  await finishScheduleGridMutation();
  return true;
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || Boolean(target instanceof HTMLElement && target.isContentEditable);
}

function getLeaveByCode(code) {
  return state.leaves.find((leave) => leave.code === code) || null;
}

function isRestLeaveId(leaveId) {
  return getItem("leave", leaveId)?.code === "0047";
}

function isRegularRestLeaveId(leaveId) {
  return getItem("leave", leaveId)?.code === "0036";
}

function getWeekBucketIndex(dateString, rangeStartDate) {
  return Math.floor(diffDays(rangeStartDate, dateString) / 7);
}

function getWorkScheduleSlot(scheduleMap, memberId, dateString) {
  const key = getScheduleKeyForDateString(memberId, dateString);
  return key ? scheduleMap[key] || null : null;
}

function countAssignedShiftMembers(scheduleMap, shiftId, dateString, excludeMemberId = "") {
  if (!shiftId || !dateString) {
    return 0;
  }
  return state.members.filter((member) => {
    if (member.id === excludeMemberId || !isMemberActiveOnDateString(member, dateString)) {
      return false;
    }
    return getWorkScheduleSlot(scheduleMap, member.id, dateString)?.shift === shiftId;
  }).length;
}

function ensureWorkScheduleSlot(scheduleMap, memberId, dateString) {
  const key = getScheduleKeyForDateString(memberId, dateString);
  if (!key) {
    return null;
  }
  if (!scheduleMap[key]) {
    scheduleMap[key] = { shift: null, leave: null, overtime: null };
  }
  return scheduleMap[key];
}

function hasAnyLeaveOnDate(scheduleMap, memberId, dateString) {
  return Boolean(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave);
}

function hasAnyShiftOnDate(scheduleMap, memberId, dateString) {
  return Boolean(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.shift);
}

function getVisibleAutoScheduleShifts(dateString = "") {
  return state.shifts.filter((shift) => (
    !shift.hiddenFromToolbar
    && Math.max(0, Number(shift.requiredStaffCount) || 0) > 0
    && (!dateString || isShiftOperatingOnDate(shift, dateString))
  ));
}

function getMemberAutoRestTarget(member, scheduleMap, dates) {
  const activeDays = countMemberActiveDays(member, dates);
  if (!activeDays) {
    return { activeDays: 0, fixedRegularCount: 0, totalHolidayTarget: 0, restTarget: 0 };
  }
  const fixedRegularCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRegularRestLeaveId);
  const totalHolidayTarget = Math.round((activeDays / 56) * 16);
  return {
    activeDays,
    fixedRegularCount,
    totalHolidayTarget,
    restTarget: Math.max(0, totalHolidayTarget - fixedRegularCount)
  };
}

function getActiveMembersForDate(dateString) {
  return state.members.filter((member) => isMemberActiveOnDateString(member, dateString));
}

function countMemberActiveDays(member, dates) {
  return dates.filter((dateString) => isMemberActiveOnDateString(member, dateString)).length;
}

function countMemberLeaveByPredicate(scheduleMap, memberId, dates, predicate) {
  return dates.filter((dateString) => predicate(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)).length;
}

function memberHasRestInWeek(scheduleMap, memberId, dates, weekIndex, rangeStartDate) {
  return dates.some((dateString) => (
    getWeekBucketIndex(dateString, rangeStartDate) === weekIndex
    && isRestLeaveId(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)
  ));
}

function countMemberRestInWeek(scheduleMap, memberId, dates, weekIndex, rangeStartDate) {
  return dates.filter((dateString) => (
    getWeekBucketIndex(dateString, rangeStartDate) === weekIndex
    && isRestLeaveId(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)
  )).length;
}

function markAutoLeave(scheduleMap, member, dateString, leave, preview, reason) {
  const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (!slot || !leave) {
    return false;
  }
  slot.leave = leave.id;
  slot.leaveMeta = {
    leaveCode: leave.code || "",
    displayName: leave.name,
    displayColor: leave.color || "",
    displayTextColor: getItemTextColor(leave, leave.color),
    allDay: true,
    startTime: "",
    endTime: "",
    reasonEnabled: Boolean(reason),
    reason: reason || ""
  };
  return true;
}

function getDailyShiftNeedOptions(scheduleMap, dateString) {
  const shifts = getVisibleAutoScheduleShifts(dateString);
  const activeMembers = getActiveMembersForDate(dateString);
  const memberDeptIdsById = new Map(activeMembers.map((member) => [member.id, getMemberScheduleDeptIds(member)]));
  const availableMembers = [];
  activeMembers.forEach((member) => {
    const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
    if (!slot?.shift && !slot?.leave) {
      availableMembers.push(member);
    }
  });
  return shifts
    .map((shift) => {
      const assignedCount = countAssignedShiftMembers(scheduleMap, shift.id, dateString);
      const remaining = Math.max(0, getShiftDemandForDate(shift, dateString) - assignedCount);
      const shiftDeptIds = getOperatingShiftDepartmentIds(shift, dateString);
      const candidates = remaining > 0
        ? availableMembers.filter((member) => (
          !shiftDeptIds.length || shiftDeptIds.some((deptId) => memberDeptIdsById.get(member.id)?.includes(deptId))
        ))
        : [];
      return { shift, assignedCount, remaining, candidates };
    })
    .filter((item) => item.remaining > 0);
}

function getShiftDepartmentIds(shift) {
  return Array.isArray(shift?.applicableDeptIds) ? shift.applicableDeptIds.filter(Boolean) : [];
}

function getShiftDemandForDate(shift, dateString) {
  if (!shift || !isShiftOperatingOnDate(shift, dateString)) {
    return 0;
  }
  return Math.max(0, Number(shift.requiredStaffCount) || 0);
}

function getOperatingShiftDepartmentIds(shift, dateString) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return shiftDeptIds.filter((deptId) => {
    const department = state.departments.find((item) => item.id === deptId);
    return isDepartmentVisibleInSchedule(department) && isDepartmentOperatingOnDate(department, dateString);
  });
}

function isShiftOperatingOnDate(shift, dateString) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || getOperatingShiftDepartmentIds(shift, dateString).length > 0;
}

function shiftHasVisibleDepartment(shift) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || shiftDeptIds.some((deptId) => (
    isDepartmentVisibleInScheduleRange(state.departments.find((department) => department.id === deptId))
  ));
}

function getDailyAssignmentCost(scheduleMap, option, member, dateString, dates) {
  const shiftDeptIds = getOperatingShiftDepartmentIds(option.shift, dateString);
  const homeDeptMatch = shiftDeptIds.length ? shiftDeptIds.includes(getMemberHomeDeptId(member)) : true;
  const weekIndex = getWeekBucketIndex(dateString, dates[0] || dateString);
  const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
  const restTarget = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  const restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
  const hasRestThisWeek = memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, dates[0] || dateString);
  const mustWork = !member.payByDay
    && !isRegularRestLeaveId(slot?.leave)
    && hasRestThisWeek;
  const monthlyCanStillRest = !member.payByDay && restCount < restTarget && !hasRestThisWeek;
  if (mustWork) {
    return 0;
  }
  if (!member.payByDay && homeDeptMatch) {
    return 100;
  }
  if (!member.payByDay && !monthlyCanStillRest) {
    return 200;
  }
  if (monthlyCanStillRest) {
    return 300;
  }
  return 400;
}

function findMinimumCostFlowAssignments(scheduleMap, options, dateString, dates) {
  const FIRST_COVERAGE_COST = 0;
  const EXTRA_COVERAGE_COST = 1000000;
  const members = [];
  const memberIndexById = new Map();
  options.forEach((option) => {
    option.candidates.forEach((member) => {
      if (!memberIndexById.has(member.id)) {
        memberIndexById.set(member.id, members.length);
        members.push(member);
      }
    });
  });
  const shiftSlots = [];
  options.forEach((option) => {
    for (let index = 0; index < option.remaining; index += 1) {
      shiftSlots.push({
        ...option,
        slotCost: option.assignedCount === 0 && index === 0 ? FIRST_COVERAGE_COST : EXTRA_COVERAGE_COST
      });
    }
  });
  const source = 0;
  const shiftStart = 1;
  const memberStart = shiftStart + shiftSlots.length;
  const sink = memberStart + members.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const assignmentEdges = [];
  const addEdge = (from, to, capacity, cost = 0) => {
    const forward = { to, rev: graph[to].length, capacity, cost };
    const backward = { to: from, rev: graph[from].length, capacity: 0, cost: -cost };
    graph[from].push(forward);
    graph[to].push(backward);
    return forward;
  };
  shiftSlots.forEach((option, optionIndex) => {
    const shiftNode = shiftStart + optionIndex;
    addEdge(source, shiftNode, 1, option.slotCost);
    option.candidates.forEach((member) => {
      const memberNode = memberStart + memberIndexById.get(member.id);
      const edge = addEdge(
        shiftNode,
        memberNode,
        1,
        getDailyAssignmentCost(scheduleMap, option, member, dateString, dates)
      );
      assignmentEdges.push({ edge, shift: option.shift, member });
    });
  });
  members.forEach((member, memberIndex) => {
    addEdge(memberStart + memberIndex, sink, 1);
  });
  const findShortestPath = () => {
    const distances = Array(graph.length).fill(Infinity);
    const inQueue = Array(graph.length).fill(false);
    const previous = Array(graph.length).fill(null);
    distances[source] = 0;
    const queue = [source];
    inQueue[source] = true;
    while (queue.length) {
      const node = queue.shift();
      inQueue[node] = false;
      graph[node].forEach((edge, edgeIndex) => {
        const nextCost = distances[node] + edge.cost;
        if (edge.capacity > 0 && nextCost < distances[edge.to]) {
          distances[edge.to] = nextCost;
          previous[edge.to] = { node, edgeIndex };
          if (!inQueue[edge.to]) {
            inQueue[edge.to] = true;
            queue.push(edge.to);
          }
        }
      });
    }
    return distances[sink] < Infinity ? previous : null;
  };
  // ponytail: daily graph is tiny; min-cost max-flow keeps full coverage while honoring priority costs.
  while (true) {
    const previous = findShortestPath();
    if (!previous) {
      break;
    }
    let cursor = sink;
    while (cursor !== source) {
      const step = previous[cursor];
      const edge = graph[step.node][step.edgeIndex];
      edge.capacity -= 1;
      graph[edge.to][edge.rev].capacity += 1;
      cursor = step.node;
    }
  }
  return assignmentEdges
    .filter(({ edge }) => edge.capacity === 0)
    .map(({ shift, member }) => ({ shift, member }));
}

function findBestDailyShiftAssignments(scheduleMap, dateString, preview) {
  const options = getDailyShiftNeedOptions(scheduleMap, dateString)
    .sort((a, b) => (
      a.candidates.length - b.candidates.length
      || b.remaining - a.remaining
      || a.shift.name.localeCompare(b.shift.name)
    ));
  const assignments = findMinimumCostFlowAssignments(scheduleMap, options, dateString, preview.dates || [dateString]);
  assignments.forEach(({ shift, member }) => {
    const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
    if (slot) {
      slot.shift = shift.id;
    }
  });
  const missingDetails = getRemainingDailyShiftDemandDetails(scheduleMap, dateString);
  if (missingDetails.length) {
    const missing = missingDetails.reduce((sum, item) => sum + item.missing, 0);
    const detailText = missingDetails
      .map(({ shift, missing: missingCount }) => `${shift.name}缺${missingCount}`)
      .join("、");
    preview.warnings.push(`${dateString} 仍缺 ${missing} 個班別人力${detailText ? `（${detailText}）` : ""}`);
  }
  return assignments;
}

function getRemainingDailyShiftDemand(scheduleMap, dateString) {
  return getRemainingDailyShiftDemandDetails(scheduleMap, dateString)
    .reduce((sum, item) => sum + item.missing, 0);
}

function getRemainingDailyShiftDemandDetails(scheduleMap, dateString) {
  return getVisibleAutoScheduleShifts(dateString)
    .map((shift) => {
      return {
        shift,
        missing: Math.max(0, getShiftDemandForDate(shift, dateString) - countAssignedShiftMembers(scheduleMap, shift.id, dateString))
      };
    })
    .filter((item) => item.missing > 0);
}

function canAutoPlaceDailyRest(scheduleMap, member, dateString, dates, rangeStartDate) {
  if (!isMemberActiveOnDateString(member, dateString)) {
    return false;
  }
  const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (slot?.shift || slot?.leave) {
    return false;
  }
  const target = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  if (countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId) >= target) {
    return false;
  }
  const weekIndex = getWeekBucketIndex(dateString, rangeStartDate);
  return countMemberRestInWeek(scheduleMap, member.id, dates, weekIndex, rangeStartDate) === 0;
}

function placeDailySurplusRestDays(scheduleMap, dateString, dates, rangeStartDate, restLeave, preview) {
  const candidates = getActiveMembersForDate(dateString)
    .filter((member) => canAutoPlaceDailyRest(scheduleMap, member, dateString, dates, rangeStartDate))
    .sort((a, b) => {
      if (a.payByDay !== b.payByDay) {
        return a.payByDay ? -1 : 1;
      }
      const restDiff = countMemberLeaveByPredicate(scheduleMap, a.id, dates, isRestLeaveId)
        - countMemberLeaveByPredicate(scheduleMap, b.id, dates, isRestLeaveId);
      return restDiff || getMemberHomeDeptId(a).localeCompare(getMemberHomeDeptId(b)) || a.name.localeCompare(b.name);
    });
  candidates.forEach((member) => {
    markAutoLeave(scheduleMap, member, dateString, restLeave, preview, "多餘人力預排休息日");
  });
}

function buildAutoSchedulePreview(dates = getVisibleDates()) {
  const startDate = dates[0] || getTodayDateString();
  const regularLeave = getLeaveByCode("0036");
  const restLeave = getLeaveByCode("0047");
  const preview = {
    startDate,
    dates,
    slots: {},
    warnings: [],
    cancelLeaveRequestIds: new Set(),
    memberTargets: {}
  };
  const scheduleMap = deepClone(state.schedule || {});
  if (!regularLeave || !restLeave) {
    preview.warnings.push("找不到例假 0036 或休息日 0047，無法完整自動排班");
    return preview;
  }

  state.members.forEach((member) => {
    const activeDays = countMemberActiveDays(member, dates);
    if (!activeDays) {
      return;
    }
    dates.forEach((dateString) => {
      if (!isMemberActiveOnDateString(member, dateString)) {
        return;
      }
      if (toDateObject(dateString)?.getDay() === normalizeRestWeekday(member.fixedRestWeekday)) {
        const hadShift = hasAnyShiftOnDate(scheduleMap, member.id, dateString);
        markAutoLeave(scheduleMap, member, dateString, regularLeave, preview, hadShift ? "例假加班" : "固定例假");
        if (hadShift) {
          preview.warnings.push(`${member.name} ${dateString} 已有班別，預排為例假加班`);
        }
      }
    });
  });

  state.members.forEach((member) => {
    const target = getMemberAutoRestTarget(member, scheduleMap, dates);
    if (!target.activeDays) {
      return;
    }
    preview.memberTargets[member.id] = target;
  });

  dates.forEach((dateString) => {
    findBestDailyShiftAssignments(scheduleMap, dateString, preview);
    placeDailySurplusRestDays(scheduleMap, dateString, dates, startDate, restLeave, preview);
  });

  state.members.forEach((member) => {
    const target = preview.memberTargets[member.id]?.restTarget ?? 0;
    let restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
    while (restCount < target) {
      const weekCount = Math.max(1, Math.ceil(dates.length / 7));
      const weekIndexes = Array.from({ length: weekCount }, (_, index) => index);
      const targetWeek = weekIndexes.find((weekIndex) => !memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, startDate));
      const candidateDate = dates.find((dateString) => (
        getWeekBucketIndex(dateString, startDate) === targetWeek
        && isMemberActiveOnDateString(member, dateString)
        && !hasAnyLeaveOnDate(scheduleMap, member.id, dateString)
      ));
      if (!candidateDate) {
        preview.warnings.push(`${member.name} 休息日不足 ${target - restCount} 天`);
        break;
      }
      markAutoLeave(scheduleMap, member, candidateDate, restLeave, preview, hasAnyShiftOnDate(scheduleMap, member.id, candidateDate) ? "休息日加班" : "補足休息日");
      if (hasAnyShiftOnDate(scheduleMap, member.id, candidateDate)) {
        preview.warnings.push(`${member.name} ${candidateDate} 預排為休息日加班`);
      }
      restCount += 1;
    }
  });

  Object.entries(scheduleMap).forEach(([key, slot]) => {
    const original = state.schedule[key] || null;
    if (JSON.stringify(original || null) !== JSON.stringify(slot || null)) {
      preview.slots[key] = slot;
    }
  });
  preview.cancelLeaveRequestIds = Array.from(preview.cancelLeaveRequestIds);
  return preview;
}

async function previewAutoSchedule() {
  if (!promptManagerAccess("自動排班需先登入主管帳號")) {
    return;
  }
  const { startDate, endDate } = getVisibleDateRange();
  modalContext = { category: "auto-schedule-period" };
  openEntityListModal({
    title: "自動排班期間",
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="autoScheduleStartDate">開始日期</label>
          <input id="autoScheduleStartDate" type="date" value="${escapeHtml(startDate)}">
        </div>
        <div class="form-row">
          <label for="autoScheduleEndDate">結束日期</label>
          <input id="autoScheduleEndDate" type="date" value="${escapeHtml(endDate)}">
        </div>
      </div>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-generate-auto-schedule="true">產生預覽</button>'
  });
}

async function generateAutoSchedulePreviewFromModal() {
  const startDate = document.getElementById("autoScheduleStartDate")?.value || "";
  const endDate = document.getElementById("autoScheduleEndDate")?.value || "";
  if (!startDate || !endDate || (!isValidDateRange(startDate, endDate) && startDate !== endDate)) {
    reportValidationError("請確認自動排班期間");
    return;
  }
  const dates = enumerateDateRange(startDate, endDate);
  if (!dates.length) {
    reportValidationError("請確認自動排班期間");
    return;
  }
  closeModal();
  autoSchedulePreview = buildAutoSchedulePreview(dates);
  renderAll();
  const changeCount = Object.keys(autoSchedulePreview.slots || {}).length;
  const warningCount = autoSchedulePreview.warnings.length;
  showInfoMessage(`已產生自動排班預覽：${startDate} ～ ${endDate}，${changeCount} 格預排${warningCount ? `，${warningCount} 則提醒` : ""}`);
}

async function applyAutoSchedulePreview() {
  if (!promptManagerAccess("套用自動排班需先登入主管帳號")) {
    return;
  }
  if (!autoSchedulePreview) {
    showInfoMessage("目前沒有自動排班預覽");
    return;
  }
  if (!await confirmAction("確定要套用目前綠色預排結果嗎？套用後會寫入班表。")) {
    return;
  }
  Object.entries(autoSchedulePreview.slots || {}).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await forceSave();
  showInfoMessage("已套用自動排班預覽");
}

function cancelAutoSchedulePreview() {
  if (!autoSchedulePreview) {
    return;
  }
  autoSchedulePreview = null;
  renderAll();
  showInfoMessage("已取消自動排班預覽");
}

function beginScheduleRangeSelection(event) {
  if (event.button !== 0) {
    return;
  }
  const cell = getScheduleCellFromEvent(event);
  if (!cell) {
    return;
  }
  const point = getScheduleCellPoint(cell);
  if (event.shiftKey && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)) {
    setScheduleRangeSelection(scheduleRangeSelection.anchor, point);
  } else {
    setScheduleRangeSelection(point);
  }
  scheduleDragSelecting = true;
  scheduleSuppressNextCellClick = true;
  event.preventDefault();
}

function updateScheduleRangeSelection(event) {
  if (!scheduleDragSelecting || !scheduleRangeSelection) {
    return;
  }
  const cell = getScheduleCellFromEvent(event);
  if (!cell) {
    return;
  }
  setScheduleRangeSelection(scheduleRangeSelection.anchor, getScheduleCellPoint(cell));
}

function endScheduleRangeSelection() {
  scheduleDragSelecting = false;
}

function clearSelectedChip() {
  if (!state.selected.type) {
    return false;
  }
  state.selected = { type: null, id: null };
  clearScheduleRangeSelection();
  renderToolbar();
  renderTable();
  return true;
}

async function handleScheduleGridKeydown(event) {
  if (event.key === "Escape"
    && !document.querySelector("#modalRoot .modal-overlay")
    && !isTypingTarget(event.target)
    && canEditSchedule()
    && clearSelectedChip()) {
    event.preventDefault();
    return;
  }
  if (document.querySelector("#modalRoot .modal-overlay")
    || isTypingTarget(event.target)
    || !canEditSchedule()
    || state.tableView !== "member"
    || !scheduleRangeSelection) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "delete" || key === "backspace") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      scheduleUndoSnapshot = null;
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }
  if (key === "c") {
    event.preventDefault();
    copyScheduleRangeToClipboard();
    return;
  }
  if (key === "x") {
    event.preventDefault();
    if (!copyScheduleRangeToClipboard()) {
      return;
    }
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      scheduleUndoSnapshot = null;
    }
    return;
  }
  if (key === "v") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await pasteScheduleClipboard()) {
      scheduleUndoSnapshot = null;
    }
    return;
  }
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      const redoSnapshot = scheduleRedoSnapshot;
      if (redoSnapshot) {
        scheduleRedoSnapshot = null;
        scheduleUndoSnapshot = deepClone(state.schedule || {});
        await restoreScheduleSnapshot(redoSnapshot);
      }
      return;
    }
    const undoSnapshot = scheduleUndoSnapshot;
    if (undoSnapshot) {
      scheduleUndoSnapshot = null;
      scheduleRedoSnapshot = deepClone(state.schedule || {});
      await restoreScheduleSnapshot(undoSnapshot);
    }
    return;
  }
  if (key === "y") {
    event.preventDefault();
    const redoSnapshot = scheduleRedoSnapshot;
    if (redoSnapshot) {
      scheduleRedoSnapshot = null;
      scheduleUndoSnapshot = deepClone(state.schedule || {});
      await restoreScheduleSnapshot(redoSnapshot);
    }
  }
}

function getLeaveLabel(leave) {
  if (!leave) {
    return "";
  }
  return leave.code ? `${leave.code} ${leave.name}` : leave.name;
}

function isLoggedIn() {
  return Boolean(currentSession?.user);
}

function isManager() {
  return currentProfile?.role === "manager";
}

function canEditSchedule() {
  return isManager();
}

function getCurrentProfileName() {
  return currentProfile?.full_name || currentSession?.user?.email || "";
}

function getRequestActor() {
  if (currentMember) {
    return {
      code: currentMember.code || currentProfile?.employee_code || "",
      name: currentMember.name || getCurrentProfileName()
    };
  }
  if (currentProfile) {
    return {
      code: currentProfile.employee_code || "",
      name: currentProfile.full_name || getCurrentProfileName()
    };
  }
  return null;
}

function getCurrentRoleLabel() {
  return isManager() ? "主管" : "員工";
}

function resolveCurrentMember() {
  if (!currentProfile?.employee_code) {
    return null;
  }
  return state.members.find((member) => member.code === currentProfile.employee_code) || null;
}

function requestMatchesMember(record, memberId = "", memberCode = "") {
  if (!record) {
    return false;
  }
  return Boolean(
    (memberId && record.memberId === memberId)
    || (memberCode && record.memberCode === memberCode)
  );
}

function hasDateRangeOverlap(startDate, endDate, otherStartDate, otherEndDate) {
  if (!startDate || !endDate || !otherStartDate || !otherEndDate) {
    return false;
  }
  return otherStartDate <= endDate && otherEndDate >= startDate;
}

function findDirectLeaveScheduleConflict(scheduleMemberId, startDate, endDate) {
  if (!scheduleMemberId || !startDate || !endDate) {
    return "";
  }
  return enumerateDateRange(startDate, endDate).find((dateString) => {
    const slot = getScheduleSlotByDateString(scheduleMemberId, dateString);
    return Boolean(slot?.leave);
  }) || "";
}

function hasDirectOvertimeScheduleConflict(scheduleMemberId, workDate) {
  if (!scheduleMemberId || !workDate) {
    return false;
  }
  const slot = getScheduleSlotByDateString(scheduleMemberId, workDate);
  return Boolean(slot?.overtime);
}

function formatRequestDateText(startDate, endDate) {
  if (!startDate) {
    return "";
  }
  return startDate === endDate || !endDate ? startDate : `${startDate} ~ ${endDate}`;
}

function formatOvertimeTimeText(record) {
  return `${record.startTime || "--:--"} - ${record.endTime || "--:--"}`;
}

function formatOvertimeRestLines(record) {
  const lines = [];
  if (record.useRest1) {
    lines.push(`休息1：${record.rest1StartTime || "--:--"} - ${record.rest1EndTime || "--:--"}`);
  }
  if (record.useRest2) {
    lines.push(`休息2：${record.rest2StartTime || "--:--"} - ${record.rest2EndTime || "--:--"}`);
  }
  return lines;
}

function leaveRequiresTime(leave) {
  return Boolean(leave?.defaultAllDay);
}

function defaultLeaveIsAllDay(leave) {
  return !leaveRequiresTime(leave);
}

function getLeaveStyleForRecord(record) {
  const leaveItemId = String(record?.leaveItemId || "").trim();
  return leaveItemId ? state.leaves.find((item) => item.id === leaveItemId) || null : null;
}

function getLeaveStyleForSlot(slot) {
  return getItem("leave", slot?.leave);
}

function getLeaveCatalogDisplayName(item) {
  if (!item) {
    return "";
  }
  return LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || item.name || "";
}

function openSignInDialog(message = "") {
  authPromptMessage = message;
  authErrorMessage = "";
  authModalOpen = true;
  renderAuthGate();
}

function closeSignInDialog() {
  authPromptMessage = "";
  authErrorMessage = "";
  authModalOpen = false;
  renderAuthGate();
}

function promptManagerAccess(message) {
  if (!isLoggedIn()) {
    openSignInDialog(message || "此功能需先登入主管帳號");
    return false;
  }
  if (!isManager()) {
    showInfoMessage("此功能限主管使用");
    return false;
  }
  return true;
}

function shouldDefaultCollapseToolbar() {
  return window.innerWidth <= 960;
}

function syncToolbarCollapseUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  const toggle = document.getElementById("toolbarCollapseToggle");
  if (!toolbarCard || !toggle) {
    return;
  }
  toolbarCard.classList.toggle("toolbar-floating-card-collapsed", toolbarCollapsed);
  toggle.setAttribute("aria-expanded", toolbarCollapsed ? "false" : "true");
  toggle.setAttribute("aria-label", toolbarCollapsed ? "展開工具列" : "收合工具列");
  toggle.setAttribute("title", toolbarCollapsed ? "展開工具列" : "收合工具列");
  toggle.innerHTML = toolbarCollapsed
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6"></path>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 15l6-6 6 6"></path>
      </svg>
    `;
}

function initializeToolbarCollapse() {
  if (toolbarCollapseInitialized) {
    return;
  }
  toolbarCollapsed = shouldDefaultCollapseToolbar();
  toolbarCollapseInitialized = true;
}

function toggleToolbarCollapse() {
  toolbarCollapsed = !toolbarCollapsed;
  syncToolbarCollapseUi();
}

function syncRoleUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  initializeToolbarCollapse();
  const toolbarGrid = document.getElementById("toolbarGrid");
  if (toolbarGrid) {
    toolbarGrid.style.display = isManager() ? "grid" : "none";
  }
  if (toolbarCard) {
    toolbarCard.classList.toggle("toolbar-floating-card-compact", !isManager());
  }
  syncToolbarCollapseUi();
  const coreActionsShell = document.getElementById("coreActionsShell");
  if (coreActionsShell) {
    coreActionsShell.style.display = isManager() ? "" : "none";
  }
  const managerOnlyIds = [
    "deptSettingsButton",
    "shiftSettingsButton",
    "restComplianceButton",
    "leaveSettingsButton",
    "overtimeSettingsButton",
    "weekStartSettingsButton"
  ];
  managerOnlyIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.style.display = isManager() ? "" : "none";
    element.disabled = !isManager();
  });

  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.classList.toggle("chips-readonly", !canEditSchedule());
  });

}

function renderAuthBar() {
  const container = document.getElementById("authBar");
  const signOutSlot = document.getElementById("signOutSlot");
  if (!container) {
    return;
  }
  if (signOutSlot) {
    signOutSlot.innerHTML = "";
  }
  if (!isLoggedIn()) {
    container.innerHTML = `
      <button class="ghost-btn compact-btn" type="button" data-open-sign-in="true">登入</button>
    `;
    return;
  }
  if (!currentProfile) {
    container.innerHTML = `
      <div class="session-pill">已登入，但尚未建立身份資料</div>
    `;
    if (signOutSlot) {
      signOutSlot.innerHTML = `<button class="ghost-btn compact-btn" id="signOutButton" type="button">登出</button>`;
    }
    return;
  }
  const requestButtons = currentProfile ? `
    <button class="ghost-btn compact-btn" type="button" data-open-change-password="true">修改密碼</button>
  ` : "";
  container.innerHTML = `
    <div class="session-pill">${escapeHtml(getCurrentProfileName())}</div>
    ${requestButtons}
  `;
  if (signOutSlot) {
    signOutSlot.innerHTML = `<button class="ghost-btn compact-btn" id="signOutButton" type="button">登出</button>`;
  }
}

function renderAuthGate() {
  const root = document.getElementById("authRoot");
  if (!root) {
    return;
  }
  if (!authModalOpen) {
    root.innerHTML = "";
    return;
  }
  if (!isLoggedIn()) {
    root.innerHTML = `
      <div class="auth-overlay">
        <div class="auth-card">
          <h3>登入</h3>
          ${authPromptMessage ? `<p class="modal-description">${escapeHtml(authPromptMessage)}</p>` : ""}
          <div class="form-row">
            <label for="loginAccount">工號</label>
            <input id="loginAccount" type="text" autocomplete="username" placeholder="請輸入工號">
          </div>
          <div class="form-row">
            <label for="loginPassword">密碼</label>
            <input id="loginPassword" type="password" autocomplete="current-password" placeholder="請輸入密碼">
          </div>
          ${authErrorMessage ? `<div class="auth-error">${escapeHtml(authErrorMessage)}</div>` : ""}
          <div class="modal-footer auth-footer">
            <button class="btn-cancel" type="button" data-close-auth-gate="true">取消</button>
            <button class="btn-primary" type="button" data-auth-sign-in="true">登入</button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  root.innerHTML = "";
}

function openChangePasswordModal() {
  if (!isLoggedIn()) {
    openSignInDialog("修改密碼前請先登入");
    return;
  }
  openEntityListModal({
    title: "修改密碼",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label for="changePasswordValue">新密碼</label>
        <input id="changePasswordValue" type="password" maxlength="64" placeholder="請輸入新密碼">
      </div>
      <div class="form-row">
        <label for="changePasswordConfirm">確認新密碼</label>
        <input id="changePasswordConfirm" type="password" maxlength="64" placeholder="請再次輸入新密碼">
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-change-password="true">儲存修改</button>',
    hideFooterClose: true
  });
}

async function saveChangedPassword() {
  const password = document.getElementById("changePasswordValue")?.value || "";
  const confirmPassword = document.getElementById("changePasswordConfirm")?.value || "";
  if (password.length < 4) {
    reportValidationError("密碼至少需要 4 碼");
    return;
  }
  if (password !== confirmPassword) {
    reportValidationError("兩次輸入的密碼不一致");
    return;
  }
  try {
    await window.schedulerApi.changePassword(password);
    closeModal();
    showInfoMessage("密碼已修改");
  } catch (error) {
    setSaveStatus(`修改密碼失敗：${error.message}`);
  }
}

function hasSapLeaveRows() {
  const sapLeaveCodes = new Set(["0036", "0047"]);
  return state.members.some((member) => {
    if (member.payByDay) {
      return false;
    }
    for (let day = 1; day <= daysInMonth(state.year, state.month); day += 1) {
      if (!isMemberActiveOnDate(member, state.year, state.month, day)) {
        continue;
      }
      const leaveId = state.schedule[scheduleKey(member.id, state.year, state.month, day)]?.leave;
      const leave = getItem("leave", leaveId);
      if (leave && sapLeaveCodes.has(leave.code)) {
        return true;
      }
    }
    return false;
  });
}

function hasOvertimeRows() {
  return state.members.some((member) => {
    for (let day = 1; day <= daysInMonth(state.year, state.month); day += 1) {
      if (!isMemberActiveOnDate(member, state.year, state.month, day)) {
        continue;
      }
      if (state.schedule[scheduleKey(member.id, state.year, state.month, day)]?.overtime) {
        return true;
      }
    }
    return false;
  });
}

function hasLeaveRows() {
  const excludedLeaveCodes = new Set(["0036", "0047"]);
  return state.members.some((member) => {
    const department = state.departments.find((item) => item.id === member.deptId);
    if (department?.hiddenFromLeave) {
      return false;
    }
    for (let day = 1; day <= daysInMonth(state.year, state.month); day += 1) {
      if (!isMemberActiveOnDate(member, state.year, state.month, day)) {
        continue;
      }
      const leave = getItem("leave", state.schedule[scheduleKey(member.id, state.year, state.month, day)]?.leave);
      if (leave && !excludedLeaveCodes.has(leave.code)) {
        return true;
      }
    }
    return false;
  });
}

function shouldPromptLeaveDetail(leave, leaveMeta = null) {
  if (leaveMeta?.reason || leaveMeta?.startTime || leaveMeta?.endTime || leaveMeta?.allDay !== undefined) {
    return true;
  }
  if (leave?.requireReason) {
    return true;
  }
  return leaveRequiresTime(leave);
}

function formatLeaveDetailSummary(leave, leaveMeta) {
  const lines = [];
  if (leave && (leaveRequiresTime(leave) || leaveMeta?.allDay !== undefined || leaveMeta?.startTime || leaveMeta?.endTime)) {
    if (leaveMeta?.allDay !== false) {
      lines.push("時間：整天");
    } else {
      lines.push(`時間：${leaveMeta?.startTime || "--:--"} - ${leaveMeta?.endTime || "--:--"}`);
    }
  }
  if (leave && (leave.requireReason || leaveMeta?.reasonEnabled || leaveMeta?.reason)) {
    lines.push(`原因：${leaveMeta?.reason || "未填寫"}`);
  }
  return lines;
}

function hideLeaveTooltip() {
  if (leaveTooltipTimer) {
    clearTimeout(leaveTooltipTimer);
    leaveTooltipTimer = null;
  }
  document.getElementById("leaveTooltipRoot")?.remove();
}

function scheduleHideLeaveTooltip() {
  if (leaveTooltipTimer) {
    clearTimeout(leaveTooltipTimer);
  }
  leaveTooltipTimer = setTimeout(() => {
    hideLeaveTooltip();
  }, 120);
}

function formatOvertimeDetailSummary(overtimeMeta) {
  const lines = [];
  lines.push(`時間：${overtimeMeta?.startTime || "--:--"} - ${overtimeMeta?.endTime || "--:--"}`);
  if (overtimeMeta?.useRest1) {
    lines.push(`休息1：${overtimeMeta.rest1StartTime || "--:--"} - ${overtimeMeta.rest1EndTime || "--:--"}`);
  }
  if (overtimeMeta?.useRest2) {
    lines.push(`休息2：${overtimeMeta.rest2StartTime || "--:--"} - ${overtimeMeta.rest2EndTime || "--:--"}`);
  }
  if (overtimeMeta?.reason) {
    lines.push(`原因：${overtimeMeta.reason}`);
  }
  return lines;
}

function showScheduleTooltip(memberId, day, category, anchorRect) {
  const slot = getSlot(memberId, day);
  const isLeave = category === "leave";
  const item = isLeave
    ? getItem(category, slot?.[category])
    : getItem(category, slot?.[category]);
  const meta = isLeave ? slot?.leaveMeta : slot?.overtimeMeta;
  const shouldShow = isLeave
    ? item && shouldPromptLeaveDetail(item, meta)
    : item && meta;
  if (!shouldShow) {
    hideLeaveTooltip();
    return;
  }

  const lines = isLeave
    ? formatLeaveDetailSummary(item, meta)
    : formatOvertimeDetailSummary(meta);
  if (!lines.length) {
    hideLeaveTooltip();
    return;
  }

  hideLeaveTooltip();
  const root = document.createElement("div");
  root.id = "leaveTooltipRoot";
  root.className = "leave-tooltip";
  root.style.left = `${Math.min(window.innerWidth - 250, anchorRect.left + 10) + window.scrollX}px`;
  root.style.top = `${anchorRect.bottom + window.scrollY + 8}px`;
  root.innerHTML = `
    <div class="leave-tooltip-head">
      <div class="leave-tooltip-title">${escapeHtml(
        isLeave
          ? `${item?.code || ""} ${meta?.displayName || item?.name || ""}`.trim()
          : (meta?.displayName || item?.name || "加班")
      )}</div>
      ${isManager()
        ? (isLeave
          ? renderActionIconButton("edit", `data-edit-leave-assignment="${memberId}:${day}"`, "leave-tooltip-btn")
          : renderActionIconButton("edit", `data-edit-overtime-assignment="${memberId}:${day}"`, "leave-tooltip-btn"))
        : ""}
    </div>
    ${lines.map((line) => `<div class="leave-tooltip-line">${escapeHtml(line)}</div>`).join("")}
  `;
  root.addEventListener("mouseenter", () => {
    if (leaveTooltipTimer) {
      clearTimeout(leaveTooltipTimer);
      leaveTooltipTimer = null;
    }
  });
  root.addEventListener("mouseleave", scheduleHideLeaveTooltip);
  document.body.appendChild(root);
}

function closeModal() {
  modalContext = {};
  document.getElementById("modalRoot").innerHTML = "";
  hideLeaveTooltip();
}

function reopenModalFromContext(context) {
  if (!context || typeof context !== "object") {
    return;
  }
  if (context.category === "department-settings") {
    if (context.view) {
      departmentSettingsView = context.view === "member" ? "member" : "department";
    }
    openDepartmentSettings();
    restoreSettingsScroll(context);
    return;
  }
  if (context.category === "member-settings") {
    openMemberSettings();
    restoreSettingsScroll(context);
    return;
  }
  if (context.category === "list-settings") {
    openListSettings(context.listCategory);
    restoreSettingsScroll(context);
  }
}

function setModal(content) {
  document.getElementById("modalRoot").innerHTML = content;
}

function renderDeptFilter() {
  const select = document.getElementById("deptFilter");
  const departments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
  if (state.deptFilter !== "all" && !departments.some((department) => department.id === state.deptFilter)) {
    state.deptFilter = "all";
  }
  select.innerHTML = `
    <option value="all">全部單位</option>
    ${departments.map((department) => (
      `<option value="${department.id}" ${state.deptFilter === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`
    )).join("")}
  `;
}

function renderTableDeptScopeFilter() {
  const select = document.getElementById("tableDeptScopeFilter");
  if (!select) {
    return;
  }
  const departments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
  if (state.tableDeptScopeFilter !== "all" && !departments.some((department) => department.id === state.tableDeptScopeFilter)) {
    state.tableDeptScopeFilter = "all";
  }
  select.innerHTML = `
    <option value="all">全部顯示</option>
    ${departments.map((department) => (
      `<option value="${department.id}" ${state.tableDeptScopeFilter === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`
    )).join("")}
  `;
}

function renderTableViewSelect() {
  const select = document.getElementById("tableViewSelect");
  if (!select) {
    return;
  }
  select.value = state.tableView === "shift" ? "shift" : state.tableStatsVisible ? "member-stats" : "member";
}

function renderChips(containerId, category, items) {
  const container = document.getElementById(containerId);
  const chips = items.map((item) => {
    const active = state.selected.type === category && state.selected.id === item.id;
    const foreground = getItemTextColor(item, item.color);
    const style = `color:${foreground};background:${item.color};border-color:${item.color};`;
    return `<button class="chip ${active ? "active" : ""}" style="${style}" type="button" data-chip-type="${category}" data-chip-id="${item.id}">${escapeHtml(item.name)}</button>`;
  });
  const cancelType = `cancel-${category}`;
  const cancelActive = state.selected.type === cancelType;
  chips.push(`<button class="chip cancel ${cancelActive ? "active" : ""}" type="button" data-chip-type="${cancelType}" data-chip-id="">取消</button>`);
  container.innerHTML = chips.join("");
}

function renderToolbar() {
  renderDeptFilter();
  renderTableViewSelect();
  renderTableDeptScopeFilter();
  const visibleShifts = state.deptFilter === "all"
    ? state.shifts
    : state.shifts.filter((shift) => shiftAllowsDepartment(shift, state.deptFilter));
  renderChips("shiftChips", "shift", visibleShifts.filter((item) => !item.hiddenFromToolbar));
  renderChips("leaveChips", "leave", state.leaves.filter((item) => !item.hiddenFromToolbar));
  renderChips("overtimeChips", "overtime", state.overtime.filter((item) => !item.hiddenFromToolbar));
  syncRoleUi();
}

function memberMatchesSelectedShift(member) {
  if (state.selected.type !== "shift" || !state.selected.id) {
    return false;
  }
  const shift = getItem("shift", state.selected.id);
  if (!shift) {
    return false;
  }
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || shiftDeptIds.some((deptId) => memberCanScheduleDepartment(member, deptId));
}

function memberLabel(member) {
  const selectedShiftClass = memberMatchesSelectedShift(member) ? "shift-eligible-member-name" : "";
  const payTypeLabel = member.payByDay ? '<span class="member-pay-type">PT</span>' : "";
  return `<span class="member-main ${selectedShiftClass}">${escapeHtml(member.name)}${payTypeLabel}</span>`;
}

function getMemberEightWeekStats(member) {
  return getVisibleDates().reduce((stats, dateString) => {
    if (!isMemberActiveOnDateString(member, dateString)) {
      return stats;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    const leave = getItem("leave", slot?.leave);
    const hasShift = Boolean(slot?.shift);
    if (leave?.code === "0036") {
      stats.regular += 1;
    }
    if (leave?.code === "0047") {
      if (hasShift) {
        stats.restWork += 1;
      } else {
        stats.rest += 1;
      }
    }
    if (!slot?.shift && !slot?.leave) {
      stats.unassigned += 1;
    }
    return stats;
  }, { regular: 0, rest: 0, restWork: 0, unassigned: 0 });
}

function renderMemberStats(member) {
  const stats = getMemberEightWeekStats(member);
  return `
    <div class="member-stats">
      <span>休:${stats.rest}</span>
      <span>灰休:${stats.restWork}</span>
      <span>例:${stats.regular}</span>
      <span>未排:${stats.unassigned}</span>
    </div>
  `;
}

function memberHasScheduledShiftInDepartment(member, departmentId) {
  if (getMemberHomeDeptId(member) === departmentId) {
    return true;
  }
  for (const dateString of getVisibleDates()) {
    if (!isMemberActiveOnDateString(member, dateString)) {
      continue;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    const shift = getItem("shift", slot?.shift);
    if (shift && shiftAllowsDepartment(shift, departmentId)) {
      return true;
    }
  }
  return false;
}

function getVisibleTableGroups() {
  return state.departments
    .filter((department) => isDepartmentVisibleInScheduleRange(department))
    .map((department) => ({
      department,
      members: state.members.filter((member) => {
        if (getMemberHomeDeptId(member) !== department.id) {
          return false;
        }
        if (!isMemberActiveInVisibleRange(member)) {
          return false;
        }
        if (state.tableDeptScopeFilter === "all") {
          return true;
        }
        return memberHasScheduledShiftInDepartment(member, state.tableDeptScopeFilter);
      })
    }))
    .filter(({ members }) => members.length);
}

function getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter) {
  if (!draggedId || !targetId || draggedId === targetId || !visibleIds.includes(draggedId) || !visibleIds.includes(targetId)) {
    return visibleIds;
  }
  const reorderedIds = visibleIds.filter((id) => id !== draggedId);
  const targetIndex = reorderedIds.indexOf(targetId);
  if (targetIndex < 0) {
    return visibleIds;
  }
  reorderedIds.splice(targetIndex + (insertAfter ? 1 : 0), 0, draggedId);
  return reorderedIds;
}

function applyVisibleOrderById(items, visibleIds) {
  const orderedQueue = visibleIds.slice();
  const orderedById = new Map(items.map((item) => [item.id, item]));
  const visibleIdSet = new Set(visibleIds);
  return items.map((item) => {
    if (!visibleIdSet.has(item.id)) {
      return item;
    }
    const nextId = orderedQueue.shift();
    return orderedById.get(nextId) || item;
  });
}

function captureScheduleViewport() {
  return { scrollX: window.scrollX || 0, scrollY: window.scrollY || 0 };
}

function restoreScheduleViewport(viewport) {
  requestAnimationFrame(() => {
    window.scrollTo(viewport?.scrollX || 0, viewport?.scrollY || 0);
    syncStickyHeaderScroll();
  });
}

async function finishScheduleTableOrderChange(viewport) {
  renderAll();
  restoreScheduleViewport(viewport);
  await forceSave();
}

async function reorderScheduleTableDepartment(draggedId, targetId, insertAfter = false) {
  const visibleIds = getVisibleTableGroups().map(({ department }) => department.id);
  const nextVisibleIds = getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter);
  if (nextVisibleIds.join("|") === visibleIds.join("|")) {
    return false;
  }
  const viewport = captureScheduleViewport();
  state.departments = applyVisibleOrderById(state.departments, nextVisibleIds);
  await finishScheduleTableOrderChange(viewport);
  return true;
}

async function reorderScheduleTableMember(draggedId, targetId, insertAfter = false) {
  const draggedMember = state.members.find((member) => member.id === draggedId);
  const targetMember = state.members.find((member) => member.id === targetId);
  const departmentId = getMemberHomeDeptId(draggedMember);
  if (!draggedMember || !targetMember || !departmentId || departmentId !== getMemberHomeDeptId(targetMember)) {
    return false;
  }
  const group = getVisibleTableGroups().find(({ department }) => department.id === departmentId);
  const visibleIds = (group?.members || []).map((member) => member.id);
  const nextVisibleIds = getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter);
  if (nextVisibleIds.join("|") === visibleIds.join("|")) {
    return false;
  }
  const viewport = captureScheduleViewport();
  state.members = applyVisibleOrderById(state.members, nextVisibleIds);
  await finishScheduleTableOrderChange(viewport);
  return true;
}

function getVisibleShiftRows() {
  return state.shifts.filter((shift) => (
    shiftHasVisibleDepartment(shift)
    && (state.tableDeptScopeFilter === "all" || shiftAllowsDepartment(shift, state.tableDeptScopeFilter))
  ));
}

function getShiftViewMembersForDay(shiftId, dateString) {
  return state.members.filter((member) => {
    if (!isMemberActiveOnDateString(member, dateString)) {
      return false;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    return slot?.shift === shiftId;
  });
}

function getShiftViewCellState(shift, dateString) {
  const members = getShiftViewMembersForDay(shift.id, dateString);
  const isOperating = isShiftOperatingOnDate(shift, dateString);
  const requiredStaffCount = getShiftDemandForDate(shift, dateString);
  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount
  };
}

function renderShiftViewCell(members) {
  if (!members.length) {
    return '<div class="shift-view-members"></div>';
  }
  return `
    <div class="shift-view-members">
      ${members.map((member) => `<div class="shift-view-member">${escapeHtml(member.name)}</div>`).join("")}
    </div>
  `;
}

function getScheduleSegmentTextLength(text) {
  return Array.from(String(text || "").trim()).length;
}

function getScheduleSegmentSizeClass(segment, segmentCount) {
  const textLength = getScheduleSegmentTextLength(segment.name);
  if (segmentCount < 3 && textLength > 0 && textLength < 3) {
    return "seg-label-large";
  }
  if (segmentCount < 3 && textLength === 3) {
    return "seg-label-medium";
  }
  return "";
}

function renderCellInner(key, memberId = "", day = 0, slotOverride = null, isPreview = false) {
  const cellState = slotOverride || state.schedule[key];
  if (!cellState) {
    return '<div class="cell-inner"></div>';
  }
  const segments = [];
  if (cellState.shift) {
    const shift = getItem("shift", cellState.shift);
    if (shift) {
      segments.push({
        category: "shift",
        name: shift.name,
        color: shift.color,
        textColor: getItemTextColor(shift, shift.color)
      });
    }
  }
  if (cellState.leave) {
    const leave = getItem("leave", cellState.leave);
    if (leave) {
      segments.push({
        category: "leave",
        name: cellState.leaveMeta?.displayName || leave.name,
        color: leave.color,
        textColor: getItemTextColor(leave, leave.color)
      });
    }
  }
  if (cellState.overtime) {
    const overtime = getItem("overtime", cellState.overtime);
    const color = overtime?.color || "#D85A30";
    segments.push({
      category: "overtime",
      name: overtime?.name || cellState.overtimeMeta?.displayName || "加班",
      color,
      textColor: getItemTextColor(overtime, color)
    });
  }
  if (!segments.length) {
    return '<div class="cell-inner"></div>';
  }
  const visibleSegments = segments.slice(0, 3);
  return `<div class="cell-inner">${visibleSegments.map((segment) => (
    `<div class="seg" style="background-color:${segment.color};color:${segment.textColor || textColor(segment.color)}" ${
      segment.category === "leave" && !isPreview && shouldPromptLeaveDetail(segment, cellState.leaveMeta)
        ? `data-hover-schedule-detail="${memberId}:${day}:leave"`
        : segment.category === "overtime" && !isPreview && cellState.overtimeMeta
          ? `data-hover-schedule-detail="${memberId}:${day}:overtime"`
          : ""
    }><span class="seg-label ${getScheduleSegmentSizeClass(segment, visibleSegments.length)}">${escapeHtml(segment.name)}</span></div>`
  )).join("")}</div>`;
}

function renderTable() {
  hideLeaveTooltip();
  const table = document.getElementById("mainTable");
  const visibleDates = getVisibleDates();
  const days = visibleDates.length;
  const today = getTodayDateString();

  let html = '<colgroup><col class="col-dept"><col class="col-person">';
  if (state.tableView === "member" && state.tableStatsVisible) {
    html += '<col class="col-stats">';
  }
  visibleDates.forEach(() => {
    html += '<col class="col-day">';
  });
  html += "</colgroup><tbody>";

  if (state.tableView === "shift") {
    const shifts = getVisibleShiftRows();
    if (!shifts.length) {
      html += `<tr><td class="empty-table" colspan="${days + 2}">目前沒有符合範圍的班別</td></tr>`;
    } else {
      shifts.forEach((shift) => {
        html += "<tr>";
        html += `<td class="dept-col">${escapeHtml(shift.name)}</td>`;
        html += `<td class="person-col demand-col">${escapeHtml(String(shift.requiredStaffCount ?? 0))}</td>`;
        visibleDates.forEach((dateString, index) => {
          const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, index, days);
          const shiftViewCellState = getShiftViewCellState(shift, dateString);
          const inactiveClass = shiftViewCellState.isOperating ? "" : "inactive-cell";
          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members)}</td>`;
        });
        html += "</tr>";
      });
    }
  } else {
    const groups = getVisibleTableGroups();
    const canEditScheduleOrder = canEditSchedule();
    const orderDragClass = canEditScheduleOrder ? " schedule-order-drag" : "";
    const draggableAttr = canEditScheduleOrder ? ' draggable="true"' : "";
    let rowIndex = 0;
    if (!groups.length) {
      html += `<tr><td class="empty-table" colspan="${days + 2 + (state.tableStatsVisible ? 1 : 0)}">${state.tableDeptScopeFilter === "all" ? "目前還沒有人員" : "目前週期沒有排到此單位班別的人員"}</td></tr>`;
    } else {
      groups.forEach(({ department, members }) => {
        members.forEach((member, index) => {
          html += `<tr class="${member.payByDay ? "pay-daily-row" : ""}">`;
          if (index === 0) {
            const departmentEditAttrs = canEditScheduleOrder ? ` data-table-department-id="${escapeHtml(department.id)}"` : "";
            html += `<td class="dept-col${orderDragClass}"${draggableAttr} rowspan="${members.length}"${departmentEditAttrs}>${escapeHtml(department.name)}</td>`;
          }
          const memberEditAttrs = canEditScheduleOrder
            ? ` data-table-member-id="${escapeHtml(member.id)}" data-table-member-department-id="${escapeHtml(getMemberHomeDeptId(member))}"`
            : "";
          html += `<td class="person-col${orderDragClass}"${draggableAttr}${memberEditAttrs}><div class="member-label">${memberLabel(member)}</div></td>`;
          if (state.tableStatsVisible) {
            html += `<td class="stats-col">${renderMemberStats(member)}</td>`;
          }
          visibleDates.forEach((dateString, dateIndex) => {
            const active = isMemberActiveOnDateString(member, dateString);
            const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, dateIndex, days);
            if (!active) {
              html += `<td class="cell inactive-cell ${weekBoundaryClass}" data-disabled="true" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}"><div class="cell-inner"></div></td>`;
              return;
            }
            const key = getScheduleKeyForDateString(member.id, dateString);
            const previewSlot = getPreviewSlotByKey(key);
            const displayedSlot = previewSlot || state.schedule[key] || null;
            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            html += `<td class="cell ${previewClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;
          });
          html += "</tr>";
          rowIndex += 1;
        });
      });
    }
  }

  html += "</tbody>";
  table.innerHTML = html;
  syncScheduleColumnWidths();
  renderStickyTableHeader(visibleDates);
  syncScheduleRangeSelectionUi();
}

function renderHeader() {
  const { startDate, endDate } = getVisibleDateRange();
  document.getElementById("monthTitle").textContent = `${startDate} ～ ${endDate}`;
  document.getElementById("dbHint").textContent = "";
  renderAuthBar();
}

function renderAll() {
  renderHeader();
  renderToolbar();
  renderTable();
  renderAuthGate();
}

function ensureScheduleSlot(memberId, day) {
  const key = getScheduleKeyForDateString(memberId, normalizeScheduleDateInput(day));
  if (!key) {
    return null;
  }
  if (!state.schedule[key]) {
    state.schedule[key] = { shift: null, leave: null, overtime: null };
  }
  return state.schedule[key];
}

function pruneEmptySchedule() {
  Object.keys(state.schedule).forEach((key) => {
    const slot = state.schedule[key];
    if (!slot || (!slot.shift && !slot.leave && !slot.overtime)) {
      delete state.schedule[key];
    }
  });
}

function buildPersistedState() {
  const nextState = {
    ...state,
    schedule: {}
  };
  Object.entries(state.schedule || {}).forEach(([key, slot]) => {
    if (!slot) {
      return;
    }
    const nextSlot = {
      shift: slot.shift || null,
      leave: slot.leave || null,
      overtime: slot.overtime || null
    };
    if (nextSlot.leave && slot.leaveMeta) {
      nextSlot.leaveMeta = {
        ...slot.leaveMeta
      };
    }
    if (nextSlot.overtime && slot.overtimeMeta) {
      nextSlot.overtimeMeta = {
        ...slot.overtimeMeta
      };
    }
    if (nextSlot.shift || nextSlot.leave || nextSlot.overtime) {
      nextState.schedule[key] = nextSlot;
    }
  });
  return nextState;
}

function queueSave() {
  if (!canEditSchedule()) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void forceSave();
}

function clearLegacyLeaveFromSlot(slot) {
  if (!slot) {
    return;
  }
  slot.leave = null;
  slot.leaveMeta = null;
}

function clearLegacyOvertimeFromSlot(slot) {
  if (!slot) {
    return;
  }
  slot.overtime = null;
  slot.overtimeMeta = null;
}

async function applySelectionToCell(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  if (!canEditSchedule()) {
    return;
  }
  const member = state.members.find((item) => item.id === memberId);
  if (!member || !isMemberActiveOnDateString(member, dateString)) {
    return;
  }
  if (!state.selected.type) {
    return;
  }
  const slot = ensureScheduleSlot(memberId, dateString);
  if (!slot) {
    return;
  }
  const { type, id } = state.selected;
  if (type === "leave") {
    const leave = getItem("leave", id);
    if (!leave) {
      return;
    }
    try {
      if (slot.leave === id) {
        clearLegacyLeaveFromSlot(slot);
        await finishScheduleCellMutation(memberId, dateString);
        return;
      } else if (shouldPromptLeaveDetail(leave, null)) {
        openLeaveAssignmentModal(memberId, dateString, id);
        return;
      } else {
        slot.leave = id;
        slot.leaveMeta = {
          allDay: defaultLeaveIsAllDay(leave),
          startTime: "",
          endTime: "",
          reason: ""
        };
      }
      await finishScheduleCellMutation(memberId, dateString);
    } catch (error) {
      showInfoMessage(`設定請假失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "shift") {
    const nextShiftId = slot.shift === id ? null : id;
    slot.shift = nextShiftId;
    try {
      await finishScheduleCellMutation(memberId, dateString);
    } catch (error) {
      showInfoMessage(`設定班別失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "overtime") {
    const nextOvertimeId = slot.overtime === id ? null : id;
    try {
      if (nextOvertimeId) {
        const overtime = getItem("overtime", nextOvertimeId) || state.overtime[0];
        slot.overtime = nextOvertimeId;
        slot.overtimeMeta = {
          startTime: slot.overtimeMeta?.startTime || overtime?.startTime || "",
          endTime: slot.overtimeMeta?.endTime || overtime?.endTime || "",
          useRest1: slot.overtimeMeta?.useRest1 ?? Boolean(overtime?.useRest1),
          rest1StartTime: slot.overtimeMeta?.rest1StartTime || overtime?.rest1StartTime || "",
          rest1EndTime: slot.overtimeMeta?.rest1EndTime || overtime?.rest1EndTime || "",
          useRest2: slot.overtimeMeta?.useRest2 ?? Boolean(overtime?.useRest2),
          rest2StartTime: slot.overtimeMeta?.rest2StartTime || overtime?.rest2StartTime || "",
          rest2EndTime: slot.overtimeMeta?.rest2EndTime || overtime?.rest2EndTime || "",
          reason: slot.overtimeMeta?.reason || ""
        };
      } else {
        clearLegacyOvertimeFromSlot(slot);
      }
      await finishScheduleCellMutation(memberId, dateString);
    } catch (error) {
      showInfoMessage(`設定加班失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "cancel-shift") {
    slot.shift = null;
    try {
      await finishScheduleCellMutation(memberId, dateString);
    } catch (error) {
      showInfoMessage(`清除班別失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-leave") {
    try {
      clearLegacyLeaveFromSlot(slot);
      await finishScheduleCellMutation(memberId, dateString);
    } catch (error) {
      showInfoMessage(`清除請假失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-overtime") {
    try {
      clearLegacyOvertimeFromSlot(slot);
      await finishScheduleCellMutation(memberId, dateString);
    } catch (error) {
      showInfoMessage(`清除加班失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
}

function selectChip(type, id) {
  if (!canEditSchedule()) {
    return;
  }
  clearScheduleRangeSelection();
  if (state.selected.type === type && state.selected.id === id) {
    clearSelectedChip();
    return;
  } else {
    state.selected = { type, id };
  }
  renderToolbar();
  renderTable();
}

function removeAssignmentsByItem(category, id) {
  Object.values(state.schedule).forEach((slot) => {
    if (slot[category] === id) {
      slot[category] = null;
      if (category === "leave") {
        slot.leaveMeta = null;
      }
    }
  });
  pruneEmptySchedule();
}

function openEntityListModal(config) {
  const headerButtons = config.headerButtons || "";
  const headerActionBlock = headerButtons
    ? `<div class="modal-header-actions">${headerButtons}</div>`
    : '<div class="modal-header-actions"></div>';
  const closeButton = `
    <div class="modal-header-close">
      <button class="settings-icon-btn modal-close-btn" type="button" data-close-button="true" aria-label="關閉" title="關閉">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12"></path>
          <path d="M18 6l-12 12"></path>
        </svg>
      </button>
    </div>
  `;
  const showFooter = !config.hideFooterClose || config.footerButtons;
  setModal(`
    <div class="modal-overlay" data-close-modal="true">
      <div class="${config.modalClass || "modal modal-wide"}">
        <div class="modal-header">
          <h3>${escapeHtml(config.title)}</h3>
          <div class="modal-header-tools">
            ${headerActionBlock}
            ${closeButton}
          </div>
        </div>
        <div class="modal-body">
          ${config.description ? `<p class="modal-description">${escapeHtml(config.description)}</p>` : ""}
          ${config.body}
        </div>
        ${showFooter ? `
          <div class="modal-footer">
            ${config.hideFooterClose ? "" : '<button class="btn-cancel" type="button" data-close-button="true">關閉</button>'}
            ${config.footerButtons || ""}
          </div>
        ` : ""}
      </div>
    </div>
  `);
}

function syncLeaveAssignmentModalUi() {
  const allDay = document.getElementById("leaveAssignmentAllDay")?.checked;
  const reasonEnabled = document.getElementById("leaveAssignmentReasonEnabled")?.checked;
  const timeSection = document.getElementById("leaveAssignmentTimeSection");
  const reasonSection = document.getElementById("leaveAssignmentReasonSection");
  const reasonInput = document.getElementById("leaveAssignmentReason");

  if (timeSection) {
    timeSection.style.display = allDay ? "none" : "";
  }
  setTimeInputDisabled("leaveAssignmentStartTime", Boolean(allDay));
  setTimeInputDisabled("leaveAssignmentEndTime", Boolean(allDay));
  if (reasonSection) {
    reasonSection.style.display = reasonEnabled ? "" : "none";
  }
  if (reasonInput) {
    if (reasonEnabled) {
      reasonInput.disabled = false;
      reasonInput.removeAttribute("disabled");
      reasonInput.readOnly = false;
      reasonInput.style.pointerEvents = "auto";
    } else {
      reasonInput.disabled = true;
      reasonInput.setAttribute("disabled", "disabled");
      reasonInput.style.pointerEvents = "none";
    }
  }
}

function syncOvertimeFormUi() {
  const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked);
  const rest1Fields = document.getElementById("overtimeRest1Fields");
  const rest2Fields = document.getElementById("overtimeRest2Fields");
  const rest2Toggle = document.getElementById("overtimeUseRest2");
  const rest1Inputs = ["overtimeRest1StartTime", "overtimeRest1EndTime"];
  const rest2Inputs = ["overtimeRest2StartTime", "overtimeRest2EndTime"];

  if (rest1Fields) {
    rest1Fields.style.display = useRest1 ? "" : "none";
  }
  rest1Inputs.forEach((id) => setTimeInputDisabled(id, !useRest1));

  if (!useRest1) {
    if (rest2Toggle) {
      rest2Toggle.checked = false;
      rest2Toggle.disabled = true;
    }
    if (rest2Fields) {
      rest2Fields.style.display = "none";
    }
    rest2Inputs.forEach((id) => setTimeInputDisabled(id, true));
    return;
  }

  if (rest2Toggle) {
    rest2Toggle.disabled = false;
  }
  if (rest2Fields) {
    rest2Fields.style.display = useRest2 ? "" : "none";
  }
  rest2Inputs.forEach((id) => setTimeInputDisabled(id, !useRest2));
}

function openLeaveAssignmentModal(memberId, day, leaveId) {
  const dateString = normalizeScheduleDateInput(day);
  const member = state.members.find((item) => item.id === memberId);
  const leave = getItem("leave", leaveId);
  if (!member || !leave) {
    return;
  }

  const slot = getSlot(memberId, dateString);
  const existingMeta = slot?.leave === leaveId ? slot.leaveMeta || null : null;
  const defaultAllDay = existingMeta?.allDay ?? defaultLeaveIsAllDay(leave);
  const reasonEnabled = existingMeta?.reasonEnabled ?? leave.requireReason;
  const startTime = existingMeta?.startTime || "";
  const endTime = existingMeta?.endTime || "";
  const reason = existingMeta?.reason || "";

  modalContext = {
    category: "leave-assignment",
    memberId,
    day: dateString,
    leaveId
  };
  openEntityListModal({
    title: "休假明細",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label>假別</label>
        <div class="readonly-pill">${escapeHtml(member.name)} · ${escapeHtml(formatDateTextFromIso(dateString))} · ${escapeHtml(getLeaveLabel(leave))}</div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="leaveAssignmentAllDay" type="checkbox" ${defaultAllDay ? "checked" : ""}>
          整天
        </label>
      </div>
      <div class="form-grid" id="leaveAssignmentTimeSection" style="${defaultAllDay ? "display:none;" : ""}">
        <div class="form-row">
          <label for="leaveAssignmentStartTime">開始時間</label>
          ${timeInputMarkup("leaveAssignmentStartTime", startTime, defaultAllDay)}
        </div>
        <div class="form-row">
          <label for="leaveAssignmentEndTime">結束時間</label>
          ${timeInputMarkup("leaveAssignmentEndTime", endTime, defaultAllDay)}
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="leaveAssignmentReasonEnabled" type="checkbox" ${reasonEnabled ? "checked" : ""}>
          原因
        </label>
      </div>
      <div class="form-row" id="leaveAssignmentReasonSection" style="${reasonEnabled ? "" : "display:none;"}">
        <label for="leaveAssignmentReason">原因內容</label>
        <input id="leaveAssignmentReason" type="text" maxlength="60" value="${escapeHtml(reason)}" ${reasonEnabled ? "" : "disabled"} placeholder="請輸入原因">
      </div>
    `,
    footerButtons: `<button class="btn-primary" type="button" data-save-leave-assignment="true">儲存</button>`
  });
  syncLeaveAssignmentModalUi();
}

async function saveLeaveAssignmentFromModal() {
  const { memberId, day, leaveId } = modalContext;
  const allDay = document.getElementById("leaveAssignmentAllDay")?.checked !== false;
  const reasonEnabled = Boolean(document.getElementById("leaveAssignmentReasonEnabled")?.checked);
  const startTime = readTimeInputValue("leaveAssignmentStartTime");
  const endTime = readTimeInputValue("leaveAssignmentEndTime");
  if (!allDay && !isValidTimeRange(startTime, endTime)) {
    reportValidationError("開始時間必須早於結束時間");
    return;
  }

  try {
    const dateString = normalizeScheduleDateInput(day);
    const slot = ensureScheduleSlot(memberId, dateString);
    const leave = getItem("leave", leaveId);
    if (!slot || !leave) {
      throw new Error("找不到班表格子或假別");
    }
    slot.leave = leaveId;
    slot.leaveMeta = {
      leaveCode: leave.code || "",
      displayName: leave.name,
      displayColor: leave.color || "",
      displayTextColor: getItemTextColor(leave, leave.color),
      allDay,
      startTime: allDay ? "" : startTime,
      endTime: allDay ? "" : endTime,
      reasonEnabled,
      reason: reasonEnabled ? (document.getElementById("leaveAssignmentReason")?.value.trim() || "") : ""
    };
    closeModal();
    renderScheduleCell(memberId, dateString);
    await persistScheduleCell(memberId, dateString);
  } catch (error) {
    reportValidationError(`儲存休假失敗：${formatSchedulerError(error, "儲存失敗")}`);
  }
}

function openOvertimeAssignmentModal(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  const member = state.members.find((item) => item.id === memberId);
  const slot = getSlot(memberId, dateString);
  const overtimeMeta = slot?.overtimeMeta || null;
  if (!member || !slot?.overtime) {
    return;
  }
  modalContext = {
    category: "overtime-assignment",
    memberId,
    day: dateString
  };
  openEntityListModal({
    title: "修改加班",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label>人員</label>
        <div class="readonly-pill">${escapeHtml(member.name)} · ${escapeHtml(formatDateTextFromIso(dateString))}</div>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="scheduleOvertimeStartTime">加班開始</label>
          ${timeInputMarkup("scheduleOvertimeStartTime", overtimeMeta?.startTime || "")}
        </div>
        <div class="form-row">
          <label for="scheduleOvertimeEndTime">加班結束</label>
          ${timeInputMarkup("scheduleOvertimeEndTime", overtimeMeta?.endTime || "")}
        </div>
      </div>
      <div class="form-section">
        <div class="form-row checkbox-row">
          <label class="overtime-use-label">
            <input id="scheduleOvertimeUseRest1" type="checkbox" ${overtimeMeta?.useRest1 ? "checked" : ""}>
            使用休息1
          </label>
        </div>
        <div class="form-grid" id="scheduleOvertimeRest1Fields" style="${overtimeMeta?.useRest1 ? "" : "display:none;"}">
          <div class="form-row">
            <label for="scheduleOvertimeRest1StartTime">休息1開始</label>
            ${timeInputMarkup("scheduleOvertimeRest1StartTime", overtimeMeta?.rest1StartTime || "", !overtimeMeta?.useRest1)}
          </div>
          <div class="form-row">
            <label for="scheduleOvertimeRest1EndTime">休息1結束</label>
            ${timeInputMarkup("scheduleOvertimeRest1EndTime", overtimeMeta?.rest1EndTime || "", !overtimeMeta?.useRest1)}
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-row checkbox-row">
          <label class="overtime-use-label">
            <input id="scheduleOvertimeUseRest2" type="checkbox" ${overtimeMeta?.useRest1 && overtimeMeta?.useRest2 ? "checked" : ""} ${overtimeMeta?.useRest1 ? "" : "disabled"}>
            使用休息2
          </label>
        </div>
        <div class="form-grid" id="scheduleOvertimeRest2Fields" style="${overtimeMeta?.useRest1 && overtimeMeta?.useRest2 ? "" : "display:none;"}">
          <div class="form-row">
            <label for="scheduleOvertimeRest2StartTime">休息2開始</label>
            ${timeInputMarkup("scheduleOvertimeRest2StartTime", overtimeMeta?.rest2StartTime || "", !(overtimeMeta?.useRest1 && overtimeMeta?.useRest2))}
          </div>
          <div class="form-row">
            <label for="scheduleOvertimeRest2EndTime">休息2結束</label>
            ${timeInputMarkup("scheduleOvertimeRest2EndTime", overtimeMeta?.rest2EndTime || "", !(overtimeMeta?.useRest1 && overtimeMeta?.useRest2))}
          </div>
        </div>
      </div>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-save-overtime-assignment="true">儲存</button>'
  });
  syncScheduleOvertimeFormUi();
}

async function saveOvertimeAssignmentFromModal() {
  const { memberId, day } = modalContext;
  const startTime = readTimeInputValue("scheduleOvertimeStartTime");
  const endTime = readTimeInputValue("scheduleOvertimeEndTime");
  const useRest1 = Boolean(document.getElementById("scheduleOvertimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("scheduleOvertimeUseRest2")?.checked) && useRest1;
  const rest1StartTime = readTimeInputValue("scheduleOvertimeRest1StartTime");
  const rest1EndTime = readTimeInputValue("scheduleOvertimeRest1EndTime");
  const rest2StartTime = readTimeInputValue("scheduleOvertimeRest2StartTime");
  const rest2EndTime = readTimeInputValue("scheduleOvertimeRest2EndTime");
  if (!memberId || !day) {
    reportValidationError("請確認加班資料");
    return;
  }
  if (!isValidTimeRange(startTime, endTime)) {
    reportValidationError("加班開始時間必須早於加班結束時間");
    return;
  }
  if (useRest1 && !isValidTimeRange(rest1StartTime, rest1EndTime)) {
    reportValidationError("休息1開始時間必須早於結束時間");
    return;
  }
  if (useRest2 && !isValidTimeRange(rest2StartTime, rest2EndTime)) {
    reportValidationError("休息2開始時間必須早於結束時間");
    return;
  }
  try {
    const dateString = normalizeScheduleDateInput(day);
    const slot = getSlot(memberId, dateString);
    const overtime = getItem("overtime", slot?.overtime) || state.overtime[0];
    if (!slot || !overtime) {
      throw new Error("找不到班表格子或加班類型");
    }
    slot.overtime = overtime.id;
    slot.overtimeMeta = {
      displayName: overtime.name || "加班",
      displayColor: overtime.color || "#D85A30",
      displayTextColor: getItemTextColor(overtime, overtime.color || "#D85A30"),
      startTime,
      endTime,
      useRest1,
      rest1StartTime: useRest1 ? rest1StartTime : "",
      rest1EndTime: useRest1 ? rest1EndTime : "",
      useRest2,
      rest2StartTime: useRest2 ? rest2StartTime : "",
      rest2EndTime: useRest2 ? rest2EndTime : "",
      reason: slot.overtimeMeta?.reason || ""
    };
    closeModal();
    renderScheduleCell(memberId, dateString);
    await persistScheduleCell(memberId, dateString);
  } catch (error) {
    reportValidationError(`儲存加班失敗：${formatSchedulerError(error, "儲存失敗")}`);
  }
}

function openListSettings(category) {
  modalContext = { category: "list-settings", listCategory: category };
  const titleMap = {
    shift: "班別設定",
    leave: "假別設定",
    overtime: "加班設定"
  };
  const list = getItemList(category);
  const body = list.length
      ? `
        <div class="settings-table-wrap">
          <div class="settings-table-scroll">
            <div class="settings-table">
              <div class="settings-table-row settings-table-head settings-table-row-${category}">
                <div>預覽</div>
                ${category === "leave" ? "<div>假別代碼</div>" : ""}
                <div>${category === "shift" ? "班別" : category === "leave" ? "假別" : "加班"}</div>
                <div>${category === "shift" ? "適用單位" : category === "leave" ? "需填時間" : "時段"}</div>
                ${category === "shift" ? "<div>需求人數</div>" : ""}
                ${category === "overtime" ? "<div>休息1</div><div>休息2</div>" : ""}
                ${category === "shift" ? "<div>時段</div>" : ""}
                ${category === "leave" ? "<div>需填原因</div>" : ""}
                <div>不顯示</div>
                <div class="settings-table-actions-head">操作</div>
              </div>
              ${list.map((item) => `
                <div class="settings-table-row settings-table-row-${category} sortable-settings-item" draggable="true" data-sort-category="${category}" data-sort-item="${item.id}">
                  <div class="settings-table-color">
                    <div class="settings-table-preview" style="background:${escapeHtml(item.color)};color:${escapeHtml(getItemTextColor(item, item.color))}">${escapeHtml(item.name || item.code || "名稱")}</div>
                  </div>
                  ${category === "leave" ? `<div class="settings-table-code">${escapeHtml(item.code || "")}</div>` : ""}
                  <div class="settings-table-name">${escapeHtml(category === "leave" ? getLeaveCatalogDisplayName(item) : item.name)}</div>
                  <div class="settings-table-meta">${category === "shift"
                    ? escapeHtml(getDepartmentSummary(item.applicableDeptIds))
                    : category === "leave"
                      ? (item.defaultAllDay ? "是" : "否")
                      : escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)
                  }</div>
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(String(item.requiredStaffCount ?? 0))}</div>`
                    : ""}
                  ${category === "overtime"
                    ? `<div class="settings-table-meta">${item.useRest1 ? escapeHtml(`${item.rest1StartTime || "--:--"} - ${item.rest1EndTime || "--:--"}`) : "-"}</div>
                       <div class="settings-table-meta">${item.useRest2 ? escapeHtml(`${item.rest2StartTime || "--:--"} - ${item.rest2EndTime || "--:--"}`) : "-"}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)}</div>`
                    : ""}
                  ${category === "leave"
                    ? `<div class="settings-table-meta">${item.requireReason ? "是" : "否"}</div>`
                    : ""}
                  <div class="settings-table-meta">${item.hiddenFromToolbar ? "是" : "否"}</div>
                  <div class="settings-table-actions">
                    ${renderActionIconButton("edit", `data-edit-item="${category}" data-edit-id="${item.id}"`)}
                    ${renderActionIconButton("delete", `data-delete-category="${category}" data-delete-id="${item.id}"`)}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `
      : '<div class="empty-state">目前還沒有資料</div>';

  openEntityListModal({
    title: titleMap[category],
    modalClass: category === "shift" || category === "leave" || category === "overtime"
      ? "modal modal-wide catalog-settings-modal"
      : undefined,
    body,
    headerButtons: `
      <button class="ghost-btn compact-btn" type="button" data-export-settings="${category}">匯出</button>
      <button class="ghost-btn compact-btn" type="button" data-import-settings="${category}">匯入</button>
      <button class="btn-primary" type="button" data-open-add="${category}">新增${escapeHtml(titleMap[category].replace("設定", ""))}</button>
    `,
    hideFooterClose: true
  });
}

function readApplicableDepartmentInput() {
  const selectedDeptId = document.getElementById("shiftApplicableDept")?.value || "";
  return selectedDeptId ? [selectedDeptId] : [];
}

function renderColorPreviewFields(category, previewText) {
  return `
    <div class="form-row form-row-compact leave-preview-row">
      <label>預覽</label>
      <div class="leave-preview-wrap">
        <div class="leave-preview" data-color-preview="${category}" style="background:${escapeHtml(modalColor)};color:${escapeHtml(modalTextColor)}">
          <span data-color-preview-text="${category}">${escapeHtml(previewText)}</span>
        </div>
        <div class="leave-color-actions">
          <button class="ghost-btn leave-color-btn" type="button" data-open-item-color="bg">底色</button>
          <input class="hidden-color-input leave-color-input" type="color" value="${escapeHtml(modalColor)}" data-item-color-input="bg">
          <button class="ghost-btn leave-color-btn" type="button" data-open-item-color="text">字色</button>
          <input class="hidden-color-input leave-color-input" type="color" value="${escapeHtml(modalTextColor)}" data-item-color-input="text">
          <button class="ghost-btn leave-color-btn" type="button" data-set-auto-item-text="true">自動字色</button>
        </div>
      </div>
    </div>
  `;
}

function renderActionIconButton(kind, attrs, extraClass = "") {
  const title = kind === "delete" ? "刪除" : "修改";
  const dangerClass = kind === "delete" ? " settings-icon-btn-danger" : "";
  const icon = kind === "delete"
    ? `
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 13h8l1-13"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    `
    : `
      <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path>
      <path d="M13.5 6.5l4 4"></path>
    `;
  return `
    <button class="settings-icon-btn${dangerClass}${extraClass ? ` ${extraClass}` : ""}" type="button" ${attrs} aria-label="${title}" title="${title}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        ${icon}
      </svg>
    </button>
  `;
}

function syncNamedColorUi() {
  const preview = document.querySelector("[data-color-preview]");
  const previewText = document.querySelector("[data-color-preview-text]");
  const bgInput = document.querySelector('[data-item-color-input="bg"]');
  const textInput = document.querySelector('[data-item-color-input="text"]');
  if (modalTextColorAuto) {
    modalTextColor = autoLeaveTextColor(modalColor);
  }
  const fallbackName = modalContext.category === "shift"
    ? "班別"
    : modalContext.category === "overtime"
      ? "加班"
      : "名稱";
  const displayName = modalContext.category === "leave"
    ? (document.getElementById("leaveCatalogName")?.value.trim() || "名稱")
    : modalContext.category === "shift"
      ? (document.getElementById("shiftName")?.value.trim() || fallbackName)
      : (document.getElementById("namedItemName")?.value.trim() || fallbackName);
  if (preview) {
    preview.style.background = modalColor;
    preview.style.color = modalTextColor;
  }
  if (previewText) {
    previewText.textContent = displayName;
  }
  if (bgInput) {
    bgInput.value = modalColor;
  }
  if (textInput) {
    textInput.value = modalTextColor;
  }
}

function openShiftFormModal(mode, shiftId = "") {
  const returnTo = modalContext?.category === "list-settings"
    ? captureSettingsReturnContext({ category: "list-settings", listCategory: "shift" })
    : null;
  const shift = mode === "edit"
    ? state.shifts.find((item) => item.id === shiftId)
    : {
      id: "",
      name: "",
      color: COLORS[0].hex,
      startTime: "",
      endTime: "",
      hiddenFromToolbar: false,
      requiredStaffCount: 1,
      applicableDeptIds: [state.deptFilter !== "all" ? state.deptFilter : (state.departments[0]?.id || "")].filter(Boolean),
      positionRequirements: []
    };
  if (!shift) {
    return;
  }
  modalColor = shift.color;
  modalTextColorAuto = shift.autoTextColor ?? !shift.textColor;
  modalTextColor = shift.textColor || autoLeaveTextColor(shift.color);
  modalContext = { mode, category: "shift", targetId: shiftId, returnTo };

  openEntityListModal({
    title: mode === "edit" ? "修改班別" : "新增班別",
    modalClass: "modal modal-wide modal-form-compact settings-edit-form",
    body: `
      ${renderColorPreviewFields("shift", shift.name || "班別")}
      <div class="form-row">
        <label for="shiftApplicableDept">適用單位</label>
        <select id="shiftApplicableDept">${buildSelectOptions(state.departments, "id", (item) => item.name, shift.applicableDeptIds?.[0] || "")}</select>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="shiftName">名稱</label>
          <textarea id="shiftName" class="single-line-textarea" rows="1" maxlength="12" lang="zh-Hant" spellcheck="false" placeholder="請輸入班別">${escapeHtml(shift.name)}</textarea>
        </div>
        <div class="form-row">
          <label for="shiftRequiredStaffCount">需求人數</label>
          <input id="shiftRequiredStaffCount" type="number" min="0" max="99" step="1" value="${escapeHtml(String(shift.requiredStaffCount ?? 1))}">
        </div>
      </div>
      <div class="form-section">
      <div class="form-grid">
        <div class="form-row">
          <label for="shiftStartTime">上班時間</label>
          ${timeInputMarkup("shiftStartTime", shift.startTime || "")}
        </div>
        <div class="form-row">
          <label for="shiftEndTime">下班時間</label>
          ${timeInputMarkup("shiftEndTime", shift.endTime || "")}
        </div>
      </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="shiftHiddenFromToolbar" type="checkbox" ${shift.hiddenFromToolbar ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-shift="${mode}">${mode === "edit" ? "儲存修改" : "新增班別"}</button>`,
    hideFooterClose: true
  });
  syncNamedColorUi();
}

function saveShiftFromModal(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("shiftName")?.value.trim();
  if (!name) {
    document.getElementById("shiftName")?.focus();
    return;
  }
  const startTime = readTimeInputValue("shiftStartTime");
  const endTime = readTimeInputValue("shiftEndTime");
  if (!isValidTimeRange(startTime, endTime)) {
    reportValidationError("上班時間必須早於下班時間");
    return;
  }
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("s"),
    name,
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    startTime,
    endTime,
    hiddenFromToolbar: Boolean(document.getElementById("shiftHiddenFromToolbar")?.checked),
    requiredStaffCount: Math.max(0, Number(document.getElementById("shiftRequiredStaffCount")?.value || 0)),
    applicableDeptIds: readApplicableDepartmentInput(),
    positionRequirements: []
  };

  if (mode === "edit") {
    state.shifts = state.shifts.map((shift) => shift.id === payload.id ? payload : shift);
  } else {
    state.shifts.push(payload);
  }
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo || { category: "list-settings", listCategory: "shift" });
  queueSave();
}

function openNamedColorFormModal(category, mode, targetId = "") {
  const returnTo = modalContext?.category === "list-settings"
    ? captureSettingsReturnContext({ category: "list-settings", listCategory: category })
    : null;
  const list = getItemList(category);
  const item = mode === "edit"
    ? list.find((entry) => entry.id === targetId)
    : {
      id: "",
      code: LEAVE_CATALOG[0].code,
      name: LEAVE_CATALOG[0].name,
      color: COLORS[0].hex,
      defaultAllDay: false,
      requireReason: false,
      hiddenFromToolbar: false,
      startTime: "",
      endTime: "",
      useRest1: false,
      rest1StartTime: "",
      rest1EndTime: "",
      useRest2: false,
      rest2StartTime: "",
      rest2EndTime: ""
    };
  if (!item) {
    return;
  }
  modalColor = item.color;
  modalTextColorAuto = item.autoTextColor ?? !item.textColor;
  modalTextColor = item.textColor || autoLeaveTextColor(item.color);
  modalContext = { category, mode, targetId, returnTo };
  const titleMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  openEntityListModal({
      title: `${mode === "edit" ? "修改" : "新增"}${titleMap[category]}`,
    modalClass: category === "leave" || category === "overtime"
        ? "modal modal-wide modal-form-compact settings-edit-form"
        : "modal modal-wide",
      body: `
      ${renderColorPreviewFields(category, item.name || (category === "overtime" ? "加班" : "名稱"))}
      <div class="form-row">
        <label for="${category === "leave" ? "leaveCatalogCode" : "namedItemName"}">${category === "leave" ? "假別" : "名稱"}</label>
        ${category === "leave"
          ? `<select id="leaveCatalogCode">${buildSelectOptions(LEAVE_CATALOG, "code", (entry) => `${entry.code} ${entry.name}`, item.code || "")}</select>`
          : `<textarea id="namedItemName" class="single-line-textarea" rows="1" maxlength="12" lang="zh-Hant" spellcheck="false" placeholder="請輸入名稱">${escapeHtml(item.name)}</textarea>`
        }
      </div>
      ${category === "leave" ? `
        <div class="form-row">
          <label for="leaveCatalogName">名稱</label>
          <input id="leaveCatalogName" type="text" maxlength="20" placeholder="請輸入名稱" value="${escapeHtml(item.name || LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || "")}">
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveDefaultAllDay" type="checkbox" ${item.defaultAllDay ? "checked" : ""}>
              需填時間
            </label>
          </div>
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveRequireReason" type="checkbox" ${item.requireReason ? "checked" : ""}>
              需填原因
            </label>
          </div>
        </div>
      ` : ""}
      ${category === "overtime" ? `
        <div class="form-section">
          <div class="form-grid">
            <div class="form-row">
              <label for="overtimeStartTime">上班時間</label>
              ${timeInputMarkup("overtimeStartTime", item.startTime || "")}
            </div>
            <div class="form-row">
              <label for="overtimeEndTime">下班時間</label>
              ${timeInputMarkup("overtimeEndTime", item.endTime || "")}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row">
            <label class="overtime-use-label">
              <input id="overtimeUseRest1" type="checkbox" ${item.useRest1 ? "checked" : ""}>
              使用休息1
            </label>
          </div>
          <div class="form-grid" id="overtimeRest1Fields" style="${item.useRest1 ? "" : "display:none;"}">
            <div class="form-row">
              <label for="overtimeRest1StartTime">休息1開始</label>
              ${timeInputMarkup("overtimeRest1StartTime", item.rest1StartTime || "", !item.useRest1)}
            </div>
            <div class="form-row">
              <label for="overtimeRest1EndTime">休息1結束</label>
              ${timeInputMarkup("overtimeRest1EndTime", item.rest1EndTime || "", !item.useRest1)}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row">
            <label class="overtime-use-label">
              <input id="overtimeUseRest2" type="checkbox" ${item.useRest1 && item.useRest2 ? "checked" : ""} ${item.useRest1 ? "" : "disabled"}>
              使用休息2
            </label>
          </div>
          <div class="form-grid" id="overtimeRest2Fields" style="${item.useRest1 && item.useRest2 ? "" : "display:none;"}">
            <div class="form-row">
              <label for="overtimeRest2StartTime">休息2開始</label>
              ${timeInputMarkup("overtimeRest2StartTime", item.rest2StartTime || "", !(item.useRest1 && item.useRest2))}
            </div>
            <div class="form-row">
              <label for="overtimeRest2EndTime">休息2結束</label>
              ${timeInputMarkup("overtimeRest2EndTime", item.rest2EndTime || "", !(item.useRest1 && item.useRest2))}
            </div>
          </div>
        </div>
      ` : ""}
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="${category}HiddenFromToolbar" type="checkbox" ${item.hiddenFromToolbar ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-named-item="${category}:${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
  if (category === "overtime") {
    syncOvertimeFormUi();
  }
  syncNamedColorUi();
}

function saveNamedColorItem(category, mode) {
  const returnTo = modalContext.returnTo || null;
  if (category === "shift") {
    saveShiftFromModal(mode);
    return;
  }
  const selectedLeave = category === "leave"
    ? LEAVE_CATALOG.find((entry) => entry.code === (document.getElementById("leaveCatalogCode")?.value || ""))
    : null;
  const name = category === "leave"
    ? (document.getElementById("leaveCatalogName")?.value.trim() || "")
    : (document.getElementById("namedItemName")?.value.trim() || "");
  if (!name) {
    document.getElementById(category === "leave" ? "leaveCatalogName" : "namedItemName")?.focus();
    return;
  }
  if (category === "overtime") {
    const startTime = readTimeInputValue("overtimeStartTime");
    const endTime = readTimeInputValue("overtimeEndTime");
    if (!isValidTimeRange(startTime, endTime)) {
      reportValidationError("上班時間必須早於下班時間");
      return;
    }
    const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
    const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked) && useRest1;
    if (useRest1) {
      const rest1Start = readTimeInputValue("overtimeRest1StartTime");
      const rest1End = readTimeInputValue("overtimeRest1EndTime");
      if (!isValidTimeRange(rest1Start, rest1End)) {
        reportValidationError("休息1開始時間必須早於結束時間");
        return;
      }
      if (useRest2) {
        const rest2Start = readTimeInputValue("overtimeRest2StartTime");
        const rest2End = readTimeInputValue("overtimeRest2EndTime");
        if (!isValidTimeRange(rest2Start, rest2End)) {
          reportValidationError("休息2開始時間必須早於結束時間");
          return;
        }
      }
    }
  }
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid(category[0]),
    code: category === "leave" ? selectedLeave?.code : undefined,
    name,
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    defaultAllDay: category === "leave" ? document.getElementById("leaveDefaultAllDay")?.checked : undefined,
    requireReason: category === "leave" ? document.getElementById("leaveRequireReason")?.checked : undefined,
    hiddenFromToolbar: Boolean(document.getElementById(`${category}HiddenFromToolbar`)?.checked),
    startTime: category === "overtime" ? readTimeInputValue("overtimeStartTime") : undefined,
    endTime: category === "overtime" ? readTimeInputValue("overtimeEndTime") : undefined,
    useRest1: category === "overtime" ? Boolean(document.getElementById("overtimeUseRest1")?.checked) : undefined,
    rest1StartTime: category === "overtime" ? readTimeInputValue("overtimeRest1StartTime") : undefined,
    rest1EndTime: category === "overtime" ? readTimeInputValue("overtimeRest1EndTime") : undefined,
    useRest2: category === "overtime" ? Boolean(document.getElementById("overtimeUseRest2")?.checked) : undefined,
    rest2StartTime: category === "overtime" ? readTimeInputValue("overtimeRest2StartTime") : undefined,
    rest2EndTime: category === "overtime" ? readTimeInputValue("overtimeRest2EndTime") : undefined
  };
  if (category === "overtime" && payload.useRest1 === false) {
    payload.useRest2 = false;
    payload.rest1StartTime = "";
    payload.rest1EndTime = "";
    payload.rest2StartTime = "";
    payload.rest2EndTime = "";
  } else if (category === "overtime" && payload.useRest2 === false) {
    payload.rest2StartTime = "";
    payload.rest2EndTime = "";
  }
  const currentList = getItemList(category);
  const nextList = mode === "edit"
    ? currentList.map((item) => item.id === payload.id ? payload : item)
    : [...currentList, payload];
  if (category === "leave") state.leaves = nextList;
  if (category === "overtime") state.overtime = nextList;
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo || { category: "list-settings", listCategory: category });
  queueSave();
  if (category === "leave" || category === "overtime") {
    syncScheduleCatalogs().catch((error) => setSaveStatus(`同步設定失敗：${error.message}`));
  }
}

async function deleteListItem(category, id) {
  const labelMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  const confirmed = await confirmAction(`確定要刪除這個${labelMap[category] || "項目"}嗎？`);
  if (!confirmed) {
    return;
  }
  if (category === "shift") state.shifts = state.shifts.filter((item) => item.id !== id);
  if (category === "leave") state.leaves = state.leaves.filter((item) => item.id !== id);
  if (category === "overtime") state.overtime = state.overtime.filter((item) => item.id !== id);
  removeAssignmentsByItem(category, id);
  renderAll();
  openListSettings(category);
  await forceSave();
}

function openDepartmentSettings() {
  modalContext = { category: "department-settings", view: departmentSettingsView };
  const activeMembers = state.members.filter(isMemberCurrentlyActive);
  const departmentRows = state.departments.map((department) => {
    const homeMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) === department.id);
    const schedulableMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) !== department.id && memberCanScheduleDepartment(member, department.id));
    return `
      <div class="department-settings-row sortable-settings-item" draggable="true" data-sort-category="department" data-sort-item="${department.id}" data-drop-department="${department.id}">
        <div class="department-settings-title">${escapeHtml(department.name)}</div>
        <div class="member-inline-list">
          ${homeMembers.length
            ? homeMembers.map((member) => `
              <div class="member-item draggable-member" draggable="true" data-member-card="${member.id}" data-drop-member="${member.id}" data-drop-department="${department.id}">
                <span>${escapeHtml(member.name)}</span>
              </div>
            `).join("")
            : '<div class="dept-empty-pill">拖曳人員到這裡</div>'
          }
        </div>
        <div class="member-inline-list">
          ${schedulableMembers.length
            ? schedulableMembers.map((member) => `<div class="dept-empty-pill">${escapeHtml(member.name)}</div>`).join("")
            : '<div class="dept-empty-pill">-</div>'
          }
        </div>
        <div class="member-table-actions">
          ${renderActionIconButton("edit", `data-edit-department="${department.id}"`)}
          ${renderActionIconButton("delete", `data-delete-department="${department.id}"`)}
        </div>
      </div>
    `;
  }).join("");
  const memberRows = activeMembers.map((member) => `
    <div class="department-settings-row department-settings-row-member">
      <div class="department-settings-title">${escapeHtml(member.name)}</div>
      <div>${escapeHtml(getMemberScheduleDeptNames(member))}</div>
      <div class="member-table-actions">
        ${renderActionIconButton("edit", `data-edit-member="${member.id}"`)}
        ${renderActionIconButton("delete", `data-delete-member="${member.id}"`)}
      </div>
    </div>
  `).join("");
  const body = `
    ${departmentSettingsView === "department"
      ? (state.departments.length
        ? `
          <div class="department-settings-table-wrap">
            <div class="department-settings-table department-settings-table-department">
            <div class="department-settings-row department-settings-head">
              <div>單位</div>
              <div>所屬人員</div>
              <div>可排人員</div>
              <div>操作</div>
            </div>
            ${departmentRows}
            </div>
          </div>
        `
        : '<div class="empty-state">目前還沒有單位</div>')
      : (activeMembers.length
        ? `
          <div class="department-settings-table-wrap">
            <div class="department-settings-table department-settings-table-member">
            <div class="department-settings-row department-settings-head">
              <div>人員</div>
              <div>排班單位</div>
              <div>操作</div>
            </div>
            ${memberRows}
            </div>
          </div>
        `
        : '<div class="empty-state">目前沒有今日在職人員</div>')
    }
  `;
  openEntityListModal({
    title: "單位設定",
    modalClass: "modal modal-wide department-settings-modal",
    body,
    headerButtons: `
      <button class="ghost-btn compact-btn" type="button" data-export-departments="true">匯出</button>
      <button class="ghost-btn compact-btn" type="button" data-import-departments="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-department="true">新增單位</button>
      <div class="settings-view-toggle" role="group" aria-label="單位設定檢視">
        <button class="settings-view-option ${departmentSettingsView === "department" ? "active" : ""}" type="button" data-set-department-view="department" aria-pressed="${departmentSettingsView === "department" ? "true" : "false"}">單位檢視</button>
        <button class="settings-view-option ${departmentSettingsView === "member" ? "active" : ""}" type="button" data-set-department-view="member" aria-pressed="${departmentSettingsView === "member" ? "true" : "false"}">人員檢視</button>
      </div>
    `,
    hideFooterClose: true
  });
}

function openDepartmentForm(mode, departmentId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView })
    : null;
  const department = mode === "edit"
    ? state.departments.find((item) => item.id === departmentId)
    : { id: "", name: "", startDate: "", endDate: "", hiddenFromLeave: false };
  if (!department) {
    return;
  }
  modalContext = { mode, category: "department", targetId: departmentId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}單位`,
    modalClass: "modal modal-form-compact settings-edit-form",
    body: `
      <div class="form-row">
        <label for="departmentName">單位名稱</label>
        <input id="departmentName" type="text" maxlength="12" value="${escapeHtml(department.name)}" placeholder="請輸入單位名稱">
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentStartDate">開始日期</label>
          <input id="departmentStartDate" type="date" value="${escapeHtml(department.startDate || "")}">
        </div>
        <div class="form-row">
          <label for="departmentEndDate">結束日期</label>
          <input id="departmentEndDate" type="date" value="${escapeHtml(department.endDate || "")}">
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentHiddenFromLeave" type="checkbox" ${department.hiddenFromLeave ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-department="${mode}">${mode === "edit" ? "儲存修改" : "新增單位"}</button>`,
    hideFooterClose: true
  });
}

function saveDepartment(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("departmentName")?.value.trim();
  const startDate = document.getElementById("departmentStartDate")?.value || "";
  const endDate = document.getElementById("departmentEndDate")?.value || "";
  const hiddenFromLeave = Boolean(document.getElementById("departmentHiddenFromLeave")?.checked);
  if (!name) {
    document.getElementById("departmentName")?.focus();
    return;
  }
  if (startDate && endDate && !isValidDateRange(startDate, endDate)) {
    reportValidationError("開始日期必須早於結束日期");
    return;
  }
  const payload = { id: mode === "edit" ? modalContext.targetId : uid("d"), name, startDate, endDate, hiddenFromLeave };
  if (mode === "edit") {
    state.departments = state.departments.map((department) => department.id === modalContext.targetId ? payload : department);
  } else {
    state.departments.push(payload);
  }
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo || { category: "department-settings", view: departmentSettingsView });
  queueSave();
}

function removeScheduleByMember(memberId) {
  Object.keys(state.schedule).forEach((key) => {
    if (key.startsWith(`${memberId}_`)) {
      delete state.schedule[key];
    }
  });
}

async function deleteDepartment(departmentId) {
  const memberIds = state.members.filter((member) => getMemberHomeDeptId(member) === departmentId).map((member) => member.id);
  if (memberIds.length) {
    showInfoMessage("這個單位還有人員，請先將人員移轉到其他單位後再刪除。");
    return;
  }
  const confirmed = await confirmAction("確定要刪除這個單位嗎？");
  if (!confirmed) {
    return;
  }
  state.departments = state.departments.filter((department) => department.id !== departmentId);
  memberIds.forEach(removeScheduleByMember);
  if (state.deptFilter === departmentId) {
    state.deptFilter = "all";
  }
  if (state.tableDeptScopeFilter === departmentId) {
    state.tableDeptScopeFilter = "all";
  }
  renderAll();
  openDepartmentSettings();
  queueSave();
}

async function moveMemberToDepartment(memberId, departmentId, targetMemberId = "") {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || targetMemberId === memberId) {
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  const previousHomeDeptId = getMemberHomeDeptId(member);
  const remaining = state.members.filter((item) => item.id !== memberId);
  const targetDeptId = targetMemberId
    ? (getMemberHomeDeptId(remaining.find((item) => item.id === targetMemberId)) || departmentId)
    : departmentId;
  const grouped = new Map(state.departments.map((department) => [department.id, []]));
  remaining.forEach((item) => {
    const homeDeptId = getMemberHomeDeptId(item);
    if (grouped.has(homeDeptId)) {
      grouped.get(homeDeptId).push(item);
    }
  });
  if (!grouped.has(targetDeptId)) {
    return;
  }
  let keptDeptIds = getMemberScheduleDeptIds(member).filter((deptId) => deptId !== targetDeptId);
  if (previousHomeDeptId && previousHomeDeptId !== targetDeptId && keptDeptIds.includes(previousHomeDeptId)) {
    const removeOldDept = await confirmAction("是否將舊單位從這位人員的排班單位移除？");
    if (removeOldDept) {
      keptDeptIds = keptDeptIds.filter((deptId) => deptId !== previousHomeDeptId);
    }
  }
  const movedDeptIds = [targetDeptId, ...keptDeptIds];
  const movedMember = { ...member, deptId: targetDeptId, scheduleDeptIds: movedDeptIds };
  const targetList = grouped.get(targetDeptId);
  const targetIndex = targetMemberId ? targetList.findIndex((item) => item.id === targetMemberId) : -1;
  if (targetIndex >= 0) {
    targetList.splice(targetIndex, 0, movedMember);
  } else {
    targetList.push(movedMember);
  }
  state.members = state.departments.flatMap((department) => grouped.get(department.id) || []);
  openDepartmentSettings();
  restoreSettingsScroll(returnTo);
  renderAll();
  queueSave();
}

function moveDragPreviewElement(draggedElement, targetElement, clientY) {
  if (!(draggedElement instanceof HTMLElement) || !(targetElement instanceof HTMLElement) || draggedElement === targetElement) {
    return false;
  }
  const parent = targetElement.parentElement;
  if (!parent || draggedElement.parentElement !== parent) {
    return false;
  }
  const targetRect = targetElement.getBoundingClientRect();
  const insertAfter = clientY > targetRect.top + targetRect.height / 2;
  const referenceNode = insertAfter ? targetElement.nextElementSibling : targetElement;
  if (referenceNode === draggedElement || draggedElement.nextElementSibling === referenceNode) {
    return true;
  }
  parent.insertBefore(draggedElement, referenceNode);
  dragPreviewElement = draggedElement;
  return true;
}

function cssEscapeValue(value) {
  return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
}

function clearDragPreviewState() {
  if (dragPreviewElement instanceof HTMLElement) {
    dragPreviewElement.classList.remove("drag-preview-active");
    dragPreviewElement.classList.remove("schedule-order-insert-before");
    dragPreviewElement.classList.remove("schedule-order-insert-after");
  }
  document.querySelectorAll(".drag-preview-active, .schedule-order-insert-before, .schedule-order-insert-after").forEach((element) => {
    element.classList.remove("drag-preview-active");
    element.classList.remove("schedule-order-insert-before");
    element.classList.remove("schedule-order-insert-after");
  });
  dragPreviewElement = null;
}

function markDragPreviewTarget(element, insertAfter = null) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if (dragPreviewElement !== element) {
    clearDragPreviewState();
    dragPreviewElement = element;
  }
  element.classList.add("drag-preview-active");
  if (insertAfter !== null) {
    element.classList.toggle("schedule-order-insert-before", !insertAfter);
    element.classList.toggle("schedule-order-insert-after", insertAfter);
  }
}

function markScheduleTableOrderTarget(element, clientY) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const insertAfter = clientY > rect.top + rect.height / 2;
  markDragPreviewTarget(element, insertAfter);
  return insertAfter;
}

function getScheduleTableOrderInsertAfter(element, clientY) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.classList.contains("schedule-order-insert-after")) {
    return true;
  }
  if (element.classList.contains("schedule-order-insert-before")) {
    return false;
  }
  return markScheduleTableOrderTarget(element, clientY);
}

function previewSortableSettingsItem(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-sort-item="${cssEscapeValue(dragSortItemId)}"][data-sort-category="${cssEscapeValue(dragSortCategory)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  return moveDragPreviewElement(draggedElement, targetElement, clientY);
}

function previewScheduleDepartmentOption(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-schedule-dept-option="${cssEscapeValue(dragScheduleDeptId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  if (!moveDragPreviewElement(draggedElement, targetElement, clientY)) {
    return false;
  }
  syncScheduleDeptSelectorRanks();
  syncScheduleDeptSummary();
  return true;
}

function previewDepartmentMember(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-member-card="${cssEscapeValue(dragMemberId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  return moveDragPreviewElement(draggedElement, targetElement, clientY);
}

function getOrderedIdsFromDom(selector, attributeName) {
  return Array.from(document.querySelectorAll(selector))
    .map((element) => element instanceof HTMLElement ? element.dataset[attributeName] || "" : "")
    .filter(Boolean);
}

function applyOrderedIds(list, orderedIds) {
  const byId = new Map(list.map((item) => [item.id, item]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const missing = list.filter((item) => !orderedIds.includes(item.id));
  return [...ordered, ...missing];
}

function commitSortedListFromDom(category) {
  const orderedIds = getOrderedIdsFromDom(`[data-sort-category="${cssEscapeValue(category)}"][data-sort-item]`, "sortItem");
  const currentList = category === "department"
    ? state.departments
    : getItemList(category);
  if (!orderedIds.length || orderedIds.join("|") === currentList.map((item) => item.id).join("|")) {
    return false;
  }
  const returnTo = captureSettingsReturnContext({
    category: category === "department" ? "department-settings" : "list-settings",
    listCategory: category,
    view: departmentSettingsView
  });
  const nextList = applyOrderedIds(currentList, orderedIds);
  if (category === "department") {
    state.departments = nextList;
  }
  if (category === "shift") {
    state.shifts = nextList;
  }
  if (category === "leave") {
    state.leaves = nextList;
  }
  if (category === "overtime") {
    state.overtime = nextList;
  }
  renderAll();
  if (category === "department") {
    openDepartmentSettings();
  } else {
    openListSettings(category);
  }
  restoreSettingsScroll(returnTo);
  queueSave();
  return true;
}

function commitDepartmentMemberOrderFromDom() {
  const visibleIds = getOrderedIdsFromDom("[data-member-card]", "memberCard");
  if (!visibleIds.length) {
    return false;
  }
  const visibleIdSet = new Set(visibleIds);
  const visibleById = new Map(state.members.filter((member) => visibleIdSet.has(member.id)).map((member) => [member.id, member]));
  const groupedVisibleIds = new Map(state.departments.map((department) => [department.id, []]));
  document.querySelectorAll(".department-settings-row[data-drop-department]").forEach((container) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const departmentId = container.dataset.dropDepartment || "";
    if (!groupedVisibleIds.has(departmentId)) {
      return;
    }
    container.querySelectorAll("[data-member-card]").forEach((element) => {
      if (element instanceof HTMLElement && element.dataset.memberCard) {
        groupedVisibleIds.get(departmentId).push(element.dataset.memberCard);
      }
    });
  });
  const nextMembers = [];
  state.departments.forEach((department) => {
    const visibleMembers = (groupedVisibleIds.get(department.id) || [])
      .map((memberId) => visibleById.get(memberId))
      .filter(Boolean);
    const hiddenMembers = state.members.filter((member) => getMemberHomeDeptId(member) === department.id && !visibleIdSet.has(member.id));
    nextMembers.push(...visibleMembers, ...hiddenMembers);
  });
  const includedIds = new Set(nextMembers.map((member) => member.id));
  nextMembers.push(...state.members.filter((member) => !includedIds.has(member.id)));
  if (nextMembers.map((member) => member.id).join("|") === state.members.map((member) => member.id).join("|")) {
    return false;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  state.members = nextMembers;
  openDepartmentSettings();
  restoreSettingsScroll(returnTo);
  renderAll();
  queueSave();
  return true;
}

function buildSelectOptions(items, valueField, labelBuilder, selectedValue, includeEmpty = false, emptyLabel = "未指定") {
  const entries = [];
  if (includeEmpty) {
    entries.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  }
  entries.push(...items.map((item) => `<option value="${escapeHtml(item[valueField])}" ${item[valueField] === selectedValue ? "selected" : ""}>${escapeHtml(labelBuilder(item))}</option>`));
  return entries.join("");
}

function renderScheduleDepartmentSelector(member) {
  const today = new Date();
  const todayString = toDateString(today.getFullYear(), today.getMonth(), today.getDate());
  const availableDepartments = state.departments.filter((department) => !department.endDate || department.endDate >= todayString);
  const selectedIds = getMemberScheduleDeptIds(member).filter((deptId) => availableDepartments.some((department) => department.id === deptId));
  const orderedDepartments = [
    ...selectedIds.map((deptId) => availableDepartments.find((department) => department.id === deptId)).filter(Boolean),
    ...availableDepartments.filter((department) => !selectedIds.includes(department.id))
  ];
  return `
    <div class="schedule-dept-list" id="memberScheduleDeptList" hidden>
      ${orderedDepartments.map((department, index) => {
        const checked = selectedIds.includes(department.id);
        return `
          <label class="schedule-dept-option" draggable="true" data-schedule-dept-option="${escapeHtml(department.id)}">
            <input type="checkbox" value="${escapeHtml(department.id)}" ${checked ? "checked" : ""}>
            <span class="schedule-dept-rank">${checked ? index + 1 : "-"}</span>
            <span>${escapeHtml(department.name)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function readMemberScheduleDeptIds() {
  return Array.from(document.querySelectorAll("#memberScheduleDeptList [data-schedule-dept-option]"))
    .filter((row) => row.querySelector("input")?.checked)
    .map((row) => row.dataset.scheduleDeptOption || "")
    .filter(Boolean);
}

function syncScheduleDeptSummary() {
  const summary = document.querySelector(".schedule-dept-summary");
  if (!summary) {
    return;
  }
  const names = readMemberScheduleDeptIds()
    .map((deptId) => getDepartmentName(deptId))
    .filter(Boolean);
  summary.textContent = names.length ? names.join("、") : "未指定";
}

function syncScheduleDeptSelectorRanks() {
  let rank = 1;
  document.querySelectorAll("#memberScheduleDeptList [data-schedule-dept-option]").forEach((row) => {
    const rankElement = row.querySelector(".schedule-dept-rank");
    const checked = Boolean(row.querySelector("input")?.checked);
    if (rankElement) {
      rankElement.textContent = checked ? String(rank) : "-";
    }
    if (checked) {
      rank += 1;
    }
  });
}

function getFilteredMemberSettingsMembers() {
  const normalizedName = memberSettingsFilters.name.trim().toLowerCase();
  const sourceMembers = state.members;
  const filteredMembers = sourceMembers.filter((member) => {
    const matchesName = !normalizedName || member.name.toLowerCase().includes(normalizedName);
    const matchesDepartment = memberSettingsFilters.department === "all"
      ? true
      : memberSettingsFilters.department === "__none__"
        ? !getMemberHomeDeptId(member)
        : memberCanScheduleDepartment(member, memberSettingsFilters.department);
    const matchesRole = memberSettingsFilters.role === "all"
      ? true
      : member.role === memberSettingsFilters.role;
    const active = isMemberCurrentlyActive(member);
    const matchesEmployment = memberSettingsFilters.employment === "all"
      ? true
      : memberSettingsFilters.employment === "inactive"
        ? !active
        : active;
    const matchesSalaryType = memberSettingsFilters.salaryType === "all"
      ? true
      : memberSettingsFilters.salaryType === "daily"
        ? Boolean(member.payByDay)
        : !member.payByDay;
    return matchesName && matchesDepartment && matchesRole && matchesEmployment && matchesSalaryType;
  });
  return { sourceMembers, filteredMembers };
}

function renderMemberSettingsList() {
  const { sourceMembers, filteredMembers } = getFilteredMemberSettingsMembers();
  return `
      ${sourceMembers.length
        ? `
      <div class="member-table-wrap">
        <div class="member-table-scroll">
          <div class="member-table">
            <div class="member-table-row member-table-head">
              <div>工號</div>
              <div>姓名</div>
              <div>排班單位</div>
              <div>權限</div>
              <div>到職日</div>
              <div>離職日</div>
              <div>計薪方式</div>
              <div>例假星期</div>
              <div class="member-table-actions-head">操作</div>
            </div>
            ${filteredMembers.map((member) => `
              <div class="member-table-row">
                <div class="member-table-code">${escapeHtml(member.code)}</div>
                <div class="member-table-name">${escapeHtml(member.name)}</div>
                <div>${escapeHtml(getMemberScheduleDeptNames(member))}</div>
                <div>${member.role === "manager" ? "主管" : "員工"}</div>
                <div>${escapeHtml(member.hireDate || "-")}</div>
                <div>${escapeHtml(member.leaveDate || "-")}</div>
                <div>${getSalaryTypeLabel(member)}</div>
                <div>${getRestWeekdayLabel(member.fixedRestWeekday)}</div>
                <div class="member-table-actions">
                  ${renderActionIconButton("edit", `data-edit-member="${member.id}"`)}
                  ${renderActionIconButton("delete", `data-delete-member="${member.id}"`)}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
        `
        : '<div class="empty-state">目前還沒有人員</div>'
      }
      ${sourceMembers.length && !filteredMembers.length ? '<div class="empty-state">沒有符合篩選條件的人員</div>' : ""}
    `;
}

function refreshMemberSettingsList() {
  const list = document.getElementById("memberSettingsList");
  if (list) {
    list.innerHTML = renderMemberSettingsList();
  }
}

function openMemberSettings() {
  modalContext = { category: "member-settings" };
  const body = `
      <div class="member-settings-filters">
        <div class="form-row">
          <label for="memberSettingsNameFilter">姓名</label>
          <input id="memberSettingsNameFilter" type="text" value="${escapeHtml(memberSettingsFilters.name)}" placeholder="輸入姓名" data-member-settings-filter-field="name">
        </div>
        <div class="form-row">
          <label for="memberSettingsDepartmentFilter">單位</label>
          <select id="memberSettingsDepartmentFilter" data-member-settings-filter-field="department">
            <option value="all" ${memberSettingsFilters.department === "all" ? "selected" : ""}>全部</option>
            ${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${memberSettingsFilters.department === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}
            <option value="__none__" ${memberSettingsFilters.department === "__none__" ? "selected" : ""}>未指定</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsRoleFilter">權限</label>
          <select id="memberSettingsRoleFilter" data-member-settings-filter-field="role">
            <option value="all" ${memberSettingsFilters.role === "all" ? "selected" : ""}>全部</option>
            <option value="manager" ${memberSettingsFilters.role === "manager" ? "selected" : ""}>主管</option>
            <option value="employee" ${memberSettingsFilters.role === "employee" ? "selected" : ""}>員工</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsEmploymentFilter">狀態</label>
          <select id="memberSettingsEmploymentFilter" data-member-settings-filter-field="employment">
            <option value="active" ${memberSettingsFilters.employment === "active" ? "selected" : ""}>在職</option>
            <option value="inactive" ${memberSettingsFilters.employment === "inactive" ? "selected" : ""}>離職</option>
            <option value="all" ${memberSettingsFilters.employment === "all" ? "selected" : ""}>全部</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsSalaryTypeFilter">計薪方式</label>
          <select id="memberSettingsSalaryTypeFilter" data-member-settings-filter-field="salaryType">
            <option value="all" ${memberSettingsFilters.salaryType === "all" ? "selected" : ""}>全部</option>
            <option value="monthly" ${memberSettingsFilters.salaryType === "monthly" ? "selected" : ""}>月薪</option>
            <option value="daily" ${memberSettingsFilters.salaryType === "daily" ? "selected" : ""}>日薪</option>
          </select>
        </div>
      </div>
      <div class="member-settings-list" id="memberSettingsList">${renderMemberSettingsList()}</div>
    `;
  openEntityListModal({
    title: "人員設定",
    modalClass: "modal modal-wide member-settings-modal",
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-members="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-members="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-member="true">新增人員</button>
    `,
    hideFooterClose: true
  });
}

function openMemberForm(mode, memberId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: modalContext.view || departmentSettingsView })
    : modalContext?.category === "member-settings"
      ? captureSettingsReturnContext({ category: "member-settings" })
      : null;
  const member = mode === "edit"
    ? state.members.find((item) => item.id === memberId)
    : {
      id: "",
      code: "",
      name: "",
      deptId: state.departments[0]?.id || "",
      positionId: "",
      proxyMemberId: "",
      hireDate: "",
      leaveDate: "",
      payByDay: false,
      fixedRestWeekday: 0,
      scheduleDeptIds: state.departments[0]?.id ? [state.departments[0].id] : [],
      role: "employee"
    };
  if (!member) {
    return;
  }
  modalContext = { mode, category: "member", targetId: memberId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}人員`,
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid two-col">
        <div class="form-row">
          <label for="memberCode">工號</label>
          <input id="memberCode" type="text" maxlength="12" value="${escapeHtml(member.code)}" placeholder="請輸入員工編號">
        </div>
        <div class="form-row">
          <label for="memberName">姓名</label>
          <input id="memberName" type="text" maxlength="12" value="${escapeHtml(member.name)}" placeholder="請輸入姓名">
        </div>
        <div class="form-row">
          <label for="memberRole">權限</label>
          <select id="memberRole">
            <option value="employee" ${member.role === "manager" ? "" : "selected"}>員工</option>
            <option value="manager" ${member.role === "manager" ? "selected" : ""}>主管</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSalaryType">計薪方式</label>
          <select id="memberSalaryType">
            <option value="monthly" ${member.payByDay ? "" : "selected"}>月薪</option>
            <option value="daily" ${member.payByDay ? "selected" : ""}>日薪</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberHireDate">到職日</label>
          <input id="memberHireDate" type="date" value="${escapeHtml(member.hireDate)}">
        </div>
        <div class="form-row">
          <label for="memberLeaveDate">離職日</label>
          <input id="memberLeaveDate" type="date" value="${escapeHtml(member.leaveDate)}">
        </div>
        <div class="form-row">
          <label for="memberFixedRestWeekday">例假星期</label>
          <select id="memberFixedRestWeekday">
            ${REST_WEEKDAY_OPTIONS.map((option) => (
              `<option value="${option.value}" ${normalizeRestWeekday(member.fixedRestWeekday) === option.value ? "selected" : ""}>${option.label}</option>`
            )).join("")}
          </select>
        </div>
        ${mode === "edit" ? `
          <div class="form-row">
            <button class="ghost-btn" type="button" data-reset-member-password="${escapeHtml(member.code)}">重設密碼為 0000</button>
          </div>
        ` : ""}
        <div class="form-row form-row-wide">
          <label>排班單位</label>
          <div class="schedule-dept-summary-row">
            <div class="readonly-pill schedule-dept-summary">${escapeHtml(getMemberScheduleDeptNames(member))}</div>
            <button class="ghost-btn compact-btn" type="button" data-toggle-schedule-depts="true">設定</button>
          </div>
          ${renderScheduleDepartmentSelector(member)}
        </div>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-member="${mode}">${mode === "edit" ? "儲存修改" : "新增人員"}</button>`,
    hideFooterClose: true
  });
}

async function saveMember(mode) {
  const returnTo = modalContext.returnTo || null;
  const hireDate = document.getElementById("memberHireDate")?.value || "";
  const leaveDate = document.getElementById("memberLeaveDate")?.value || "";
  if (hireDate && leaveDate && !isValidDateRange(hireDate, leaveDate)) {
    reportValidationError("到職日必須早於離職日");
    return;
  }
  const previousMember = mode === "edit"
    ? state.members.find((member) => member.id === modalContext.targetId) || null
    : null;
  const scheduleDeptIds = readMemberScheduleDeptIds();
  const monthlyRestDays = Math.max(0, Number(previousMember?.monthlyRestDays) || 0);
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("m"),
    code: document.getElementById("memberCode")?.value.trim(),
    name: document.getElementById("memberName")?.value.trim(),
    deptId: scheduleDeptIds[0] || "",
    scheduleDeptIds,
    positionId: mode === "edit" ? (state.members.find((member) => member.id === modalContext.targetId)?.positionId || "") : "",
    proxyMemberId: "",
    hireDate,
    leaveDate,
    payByDay: document.getElementById("memberSalaryType")?.value === "daily",
    fixedRestWeekday: normalizeRestWeekday(document.getElementById("memberFixedRestWeekday")?.value),
    monthlyRestDays,
    role: document.getElementById("memberRole")?.value === "manager" ? "manager" : "employee"
  };
  if (!payload.code || !payload.name || !payload.deptId) {
    return;
  }
  try {
    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");
  } catch (error) {
    setSaveStatus(`同步人員資料失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.members = state.members.map((member) => member.id === payload.id ? payload : member);
  } else {
    state.members.push(payload);
  }
  if (currentProfile && currentProfile.employee_code === (previousMember?.code || payload.code)) {
    currentProfile = {
      ...currentProfile,
      employee_code: payload.code,
      full_name: payload.name,
      role: payload.role
    };
  }
  currentMember = resolveCurrentMember();
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo);
  queueSave();
}

async function exportMembersFromSettings() {
  try {
    await window.schedulerApi.exportMembers({
      state,
      year: state.year,
      month: state.month
    });
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function importMembersFromSettings() {
  try {
    const result = await window.schedulerApi.importMembers();
    if (result.canceled) {
      return;
    }
    const departmentMap = new Map(state.departments.map((department) => [department.name.trim(), department.id]));
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let syncFailed = 0;
    let firstSyncError = "";

    for (const row of result.rows || []) {
      const code = String(row.code || "").trim();
      const name = String(row.name || "").trim();
      const departmentName = String(row.departmentName || "").trim();
      const deptId = departmentMap.get(departmentName);
      const scheduleDepartmentNames = String(row.scheduleDepartmentNames || departmentName || "")
        .split(/[、,，]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const hasUnknownScheduleDepartment = scheduleDepartmentNames.some((value) => !departmentMap.has(value));
      const scheduleDeptIds = scheduleDepartmentNames
        .map((value) => departmentMap.get(value))
        .filter((deptIdValue, index, list) => deptIdValue && list.indexOf(deptIdValue) === index);
      if (deptId && !scheduleDeptIds.includes(deptId)) {
        scheduleDeptIds.unshift(deptId);
      }
      if (!code || !name || !deptId || hasUnknownScheduleDepartment) {
        skipped += 1;
        continue;
      }
      if (row.hireDate && row.leaveDate && !isValidDateRange(row.hireDate, row.leaveDate)) {
        skipped += 1;
        continue;
      }
      const existing = state.members.find((member) => member.code === code) || null;
      const payload = {
        id: existing?.id || uid("m"),
        code,
        name,
        deptId: scheduleDeptIds[0] || deptId,
        scheduleDeptIds,
        positionId: existing?.positionId || "",
        proxyMemberId: existing?.proxyMemberId || "",
        hireDate: row.hireDate || "",
        leaveDate: row.leaveDate || "",
        payByDay: Boolean(row.payByDay),
        fixedRestWeekday: normalizeRestWeekday(row.fixedRestWeekday),
        monthlyRestDays: Math.max(0, Number(row.monthlyRestDays) || 0),
        role: row.role === "manager" ? "manager" : "employee"
      };
      try {
        await window.schedulerApi.syncMemberProfile(payload, existing?.code || "");
      } catch (error) {
        syncFailed += 1;
        if (!firstSyncError) {
          firstSyncError = `${code || "(空白工號)"}：${error.message || "同步失敗"}`;
        }
        continue;
      }
      if (existing) {
        state.members = state.members.map((member) => member.id === existing.id ? payload : member);
        updated += 1;
      } else {
        state.members.push(payload);
        imported += 1;
      }
    }

    currentMember = resolveCurrentMember();
    renderAll();
    openMemberSettings();
    queueSave();
    const summary = `匯入完成：新增 ${imported} 筆，更新 ${updated} 筆，略過 ${skipped} 筆，同步失敗 ${syncFailed} 筆`;
    if (syncFailed > 0) {
      showInfoMessage(`${summary}\n第一筆同步失敗：${firstSyncError}`);
      setSaveStatus(`匯入同步失敗：${firstSyncError}`);
      return;
    }
    showInfoMessage(summary);
  } catch (error) {
    setSaveStatus(`匯入失敗：${error.message}`);
  }
}

async function deleteMember(memberId) {
  const confirmed = await confirmAction("確定要刪除這位人員嗎？");
  if (!confirmed) {
    return;
  }
  state.members = state.members.filter((member) => member.id !== memberId);
  state.members = state.members.map((member) => ({
    ...member,
    proxyMemberId: member.proxyMemberId === memberId ? "" : member.proxyMemberId
  }));
  removeScheduleByMember(memberId);
  renderAll();
  openMemberSettings();
  queueSave();
}

async function resetMemberPasswordFromModal(employeeCode) {
  const code = String(employeeCode || "").trim();
  if (!code) {
    return;
  }
  const confirmed = await confirmAction(`確定要將 ${code} 的密碼重設為 0000 嗎？`);
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.resetMemberPassword(code);
    showInfoMessage(`${code} 的密碼已重設為 0000`);
  } catch (error) {
    setSaveStatus(`重設密碼失敗：${error.message}`);
  }
}

async function syncScheduleCatalogs() {
  if (!isManager()) {
    return;
  }
  await window.schedulerApi.syncCatalogs(state);
}

function formatMonthText(year, month) {
  return `${year} 年 ${month + 1} 月`;
}

function formatWeekStartLabel(value) {
  return WEEK_START_OPTIONS.find((option) => option.value === value)?.label || "星期日";
}

function getConfiguredMonthStartDay() {
  const value = Number(state.rules?.monthStartDay);
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : 1;
}

function formatDateTextFromIso(dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return dateString || "";
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekRangeText(startDate, endDate) {
  return `${formatDateTextFromIso(startDate)} - ${formatDateTextFromIso(endDate)}`;
}

function getScheduleSlotByDateString(memberId, dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return null;
  }
  return state.schedule[scheduleKey(memberId, date.getFullYear(), date.getMonth(), date.getDate())] || null;
}

function buildRestComplianceCalendars() {
  const checker = window.restCompliance;
  if (!checker) {
    return [];
  }
  const weekStart = getConfiguredWeekStart();
  const weeks = checker.buildCalendarWeeks(state.year, state.month, weekStart);
  const dateRange = [...new Set(weeks.flatMap((week) => week.dates))];
  const previousMonthStart = new Date(state.year, state.month - 1, 1);
  const currentMonthEnd = new Date(state.year, state.month + 1, 0);
  const slidingDateRange = enumerateDateRange(
    toDateString(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), previousMonthStart.getDate()),
    toDateString(currentMonthEnd.getFullYear(), currentMonthEnd.getMonth(), currentMonthEnd.getDate())
  );

  return state.members.map((member) => {
    const buildDay = (dateString) => {
      const slot = getScheduleSlotByDateString(member.id, dateString);
      const leave = getItem("leave", slot?.leave);
      return {
        date: dateString,
        active: isMemberActiveOnDateString(member, dateString),
        leaveCode: leave?.code || "",
        hasShift: Boolean(slot?.shift),
        hasOvertime: Boolean(slot?.overtime)
      };
    };
    const days = dateRange.map(buildDay);
    return {
      memberId: member.id,
      memberName: member.name,
      memberCode: member.code || "",
      hireDate: member.hireDate || "",
      leaveDate: member.leaveDate || "",
      days,
      slidingDays: slidingDateRange.map(buildDay)
    };
  }).filter((member) => member.days.some((day) => day.active));
}

function openWeekStartSettingModal() {
  if (!promptManagerAccess("設定週期規則前請先登入主管帳號")) {
    return;
  }
  openEntityListModal({
    title: "週期設定",
    modalClass: "modal modal-wide",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="eightWeekStartSetting">八週起算日</label>
          <input id="eightWeekStartSetting" type="date" value="${escapeHtml(getConfiguredEightWeekAnchorDate())}">
        </div>
        <div class="form-row">
          <label for="weekStartSetting">每週起算日</label>
          <select id="weekStartSetting">${WEEK_START_OPTIONS.map((option) => (
            `<option value="${option.value}" ${option.value === getConfiguredWeekStart() ? "selected" : ""}>${option.label}</option>`
          )).join("")}</select>
        </div>
        <div class="form-row">
          <label for="monthStartSetting">每月起算日</label>
          <select id="monthStartSetting">${Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            return `<option value="${day}" ${day === getConfiguredMonthStartDay() ? "selected" : ""}>${day} 日</option>`;
          }).join("")}</select>
        </div>
      </div>
      <div class="result-item">
        <div class="result-title">說明</div>
        <div class="result-detail">班表預設顯示今天所在的八週週期；週期由八週起算日往前後每 56 天推算。</div>
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-week-start="true">儲存設定</button>',
    hideFooterClose: true
  });
}

async function saveWeekStartSettingFromModal() {
  const weekValue = Number(document.getElementById("weekStartSetting")?.value || 0);
  const monthValue = Number(document.getElementById("monthStartSetting")?.value || 1);
  const eightWeekStartDate = document.getElementById("eightWeekStartSetting")?.value || getTodayDateString();
  state.rules.weekStart = Number.isInteger(weekValue) && weekValue >= 0 && weekValue <= 6 ? weekValue : 0;
  state.rules.monthStartDay = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 31 ? monthValue : 1;
  state.rules.eightWeekStartDate = toDateObject(eightWeekStartDate) ? eightWeekStartDate : getTodayDateString();
  state.scheduleStartDate = getEightWeekCycleStartForDate(getTodayDateString());
  syncVisibleDatePartsFromStart();
  closeModal();
  renderAll();
  await forceSave();
}

function openRestComplianceModal() {
  if (!promptManagerAccess("執行例休檢查前請先登入主管帳號")) {
    return;
  }
  const checker = window.restCompliance;
  if (!checker) {
    showInfoMessage("例休檢查模組尚未載入");
    return;
  }

  const result = checker.checkRestCompliance({
    year: state.year,
    month: state.month,
    weekStart: getConfiguredWeekStart(),
    maxConsecutiveWorkDays: Math.max(1, Number(state.rules?.maxConsecutiveWorkDays) || 6),
    reportStartDate: toDateString(state.year, state.month, 1),
    reportEndDate: toDateString(state.year, state.month, daysInMonth(state.year, state.month)),
    memberCalendars: buildRestComplianceCalendars()
  });
  const issueCount = result.issues.length;
  const errorCount = result.issues.filter((issue) => issue.severity === "error").length;
  const warningCount = result.issues.filter((issue) => issue.severity === "warning").length;
  const groupedIssues = result.issues.reduce((groups, issue) => {
    const key = issue.memberId || `${issue.memberCode || ""}-${issue.memberName || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        memberId: issue.memberId,
        memberName: issue.memberName,
        memberCode: issue.memberCode || "",
        issues: []
      });
    }
    groups.get(key).issues.push(issue);
    return groups;
  }, new Map());
  const summaryCards = `
    <div class="compliance-summary-grid">
      <div class="result-item">
        <div class="result-title">檢查月份</div>
        <div class="result-detail">${escapeHtml(formatMonthText(state.year, state.month))}</div>
      </div>
      <div class="result-item ${issueCount ? "warning" : "success"}">
        <div class="result-title">檢查結果</div>
        <div class="result-detail">${issueCount ? `${errorCount} 筆缺漏，${warningCount} 筆待確認` : "目前未發現缺少例假或休息日"}</div>
      </div>
    </div>
  `;
  const notes = `
    <div class="result-item">
      <div class="result-title">檢查說明</div>
      <div class="result-detail compliance-check-note">
        <div>目前依設定的每週起算日，以 ${escapeHtml(formatWeekStartLabel(getConfiguredWeekStart()))} 開始切 7 日週期。</div>
        <div>到職日或離職日落在該週時，每週例假／休息日檢查會略過，改檢查「未在職日＋例假＋休息日」是否至少 2 天。</div>
        <div>這版只看系統內已標記的「例假 0036 / 休息日 0047」；空白未排班不自動視為例休。</div>
      </div>
    </div>
  `;
  const issuesMarkup = issueCount
    ? `
      <div class="compliance-check-list">
        ${Array.from(groupedIssues.values()).map((group) => `
          <div class="result-item ${group.issues.some((issue) => issue.severity === "error") ? "error" : "warning"} compliance-member-group">
            <div class="compliance-member-head">
              <div class="result-title compliance-member-name">${escapeHtml(group.memberName || group.memberId)}</div>
              <div class="result-detail compliance-member-summary">
                <span>缺漏：${group.issues.filter((issue) => issue.severity === "error").length} 筆</span>
                <span>待確認：${group.issues.filter((issue) => issue.severity === "warning").length} 筆</span>
              </div>
            </div>
            <div class="result-detail">
              ${group.issues.map((issue) => `
                <div>${issue.type === "regular_holiday_work" && issue.date
                  ? `${escapeHtml(formatDateTextFromIso(issue.date))}｜${escapeHtml(issue.message)}`
                  : `${escapeHtml(formatWeekRangeText(issue.weekStart, issue.weekEnd))}｜${escapeHtml(issue.message)}`
                }${issue.streakStartDate ? `｜連續區間：${escapeHtml(formatDateTextFromIso(issue.streakStartDate))} - ${escapeHtml(formatDateTextFromIso(issue.date || issue.streakStartDate))}` : ""}</div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `
    : `
      <div class="result-item success">
        <div class="result-title">檢查完成</div>
        <div class="result-detail">目前依系統標記，當月未發現例假或休息日缺漏。</div>
      </div>
    `;

  openEntityListModal({
    title: "例休檢查",
    modalClass: "modal modal-wide compliance-check-modal",
    body: `${summaryCards}${notes}${issuesMarkup}`,
    hideFooterClose: true
  });
}

function syncScheduleOvertimeFormUi() {
  const useRest1 = Boolean(document.getElementById("scheduleOvertimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("scheduleOvertimeUseRest2")?.checked) && useRest1;
  const rest1Fields = document.getElementById("scheduleOvertimeRest1Fields");
  const rest2Fields = document.getElementById("scheduleOvertimeRest2Fields");
  const rest2Toggle = document.getElementById("scheduleOvertimeUseRest2");

  if (rest1Fields) {
    rest1Fields.style.display = useRest1 ? "" : "none";
  }
  setTimeInputDisabled("scheduleOvertimeRest1StartTime", !useRest1);
  setTimeInputDisabled("scheduleOvertimeRest1EndTime", !useRest1);

  if (rest2Toggle) {
    rest2Toggle.disabled = !useRest1;
    if (!useRest1) {
      rest2Toggle.checked = false;
    }
  }
  if (rest2Fields) {
    rest2Fields.style.display = useRest2 ? "" : "none";
  }
  setTimeInputDisabled("scheduleOvertimeRest2StartTime", !useRest2);
  setTimeInputDisabled("scheduleOvertimeRest2EndTime", !useRest2);
}

async function handleSignIn() {
  const loginAccount = document.getElementById("loginAccount")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  if (!loginAccount || !password) {
    authErrorMessage = "請輸入工號與密碼";
    renderAuthGate();
    return;
  }
  try {
    authErrorMessage = "";
    await window.schedulerApi.signIn(loginAccount, password);
    closeSignInDialog();
    await loadApp();
  } catch (error) {
    authErrorMessage = error.message || "登入失敗";
    renderAuthGate();
  }
}

async function handleSignOut() {
  await window.schedulerApi.signOut();
  authErrorMessage = "";
  authPromptMessage = "";
  authModalOpen = false;
  currentSession = null;
  currentProfile = null;
  currentMember = null;
  appInfo = null;
  closeModal();
  closeCoreActionsMenu();
  await loadApp();
}

async function changeScheduleWindowWeeks(weeks) {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
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

async function forceSave() {
  if (!canEditSchedule()) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await window.schedulerApi.saveState(buildPersistedState());
  } catch (error) {
    setSaveStatus(`儲存失敗：${error.message}`);
  }
}

function bindEvents() {
  if (eventsBound) {
    return;
  }
  eventsBound = true;
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  };

  bindClick("coreActionsToggle", (event) => {
    event.stopPropagation();
    toggleCoreActionsMenu();
  });
  bindClick("toolbarCollapseToggle", (event) => {
    event.stopPropagation();
    toggleToolbarCollapse();
  });
  bindClick("prevPeriodButton", async () => changeScheduleWindowWeeks(-8));
  bindClick("prevWeekButton", async () => changeScheduleWindowWeeks(-1));
  bindClick("nextWeekButton", async () => changeScheduleWindowWeeks(1));
  bindClick("nextPeriodButton", async () => changeScheduleWindowWeeks(8));
  bindClick("tablePrevWeekButton", async () => changeScheduleWindowWeeks(-1));
  bindClick("tableNextWeekButton", async () => changeScheduleWindowWeeks(1));
  bindClick("exportSapButton", () => {
    closeCoreActionsMenu();
    exportSapCsv();
  });
  bindClick("exportOvertimeButton", () => {
    closeCoreActionsMenu();
    exportOvertime();
  });
  bindClick("exportLeaveButton", () => {
    closeCoreActionsMenu();
    exportLeave();
  });
  bindClick("deptSettingsButton", openDepartmentSettings);
  bindClick("shiftSettingsButton", () => openListSettings("shift"));
  bindClick("leaveSettingsButton", () => openListSettings("leave"));
  bindClick("overtimeSettingsButton", () => openListSettings("overtime"));
  bindClick("weekStartSettingsButton", () => {
    closeCoreActionsMenu();
    openWeekStartSettingModal();
  });
  bindClick("autoSchedulePreviewButton", async () => {
    closeCoreActionsMenu();
    await previewAutoSchedule();
  });
  bindClick("autoScheduleApplyButton", async () => {
    closeCoreActionsMenu();
    await applyAutoSchedulePreview();
  });
  bindClick("autoScheduleCancelButton", () => {
    closeCoreActionsMenu();
    cancelAutoSchedulePreview();
  });
  bindClick("restComplianceButton", () => {
    closeCoreActionsMenu();
    openRestComplianceModal();
  });

  const tableWrap = document.getElementById("tableWrap");
  if (tableWrap) {
    tableWrap.addEventListener("scroll", syncStickyHeaderScroll, { passive: true });
  }
  const tableStickyHeader = document.getElementById("tableStickyHeader");
  if (tableStickyHeader) {
    tableStickyHeader.addEventListener("wheel", scrollScheduleHorizontallyFromHeader, { passive: false });
  }
  window.addEventListener("resize", () => {
    syncScheduleColumnWidths();
    syncStickyHeaderLayout();
    syncStickyHeaderScroll();
    if (!toolbarCollapseInitialized) {
      initializeToolbarCollapse();
    }
    syncToolbarCollapseUi();
  });

  const deptFilter = document.getElementById("deptFilter");
  if (deptFilter) {
    deptFilter.addEventListener("change", async (event) => {
      state.deptFilter = event.target.value;
      renderToolbar();
      renderTable();
      await forceSave();
    });
  }
  const tableDeptScopeFilter = document.getElementById("tableDeptScopeFilter");
  if (tableDeptScopeFilter) {
    tableDeptScopeFilter.addEventListener("change", async (event) => {
      state.tableDeptScopeFilter = event.target.value;
      renderToolbar();
      renderTable();
      await forceSave();
    });
  }
  const tableViewSelect = document.getElementById("tableViewSelect");
  if (tableViewSelect) {
    tableViewSelect.addEventListener("change", async (event) => {
      const value = event.target.value;
      state.tableView = value === "shift" ? "shift" : "member";
      state.tableStatsVisible = value === "member-stats";
      clearScheduleRangeSelection();
      renderToolbar();
      renderTable();
      await forceSave();
    });
  }

  document.body.addEventListener("mousedown", beginScheduleRangeSelection);
  document.body.addEventListener("mouseover", updateScheduleRangeSelection);
  document.body.addEventListener("mouseup", endScheduleRangeSelection);
  document.body.addEventListener("mouseleave", endScheduleRangeSelection);
  document.addEventListener("keydown", handleScheduleGridKeydown);

  document.body.addEventListener("click", async (event) => {
    const target = event.target.closest("button, td");
    if (!target) {
      return;
    }
    if (target.dataset.openSignIn) {
      openSignInDialog();
      return;
    }
    if (target.dataset.closeAuthGate) {
      closeSignInDialog();
      return;
    }
    if (target.dataset.authSignIn) {
      await handleSignIn();
      return;
    }
    if (target.id === "signOutButton" || target.id === "authGateSignOutButton") {
      await handleSignOut();
      return;
    }
    if (target.id === "coreActionsToggle") {
      return;
    }
    if (target.dataset.closeButton) {
      const returnTo = modalContext.returnTo || null;
      closeModal();
      reopenModalFromContext(returnTo);
      return;
    }
    const cellTarget = target instanceof Element ? target.closest(".cell") : null;
    if (cellTarget instanceof HTMLElement) {
      if (scheduleSuppressNextCellClick) {
        scheduleSuppressNextCellClick = false;
        return;
      }
      if (cellTarget.dataset.readonly) {
        return;
      }
      if (cellTarget.classList.contains("inactive-cell")) {
        return;
      }
      const memberId = cellTarget.dataset.memberId;
      const dateString = cellTarget.dataset.date || "";
      if (!state.selected.type) {
        const slot = getSlot(memberId, dateString);
        if (canEditSchedule() && slot?.overtime) {
          openOvertimeAssignmentModal(memberId, dateString);
          return;
        }
      }
      await applySelectionToCell(memberId, dateString);
      return;
    }
    const managerOnlyAction = Boolean(
      target.dataset.openDepartmentSettings ||
      target.dataset.openMemberSettings ||
      target.dataset.deleteCategory ||
      target.dataset.editLeaveAssignment ||
      target.dataset.openAdd ||
      target.dataset.editItem ||
      target.dataset.saveShift ||
      target.dataset.saveNamedItem ||
      target.id === "autoSchedulePreviewButton" ||
      target.id === "autoScheduleApplyButton" ||
      target.id === "autoScheduleCancelButton" ||
      target.dataset.generateAutoSchedule ||
      target.dataset.saveOvertimeAssignment ||
      target.dataset.openAddDepartment ||
      target.dataset.setDepartmentView ||
      target.dataset.toggleScheduleDepts ||
      target.dataset.editDepartment ||
      target.dataset.saveDepartment ||
      target.dataset.deleteDepartment ||
      target.dataset.openAddMember ||
      target.dataset.exportMembers ||
      target.dataset.importMembers ||
      target.dataset.exportSettings ||
      target.dataset.importSettings ||
      target.dataset.exportDepartments ||
      target.dataset.importDepartments ||
      target.dataset.editMember ||
      target.dataset.saveMember ||
      target.dataset.deleteMember ||
      target.dataset.resetMemberPassword
    );
    if (managerOnlyAction && !isManager()) {
      promptManagerAccess("此功能需先登入主管帳號");
      return;
    }
    if (target.dataset.openDepartmentSettings) {
      openDepartmentSettings();
      return;
    }
    if (target.dataset.openMemberSettings) {
      openMemberSettings();
      return;
    }
    if (target.dataset.openChangePassword) {
      openChangePasswordModal();
      return;
    }
    if (target.dataset.resetMemberPassword) {
      await resetMemberPasswordFromModal(target.dataset.resetMemberPassword);
      return;
    }
    if (target.dataset.chipType !== undefined) {
      selectChip(target.dataset.chipType, target.dataset.chipId || null);
      return;
    }
    if (target.dataset.openItemColor) {
      target.parentElement?.querySelector(`[data-item-color-input="${target.dataset.openItemColor}"]`)?.click();
      return;
    }
    if (target.dataset.setAutoItemText !== undefined) {
      modalTextColorAuto = true;
      modalTextColor = autoLeaveTextColor(modalColor);
      syncNamedColorUi();
      return;
    }
    if (target.dataset.color) {
      modalColor = target.dataset.color;
      syncNamedColorUi();
      return;
    }

    if (target.dataset.deleteCategory) {
      await deleteListItem(target.dataset.deleteCategory, target.dataset.deleteId);
      return;
    }
    if (target.dataset.editLeaveAssignment) {
      const [memberId, dateString] = target.dataset.editLeaveAssignment.split(":");
      const slot = getSlot(memberId, dateString);
      hideLeaveTooltip();
      if (slot?.leave) {
        openLeaveAssignmentModal(memberId, dateString, slot.leave);
      }
      return;
    }
    if (target.dataset.editOvertimeAssignment) {
      const [memberId, dateString] = target.dataset.editOvertimeAssignment.split(":");
      hideLeaveTooltip();
      openOvertimeAssignmentModal(memberId, dateString);
      return;
    }
    if (target.dataset.generateAutoSchedule) {
      await generateAutoSchedulePreviewFromModal();
      return;
    }
    if (target.dataset.openAdd === "shift") openShiftFormModal("add");
    if (target.dataset.openAdd === "leave") openNamedColorFormModal("leave", "add");
    if (target.dataset.openAdd === "overtime") openNamedColorFormModal("overtime", "add");
    if (target.dataset.editItem === "shift") openShiftFormModal("edit", target.dataset.editId);
    if (target.dataset.editItem === "leave") openNamedColorFormModal("leave", "edit", target.dataset.editId);
    if (target.dataset.editItem === "overtime") openNamedColorFormModal("overtime", "edit", target.dataset.editId);
    if (target.dataset.saveShift) saveShiftFromModal(target.dataset.saveShift);
    if (target.dataset.saveNamedItem) {
      const [category, mode] = target.dataset.saveNamedItem.split(":");
      saveNamedColorItem(category, mode);
    }
    if (target.dataset.saveWeekStart) {
      await saveWeekStartSettingFromModal();
    }
    if (target.dataset.saveLeaveAssignment) saveLeaveAssignmentFromModal();
    if (target.dataset.saveOvertimeAssignment) {
      await saveOvertimeAssignmentFromModal();
      return;
    }
    if (target.dataset.saveChangePassword) {
      await saveChangedPassword();
      return;
    }

    if (target.dataset.openAddDepartment) openDepartmentForm("add");
    if (target.dataset.setDepartmentView) {
      departmentSettingsView = target.dataset.setDepartmentView === "member" ? "member" : "department";
      openDepartmentSettings();
      return;
    }
    if (target.dataset.toggleScheduleDepts) {
      const list = document.getElementById("memberScheduleDeptList");
      if (list) {
        list.hidden = !list.hidden;
      }
      return;
    }
    if (target.dataset.editDepartment) openDepartmentForm("edit", target.dataset.editDepartment);
    if (target.dataset.saveDepartment) saveDepartment(target.dataset.saveDepartment);
    if (target.dataset.deleteDepartment) {
      await deleteDepartment(target.dataset.deleteDepartment);
      return;
    }

    if (target.dataset.openAddMember) openMemberForm("add");
    if (target.dataset.exportDepartments) {
      await exportDepartmentsFromSettings();
      return;
    }
    if (target.dataset.importDepartments) {
      await importDepartmentsFromSettings();
      return;
    }
    if (target.dataset.exportMembers) {
      await exportMembersFromSettings();
      return;
    }
    if (target.dataset.importMembers) {
      await importMembersFromSettings();
      return;
    }
    if (target.dataset.exportSettings) {
      await exportListSettings(target.dataset.exportSettings);
      return;
    }
    if (target.dataset.importSettings) {
      await importListSettings(target.dataset.importSettings);
      return;
    }
    if (target.dataset.editMember) openMemberForm("edit", target.dataset.editMember);
    if (target.dataset.saveMember) {
      await saveMember(target.dataset.saveMember);
      return;
    }
    if (target.dataset.deleteMember) {
      await deleteMember(target.dataset.deleteMember);
    }
  });

  document.body.addEventListener("dblclick", (event) => {
    const target = event.target.closest("[data-table-member-id], [data-table-department-id]");
    if (!target) return;
    if (!canEditSchedule()) return;
    const memberId = target.dataset.tableMemberId;
    if (memberId) {
      openMemberForm("edit", memberId);
      return;
    }
    const deptId = target.dataset.tableDepartmentId;
    if (deptId) {
      openDepartmentForm("edit", deptId);
      return;
    }
  });

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
    if (target instanceof HTMLSelectElement && target.dataset.departmentViewSelect) {
      departmentSettingsView = target.value === "member" ? "member" : "department";
      openDepartmentSettings();
      return;
    }
    if (!(target instanceof HTMLInputElement)) {
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
    if (target.closest("#memberScheduleDeptList")) {
      syncScheduleDeptSelectorRanks();
      syncScheduleDeptSummary();
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

  document.body.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-hover-schedule-detail]");
    if (!target) {
      return;
    }
    const [memberId, day, category] = target.dataset.hoverScheduleDetail.split(":");
    if (leaveTooltipTimer) {
      clearTimeout(leaveTooltipTimer);
      leaveTooltipTimer = null;
    }
    showScheduleTooltip(memberId, day, category, target.getBoundingClientRect());
  });

  document.body.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-hover-schedule-detail]");
    if (!target) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof HTMLElement && (related.closest("[data-hover-schedule-detail]") || related.closest("#leaveTooltipRoot"))) {
      return;
    }
    scheduleHideLeaveTooltip();
  });

  document.body.addEventListener("dragstart", (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && canDragScheduleOrder) {
      dragScheduleTableDeptId = tableDepartment.dataset.tableDepartmentId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleTableDeptId);
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && canDragScheduleOrder) {
      dragScheduleTableMemberId = tableMember.dataset.tableMemberId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleTableMemberId);
      return;
    }
    const scheduleDeptOption = event.target.closest("[data-schedule-dept-option]");
    if (scheduleDeptOption) {
      dragScheduleDeptId = scheduleDeptOption.dataset.scheduleDeptOption || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleDeptId);
      return;
    }
    const card = event.target.closest("[data-member-card]");
    if (card) {
      dragMemberId = card.dataset.memberCard || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMemberId);
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem) {
      dragSortItemId = sortItem.dataset.sortItem || "";
      dragSortCategory = sortItem.dataset.sortCategory || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragSortItemId);
      return;
    }
  });

  document.body.addEventListener("dragover", (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markScheduleTableOrderTarget(tableDepartment, event.clientY);
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder) {
      const draggedMember = state.members.find((member) => member.id === dragScheduleTableMemberId);
      if (draggedMember && tableMember.dataset.tableMemberDepartmentId === getMemberHomeDeptId(draggedMember)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        markScheduleTableOrderTarget(tableMember, event.clientY);
        return;
      }
    }
    const scheduleDeptOption = event.target.closest("[data-schedule-dept-option]");
    if (scheduleDeptOption && dragScheduleDeptId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewScheduleDepartmentOption(scheduleDeptOption, event.clientY);
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewDepartmentMember(memberTarget, event.clientY);
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewSortableSettingsItem(sortItem, event.clientY);
      return;
    }
    const dropZone = event.target.closest("[data-drop-department]");
    if (!dropZone || !dragMemberId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  document.body.addEventListener("drop", async (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
      event.preventDefault();
      await reorderScheduleTableDepartment(dragScheduleTableDeptId, tableDepartment.dataset.tableDepartmentId || "", getScheduleTableOrderInsertAfter(tableDepartment, event.clientY));
      clearDragPreviewState();
      dragScheduleTableDeptId = "";
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder) {
      event.preventDefault();
      await reorderScheduleTableMember(dragScheduleTableMemberId, tableMember.dataset.tableMemberId || "", getScheduleTableOrderInsertAfter(tableMember, event.clientY));
      clearDragPreviewState();
      dragScheduleTableMemberId = "";
      return;
    }
    const scheduleDeptOption = event.target.closest("[data-schedule-dept-option]");
    if (scheduleDeptOption && dragScheduleDeptId) {
      event.preventDefault();
      syncScheduleDeptSelectorRanks();
      syncScheduleDeptSummary();
      clearDragPreviewState();
      dragScheduleDeptId = "";
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      if (dragPreviewElement?.dataset.memberCard === dragMemberId) {
        commitDepartmentMemberOrderFromDom();
      } else {
        await moveMemberToDepartment(
          dragMemberId,
          memberTarget.dataset.dropDepartment || "",
          memberTarget.dataset.dropMember || ""
        );
      }
      clearDragPreviewState();
      dragMemberId = "";
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
      event.preventDefault();
      commitSortedListFromDom(dragSortCategory);
      clearDragPreviewState();
      dragSortItemId = "";
      dragSortCategory = "";
      return;
    }
    const dropZone = event.target.closest("[data-drop-department]");
    if (!dropZone || !dragMemberId) {
      return;
    }
    event.preventDefault();
    await moveMemberToDepartment(dragMemberId, dropZone.dataset.dropDepartment);
    clearDragPreviewState();
    dragMemberId = "";
  });

  document.body.addEventListener("dragend", () => {
    clearDragPreviewState();
    dragMemberId = "";
    dragScheduleDeptId = "";
    dragSortItemId = "";
    dragSortCategory = "";
    dragScheduleTableDeptId = "";
    dragScheduleTableMemberId = "";
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    const menu = document.getElementById("coreActionsMenu");
    const toggle = document.getElementById("coreActionsToggle");
    if (!menu || !toggle) {
      return;
    }
    if (menu.contains(target) || toggle.contains(target)) {
      return;
    }
    closeCoreActionsMenu();
  });
}

async function loadApp() {
  bindEvents();
  authErrorMessage = "";
  try {
    const authContext = await window.schedulerApi.initializeAuth();
    currentSession = authContext.session;
    currentProfile = authContext.profile;
    appInfo = await window.schedulerApi.getAppInfo();
    const payload = await window.schedulerApi.loadState();
    state = normalizeState(payload);
    resetScheduleWindowToToday();
    currentMember = resolveCurrentMember();
  } catch (error) {
    setSaveStatus(`載入失敗：${error.message}`);
    authErrorMessage = error.message || "載入失敗";
    state = createEmptyState();
    currentSession = null;
    currentProfile = null;
    currentMember = null;
    appInfo = null;
    renderAll();
    syncCoreActionsMenu();
    return;
  }

  renderAll();
  syncCoreActionsMenu();
  void refreshScheduleCatalogsAfterInitialRender();
}

async function refreshScheduleCatalogsAfterInitialRender() {
  if (!isManager()) {
    return;
  }
  try {
    await syncScheduleCatalogs();
  } catch (error) {
    setSaveStatus(`同步設定失敗：${error.message}`);
  }
}

loadApp();
