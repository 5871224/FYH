/* 頁面資料載入生命週期。
 * 首頁只載入身分與權限；班表資料在第一次進入班表時載入。
 * 不覆寫 schedulerApi，也不攔截事件。
 */

let scheduleApplicationLoaded = false;
let scheduleApplicationLoading = null;

// 僅保存目前分頁的位置，不儲存班表、簽到或權限等業務資料。
const LAST_PAGE_STATE_KEY = "fyh.lastPage.v1";

function readSavedPageState() {
  if (!isLoggedIn()) return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(LAST_PAGE_STATE_KEY) || "null");
    if (saved?.userId !== String(currentUser.id)) return null;
    if (saved.view === "schedule") return { view: "schedule" };
    if (saved.view === "records") {
      return {
        view: "records",
        tab: ["personal", "review", "attachments"].includes(saved.tab) ? saved.tab : "personal"
      };
    }
  } catch {
    // 瀏覽器限制儲存空間時沿用一般首頁流程。
  }
  return null;
}

function saveCurrentPageState() {
  if (!isLoggedIn()) return;
  try {
    window.sessionStorage.setItem(LAST_PAGE_STATE_KEY, JSON.stringify({
      userId: String(currentUser.id),
      view: ["schedule", "records"].includes(appView) ? appView : "home",
      tab: appView === "records" ? recordsState.activeTab : "personal"
    }));
  } catch {
    // 儲存頁面位置失敗不應阻礙操作。
  }
}

function clearSavedPageState() {
  try {
    window.sessionStorage.removeItem(LAST_PAGE_STATE_KEY);
  } catch {
    // sessionStorage 不可用時仍正常登出。
  }
}

function getScheduleLoadingIndicator() {
  let overlay = document.getElementById("schedulePageLoading");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "schedulePageLoading";
  overlay.className = "schedule-page-loading";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "班表載入中");
  overlay.innerHTML = '<div class="schedule-page-loading-indicator" aria-hidden="true"><span class="schedule-page-loading-spinner"></span></div>';
  document.body.appendChild(overlay);
  return overlay;
}

async function showScheduleLoadingIndicator() {
  const overlay = getScheduleLoadingIndicator();
  overlay.hidden = false;
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function hideScheduleLoadingIndicator() {
  const overlay = document.getElementById("schedulePageLoading");
  if (overlay) overlay.hidden = true;
}

function clearScheduleApplicationState() {
  scheduleApplicationLoaded = false;
  scheduleApplicationLoading = null;
  groupFeatureState.entityMap = { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] };
  groupFeatureState.catalog.departments = [];
  groupFeatureState.catalog.members = [];
  groupFeatureState.catalog.shifts = [];
  groupFeatureState.catalog.schedule = {};
  groupFeatureState.initialized = false;
  hideScheduleLoadingIndicator();
}

async function initializeAuthenticatedHome(authContext) {
  if (!applyAuthContext(authContext)) return false;
  const savedPage = readSavedPageState();

  state = createEmptyState();
  resetLoadedUserRuntimeState();
  clearScheduleApplicationState();
  const [nextAppInfo, accessBundle] = await Promise.all([
    window.schedulerApi.getAppInfo(),
    window.schedulerApi.getGroupAccessBundle()
  ]);
  appInfo = nextAppInfo;
  groupFeatureState.bundle = accessBundle && typeof accessBundle === "object"
    ? accessBundle
    : { actor: {}, groups: [], roles: [] };
  groupFeatureState.currentGroupId = chooseCurrentGroupId();
  appView = "home";
  authModalOpen = false;
  authErrorMessage = "";

  // Session 恢復後才按需載入先前頁面；權限已變更時不可回到無權限的頁籤。
  if (savedPage?.view === "schedule" && getSelectableGroups().length > 0) {
    try {
      await ensureScheduleApplicationLoaded();
      resetToolbarCollapseOnScheduleEntry();
      appView = "schedule";
    } catch (error) {
      showInfoMessage(`恢復班表頁失敗：${error.message || error}`);
    }
  } else if (savedPage?.view === "records") {
    appView = "records";
    const canReview = hasAnyGroupPermission("attendance_review");
    recordsState.activeTab = canReview || savedPage.tab === "personal" ? savedPage.tab : "personal";
    if (recordsState.activeTab === "review") {
      await loadAttendanceReview(false);
    } else if (recordsState.activeTab === "attachments") {
      await loadAttachmentManager(false);
    } else {
      await loadRecordsPage(false);
    }
  }
  return true;
}

async function ensureScheduleApplicationLoaded() {
  if (scheduleApplicationLoaded) return true;
  if (scheduleApplicationLoading) return scheduleApplicationLoading;

  scheduleApplicationLoading = (async () => {
    try {
      const payload = await window.schedulerApi.loadState();
      await loadGroupAccessData(payload);
      state = initializeGroupPermissionState(payload);
      resetScheduleWindowToToday();
      await ensureVisibleScheduleLoaded();
      currentMember = resolveCurrentMember();
      scheduleApplicationLoaded = true;
      return true;
    } catch (error) {
      scheduleApplicationLoaded = false;
      throw error;
    } finally {
      scheduleApplicationLoading = null;
    }
  })();

  return scheduleApplicationLoading;
}
