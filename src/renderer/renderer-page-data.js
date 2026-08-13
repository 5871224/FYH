/* 頁面資料載入生命週期。
 * 首頁只載入身分與權限；班表資料在第一次進入班表時載入。
 * 不覆寫 schedulerApi，也不攔截事件。
 */

let scheduleApplicationLoaded = false;
let scheduleApplicationLoading = null;

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
