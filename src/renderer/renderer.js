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
let managerDirectoryLoaded = false;
let managerDirectoryLoading = null;
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

let scheduleUndoStack = [];
let scheduleRedoStack = [];
let autoSchedulePreview = null;

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

async function ensureManagerDirectoryLoaded() {
  if (!isManager() || managerDirectoryLoaded) {
    return;
  }
  if (!managerDirectoryLoading) {
    managerDirectoryLoading = window.schedulerApi.loadEmployeeAdminDirectory()
      .then((adminMembers) => {
        const adminById = new Map((adminMembers || []).map((member) => [member.id, member]));
        state.members = state.members.map((member) => {
          const adminMember = adminById.get(member.id);
          return adminMember ? { ...member, ...adminMember, id: member.id } : member;
        });
        managerDirectoryLoaded = true;
        currentMember = resolveCurrentMember();
      })
      .finally(() => {
        managerDirectoryLoading = null;
      });
  }
  await managerDirectoryLoading;
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
  if (currentProfile?.id) {
    const byId = state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
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
    managerDirectoryLoaded = false;
    managerDirectoryLoading = null;
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
        try {
          await ensureManagerDirectoryLoaded();
        } catch (error) {
          showInfoMessage(`讀取班表管理資料失敗：${error.message || error}`);
          return;
        }
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
      await openDepartmentSettings();
      return;
    }
    if (target.dataset.openMemberSettings) {
      await openMemberSettings();
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
    if (target.dataset.saveDepartment) {
      await saveDepartment(target.dataset.saveDepartment);
      return;
    }
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
  managerDirectoryLoaded = false;
  managerDirectoryLoading = null;
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
