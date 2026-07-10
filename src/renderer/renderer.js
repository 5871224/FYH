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
    eightWeekStartDate: ""
  },
  schedule: {},
  scheduleLoadedRanges: []
};

const ROLE_OPTIONS = [
  { value: "admin", label: "管理員" },
  { value: "manager", label: "主管" },
  { value: "employee", label: "員工" }
];

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

const SCHEDULE_HISTORY_LIMIT = 20;

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
let dragScheduleShiftId = "";
let leaveTooltipTimer = null;
let coreActionsOpen = false;
let appView = "home";
const APP_BACK_HISTORY_STATE = { schedulerBackGuard: true };
let departmentSettingsView = "department";
let currentSession = null;
let currentProfile = null;
let currentMember = null;
let attendanceState = {
  loading: false,
  saving: false,
  record: null,
  serverDate: "",
  error: ""
};
let attendanceOvertimeState = {
  loading: false,
  expanded: false,
  status: null,
  error: ""
};
let mealOrderState = {
  loading: false,
  status: null,
  error: ""
};
let mealOrderLoadSequence = 0;
let mealPageTab = "order";
let recordsState = createRecordsState();
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
let dragMealProductIndex = "";
let toolbarCollapsed = false;
let toolbarCollapseInitialized = false;
let measureTextContext = null;
let scheduleRangeSelection = null;
let scheduleDragSelecting = false;
let scheduleHeaderDragSelection = null;
let scheduleSuppressNextCellClick = false;
let scheduleClipboard = null;

function createRecordsState() {
  const today = getTodayDateString();
  return {
    loading: false,
    activeTab: "personal",
    personal: [],
    mealStats: null,
    mealFilters: { fromDate: today, toDate: today, departmentId: "", memberId: "" },
    overtimeReview: { loading: false, requests: [], members: [], filters: { status: "pending", fromDate: addDaysToDateString(today, -30), toDate: today }, error: "" },
    attendanceAdmin: { loading: false, rows: [], members: [], issueTypes: [], total: 0, page: 1, filters: { fromDate: today, toDate: today, memberId: "", abnormalOnly: true, issueType: "" }, error: "" },
    mealAdmin: { loading: false, products: [], settings: { daily_cutoff_time: "10:30" }, error: "" },
    error: ""
  };
}
let scheduleUndoStack = [];
let scheduleRedoStack = [];
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
  if (topScrollbar && topScrollbar.scrollLeft !== tableWrap.scrollLeft) {
    topScrollbar.scrollLeft = tableWrap.scrollLeft;
  }
}

function scrollScheduleHorizontallyFromTopScrollbar(event) {
  const tableWrap = document.getElementById("tableWrap");
  const topScrollbar = event.target;
  if (!tableWrap || !(topScrollbar instanceof HTMLElement)) {
    return;
  }
  tableWrap.scrollLeft = topScrollbar.scrollLeft;
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

function getBufferedVisibleDateRange() {
  const range = getVisibleDateRange();
  // ponytail: 7-day buffer matches the current 6-day consecutive-work ceiling; widen if compliance rules look farther.
  return {
    startDate: addDaysToDateString(range.startDate, -7),
    endDate: addDaysToDateString(range.endDate, 7)
  };
}

function normalizeScheduleLoadedRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .map((range) => ({
      startDate: toDateObject(range?.startDate) ? range.startDate : "",
      endDate: toDateObject(range?.endDate) ? range.endDate : ""
    }))
    .filter((range) => range.startDate && range.endDate && range.startDate <= range.endDate);
}

function isScheduleRangeLoaded(range) {
  return normalizeScheduleLoadedRanges(state.scheduleLoadedRanges)
    .some((loaded) => loaded.startDate <= range.startDate && loaded.endDate >= range.endDate);
}

function rememberScheduleLoadedRange(range) {
  state.scheduleLoadedRanges = [
    ...normalizeScheduleLoadedRanges(state.scheduleLoadedRanges),
    range
  ];
}

async function ensureVisibleScheduleLoaded() {
  const range = getBufferedVisibleDateRange();
  if (isScheduleRangeLoaded(range)) {
    return;
  }
  const payload = await window.schedulerApi.loadScheduleEntries({
    ...range,
    members: state.members.map((member) => ({ id: member.id }))
  });
  state.schedule = cleanupScheduleEntries({
    ...state.schedule,
    ...(payload.schedule || {})
  }, state);
  rememberScheduleLoadedRange(range);
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
  return Boolean(department) && !department.hiddenFromSchedule;
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
    hiddenFromSchedule: Boolean(department?.hiddenFromSchedule),
    address: department?.address || "",
    latitude: department?.latitude ?? "",
    longitude: department?.longitude ?? "",
    publicIp: department?.publicIp || "",
    attendanceEnabled: Boolean(department?.attendanceEnabled)
  };
}

function sanitizePosition(position, fallbackIndex) {
  return {
    id: position?.id || uid(`p${fallbackIndex}`),
    code: position?.code || `P${String(fallbackIndex + 1).padStart(2, "0")}`,
    name: position?.name || `職位 ${fallbackIndex + 1}`
  };
}

function normalizeScheduleShiftIds(member, shifts) {
  const validShiftIds = new Set((shifts || []).map((shift) => shift.id));
  const ids = Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [];
  return ids
    .map((shiftId) => String(shiftId || ""))
    .filter((shiftId, index, list) => validShiftIds.has(shiftId) && list.indexOf(shiftId) === index);
}

function sanitizeMember(member, fallbackIndex, merged) {
  const validDeptIds = new Set(merged.departments.map((department) => department.id));
  const deptId = member?.deptId && validDeptIds.has(member.deptId)
    ? member.deptId
    : merged.departments[0]?.id || "";
  return {
    id: member?.id || uid(`m${fallbackIndex}`),
    code: member?.code || `M${String(fallbackIndex + 1).padStart(3, "0")}`,
    name: member?.name || `人員 ${fallbackIndex + 1}`,
    deptId,
    scheduleShiftIds: normalizeScheduleShiftIds(member, merged.shifts),
    positionId: member?.positionId && merged.positions.some((position) => position.id === member.positionId)
      ? member.positionId
      : merged.positions[0]?.id || "",
    proxyMemberId: member?.proxyMemberId || "",
    hireDate: member?.hireDate || "",
    leaveDate: member?.leaveDate || "",
    payByDay: Boolean(member?.payByDay),
    fixedRestWeekday: normalizeRestWeekday(member?.fixedRestWeekday),
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    role: normalizeRole(member?.role)
  };
}

function sanitizeShift(shift, fallbackIndex, merged) {
  const applicableDeptId = shift?.applicableDeptId && merged.departments.some((department) => department.id === shift.applicableDeptId)
    ? shift.applicableDeptId
    : merged.departments[0]?.id || "";
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
      applicableDeptId,
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
    requiresTime: Boolean(item?.requiresTime),
    requiresReason: Boolean(item?.requiresReason)
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
  merged.shifts = Array.isArray(payload.shifts)
    ? payload.shifts.map((shift, index) => sanitizeShift(shift, index, merged))
    : merged.shifts;
  merged.shifts = merged.shifts.filter((shift) => shift.name !== "休息");
  merged.members = Array.isArray(payload.members)
    ? payload.members.map((member, index) => sanitizeMember(member, index, merged))
    : merged.members;
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
    eightWeekStartDate: toDateObject(payload.rules?.eightWeekStartDate) ? payload.rules.eightWeekStartDate : merged.rules.eightWeekStartDate
  };
  merged.deptFilter = typeof payload.deptFilter === "string" ? payload.deptFilter : merged.deptFilter;
  merged.tableView = payload.tableView === "shift" ? "shift" : "member";
  merged.tableDeptScopeFilter = typeof payload.tableDeptScopeFilter === "string" ? payload.tableDeptScopeFilter : merged.tableDeptScopeFilter;
  merged.tableStatsVisible = payload.tableStatsVisible !== false;
  merged.scheduleStartDate = toDateObject(payload.scheduleStartDate) ? payload.scheduleStartDate : merged.scheduleStartDate;
  merged.schedule = cleanupScheduleEntries(payload.schedule && typeof payload.schedule === "object" ? payload.schedule : merged.schedule, merged);
  merged.scheduleLoadedRanges = normalizeScheduleLoadedRanges(payload.scheduleLoadedRanges);

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

function getDepartmentSummary(deptId) {
  return getDepartmentName(deptId);
}

function getMemberScheduleShiftIds(member) {
  const validShiftIds = new Set(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => shift.id));
  return (Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [])
    .map((shiftId) => String(shiftId || ""))
    .filter((shiftId, index, list) => validShiftIds.has(shiftId) && list.indexOf(shiftId) === index);
}

function getMemberHomeDeptId(member) {
  return member?.deptId || "";
}

function getMemberScheduleShiftNames(member) {
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);
  return names.length ? names.join("、") : "未指定";
}

function renderMemberScheduleShiftPills(member) {
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);
  if (!names.length) {
    return "-";
  }
  return names.map((name) => `<span class="member-shift-pill">${escapeHtml(name)}</span>`).join("");
}

function getMemberShiftPriority(member, shiftId) {
  const index = getMemberScheduleShiftIds(member).indexOf(shiftId);
  return index === -1 ? Infinity : index;
}

function memberCanScheduleShift(member, shiftId) {
  return Number.isFinite(getMemberShiftPriority(member, shiftId));
}

function getMembersForScheduleShift(shiftId) {
  return state.members
    .filter((member) => isMemberCurrentlyActive(member) && memberCanScheduleShift(member, shiftId))
    .sort((a, b) => getMemberShiftPriority(a, shiftId) - getMemberShiftPriority(b, shiftId) || a.name.localeCompare(b.name));
}

function shiftAllowsDepartment(shift, deptId) {
  return Boolean(shift?.applicableDeptId && shift.applicableDeptId === deptId);
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

function getSchedulePointByRowCol(row, col) {
  const cell = document.querySelector(`#mainTable .cell[data-row-index="${row}"][data-col-index="${col}"]`);
  return cell instanceof HTMLElement ? getScheduleCellPoint(cell) : null;
}

function getScheduleGridMaxRow() {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-row-index]"))
    .reduce((max, cell) => Math.max(max, Number(cell.dataset.rowIndex)), -1);
}

function getScheduleGridMaxCol() {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-col-index]"))
    .reduce((max, cell) => Math.max(max, Number(cell.dataset.colIndex)), -1);
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

function selectScheduleColumn(col, extend = false) {
  const maxRow = getScheduleGridMaxRow();
  if (maxRow < 0) {
    return false;
  }
  const anchorCol = extend && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)
    ? scheduleRangeSelection.anchor.col
    : col;
  const anchor = getSchedulePointByRowCol(0, anchorCol);
  const focus = getSchedulePointByRowCol(maxRow, col);
  if (!anchor || !focus) {
    return false;
  }
  setScheduleRangeSelection(anchor, focus);
  return true;
}

function selectScheduleRow(row, extend = false) {
  const maxCol = getScheduleGridMaxCol();
  if (maxCol < 0) {
    return false;
  }
  const anchorRow = extend && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)
    ? scheduleRangeSelection.anchor.row
    : row;
  const anchor = getSchedulePointByRowCol(anchorRow, 0);
  const focus = getSchedulePointByRowCol(row, maxCol);
  if (!anchor || !focus) {
    return false;
  }
  setScheduleRangeSelection(anchor, focus);
  return true;
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

function pushScheduleUndoSnapshot(snapshot = state.schedule || {}) {
  scheduleUndoStack.push(deepClone(snapshot));
  if (scheduleUndoStack.length > SCHEDULE_HISTORY_LIMIT) {
    scheduleUndoStack.shift();
  }
  scheduleRedoStack = [];
}

function rememberScheduleUndoSnapshot() {
  pushScheduleUndoSnapshot();
}

function discardLastScheduleUndoSnapshot() {
  scheduleUndoStack.pop();
}

function parseScheduleKeyParts(key) {
  const parts = String(key || "").split("_");
  if (parts.length < 4) {
    return null;
  }
  const day = Number(parts.pop());
  const month = Number(parts.pop());
  const year = Number(parts.pop());
  const memberId = parts.join("_");
  if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return { memberId, dateString: toDateString(year, month, day) };
}

function getChangedScheduleCells(previousSchedule, nextSchedule) {
  const keys = new Set([
    ...Object.keys(previousSchedule || {}),
    ...Object.keys(nextSchedule || {})
  ]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(previousSchedule?.[key] || null) !== JSON.stringify(nextSchedule?.[key] || null))
    .map(parseScheduleKeyParts)
    .filter(Boolean);
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

async function finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule) {
  const nextSchedule = state.schedule || {};
  if (!getChangedScheduleCells(previousSchedule, nextSchedule).length) {
    return false;
  }
  pushScheduleUndoSnapshot(previousSchedule);
  await finishScheduleCellMutation(memberId, dateString);
  return true;
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
  const previousSchedule = state.schedule || {};
  state.schedule = deepClone(snapshot);
  pruneEmptySchedule();
  const changedCells = getChangedScheduleCells(previousSchedule, state.schedule);
  renderTable();
  syncScheduleRangeSelectionUi();
  await persistScheduleCells(changedCells);
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
    reasonEnabled: false,
    reason: ""
  };
  return true;
}

function getDailyShiftNeedOptions(scheduleMap, dateString) {
  const shifts = getVisibleAutoScheduleShifts(dateString);
  const activeMembers = getActiveMembersForDate(dateString);
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
      const candidates = remaining > 0
        ? availableMembers.filter((member) => memberCanScheduleShift(member, shift.id))
        : [];
      return { shift, assignedCount, remaining, candidates };
    })
    .filter((item) => item.remaining > 0);
}

function getShiftDepartmentIds(shift) {
  return shift?.applicableDeptId ? [shift.applicableDeptId] : [];
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
  const weekIndex = getWeekBucketIndex(dateString, dates[0] || dateString);
  const restTarget = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  const restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
  const hasRestThisWeek = memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, dates[0] || dateString);
  const shiftPriority = getMemberShiftPriority(member, option.shift.id);
  const mustWork = !member.payByDay && (restCount >= restTarget || hasRestThisWeek);
  if (mustWork) {
    return shiftPriority;
  }
  if (!member.payByDay) {
    return 1000 + shiftPriority;
  }
  return 2000 + shiftPriority;
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
      return restDiff || a.name.localeCompare(b.name);
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

function getMissingAutoScheduleLeaveLabels() {
  return [
    { code: "0036", name: "例假" },
    { code: "0047", name: "休息日" }
  ]
    .filter((leave) => !getLeaveByCode(leave.code))
    .map((leave) => `${leave.name} ${leave.code}`);
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
  const missingLeaveLabels = getMissingAutoScheduleLeaveLabels();
  if (missingLeaveLabels.length) {
    reportValidationError(`自動排班需要先在假別設定新增：${missingLeaveLabels.join("、")}`);
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
  const previewSlots = autoSchedulePreview.slots || {};
  const changedCells = Object.keys(previewSlots).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    showInfoMessage("自動排班預覽沒有需要套用的變更");
    return;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
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

function beginScheduleHeaderColumnSelection(event) {
  if (event.button !== 0) {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-schedule-column]") : null;
  if (!(target instanceof HTMLElement) || !canEditSchedule() || state.tableView !== "member" || state.selected.type) {
    return;
  }
  const col = Number(target.dataset.scheduleColumn);
  if (!Number.isInteger(col)) {
    return;
  }
  selectScheduleColumn(col, event.shiftKey);
  scheduleHeaderDragSelection = { type: "column" };
  event.preventDefault();
}

function updateScheduleHeaderColumnSelection(event) {
  if (scheduleHeaderDragSelection?.type !== "column") {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-schedule-column]") : null;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const col = Number(target.dataset.scheduleColumn);
  if (Number.isInteger(col)) {
    selectScheduleColumn(col, true);
  }
}

function selectScheduleRowFromMemberCell(cell, extend = false) {
  const row = Number(cell?.dataset?.rowIndex);
  return Number.isInteger(row) && selectScheduleRow(row, extend);
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
  scheduleHeaderDragSelection = null;
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
    || !canEditSchedule()) {
    return;
  }
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
    event.preventDefault();
    const redoRequested = key === "y" || event.shiftKey;
    const targetStack = redoRequested ? scheduleRedoStack : scheduleUndoStack;
    const snapshot = targetStack.pop();
    if (!snapshot) {
      return;
    }
    const oppositeStack = redoRequested ? scheduleUndoStack : scheduleRedoStack;
    oppositeStack.push(deepClone(state.schedule || {}));
    if (oppositeStack.length > SCHEDULE_HISTORY_LIMIT) {
      oppositeStack.shift();
    }
    await restoreScheduleSnapshot(snapshot);
    return;
  }
  if (state.tableView !== "member" || !scheduleRangeSelection) {
    return;
  }
  if (key === "delete" || key === "backspace") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      discardLastScheduleUndoSnapshot();
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
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
  if (key === "v") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await pasteScheduleClipboard()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
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

function normalizeRole(role) {
  return role === "admin" || role === "manager" ? role : "employee";
}

function isAdmin() {
  return normalizeRole(currentProfile?.role) === "admin";
}

function isManager() {
  const role = normalizeRole(currentProfile?.role);
  return role === "admin" || role === "manager";
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
  return getRoleLabel(currentProfile?.role);
}

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === normalizeRole(role))?.label || "員工";
}

function canEditMemberAccount(member) {
  return isAdmin() || normalizeRole(member?.role) !== "admin";
}

function formatClockTime(value) {
  if (!value) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function getTodayShiftSummary() {
  const member = currentMember || resolveCurrentMember();
  const dateString = attendanceState.serverDate || getTodayDateString();
  const shift = getItem("shift", getSlot(member?.id || "", dateString)?.shift);
  if (!shift) {
    return "今日未排班";
  }
  return `${shift.name || "班別"}：${shift.startTime || "--:--"} ~ ${shift.endTime || "--:--"}`;
}

function formatClockButtonStatus(record, kind) {
  const at = kind === "in" ? record.clock_in_at : record.clock_out_at;
  if (!at) {
    return "尚未打卡";
  }
  const departmentName = kind === "in" ? record.clock_in_department_name_snapshot : record.clock_out_department_name_snapshot;
  const source = kind === "in" ? record.clock_in_source : record.clock_out_source;
  return `${formatClockTime(at)}在${departmentName || "-"}打卡${source ? `(${source})` : ""}`;
}

function getBrowserPosition() {
  const userAgent = navigator.userAgent || "";
  const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
  const isPhone = Boolean(navigator.userAgentData?.mobile || narrowTouch || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent)));
  if (!isPhone || !navigator.geolocation) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "手機定位權限未開啟，請允許瀏覽器定位後再打卡"
          : error.code === error.TIMEOUT
            ? "手機定位逾時，請到空曠處或重新開啟定位後再打卡"
            : "手機無法取得 GPS 定位，請確認定位服務已開啟";
        resolve({ geolocationError: message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function loadTodayAttendance() {
  if (!isLoggedIn()) {
    return;
  }
  attendanceState = { ...attendanceState, loading: true, error: "" };
  renderAll();
  try {
    const result = await window.schedulerApi.getTodayAttendance();
    attendanceState = {
      loading: false,
      saving: false,
      record: result.record || null,
      serverDate: result.serverDate || getTodayDateString(),
      error: ""
    };
  } catch (error) {
    attendanceState = {
      loading: false,
      saving: false,
      record: null,
      serverDate: getTodayDateString(),
      error: error.message || "讀取打卡狀態失敗"
    };
  }
  renderAll();
}

async function loadTodayAttendanceOvertime(shouldRender = true) {
  if (!isLoggedIn()) {
    return null;
  }
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  if (shouldRender) renderAll();
  let status = null;
  try {
    status = await window.schedulerApi.getTodayAttendanceOvertime();
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, status, error: "" };
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, status: null, error: error.message || "讀取加班申請狀態失敗" };
  }
  if (shouldRender) renderAll();
  return status;
}

async function maybePromptOvertimeAfterClockOut(status) {
  const eligibility = status?.eligibility || null;
  const earlyHours = Number(eligibility?.earlyHours || 0);
  const lateHours = Number(eligibility?.lateHours || 0);
  if (!eligibility?.eligible || (earlyHours < 0.5 && lateHours < 0.5)) {
    return false;
  }
  const confirmed = await confirmAction(`偵測到可申請加班：\n提早上班 ${earlyHours} 小時\n延後下班 ${lateHours} 小時\n是否申請加班？`);
  if (!confirmed) {
    return true;
  }
  attendanceOvertimeState = {
    ...attendanceOvertimeState,
    expanded: true,
    loading: false,
    status,
    selectedWorkDate: getTodayDateString(),
    error: ""
  };
  renderAll();
  return true;
}

async function submitAttendanceClock(action) {
  if (!isLoggedIn()) {
    openSignInDialog();
    return;
  }
  if (attendanceState.saving) {
    return;
  }
  const confirmed = await confirmAction(action === "clock_in" ? "確定要上班打卡嗎？" : "確定要下班打卡嗎？");
  if (!confirmed) {
    return;
  }
  attendanceState = { ...attendanceState, saving: true, error: "" };
  renderAll();
  try {
    const position = await getBrowserPosition();
    const result = await window.schedulerApi.clockAttendance(action, position);
    attendanceState = {
      loading: false,
      saving: false,
      record: result.record || null,
      serverDate: result.serverDate || getTodayDateString(),
      error: ""
    };
    const overtimeStatus = action === "clock_out" ? await loadTodayAttendanceOvertime(false) : null;
    const promptedOvertime = action === "clock_out" ? await maybePromptOvertimeAfterClockOut(overtimeStatus) : false;
    if (!promptedOvertime) {
      showInfoMessage(action === "clock_in" ? "上班打卡完成" : "下班打卡完成");
    }
  } catch (error) {
    attendanceState = {
      ...attendanceState,
      loading: false,
      saving: false,
      error: error.message || "打卡失敗"
    };
  }
  renderAll();
}

async function submitTodayOvertimeRequest() {
  if (attendanceOvertimeState.loading) {
    return;
  }
  const earlyHours = Number(document.getElementById("overtimeEarlyHours")?.value || 0);
  const lateHours = Number(document.getElementById("overtimeLateHours")?.value || 0);
  const note = document.getElementById("overtimeEmployeeNote")?.value || "";
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  renderAll();
  try {
    await window.schedulerApi.submitAttendanceOvertime({ earlyHours, lateHours, note });
    await loadTodayAttendanceOvertime(false);
    showInfoMessage("加班申請已送出");
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "送出加班申請失敗" };
  }
  renderAll();
}

async function deleteTodayOvertimeRequest() {
  const confirmed = await confirmAction("確定要刪除今日加班申請嗎？");
  if (!confirmed) {
    return;
  }
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  renderAll();
  try {
    await window.schedulerApi.deleteAttendanceOvertime();
    await loadTodayAttendanceOvertime(false);
    showInfoMessage("加班申請已刪除");
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "刪除加班申請失敗" };
  }
  renderAll();
}

async function loadTodayMealOrder() {
  if (!isLoggedIn()) {
    return;
  }
  const loadSequence = ++mealOrderLoadSequence;
  mealOrderState = { ...mealOrderState, loading: true, error: "" };
  renderAll();
  try {
    const status = await window.schedulerApi.getTodayMealOrder();
    if (loadSequence !== mealOrderLoadSequence) return;
    mealOrderState = { loading: false, status, error: "" };
  } catch (error) {
    if (loadSequence !== mealOrderLoadSequence) return;
    mealOrderState = { loading: false, status: null, error: error.message || "讀取訂餐狀態失敗" };
  }
  renderAll();
}

function readMealOrderItems() {
  return Array.from(document.querySelectorAll("[data-meal-product-id]")).map((input) => {
    const productId = input.dataset.mealProductId || "";
    const noteInput = document.querySelector(`[data-meal-note-product-id="${CSS.escape(productId)}"]`);
    return {
      productId,
      quantity: Number(input.value || 0),
      note: noteInput?.value || ""
    };
  });
}

function getMealOrderLiveSummary() {
  return Array.from(document.querySelectorAll("[data-meal-product-id]")).reduce((summary, input) => {
    const quantity = Math.max(0, Math.floor(Number(input.value || 0) || 0));
    const price = Number(input.dataset.mealProductPrice || 0) || 0;
    summary.quantity += quantity;
    summary.amount += quantity * price;
    return summary;
  }, { quantity: 0, amount: 0 });
}

function updateMealOrderLiveSummary() {
  const summaryElement = document.querySelector("[data-meal-live-summary]");
  if (!summaryElement) return;
  const summary = getMealOrderLiveSummary();
  summaryElement.textContent = `目前合計 ${summary.quantity} 份，$${summary.amount.toFixed(0)}`;
}

async function saveTodayMealOrder() {
  if (mealOrderState.loading) {
    return;
  }
  const items = readMealOrderItems();
  mealOrderState = { ...mealOrderState, loading: true, error: "" };
  renderAll();
  try {
    const status = await window.schedulerApi.saveTodayMealOrder({ items });
    mealOrderState = { loading: false, status, error: "" };
    showInfoMessage(items.some((item) => item.quantity > 0) ? "訂餐已儲存" : "今日訂餐已取消");
  } catch (error) {
    mealOrderState = { ...mealOrderState, loading: false, error: error.message || "儲存訂餐失敗" };
  }
  renderAll();
}

async function loadRecordsPage() {
  if (!isLoggedIn()) {
    return;
  }
  recordsState = { ...recordsState, loading: true, error: "" };
  renderAll();
  try {
    const personal = await window.schedulerApi.getPersonalRecords();
    recordsState = {
      ...recordsState,
      loading: false,
      personal: personal.records || [],
      error: ""
    };
    if (isAdmin()) {
      await Promise.all([loadOvertimeReview(false), loadAttendanceAdmin(false)]);
    }
    renderAll();
  } catch (error) {
    recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取記錄失敗" };
  }
  renderAll();
}

async function loadMealReport(shouldRender = true) {
  if (!isManager()) return;
  recordsState = { ...recordsState, mealStats: { ...(recordsState.mealStats || {}), loading: true, error: "" } };
  if (shouldRender) renderAll();
  try {
    const mealStats = await window.schedulerApi.getMealReport(recordsState.mealFilters);
    recordsState = { ...recordsState, mealStats };
  } catch (error) {
    recordsState = { ...recordsState, mealStats: { error: error.message || "讀取訂餐統計失敗" } };
  }
  if (shouldRender) renderAll();
}

async function loadOvertimeReview(shouldRender = true) {
  if (!isAdmin()) return;
  recordsState = {
    ...recordsState,
    overtimeReview: { ...recordsState.overtimeReview, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getOvertimeReviewList(recordsState.overtimeReview.filters);
    recordsState = {
      ...recordsState,
      overtimeReview: { ...recordsState.overtimeReview, loading: false, requests: result.requests || [], members: result.members || [], error: "" }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      overtimeReview: { ...recordsState.overtimeReview, loading: false, requests: [], error: error.message === "加班操作失敗" ? "讀取加班審核失敗" : (error.message || "讀取加班審核失敗") }
    };
  }
  if (shouldRender) renderAll();
}

async function loadAttendanceAdmin(shouldRender = true) {
  if (!isAdmin()) return;
  recordsState = {
    ...recordsState,
    attendanceAdmin: { ...recordsState.attendanceAdmin, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getAttendanceAdminRecords({
      ...recordsState.attendanceAdmin.filters,
      page: recordsState.attendanceAdmin.page
    });
    recordsState = {
      ...recordsState,
      attendanceAdmin: {
        ...recordsState.attendanceAdmin,
        loading: false,
        rows: result.rows || [],
        members: result.members || [],
        issueTypes: result.issueTypes || [],
        total: Number(result.total || 0),
        page: Number(result.page || 1),
        error: ""
      }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      attendanceAdmin: { ...recordsState.attendanceAdmin, loading: false, rows: [], error: error.message === "讀取報表失敗" ? "讀取打卡管理失敗" : (error.message || "讀取打卡管理失敗") }
    };
  }
  if (shouldRender) renderAll();
}

async function loadMealAdminSettings(shouldRender = true) {
  if (!isManager()) return;
  recordsState = {
    ...recordsState,
    mealAdmin: { ...recordsState.mealAdmin, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getMealAdminSettings();
    recordsState = {
      ...recordsState,
      mealAdmin: { loading: false, products: result.products || [], settings: result.settings || { daily_cutoff_time: "10:30" }, error: "" }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      mealAdmin: { ...recordsState.mealAdmin, loading: false, error: error.message || "讀取訂餐設定失敗" }
    };
  }
  if (shouldRender) renderAll();
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
  return Boolean(leave?.requiresTime);
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
        <path d="M6 15l6-6 6 6"></path>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6"></path>
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
  document.querySelectorAll(".manager-action").forEach((element) => {
    element.style.display = isManager() ? "" : "none";
    element.disabled = !isManager();
  });
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
  const toggle = document.getElementById("coreActionsToggle");
  const menu = document.getElementById("coreActionsMenu");
  const homeButton = document.getElementById("coreHomeButton");
  if (!toggle || !menu) {
    return;
  }
  const loggedIn = isLoggedIn();
  const manager = loggedIn && isManager();
  const hasProfile = Boolean(currentProfile);
  toggle.textContent = "功能";
  toggle.title = "開啟功能";
  toggle.style.display = manager ? "" : "none";
  if (homeButton) {
    homeButton.style.display = loggedIn ? "" : "none";
  }
  menu.querySelectorAll(".user-menu-login").forEach((element) => {
    element.style.display = loggedIn ? "none" : "";
  });
  menu.querySelectorAll(".user-menu-auth").forEach((element) => {
    element.style.display = loggedIn ? "" : "none";
  });
  const changePasswordButton = menu.querySelector("[data-open-change-password]");
  if (changePasswordButton) {
    changePasswordButton.style.display = loggedIn && hasProfile ? "" : "none";
  }
  menu.querySelectorAll(".manager-action").forEach((element) => {
    element.style.display = manager ? "" : "none";
    element.disabled = !manager;
  });
  if (!loggedIn) {
    closeCoreActionsMenu();
  } else if (!manager) {
    closeCoreActionsMenu();
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
    if (department?.hiddenFromSchedule) {
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
  return Boolean(leave && (leaveRequiresTime(leave) || leave.requiresReason));
}

function formatLeaveDetailSummary(leave, leaveMeta) {
  const lines = [];
  if (leave && leaveRequiresTime(leave)) {
    if (leaveMeta?.allDay !== false) {
      lines.push("時間：整天");
    } else {
      lines.push(`時間：${leaveMeta?.startTime || "--:--"} - ${leaveMeta?.endTime || "--:--"}`);
    }
  }
  if (leave?.requiresReason) {
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

function hasClosableModal() {
  return Boolean(document.querySelector("#modalRoot .modal-overlay"));
}

function pushAppBackHistoryGuard() {
  if (!window.history?.pushState) {
    return;
  }
  if (!window.history.state || window.history.state.schedulerBackGuard !== true) {
    window.history.replaceState(APP_BACK_HISTORY_STATE, "", window.location.href);
  }
  window.history.pushState(APP_BACK_HISTORY_STATE, "", window.location.href);
}

function handleAppBackNavigation() {
  if (hasClosableModal()) {
    closeModal();
  } else {
    appView = "home";
    renderAll();
  }
  pushAppBackHistoryGuard();
}

function reopenModalFromContext(context) {
  if (!context || typeof context !== "object") {
    return;
  }
  if (context.category === "department-settings") {
    departmentSettingsView = "department";
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
  return memberCanScheduleShift(member, shift.id);
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
  if (segmentCount === 1 && textLength > 0 && textLength < 2) {
    return "seg-label-xlarge";
  }
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
        textColor: leave.code === "0047" && cellState.shift ? "rgb(112, 112, 112)" : getItemTextColor(leave, leave.color)
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
          const shiftEligibleClass = memberMatchesSelectedShift(member) ? " shift-eligible-person-col" : "";
          html += `<td class="person-col${orderDragClass}${shiftEligibleClass}"${draggableAttr}${memberEditAttrs} data-row-index="${rowIndex}"><div class="member-label">${memberLabel(member)}</div></td>`;
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
  renderAuthBar();
}

function renderHomeDashboard() {
  const homeCard = document.getElementById("homeCard");
  if (!homeCard) {
    return;
  }
  if (!isLoggedIn()) {
    homeCard.innerHTML = "";
    return;
  }
  homeCard.innerHTML = `
    <div class="home-hero">
      <div>
        <p class="home-eyebrow">福圓號</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      <div class="home-header-actions">
        <button class="ghost-btn home-password-btn" type="button" data-open-change-password="true">修改密碼</button>
        <button class="ghost-btn home-signout-btn" type="button" id="homeSignOutButton">登出</button>
      </div>
    </div>
    <div class="home-action-grid">
      <button class="home-action-card home-action-card-primary" type="button" data-home-action="clock">
        <span class="home-action-title">打卡</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="schedule">
        <span class="home-action-title">班表</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="meal">
        <span class="home-action-title">訂餐</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="records">
        <span class="home-action-title">記錄</span>
      </button>
    </div>
  `;
}

function renderClockPage() {
  const clockCard = document.getElementById("clockCard");
  if (!clockCard) {
    return;
  }
  if (!isLoggedIn()) {
    clockCard.innerHTML = "";
    return;
  }
  const record = attendanceState.record || {};
  const clockInDone = Boolean(record.clock_in_at);
  const clockOutDone = Boolean(record.clock_out_at);
  const disableClockIn = attendanceState.saving || clockInDone || clockOutDone;
  const disableClockOut = attendanceState.saving || clockOutDone;
  clockCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">打卡</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
        <p class="home-subtitle clock-today-line"><span>今日日期：${escapeHtml(attendanceState.serverDate || getTodayDateString())}</span><span>${escapeHtml(getTodayShiftSummary())}</span></p>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${attendanceState.error ? `<div class="auth-error clock-error">${escapeHtml(attendanceState.error)}</div>` : ""}
    <div class="clock-action-grid">
      <button class="clock-action-btn clock-in-btn" type="button" data-clock-action="clock_in" ${disableClockIn ? "disabled" : ""}>
        <span>上班打卡</span>
        <strong>${formatClockButtonStatus(record, "in")}</strong>
      </button>
      <button class="clock-action-btn clock-out-btn" type="button" data-clock-action="clock_out" ${disableClockOut ? "disabled" : ""}>
        <span>下班打卡</span>
        <strong>${formatClockButtonStatus(record, "out")}</strong>
      </button>
    </div>
    ${renderTodayOvertimePanel()}
    ${attendanceState.saving ? '<p class="clock-loading">處理中，請稍候...</p>' : attendanceState.loading ? '<p class="clock-loading">讀取資料中...</p>' : ""}
  `;
}

function getOvertimeStatusLabel(status) {
  if (!status) return "-";
  if (status === "approved") return "已核准";
  if (status === "returned") return "退回";
  return "待審";
}

function renderTodayOvertimePanel() {
  const checked = Boolean(attendanceOvertimeState.expanded);
  const toggle = `<label class="overtime-use-label"><input type="checkbox" data-toggle-overtime-panel="true" ${checked ? "checked" : ""}> 加班申請</label>`;
  if (!checked) {
    return `<section class="overtime-request-panel overtime-request-toggle-only">${toggle}</section>`;
  }
  const stateValue = attendanceOvertimeState.status;
  const eligibility = stateValue?.eligibility || null;
  const request = stateValue?.request || null;
  if (attendanceOvertimeState.loading) {
    return `<section class="overtime-request-panel">${toggle}<p class="clock-loading">讀取加班狀態...</p></section>`;
  }
  if (attendanceOvertimeState.error) {
    return `<section class="overtime-request-panel">${toggle}<div class="auth-error">${escapeHtml(attendanceOvertimeState.error)}</div></section>`;
  }
  if (!stateValue) {
    return `<section class="overtime-request-panel">${toggle}</section>`;
  }
  if (request) {
    const canDelete = request.status === "pending" || request.status === "returned";
    return `
      <section class="overtime-request-panel">
        ${toggle}
        <div class="overtime-panel-header">
          <div>
            <h2>今日加班申請</h2>
            <p>${getOvertimeStatusLabel(request.status)}，合計 ${Number(request.total_overtime_hours || 0)} 小時</p>
          </div>
          ${canDelete ? '<button class="ghost-btn" type="button" data-delete-today-overtime="true">刪除申請</button>' : ""}
        </div>
        <div class="clock-status-grid">
          <div><span>提早上班</span><strong>${Number(request.early_overtime_hours || 0)} 小時</strong></div>
          <div><span>延後下班</span><strong>${Number(request.late_overtime_hours || 0)} 小時</strong></div>
        </div>
      </section>
    `;
  }
  if (!eligibility?.eligible) {
    return `
      <section class="overtime-request-panel">
        ${toggle}
        <h2>今日加班申請</h2>
        <p class="home-subtitle">${escapeHtml(eligibility?.reasons?.[0] || "今日目前不可申請加班")}</p>
      </section>
    `;
  }
  return `
    <section class="overtime-request-panel">
      ${toggle}
      <div class="overtime-panel-header">
        <div>
          <h2>今日加班申請</h2>
          <p>系統計算可申請 ${Number(eligibility.totalHours || 0)} 小時，可送出前自行調低。</p>
        </div>
      </div>
      <div class="form-grid two-col">
        <div class="form-row">
          <label for="overtimeEarlyHours">提早上班時數</label>
          <input id="overtimeEarlyHours" type="number" min="0" max="${Number(eligibility.earlyHours || 0)}" step="0.5" value="${Number(eligibility.earlyHours || 0)}">
        </div>
        <div class="form-row">
          <label for="overtimeLateHours">延後下班時數</label>
          <input id="overtimeLateHours" type="number" min="0" max="${Number(eligibility.lateHours || 0)}" step="0.5" value="${Number(eligibility.lateHours || 0)}">
        </div>
        <div class="form-row form-row-wide">
          <label for="overtimeEmployeeNote">加班備註</label>
          <textarea id="overtimeEmployeeNote" rows="3" placeholder="可填寫加班原因或補充說明"></textarea>
        </div>
      </div>
      <button class="btn-primary overtime-submit-btn" type="button" data-submit-today-overtime="true">送出加班申請</button>
    </section>
  `;
}

function renderMealPage() {
  const mealCard = document.getElementById("mealCard");
  if (!mealCard) {
    return;
  }
  if (!isLoggedIn()) {
    mealCard.innerHTML = "";
    return;
  }
  const status = mealOrderState.status;
  const products = status?.products || [];
  const orders = status?.orders || [];
  const orderQuantityMap = new Map(orders.map((item) => [item.product_id, Number(item.quantity || 0)]));
  const orderNoteMap = new Map(orders.map((item) => [item.product_id, item.note || ""]));
  const disabled = mealOrderState.loading || !status?.orderingOpen || !status?.attendance?.clock_in_at;
  const unavailableReason = !status
    ? ""
    : !status.attendance?.clock_in_at
      ? "今日需先完成上班打卡才能訂餐"
      : !status.orderingOpen
        ? `今日訂餐已於 ${status.cutoffTime} 截止`
        : "";
  mealCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">訂餐</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
        <p class="home-subtitle">訂餐日期：${escapeHtml(status?.orderDate || getTodayDateString())}，截止時間：${escapeHtml(status?.cutoffTime || "--:--")}</p>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${isManager() ? `
      <div class="meal-tabs">
        <button class="ghost-btn compact-btn ${mealPageTab === "order" ? "active" : ""}" type="button" data-meal-tab="order">今日訂餐</button>
        <button class="ghost-btn compact-btn ${mealPageTab === "stats" ? "active" : ""}" type="button" data-meal-tab="stats">訂餐統計</button>
        <button class="ghost-btn compact-btn ${mealPageTab === "settings" ? "active" : ""}" type="button" data-meal-tab="settings">訂餐設定</button>
      </div>
    ` : ""}
    ${isManager() && mealPageTab === "settings" ? renderMealSettingsSection() : isManager() && mealPageTab === "stats" ? renderMealReportSection() : `
    ${mealOrderState.error ? `<div class="auth-error clock-error">${escapeHtml(mealOrderState.error)}</div>` : ""}
    ${unavailableReason ? `<div class="auth-error clock-error">${escapeHtml(unavailableReason)}</div>` : ""}
    ${products.length ? `
      <div class="records-table-wrap meal-order-table-wrap">
        <table class="meal-order-table">
          <thead><tr><th>商品</th><th class="meal-price-col">價格</th><th class="meal-quantity-col">數量</th><th>備註</th></tr></thead>
          <tbody>
        ${products.map((product) => `
          <tr>
            <td>${escapeHtml(product.name || "")}${product.is_active === false ? "（已停用）" : ""}</td>
            <td><span class="meal-product-price">$${Number(product.price || 0).toFixed(0)}</span></td>
            <td><input type="number" min="0" step="1" value="${orderQuantityMap.get(product.id) || 0}" data-meal-product-id="${escapeHtml(product.id)}" data-meal-product-price="${Number(product.price || 0)}" ${disabled ? "disabled" : ""}></td>
            <td><input type="text" placeholder="此品項備註" value="${escapeHtml(orderNoteMap.get(product.id) || "")}" data-meal-note-product-id="${escapeHtml(product.id)}" ${disabled ? "disabled" : ""}></td>
          </tr>
        `).join("")}
          </tbody>
        </table>
      </div>
      <div class="meal-summary-row">
        <span data-meal-live-summary>目前合計 ${Number(status?.summary?.totalQuantity || 0)} 份，$${Number(status?.summary?.totalAmount || 0).toFixed(0)}</span>
        <button class="btn-primary" type="button" data-save-today-meal="true" ${disabled ? "disabled" : ""}>儲存訂餐</button>
      </div>
    ` : '<div class="empty-state">目前沒有可訂購的商品</div>'}
    ${mealOrderState.loading ? '<p class="clock-loading">處理中，請稍候...</p>' : ""}
    `}
  `;
}

function formatRecordDateTime(value) {
  return value ? formatClockTime(value) : "-";
}

function renderHomeIconButton() {
  return `<button class="settings-icon-btn page-home-btn" type="button" data-home-action="home" aria-label="返回首頁" title="返回首頁"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>`;
}

function renderRecordsTabs() {
  const tabs = [
    ["personal", "個人記錄", true],
    ["overtime", "加班審核", isAdmin()],
    ["attendance", "打卡管理", isAdmin()]
  ].filter((tab) => tab[2]);
  if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
  return `<div class="record-tabs">${tabs.map(([id, label]) => `<button class="ghost-btn compact-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
}

function memberOptions(selectedValue, members = state.members) {
  return `<option value="">全部人員</option>${(members || []).map((member) => `<option value="${escapeHtml(member.id)}" ${selectedValue === member.id ? "selected" : ""}>${escapeHtml(member.full_name || member.name || member.employee_code || member.code || "")}</option>`).join("")}`;
}

function departmentOptions(selectedValue) {
  return `<option value="">全部單位</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${selectedValue === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}`;
}

function renderPersonalRecordsSection() {
  return `<section class="records-section"><h2>個人記錄</h2><div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>班別</th><th>上班</th><th>下班</th><th>加班</th><th>訂餐</th></tr></thead><tbody>${recordsState.personal.map((record) => `<tr><td>${escapeHtml(record.date || "")}</td><td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td><td>${formatRecordDateTime(record.clockIn)}<br><span>${escapeHtml(record.clockInDepartment || "")}</span></td><td>${formatRecordDateTime(record.clockOut)}<br><span>${escapeHtml(record.clockOutDepartment || "")}</span></td><td>${escapeHtml(getOvertimeStatusLabel(record.overtimeStatus || ""))}<br><span>${Number(record.overtimeHours || 0)} 小時</span></td><td>${escapeHtml(record.mealText || "-")}</td></tr>`).join("") || '<tr><td colspan="6">沒有資料</td></tr>'}</tbody></table></div></section>`;
}

function renderMealReportSection() {
  const report = recordsState.mealStats || {};
  const filters = recordsState.mealFilters;
  return `<section class="records-section"><h2>訂餐統計</h2><div class="records-filter-row"><input type="date" value="${escapeHtml(filters.fromDate)}" data-meal-report-filter="fromDate"><input type="date" value="${escapeHtml(filters.toDate)}" data-meal-report-filter="toDate"><select data-meal-report-filter="departmentId">${departmentOptions(filters.departmentId)}</select><select data-meal-report-filter="memberId">${memberOptions(filters.memberId)}</select><button class="primary-btn compact-btn" type="button" data-load-meal-report="true">查詢</button><button class="ghost-btn compact-btn" type="button" data-export-meal-report="true">匯出</button></div>${report.error ? `<div class="auth-error">${escapeHtml(report.error)}</div>` : ""}<div class="meal-stats-grid"><div><strong>${Number(report.totals?.quantity || 0)}</strong><span>期間總數量</span></div><div><strong>$${Number(report.totals?.amount || 0).toFixed(0)}</strong><span>期間總金額</span></div></div><div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>單位</th><th>員工</th><th>品項</th><th>數量</th><th>小計</th><th>備註</th></tr></thead><tbody>${(report.details || []).map((row) => `<tr><td>${escapeHtml(row.date || "")}</td><td>${escapeHtml(row.departmentName || "")}</td><td>${escapeHtml(row.employeeName || "")}</td><td>${escapeHtml(row.productName || "")}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>${escapeHtml(row.note || "")}</td></tr>`).join("") || '<tr><td colspan="7">沒有訂餐資料</td></tr>'}</tbody></table></div></section>`;
}

function renderOvertimeReviewSection() {
  const review = recordsState.overtimeReview;
  const filters = review.filters;
  return `<section class="records-section"><h2>加班審核</h2><div class="records-filter-row"><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-overtime-review-filter="fromDate"><input type="date" value="${escapeHtml(filters.toDate || "")}" data-overtime-review-filter="toDate"><select data-overtime-review-filter="status"><option value="pending" ${filters.status === "pending" ? "selected" : ""}>待審</option><option value="approved" ${filters.status === "approved" ? "selected" : ""}>核准</option><option value="returned" ${filters.status === "returned" ? "selected" : ""}>退回</option><option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option></select><button class="primary-btn compact-btn" type="button" data-load-overtime-review="true">查詢</button><button class="ghost-btn compact-btn" type="button" data-open-admin-overtime-create="true">代為申請</button></div>${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>員工</th><th>狀態</th><th>提早</th><th>延後</th><th>合計</th><th>備註</th><th>操作</th></tr></thead><tbody>${review.requests.map((row) => `<tr><td>${escapeHtml(row.work_date || "")}${row.attendance_changed_warning ? "<br><span>打卡時間已異動</span>" : ""}</td><td>${escapeHtml(row.employee?.full_name || "")}</td><td>${escapeHtml(getOvertimeStatusLabel(row.status || ""))}</td><td>${Number(row.early_overtime_hours || 0)}</td><td>${Number(row.late_overtime_hours || 0)}</td><td>${Number(row.total_overtime_hours || 0)}</td><td>${escapeHtml(row.employee_note || "")}</td><td><button class="ghost-btn compact-btn" type="button" data-open-overtime-review="${escapeHtml(row.id)}">調整</button><button class="primary-btn compact-btn" type="button" data-approve-overtime="${escapeHtml(row.id)}">核准</button><button class="ghost-btn compact-btn" type="button" data-return-overtime="${escapeHtml(row.id)}">退回</button></td></tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody></table></div></section>`;
}

function renderAttendanceAdminSection() {
  const admin = recordsState.attendanceAdmin;
  const filters = admin.filters;
  return `<section class="records-section"><h2>打卡管理</h2><div class="records-admin-toolbar attendance-admin-toolbar"><div class="records-admin-filters attendance-admin-filters"><label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate)}" data-attendance-filter="fromDate"></label><label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate)}" data-attendance-filter="toDate"></label><label class="records-admin-field"><span>人員</span><select data-attendance-filter="memberId">${memberOptions(filters.memberId, admin.members)}</select></label><label class="records-admin-field"><span>異常類型</span><select data-attendance-filter="issueType"><option value="__all__" ${filters.abnormalOnly ? "" : "selected"}>全部顯示</option><option value="" ${filters.abnormalOnly && !filters.issueType ? "selected" : ""}>全部異常</option>${admin.issueTypes.map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label></div></div>${admin.error ? `<div class="auth-error">${escapeHtml(admin.error)}</div>` : ""}<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>員工</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th>操作</th></tr></thead><tbody>${admin.rows.map((row) => `<tr><td>${escapeHtml(row.work_date || "")}</td><td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td><td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td><td>${formatRecordDateTime(row.clock_in_at)}<br><span>${escapeHtml(row.clock_in_department_name_snapshot || "")}</span></td><td>${formatRecordDateTime(row.clock_out_at)}<br><span>${escapeHtml(row.clock_out_department_name_snapshot || "")}</span></td><td>${escapeHtml((row.issues || []).join("、") || "正常")}</td><td>${escapeHtml(row.attendance_note || "")}</td><td><button class="ghost-btn compact-btn" type="button" data-edit-attendance="${escapeHtml(row.user_id)}:${escapeHtml(row.work_date)}:${escapeHtml(row.id || "")}">編輯</button>${row.id ? `<button class="ghost-btn compact-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}">歷程</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody></table></div><p class="home-subtitle">共 ${Number(admin.total || 0)} 筆，第 ${Number(admin.page || 1)} 頁</p></section>`;
}

function renderMealSettingsSection() {
  const mealAdmin = recordsState.mealAdmin;
  return `<section class="records-section"><h2>訂餐設定</h2><div class="records-filter-row"><label>訂餐截止時間 <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time></label><button class="ghost-btn compact-btn" type="button" data-add-meal-product="true">新增商品</button><button class="primary-btn compact-btn" type="button" data-save-meal-settings="true">儲存</button></div>${mealAdmin.error ? `<div class="auth-error">${escapeHtml(mealAdmin.error)}</div>` : ""}<div class="meal-settings-table-wrap"><table class="meal-settings-table"><thead><tr><th class="meal-settings-drag-col"></th><th>品項</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th></tr></thead><tbody>${mealAdmin.products.map((product, index) => `<tr draggable="true" data-meal-product-row="${index}"><td class="meal-settings-drag-col"><span class="meal-drag-handle" title="拖曳排序">≡</span></td><td><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td><td><input type="number" min="0" step="1" value="${escapeHtml(String(product.price || 0))}" data-meal-product-field="price"></td><td><input type="checkbox" ${product.is_active !== false ? "checked" : ""} data-meal-product-field="isActive"><input type="hidden" value="${escapeHtml(product.id || "")}" data-meal-product-field="id"></td></tr>`).join("") || '<tr><td colspan="4">尚無商品</td></tr>'}</tbody></table></div></section>`;
}

function timeValueFromIso(value) {
  return value ? formatClockTime(value) : "";
}

function findAttendanceAdminRow(userId, workDate, recordId) {
  return recordsState.attendanceAdmin.rows.find((row) => (
    row.user_id === userId
    && row.work_date === workDate
    && (!recordId || row.id === recordId)
  )) || null;
}

function openAttendanceEditModal(token) {
  const [userId, workDate, recordId] = String(token || "").split(":");
  const row = findAttendanceAdminRow(userId, workDate, recordId) || { user_id: userId, work_date: workDate };
  openEntityListModal({
    title: "編輯打卡",
    modalClass: "modal modal-form-compact attendance-edit-modal",
    hideFooterClose: true,
    body: `
      <div class="form-grid two-col">
        <div class="form-row"><label>上班時間</label><input id="adminClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>
        <div class="form-row"><label>上班單位</label><select id="adminClockInDepartment"><option value="">未指定</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${row.clock_in_department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></div>
        <div class="form-row"><label>下班時間</label><input id="adminClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>
        <div class="form-row"><label>下班單位</label><select id="adminClockOutDepartment"><option value="">未指定</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${row.clock_out_department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></div>
        <div class="form-row form-row-wide"><label>備註</label><textarea id="adminAttendanceNote" rows="3">${escapeHtml(row.attendance_note || "")}</textarea></div>
      </div>
    `,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-edit="${escapeHtml(userId)}:${escapeHtml(workDate)}:${escapeHtml(row.id || "")}">儲存</button>`
  });
}

async function saveAttendanceEdit(token) {
  const [userId, workDate, recordId] = String(token || "").split(":");
  try {
    await window.schedulerApi.saveAttendanceAdminRecord({
      id: recordId || "",
      userId,
      workDate,
      clockInTime: document.getElementById("adminClockInTime")?.value || "",
      clockInDepartmentId: document.getElementById("adminClockInDepartment")?.value || "",
      clockOutTime: document.getElementById("adminClockOutTime")?.value || "",
      clockOutDepartmentId: document.getElementById("adminClockOutDepartment")?.value || "",
      attendanceNote: document.getElementById("adminAttendanceNote")?.value || ""
    });
    closeModal();
    await loadAttendanceAdmin();
    await loadOvertimeReview(false);
    showInfoMessage("打卡資料已更新");
  } catch (error) {
    setSaveStatus(`儲存打卡失敗：${error.message}`);
  }
}

async function openAttendanceHistoryModal(recordId) {
  try {
    const result = await window.schedulerApi.getAttendanceAdminHistory(recordId);
    openEntityListModal({
      title: "打卡修改歷程",
      body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>欄位</th><th>原值</th><th>新值</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(log.field_name || log.action_type || "")}</td><td>${escapeHtml(log.old_value || "")}</td><td>${escapeHtml(log.new_value || "")}</td><td>${escapeHtml(log.operator_name_snapshot || "")}</td></tr>`).join("") || '<tr><td colspan="5">沒有歷程</td></tr>'}</tbody></table></div>`
    });
  } catch (error) {
    setSaveStatus(`讀取歷程失敗：${error.message}`);
  }
}

function openOvertimeReviewModal(id) {
  const row = recordsState.overtimeReview.requests.find((item) => item.id === id);
  if (!row) return;
  openEntityListModal({
    title: "調整加班時數",
    hideFooterClose: true,
    body: `<div class="form-grid two-col"><div class="form-row"><label>提早上班</label><input id="reviewEarlyHours" type="number" min="0" step="0.5" value="${Number(row.early_overtime_hours || 0)}"></div><div class="form-row"><label>延後下班</label><input id="reviewLateHours" type="number" min="0" step="0.5" value="${Number(row.late_overtime_hours || 0)}"></div></div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-overtime-review="${escapeHtml(id)}">儲存為待審</button>`
  });
}

async function reviewOvertime(id, status, readHours = false) {
  try {
    await window.schedulerApi.reviewOvertimeRequest({
      id,
      status,
      earlyHours: readHours ? document.getElementById("reviewEarlyHours")?.value : undefined,
      lateHours: readHours ? document.getElementById("reviewLateHours")?.value : undefined
    });
    closeModal();
    await loadOvertimeReview();
    showInfoMessage("加班審核已更新");
  } catch (error) {
    setSaveStatus(`加班審核失敗：${error.message}`);
  }
}

function openAdminOvertimeCreateModal() {
  const members = recordsState.overtimeReview.members?.length
    ? recordsState.overtimeReview.members
    : recordsState.attendanceAdmin.members;
  openEntityListModal({
    title: "代為申請加班",
    hideFooterClose: true,
    body: `<div class="form-grid two-col"><div class="form-row"><label>人員</label><select id="adminOvertimeUser">${memberOptions("", members)}</select></div><div class="form-row"><label>日期</label><input id="adminOvertimeDate" type="date" value="${escapeHtml(getTodayDateString())}"></div><div class="form-row"><label>提早上班</label><input id="adminOvertimeEarly" type="number" min="0" step="0.5" value="0"></div><div class="form-row"><label>延後下班</label><input id="adminOvertimeLate" type="number" min="0" step="0.5" value="0"></div><div class="form-row form-row-wide"><label>備註</label><textarea id="adminOvertimeNote" rows="3"></textarea></div></div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-admin-overtime-create="true">建立</button>`
  });
}

async function saveAdminOvertimeCreate() {
  try {
    await window.schedulerApi.createAdminOvertimeRequest({
      userId: document.getElementById("adminOvertimeUser")?.value || "",
      workDate: document.getElementById("adminOvertimeDate")?.value || getTodayDateString(),
      earlyHours: document.getElementById("adminOvertimeEarly")?.value || 0,
      lateHours: document.getElementById("adminOvertimeLate")?.value || 0,
      note: document.getElementById("adminOvertimeNote")?.value || ""
    });
    closeModal();
    await loadOvertimeReview();
    showInfoMessage("已建立代申請");
  } catch (error) {
    setSaveStatus(`建立代申請失敗：${error.message}`);
  }
}

function readMealAdminProducts() {
  return Array.from(document.querySelectorAll("[data-meal-product-row]")).map((row) => ({
    id: row.querySelector('[data-meal-product-field="id"]')?.value || "",
    name: row.querySelector('[data-meal-product-field="name"]')?.value || "",
    price: Number(row.querySelector('[data-meal-product-field="price"]')?.value || 0),
    isActive: Boolean(row.querySelector('[data-meal-product-field="isActive"]')?.checked),
    is_active: Boolean(row.querySelector('[data-meal-product-field="isActive"]')?.checked)
  })).filter((item) => item.name.trim());
}

function commitMealProductOrderFromDom() {
  recordsState.mealAdmin.products = readMealAdminProducts();
  renderAll();
}

async function saveMealSettingsFromPage() {
  try {
    await window.schedulerApi.saveMealAdminSettings({
      dailyCutoffTime: document.querySelector("[data-meal-cutoff-time]")?.value || "10:30",
      products: readMealAdminProducts()
    });
    await loadMealAdminSettings();
    showInfoMessage("訂餐設定已儲存");
  } catch (error) {
    setSaveStatus(`訂餐設定儲存失敗：${error.message}`);
  }
}

function renderRecordsPage() {
  const recordsCard = document.getElementById("recordsCard");
  if (!recordsCard) {
    return;
  }
  if (!isLoggedIn()) {
    recordsCard.innerHTML = "";
    return;
  }
  const activeSection = recordsState.activeTab === "overtime"
      ? renderOvertimeReviewSection()
      : recordsState.activeTab === "attendance"
        ? renderAttendanceAdminSection()
        : renderPersonalRecordsSection();
  recordsCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">記錄</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${renderRecordsTabs()}
    ${recordsState.error ? `<div class="auth-error clock-error">${escapeHtml(recordsState.error)}</div>` : ""}
    ${activeSection}
    ${recordsState.loading ? '<p class="clock-loading">讀取中，請稍候...</p>' : ""}
  `;
}

function syncAppView() {
  const loggedIn = isLoggedIn();
  const homeCard = document.getElementById("homeCard");
  const clockCard = document.getElementById("clockCard");
  const mealCard = document.getElementById("mealCard");
  const recordsCard = document.getElementById("recordsCard");
  const scheduleCard = document.getElementById("scheduleCard");
  const toolbarCard = document.querySelector(".toolbar-card");
  const showSchedule = loggedIn && appView === "schedule";
  const showToolbar = showSchedule && isManager();
  if (homeCard) {
    homeCard.hidden = !loggedIn || appView !== "home";
  }
  if (clockCard) {
    clockCard.hidden = !loggedIn || appView !== "clock";
  }
  if (mealCard) {
    mealCard.hidden = !loggedIn || appView !== "meal";
  }
  if (recordsCard) {
    recordsCard.hidden = !loggedIn || appView !== "records";
  }
  if (scheduleCard) {
    scheduleCard.hidden = !showSchedule;
  }
  if (toolbarCard) {
    toolbarCard.hidden = !showToolbar;
  }
  document.body.classList.toggle("is-authenticated", loggedIn);
  document.body.classList.toggle("is-home-view", loggedIn && appView === "home");
  document.body.classList.toggle("is-clock-view", loggedIn && appView === "clock");
  document.body.classList.toggle("is-meal-view", loggedIn && appView === "meal");
  document.body.classList.toggle("is-records-view", loggedIn && appView === "records");
  document.body.classList.toggle("is-schedule-view", showSchedule);
}

function renderAll() {
  renderHeader();
  renderToolbar();
  renderHomeDashboard();
  renderClockPage();
  renderMealPage();
  renderRecordsPage();
  renderTable();
  syncAppView();
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
  const previousSchedule = deepClone(state.schedule || {});
  const { type, id } = state.selected;
  if (type === "leave") {
    const leave = getItem("leave", id);
    if (!leave) {
      return;
    }
    try {
      if (slot.leave === id) {
        clearLegacyLeaveFromSlot(slot);
        await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
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
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定請假失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "shift") {
    const nextShiftId = slot.shift === id ? null : id;
    slot.shift = nextShiftId;
    try {
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
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
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定加班失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "cancel-shift") {
    slot.shift = null;
    try {
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除班別失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-leave") {
    try {
      clearLegacyLeaveFromSlot(slot);
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除請假失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-overtime") {
    try {
      clearLegacyOvertimeFromSlot(slot);
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
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
  const reasonEnabled = existingMeta?.reasonEnabled ?? leave.requiresReason;
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
    const previousSchedule = deepClone(state.schedule || {});
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
    await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
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
    const previousSchedule = deepClone(state.schedule || {});
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
    await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
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
  const renderShiftMemberNames = (shift) => {
    const members = getMembersForScheduleShift(shift.id);
    if (!members.length) {
      return "-";
    }
    return members.map((member) => (
      `<span class="settings-member-chip" data-shift-schedule-member="${escapeHtml(member.id)}" title="雙擊修改人員">${escapeHtml(member.name)}</span>`
    )).join("");
  };
  const body = list.length
      ? `
        <div class="settings-table-wrap">
          <div class="settings-table-scroll">
            <div class="settings-table">
              <div class="settings-table-row settings-table-head settings-table-row-${category}">
                <div>預覽</div>
                ${category === "leave" ? "<div>假別代碼</div>" : ""}
                ${category === "shift" ? "" : `<div>${category === "leave" ? "假別" : "加班"}</div>`}
                <div>${category === "shift" ? "適用單位" : category === "leave" ? "需填時間" : "時段"}</div>
                ${category === "shift" ? "<div>需求人數</div>" : ""}
                ${category === "shift" ? "<div>排班人員</div>" : ""}
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
                  ${category === "shift" ? "" : `<div class="settings-table-name">${escapeHtml(category === "leave" ? getLeaveCatalogDisplayName(item) : item.name)}</div>`}
                  <div class="settings-table-meta">${category === "shift"
                    ? escapeHtml(getDepartmentSummary(item.applicableDeptId))
                    : category === "leave"
                      ? (item.requiresTime ? "是" : "否")
                      : escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)
                  }</div>
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(String(item.requiredStaffCount ?? 0))}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta settings-member-list">${renderShiftMemberNames(item)}</div>`
                    : ""}
                  ${category === "overtime"
                    ? `<div class="settings-table-meta">${item.useRest1 ? escapeHtml(`${item.rest1StartTime || "--:--"} - ${item.rest1EndTime || "--:--"}`) : "-"}</div>
                       <div class="settings-table-meta">${item.useRest2 ? escapeHtml(`${item.rest2StartTime || "--:--"} - ${item.rest2EndTime || "--:--"}`) : "-"}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)}</div>`
                    : ""}
                  ${category === "leave"
                    ? `<div class="settings-table-meta">${item.requiresReason ? "是" : "否"}</div>`
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
      ? "modal modal-wide catalog-settings-modal settings-list-modal"
      : undefined,
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-settings="${category}">匯出</button>
      <button class="ghost-btn" type="button" data-import-settings="${category}">匯入</button>
      <button class="btn-primary" type="button" data-open-add="${category}">新增</button>
    `,
    hideFooterClose: true
  });
}

function readApplicableDepartmentInput() {
  return document.getElementById("shiftApplicableDept")?.value || "";
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
      applicableDeptId: state.deptFilter !== "all" ? state.deptFilter : (state.departments[0]?.id || ""),
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
        <select id="shiftApplicableDept">${buildSelectOptions(state.departments, "id", (item) => item.name, shift.applicableDeptId || "")}</select>
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
    headerButtons: `<button class="btn-primary" type="button" data-save-shift="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
  syncNamedColorUi();
}

async function saveShiftFromModal(mode) {
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
  const applicableDeptId = readApplicableDepartmentInput();
  if (!state.departments.some((department) => department.id === applicableDeptId)) {
    reportValidationError("請選擇適用單位");
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
    applicableDeptId,
    positionRequirements: []
  };

  const sortOrder = mode === "edit"
    ? state.shifts.findIndex((shift) => shift.id === payload.id)
    : state.shifts.length;
  try {
    await window.schedulerApi.saveShiftItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`班別儲存失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.shifts = state.shifts.map((shift) => shift.id === payload.id ? payload : shift);
  } else {
    state.shifts.push(payload);
  }
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo || { category: "list-settings", listCategory: "shift" });
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
      code: category === "leave" ? LEAVE_CATALOG[0].code : "",
      name: category === "overtime" ? "加班" : LEAVE_CATALOG[0].name,
      color: COLORS[0].hex,
      requiresTime: false,
      requiresReason: false,
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
              <input id="leaveRequiresTime" type="checkbox" ${item.requiresTime ? "checked" : ""}>
              需填時間
            </label>
          </div>
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveRequiresReason" type="checkbox" ${item.requiresReason ? "checked" : ""}>
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

async function saveNamedColorItem(category, mode) {
  const returnTo = modalContext.returnTo || null;
  if (category === "shift") {
    void saveShiftFromModal(mode);
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
    requiresTime: category === "leave" ? document.getElementById("leaveRequiresTime")?.checked : undefined,
    requiresReason: category === "leave" ? document.getElementById("leaveRequiresReason")?.checked : undefined,
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
  const sortOrder = mode === "edit"
    ? currentList.findIndex((item) => item.id === payload.id)
    : currentList.length;
  try {
    await window.schedulerApi.saveCatalogItem(category, payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`${category === "leave" ? "假別" : "加班"}儲存失敗：${error.message}`);
    return;
  }
  if (category === "leave") state.leaves = nextList;
  if (category === "overtime") state.overtime = nextList;
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo || { category: "list-settings", listCategory: category });
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
  if (category === "shift") {
    state.shifts = state.shifts.filter((item) => item.id !== id);
    state.members = state.members.map((member) => ({
      ...member,
      scheduleShiftIds: getMemberScheduleShiftIds(member).filter((shiftId) => shiftId !== id)
    }));
  }
  if (category === "leave") state.leaves = state.leaves.filter((item) => item.id !== id);
  if (category === "overtime") state.overtime = state.overtime.filter((item) => item.id !== id);
  removeAssignmentsByItem(category, id);
  renderAll();
  openListSettings(category);
  await forceSave();
}

function openDepartmentSettings() {
  departmentSettingsView = "department";
  modalContext = { category: "department-settings", view: "department" };
  const activeMembers = state.members.filter(isMemberCurrentlyActive);
  const departmentRows = state.departments.map((department) => {
    const homeMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) === department.id);
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
        <div class="member-table-actions">
          ${renderActionIconButton("edit", `data-edit-department="${department.id}"`)}
          ${renderActionIconButton("delete", `data-delete-department="${department.id}"`)}
        </div>
      </div>
    `;
  }).join("");
  const body = state.departments.length
    ? `
      <div class="department-settings-table-wrap">
        <div class="department-settings-table department-settings-table-department">
        <div class="department-settings-row department-settings-head">
          <div>單位</div>
          <div>所屬人員</div>
          <div>操作</div>
        </div>
        ${departmentRows}
        </div>
      </div>
    `
    : '<div class="empty-state">目前還沒有單位</div>';
  openEntityListModal({
    title: "單位設定",
    modalClass: "modal modal-wide department-settings-modal settings-list-modal",
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-departments="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-departments="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-department="true">新增</button>
    `,
    hideFooterClose: true
  });
}

function renderDepartmentAttendanceFields(department, disabledAttr) {
  return `
      <div class="settings-form-divider"></div>
      <div class="form-row">
        <label for="departmentAddress">地址</label>
        <input id="departmentAddress" type="text" value="${escapeHtml(department.address || "")}" placeholder="打卡地點地址" ${disabledAttr}>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentLatitude">緯度</label>
          <input id="departmentLatitude" type="number" step="0.000001" min="-90" max="90" value="${escapeHtml(String(department.latitude ?? ""))}" placeholder="例如 25.033964" ${disabledAttr}>
        </div>
        <div class="form-row">
          <label for="departmentLongitude">經度</label>
          <input id="departmentLongitude" type="number" step="0.000001" min="-180" max="180" value="${escapeHtml(String(department.longitude ?? ""))}" placeholder="例如 121.564468" ${disabledAttr}>
        </div>
      </div>
      <div class="form-row">
        <label for="departmentPublicIp">固定對外 IP</label>
        <input id="departmentPublicIp" type="text" value="${escapeHtml(department.publicIp || "")}" placeholder="可用逗號或空白分隔多組 IP" ${disabledAttr}>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentAttendanceEnabled" type="checkbox" ${department.attendanceEnabled ? "checked" : ""} ${disabledAttr}>
          是否啟用打卡
        </label>
      </div>
      ${isAdmin() ? "" : '<p class="modal-description">打卡地址、座標、固定 IP 與是否啟用打卡只有管理員可以修改。</p>'}
  `;
}

function renderDepartmentFormBody(department, attendanceFieldsDisabled) {
  return `
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
          <input id="departmentHiddenFromSchedule" type="checkbox" ${department.hiddenFromSchedule ? "checked" : ""}>
          不顯示於班表
        </label>
      </div>
      ${renderDepartmentAttendanceFields(department, attendanceFieldsDisabled)}
  `;
}

function openDepartmentForm(mode, departmentId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView })
    : null;
  const department = mode === "edit"
    ? state.departments.find((item) => item.id === departmentId)
    : { id: "", name: "", startDate: "", endDate: "", hiddenFromSchedule: false, address: "", latitude: "", longitude: "", publicIp: "", attendanceEnabled: false };
  if (!department) {
    return;
  }
  const attendanceFieldsDisabled = isAdmin() ? "" : "disabled";
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
          <input id="departmentHiddenFromSchedule" type="checkbox" ${department.hiddenFromSchedule ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-department="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    body: renderDepartmentFormBody(department, attendanceFieldsDisabled),
    hideFooterClose: true
  });
}

async function saveDepartment(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("departmentName")?.value.trim();
  const startDate = document.getElementById("departmentStartDate")?.value || "";
  const endDate = document.getElementById("departmentEndDate")?.value || "";
  const hiddenFromSchedule = Boolean(document.getElementById("departmentHiddenFromSchedule")?.checked);
  const previousDepartment = mode === "edit"
    ? state.departments.find((department) => department.id === modalContext.targetId) || null
    : null;
  const latitudeInput = document.getElementById("departmentLatitude")?.value.trim() || "";
  const longitudeInput = document.getElementById("departmentLongitude")?.value.trim() || "";
  const latitude = latitudeInput === "" ? "" : Number(latitudeInput);
  const longitude = longitudeInput === "" ? "" : Number(longitudeInput);
  if (!name) {
    document.getElementById("departmentName")?.focus();
    return;
  }
  if (startDate && endDate && !isValidDateRange(startDate, endDate)) {
    reportValidationError("開始日期必須早於結束日期");
    return;
  }
  if (isAdmin() && latitude !== "" && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    reportValidationError("緯度必須介於 -90 到 90");
    return;
  }
  if (isAdmin() && longitude !== "" && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    reportValidationError("經度必須介於 -180 到 180");
    return;
  }
  const attendancePayload = isAdmin()
    ? {
      address: document.getElementById("departmentAddress")?.value.trim() || "",
      latitude,
      longitude,
      publicIp: document.getElementById("departmentPublicIp")?.value.trim() || "",
      attendanceEnabled: Boolean(document.getElementById("departmentAttendanceEnabled")?.checked)
    }
    : {
      address: previousDepartment?.address || "",
      latitude: previousDepartment?.latitude ?? "",
      longitude: previousDepartment?.longitude ?? "",
      publicIp: previousDepartment?.publicIp || "",
      attendanceEnabled: Boolean(previousDepartment?.attendanceEnabled)
    };
  const payload = { id: mode === "edit" ? modalContext.targetId : uid("d"), name, startDate, endDate, hiddenFromSchedule, ...attendancePayload };
  const sortOrder = mode === "edit"
    ? state.departments.findIndex((department) => department.id === payload.id)
    : state.departments.length;
  try {
    await window.schedulerApi.saveDepartmentItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`單位儲存失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.departments = state.departments.map((department) => department.id === modalContext.targetId ? payload : department);
  } else {
    state.departments.push(payload);
  }
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo || { category: "department-settings", view: departmentSettingsView });
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
  const usedShifts = state.shifts.filter((shift) => shift.applicableDeptId === departmentId);
  if (usedShifts.length) {
    showInfoMessage(`這個單位仍有班別使用，請先修改有使用的班別：${usedShifts.map((shift) => shift.name).join("、")}`);
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
  const movedMember = { ...member, deptId: targetDeptId };
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

function previewScheduleShiftOption(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-schedule-shift-option="${cssEscapeValue(dragScheduleShiftId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  if (!moveDragPreviewElement(draggedElement, targetElement, clientY)) {
    return false;
  }
  syncScheduleShiftSelectorRanks();
  syncScheduleShiftSummary();
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

function renderScheduleShiftSelector(member) {
  const selectedIds = getMemberScheduleShiftIds(member);
  const visibleShifts = state.shifts.filter((shift) => !shift.hiddenFromToolbar);
  const orderedShifts = [
    ...selectedIds.map((shiftId) => visibleShifts.find((shift) => shift.id === shiftId)).filter(Boolean),
    ...visibleShifts.filter((shift) => !selectedIds.includes(shift.id))
  ];
  return `
    <div class="schedule-dept-list" id="memberScheduleShiftList" hidden>
      ${orderedShifts.map((shift, index) => {
        const checked = selectedIds.includes(shift.id);
        return `
          <label class="schedule-dept-option" draggable="true" data-schedule-shift-option="${escapeHtml(shift.id)}">
            <input type="checkbox" value="${escapeHtml(shift.id)}" ${checked ? "checked" : ""}>
            <span class="schedule-dept-rank">${checked ? index + 1 : "-"}</span>
            <span>${escapeHtml(shift.name)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function readMemberScheduleShiftIds() {
  return Array.from(document.querySelectorAll("#memberScheduleShiftList [data-schedule-shift-option]"))
    .filter((row) => row.querySelector("input")?.checked)
    .map((row) => row.dataset.scheduleShiftOption || "")
    .filter(Boolean);
}

function syncScheduleShiftSummary() {
  const summary = document.querySelector(".schedule-shift-summary");
  if (!summary) {
    return;
  }
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = readMemberScheduleShiftIds()
    .map((shiftId) => shiftMap.get(shiftId))
    .filter(Boolean);
  summary.textContent = names.length ? names.join("、") : "未指定";
}

function syncScheduleShiftSelectorRanks() {
  let rank = 1;
  document.querySelectorAll("#memberScheduleShiftList [data-schedule-shift-option]").forEach((row) => {
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
        : getMemberHomeDeptId(member) === memberSettingsFilters.department;
    const matchesRole = memberSettingsFilters.role === "all"
      ? true
      : normalizeRole(member.role) === memberSettingsFilters.role;
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
              <div>排班班別</div>
              <div>權限</div>
              <div>到職日<br>離職日</div>
              <div>計薪方式</div>
              <div>例假星期</div>
              <div class="member-table-actions-head">操作</div>
            </div>
            ${filteredMembers.map((member) => {
              const canEditAccount = canEditMemberAccount(member);
              return `
              <div class="member-table-row">
                <div class="member-table-code">${escapeHtml(member.code)}</div>
                <div class="member-table-name">${escapeHtml(member.name)}</div>
                <div class="member-shift-pill-list">${renderMemberScheduleShiftPills(member)}</div>
                <div>${getRoleLabel(member.role)}</div>
                <div class="member-date-stack"><span>${escapeHtml(member.hireDate || "-")}</span><span>${escapeHtml(member.leaveDate || "-")}</span></div>
                <div>${getSalaryTypeLabel(member)}</div>
                <div>${getRestWeekdayLabel(member.fixedRestWeekday)}</div>
                <div class="member-table-actions">
                  ${canEditAccount ? renderActionIconButton("edit", `data-edit-member="${member.id}"`) : ""}
                  ${canEditAccount ? renderActionIconButton("delete", `data-delete-member="${member.id}"`) : ""}
                </div>
              </div>
            `;
            }).join("")}
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
            <option value="admin" ${memberSettingsFilters.role === "admin" ? "selected" : ""}>管理員</option>
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
    modalClass: "modal modal-wide member-settings-modal settings-list-modal",
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-members="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-members="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-member="true">新增</button>
    `,
    hideFooterClose: true
  });
}

function renderMemberRoleOptions(member) {
  const currentRole = normalizeRole(member?.role);
  const options = isAdmin()
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value === currentRole);
  return options.map((option) => (
    `<option value="${option.value}" ${currentRole === option.value ? "selected" : ""}>${option.label}</option>`
  )).join("");
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
      scheduleShiftIds: [],
      role: "employee"
    };
  if (!member) {
    return;
  }
  if (!canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以修改管理員帳號");
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
          <select id="memberRole" ${isAdmin() ? "" : "disabled"}>
            ${renderMemberRoleOptions(member)}
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
        <div class="form-row">
          <label for="memberDept">所屬單位</label>
          <select id="memberDept">
            ${buildSelectOptions(state.departments, "id", (department) => department.name, member.deptId || "")}
          </select>
        </div>
        ${mode === "edit" ? `
          <div class="form-row">
            <button class="ghost-btn" type="button" data-reset-member-password="${escapeHtml(member.code)}">重設密碼為 0000</button>
          </div>
        ` : ""}
        <div class="form-row form-row-wide">
          <label>排班班別</label>
          <div class="schedule-dept-summary-row">
            <div class="readonly-pill schedule-shift-summary">${escapeHtml(getMemberScheduleShiftNames(member))}</div>
            <button class="ghost-btn compact-btn" type="button" data-toggle-schedule-shifts="true">設定</button>
          </div>
          ${renderScheduleShiftSelector(member)}
        </div>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-member="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
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
  const selectedHomeDeptId = document.getElementById("memberDept")?.value || "";
  const scheduleShiftIds = readMemberScheduleShiftIds();
  const homeDeptId = selectedHomeDeptId || previousMember?.deptId || "";
  const monthlyRestDays = Math.max(0, Number(previousMember?.monthlyRestDays) || 0);
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("m"),
    code: document.getElementById("memberCode")?.value.trim(),
    name: document.getElementById("memberName")?.value.trim(),
    deptId: homeDeptId,
    scheduleShiftIds,
    positionId: mode === "edit" ? (state.members.find((member) => member.id === modalContext.targetId)?.positionId || "") : "",
    proxyMemberId: "",
    hireDate,
    leaveDate,
    payByDay: document.getElementById("memberSalaryType")?.value === "daily",
    fixedRestWeekday: normalizeRestWeekday(document.getElementById("memberFixedRestWeekday")?.value),
    monthlyRestDays,
    role: isAdmin() ? normalizeRole(document.getElementById("memberRole")?.value) : normalizeRole(previousMember?.role)
  };
  if (!payload.code || !payload.name) {
    reportValidationError("請填寫人員編號與姓名");
    return;
  }
  if (!payload.deptId) {
    reportValidationError("請選擇所屬單位");
    return;
  }
  try {
    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");
  } catch (error) {
    reportValidationError(`同步人員資料失敗：${error.message}`);
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
    const shiftMap = new Map(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id]));
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
      const scheduleShiftNames = String(row.scheduleShiftNames || "")
        .split(/[、,，]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const hasUnknownScheduleShift = scheduleShiftNames.some((value) => !shiftMap.has(value));
      const scheduleShiftIds = scheduleShiftNames
        .map((value) => shiftMap.get(value))
        .filter((shiftIdValue, index, list) => shiftIdValue && list.indexOf(shiftIdValue) === index);
      if (!code || !name || !deptId || hasUnknownScheduleShift) {
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
        deptId,
        scheduleShiftIds,
        positionId: existing?.positionId || "",
        proxyMemberId: existing?.proxyMemberId || "",
        hireDate: row.hireDate || "",
        leaveDate: row.leaveDate || "",
        payByDay: Boolean(row.payByDay),
        fixedRestWeekday: normalizeRestWeekday(row.fixedRestWeekday),
        monthlyRestDays: Math.max(0, Number(row.monthlyRestDays) || 0),
        role: isAdmin() ? normalizeRole(row.role) : normalizeRole(existing?.role)
      };
      if (!existing) {
        try {
          await window.schedulerApi.syncMemberProfile(payload, "");
        } catch (error) {
          syncFailed += 1;
          if (!firstSyncError) {
            firstSyncError = `${code || "(空白工號)"}：${error.message || "同步失敗"}`;
          }
          continue;
        }
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
  const member = state.members.find((item) => item.id === memberId);
  if (member && !canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以刪除管理員帳號");
    return;
  }
  const confirmed = await confirmAction("確定要刪除這位人員嗎？");
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.deleteMemberProfile(member?.code || "");
  } catch (error) {
    showInfoMessage(error.message || "刪除人員失敗");
    return;
  }
  if (member?.code && member.code === currentProfile?.employee_code) {
    await signOut();
    showInfoMessage("目前登入帳號已刪除，已自動登出。");
    return;
  }
  state.members = state.members.filter((member) => member.id !== memberId);
  state.members = state.members.map((member) => ({
    ...member,
    proxyMemberId: member.proxyMemberId === memberId ? "" : member.proxyMemberId
  }));
  renderAll();
  openMemberSettings();
}

async function resetMemberPasswordFromModal(employeeCode) {
  const code = String(employeeCode || "").trim();
  if (!code) {
    return;
  }
  const member = state.members.find((item) => item.code === code);
  if (member && !canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以重設管理員密碼");
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

function getVisibleScheduleWeeks() {
  const visibleDates = getVisibleDates();
  const weeks = [];
  for (let index = 0; index < visibleDates.length; index += 7) {
    const dates = visibleDates.slice(index, index + 7);
    if (dates.length) {
      weeks.push({
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        dates
      });
    }
  }
  return weeks;
}

function buildRestComplianceCalendars(weeks) {
  const checker = window.restCompliance;
  if (!checker) {
    return [];
  }
  const dateRange = [...new Set(weeks.flatMap((week) => week.dates))];
  const visibleStartDate = dateRange[0] || getTodayDateString();
  const visibleEndDate = dateRange[dateRange.length - 1] || visibleStartDate;
  const slidingDateRange = enumerateDateRange(
    addDaysToDateString(visibleStartDate, -7),
    visibleEndDate
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

  const complianceWeeks = getVisibleScheduleWeeks();
  const complianceStartDate = complianceWeeks[0]?.startDate || getTodayDateString();
  const complianceEndDate = complianceWeeks[complianceWeeks.length - 1]?.endDate || complianceStartDate;
  const result = checker.checkRestCompliance({
    year: state.year,
    month: state.month,
    weeks: complianceWeeks,
    weekStart: getConfiguredWeekStart(),
    maxConsecutiveWorkDays: Math.max(1, Number(state.rules?.maxConsecutiveWorkDays) || 6),
    reportStartDate: complianceStartDate,
    reportEndDate: complianceEndDate,
    memberCalendars: buildRestComplianceCalendars(complianceWeeks)
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
        <div class="result-title">檢查範圍</div>
        <div class="result-detail">${escapeHtml(formatWeekRangeText(complianceStartDate, complianceEndDate))}</div>
      </div>
      <div class="result-item ${issueCount ? "warning" : "success"}">
        <div class="result-title">檢查結果</div>
        <div class="result-detail">${issueCount ? `${errorCount} 筆缺漏，${warningCount} 筆待確認` : "目前未發現缺少例假"}</div>
      </div>
    </div>
  `;
  const notes = `
    <div class="result-item">
      <div class="result-title">檢查說明</div>
      <div class="result-detail compliance-check-note">
        <div>目前檢查畫面顯示的 8 週，每 7 天為一週。</div>
        <div>到職日或離職日落在該週時，每週例假／休息日檢查會略過，改檢查「未在職日＋例假＋休息日」是否至少 2 天。</div>
        <div>這版只檢查系統內已標記的「例假 0036」；空白未排班不自動視為例假。</div>
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
        <div class="result-detail">目前依系統標記，顯示的 8 週未發現例假缺漏。</div>
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
  attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
  attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
  mealOrderState = { loading: false, status: null, error: "" };
  recordsState = createRecordsState();
  appInfo = null;
  closeModal();
  closeCoreActionsMenu();
  await loadApp();
}

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

async function forceSave() {
  if (!canEditSchedule()) {
    return false;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await window.schedulerApi.saveState(buildPersistedState());
    return true;
  } catch (error) {
    setSaveStatus(`儲存失敗：${error.message}`);
    return false;
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
    if (!isLoggedIn()) {
      openSignInDialog();
      return;
    }
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
  const topScrollbar = document.getElementById("tableTopScrollbar");
  if (topScrollbar) {
    topScrollbar.addEventListener("scroll", scrollScheduleHorizontallyFromTopScrollbar, { passive: true });
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
    currentSession = null;
    currentProfile = null;
    currentMember = null;
    attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
    attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
    mealOrderState = { loading: false, status: null, error: "" };
    recordsState = createRecordsState();
    state = createEmptyState();
    appView = "home";
    closeModal();
    closeCoreActionsMenu();
    renderAll();
  });

  document.body.addEventListener("click", async (event) => {
    const target = event.target.closest("button, td");
    if (!target) {
      return;
    }
    if (target.dataset.openSignIn) {
      closeCoreActionsMenu();
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
      closeCoreActionsMenu();
      await handleSignOut();
      return;
    }
    if (target.id === "homeSignOutButton") {
      await handleSignOut();
      return;
    }
    if (target.dataset.homeAction) {
      closeCoreActionsMenu();
      if (target.dataset.homeAction === "home") {
        appView = "home";
        renderAll();
        return;
      }
      if (target.dataset.homeAction === "clock") {
        appView = "clock";
        await loadTodayAttendance();
        return;
      }
      if (target.dataset.homeAction === "schedule") {
        appView = "schedule";
        renderAll();
        return;
      }
      if (target.dataset.homeAction === "meal") {
        appView = "meal";
        mealPageTab = "order";
        await loadTodayMealOrder();
        return;
      }
      if (target.dataset.homeAction === "records") {
        appView = "records";
        await loadRecordsPage();
        return;
      }
      const comingSoon = {
      };
      showInfoMessage(comingSoon[target.dataset.homeAction] || "此功能尚未開放");
      return;
    }
    if (target.dataset.clockAction) {
      await submitAttendanceClock(target.dataset.clockAction);
      return;
    }
    if (target.dataset.submitTodayOvertime) {
      await submitTodayOvertimeRequest();
      return;
    }
    if (target.dataset.deleteTodayOvertime) {
      await deleteTodayOvertimeRequest();
      return;
    }
    if (target.dataset.saveTodayMeal) {
      await saveTodayMealOrder();
      return;
    }
    if (target.dataset.mealTab) {
      mealPageTab = ["settings", "stats"].includes(target.dataset.mealTab) ? target.dataset.mealTab : "order";
      if (mealPageTab === "settings") {
        await loadMealAdminSettings(false);
      } else if (mealPageTab === "stats") {
        await loadMealReport(false);
      } else {
        mealOrderState = { ...mealOrderState, status: null, error: "" };
        await loadTodayMealOrder();
      }
      renderAll();
      return;
    }
    if (target.dataset.recordsTab) {
      recordsState.activeTab = target.dataset.recordsTab;
      renderAll();
      return;
    }
    if (target.dataset.loadMealReport) {
      await loadMealReport();
      return;
    }
    if (target.dataset.exportMealReport) {
      const result = await window.schedulerApi.exportMealReport(recordsState.mealStats);
      if (result.empty) showInfoMessage("目前沒有可匯出的訂餐資料");
      return;
    }
    if (target.dataset.loadOvertimeReview) {
      await loadOvertimeReview();
      return;
    }
    if (target.dataset.openOvertimeReview) {
      openOvertimeReviewModal(target.dataset.openOvertimeReview);
      return;
    }
    if (target.dataset.approveOvertime) {
      await reviewOvertime(target.dataset.approveOvertime, "approved");
      return;
    }
    if (target.dataset.returnOvertime) {
      await reviewOvertime(target.dataset.returnOvertime, "returned");
      return;
    }
    if (target.dataset.saveOvertimeReview) {
      await reviewOvertime(target.dataset.saveOvertimeReview, "pending", true);
      return;
    }
    if (target.dataset.openAdminOvertimeCreate) {
      openAdminOvertimeCreateModal();
      return;
    }
    if (target.dataset.saveAdminOvertimeCreate) {
      await saveAdminOvertimeCreate();
      return;
    }
    if (target.dataset.loadAttendanceAdmin) {
      recordsState.attendanceAdmin.page = 1;
      await loadAttendanceAdmin();
      return;
    }
    if (target.dataset.editAttendance) {
      openAttendanceEditModal(target.dataset.editAttendance);
      return;
    }
    if (target.dataset.saveAttendanceEdit) {
      await saveAttendanceEdit(target.dataset.saveAttendanceEdit);
      return;
    }
    if (target.dataset.viewAttendanceHistory) {
      await openAttendanceHistoryModal(target.dataset.viewAttendanceHistory);
      return;
    }
    if (target.dataset.addMealProduct) {
      recordsState.mealAdmin.products = [...recordsState.mealAdmin.products, { id: "", name: "", price: 0, is_active: true }];
      renderAll();
      return;
    }
    if (target.dataset.saveMealSettings) {
      await saveMealSettingsFromPage();
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
    if (target instanceof HTMLElement && target.dataset.tableMemberId && target.dataset.rowIndex) {
      selectScheduleRowFromMemberCell(target, event.shiftKey);
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
      target.dataset.toggleScheduleShifts ||
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
      closeCoreActionsMenu();
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
    if (target.dataset.saveShift) await saveShiftFromModal(target.dataset.saveShift);
    if (target.dataset.saveNamedItem) {
      const [category, mode] = target.dataset.saveNamedItem.split(":");
      await saveNamedColorItem(category, mode);
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
    if (target.dataset.toggleScheduleShifts) {
      const list = document.getElementById("memberScheduleShiftList");
      if (list) {
        list.hidden = !list.hidden;
      }
      return;
    }
    if (target.dataset.editDepartment) openDepartmentForm("edit", target.dataset.editDepartment);
    if (target.dataset.saveDepartment) await saveDepartment(target.dataset.saveDepartment);
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
    const shiftMember = event.target.closest("[data-shift-schedule-member]");
    if (shiftMember) {
      const memberId = shiftMember.dataset.shiftScheduleMember || "";
      if (memberId && canEditSchedule()) {
        openMemberForm("edit", memberId);
      }
      return;
    }
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
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption) {
      dragScheduleShiftId = scheduleShiftOption.dataset.scheduleShiftOption || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleShiftId);
      return;
    }
    const card = event.target.closest("[data-member-card]");
    if (card) {
      dragMemberId = card.dataset.memberCard || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMemberId);
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow) {
      dragMealProductIndex = mealProductRow.dataset.mealProductRow || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMealProductIndex);
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
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption && dragScheduleShiftId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewScheduleShiftOption(scheduleShiftOption, event.clientY);
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewDepartmentMember(memberTarget, event.clientY);
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow && dragMealProductIndex) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const draggedElement = document.querySelector(`[data-meal-product-row="${cssEscapeValue(dragMealProductIndex)}"]`);
      if (draggedElement instanceof HTMLElement) {
        draggedElement.classList.add("drag-preview-active");
        moveDragPreviewElement(draggedElement, mealProductRow, event.clientY);
      }
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
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption && dragScheduleShiftId) {
      event.preventDefault();
      syncScheduleShiftSelectorRanks();
      syncScheduleShiftSummary();
      clearDragPreviewState();
      dragScheduleShiftId = "";
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
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow && dragMealProductIndex) {
      event.preventDefault();
      commitMealProductOrderFromDom();
      clearDragPreviewState();
      dragMealProductIndex = "";
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
    dragScheduleShiftId = "";
    dragSortItemId = "";
    dragSortCategory = "";
    dragScheduleTableDeptId = "";
    dragScheduleTableMemberId = "";
    dragMealProductIndex = "";
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
  pushAppBackHistoryGuard();
  authErrorMessage = "";
  try {
    const authContext = await window.schedulerApi.initializeAuth();
    currentSession = authContext.session;
    currentProfile = authContext.profile;
    if (!currentSession?.user) {
      state = createEmptyState();
      currentMember = null;
      attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
      attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
      mealOrderState = { loading: false, status: null, error: "" };
      recordsState = createRecordsState();
      appInfo = null;
      appView = "home";
      authModalOpen = true;
      renderAll();
      syncCoreActionsMenu();
      return;
    }
    appInfo = await window.schedulerApi.getAppInfo();
    const payload = await window.schedulerApi.loadState();
    state = normalizeState(payload);
    resetScheduleWindowToToday();
    await ensureVisibleScheduleLoaded();
    currentMember = resolveCurrentMember();
    appView = "home";
  } catch (error) {
    setSaveStatus(`載入失敗：${error.message}`);
    authErrorMessage = error.message || "載入失敗";
    state = createEmptyState();
    currentSession = null;
    currentProfile = null;
    currentMember = null;
    attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
    attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
    mealOrderState = { loading: false, status: null, error: "" };
    recordsState = createRecordsState();
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
