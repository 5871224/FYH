(() => {
  if (typeof window === "undefined" || window.__FYH_PAGE_LAZY_DATA_INSTALLED__) return;
  window.__FYH_PAGE_LAZY_DATA_INSTALLED__ = true;

  function getPageDataState() {
    if (!window.__FYH_PAGE_DATA_STATE__) {
      window.__FYH_PAGE_DATA_STATE__ = {
        bootstrapActive: true,
        userId: "",
        scheduleLoaded: false,
        scheduleLoading: null,
        groupBundleLoaded: false,
        groupEntitiesLoaded: false
      };
    }
    return window.__FYH_PAGE_DATA_STATE__;
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

  const fullLoadGroupAccessData = typeof loadGroupAccessData === "function"
    ? loadGroupAccessData
    : null;

  if (fullLoadGroupAccessData) {
    loadGroupAccessData = async function loadGroupAccessDataOnDemand() {
      const pageData = getPageDataState();
      if (!pageData.bootstrapActive) {
        const entityMap = await groupRpc("get_group_entity_map_v1");
        groupFeatureState.entityMap = entityMap && typeof entityMap === "object"
          ? entityMap
          : { departments: [], members: [], shifts: [], archiveRanges: [] };
        pageData.groupBundleLoaded = Boolean(groupFeatureState?.bundle?.actor);
        pageData.groupEntitiesLoaded = true;
        return {
          bundle: groupFeatureState.bundle,
          entityMap: groupFeatureState.entityMap
        };
      }

      const bundle = await groupRpc("get_group_access_bundle_v1");
      groupFeatureState.bundle = bundle && typeof bundle === "object"
        ? bundle
        : { actor: {}, groups: [], roles: [] };
      groupFeatureState.entityMap = { departments: [], members: [], shifts: [], archiveRanges: [] };
      pageData.groupBundleLoaded = true;
      pageData.groupEntitiesLoaded = false;
      return {
        bundle: groupFeatureState.bundle,
        entityMap: groupFeatureState.entityMap
      };
    };
  }

  async function ensureSchedulePageData() {
    const pageData = getPageDataState();
    if (pageData.scheduleLoaded) return;
    if (pageData.scheduleLoading) {
      await pageData.scheduleLoading;
      return;
    }

    pageData.bootstrapActive = false;
    pageData.scheduleLoading = (async () => {
      try {
        await reloadGroupApplicationState();
        pageData.scheduleLoaded = true;
        pageData.groupBundleLoaded = true;
        pageData.groupEntitiesLoaded = true;
      } catch (error) {
        pageData.bootstrapActive = true;
        pageData.scheduleLoaded = false;
        throw error;
      } finally {
        pageData.scheduleLoading = null;
      }
    })();

    await pageData.scheduleLoading;
  }

  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest?.('button[data-home-action="schedule"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeCoreActionsMenu?.();

    if (!isLoggedIn?.()) {
      openSignInDialog?.("請先登入");
      return;
    }

    const pageData = getPageDataState();
    const shouldShowLoading = !pageData.scheduleLoaded;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (shouldShowLoading) await showScheduleLoadingIndicator();
    try {
      await ensureSchedulePageData();
      appView = "schedule";
      renderAll();
    } catch (error) {
      showInfoMessage?.(`讀取班表失敗：${error?.message || error}`);
    } finally {
      if (shouldShowLoading) hideScheduleLoadingIndicator();
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }, true);

  window.addEventListener("scheduler-session-expired", () => {
    const pageData = getPageDataState();
    pageData.bootstrapActive = true;
    pageData.scheduleLoaded = false;
    pageData.scheduleLoading = null;
    pageData.groupBundleLoaded = false;
    pageData.groupEntitiesLoaded = false;
    hideScheduleLoadingIndicator();
  });
})();
