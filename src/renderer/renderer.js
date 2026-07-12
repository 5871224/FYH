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
