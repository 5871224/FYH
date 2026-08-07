(() => {
  if (typeof window === "undefined" || window.__FYH_FAST_LOGIN_BOOTSTRAP_INSTALLED__) {
    return;
  }
  window.__FYH_FAST_LOGIN_BOOTSTRAP_INSTALLED__ = true;

  function createPageDataState(userId = "") {
    return {
      bootstrapActive: true,
      userId: String(userId || ""),
      scheduleLoaded: false,
      scheduleLoading: null,
      groupBundleLoaded: false,
      groupEntitiesLoaded: false
    };
  }

  function resetPageDataState(userId = "") {
    window.__FYH_PAGE_DATA_STATE__ = createPageDataState(userId);
    return window.__FYH_PAGE_DATA_STATE__;
  }

  function getPageDataState() {
    return window.__FYH_PAGE_DATA_STATE__ || resetPageDataState("");
  }

  resetPageDataState("");

  let schedulerApiValue = window.schedulerApi || null;
  let pendingAuthContext = null;

  function canRenderAuthenticatedHome(authContext) {
    return Boolean(
      authContext?.session?.user
      && typeof createEmptyState === "function"
      && typeof resetLoadedUserRuntimeState === "function"
      && typeof renderAll === "function"
      && typeof syncCoreActionsMenu === "function"
    );
  }

  function prepareAuthenticatedRuntime(authContext) {
    const userId = authContext?.session?.user?.id || "";
    const pageData = getPageDataState();
    if (pageData.userId !== userId) {
      resetPageDataState(userId);
    }
    currentSession = authContext.session;
    currentProfile = authContext.profile;
  }

  function renderAuthenticatedHomeEarly(authContext) {
    if (!canRenderAuthenticatedHome(authContext)) {
      return;
    }
    prepareAuthenticatedRuntime(authContext);
    state = createEmptyState();
    resetLoadedUserRuntimeState();
    appView = "home";
    authModalOpen = false;
    authErrorMessage = "";
    renderAll();
    syncCoreActionsMenu();
  }

  function wrapSchedulerApi(api) {
    if (!api || api.__FYH_FAST_LOGIN_WRAPPED__) {
      return api;
    }
    Object.defineProperty(api, "__FYH_FAST_LOGIN_WRAPPED__", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });

    if (typeof api.signIn === "function") {
      const baseSignIn = api.signIn.bind(api);
      api.signIn = async (...args) => {
        const authContext = await baseSignIn(...args);
        pendingAuthContext = authContext;
        resetPageDataState(authContext?.session?.user?.id || "");
        return authContext;
      };
    }

    if (typeof api.initializeAuth === "function") {
      const baseInitializeAuth = api.initializeAuth.bind(api);
      api.initializeAuth = async (...args) => {
        const authContext = pendingAuthContext || await baseInitializeAuth(...args);
        pendingAuthContext = null;
        if (authContext?.session?.user) {
          prepareAuthenticatedRuntime(authContext);
          renderAuthenticatedHomeEarly(authContext);
        } else {
          resetPageDataState("");
        }
        return authContext;
      };
    }

    if (typeof api.loadState === "function") {
      const baseLoadState = api.loadState.bind(api);
      api.loadState = async (...args) => {
        if (getPageDataState().bootstrapActive && typeof createEmptyState === "function") {
          return createEmptyState();
        }
        return baseLoadState(...args);
      };
    }

    if (typeof api.loadScheduleEntries === "function") {
      const baseLoadScheduleEntries = api.loadScheduleEntries.bind(api);
      api.loadScheduleEntries = async (range = {}, ...args) => {
        if (getPageDataState().bootstrapActive) {
          const startDate = String(range?.startDate || "");
          const endDate = String(range?.endDate || "");
          return {
            schedule: {},
            scheduleLoadedRanges: startDate && endDate ? [{ startDate, endDate }] : []
          };
        }
        return baseLoadScheduleEntries(range, ...args);
      };
    }

    if (typeof api.syncCatalogs === "function") {
      const baseSyncCatalogs = api.syncCatalogs.bind(api);
      api.syncCatalogs = async (...args) => {
        if (getPageDataState().bootstrapActive) {
          return { ok: true, skipped: true };
        }
        return baseSyncCatalogs(...args);
      };
    }

    if (typeof api.signOut === "function") {
      const baseSignOut = api.signOut.bind(api);
      api.signOut = async (...args) => {
        pendingAuthContext = null;
        resetPageDataState("");
        return baseSignOut(...args);
      };
    }

    return api;
  }

  schedulerApiValue = wrapSchedulerApi(schedulerApiValue);
  Object.defineProperty(window, "schedulerApi", {
    configurable: true,
    enumerable: true,
    get() {
      return schedulerApiValue;
    },
    set(value) {
      schedulerApiValue = wrapSchedulerApi(value);
    }
  });

  window.addEventListener("scheduler-session-expired", () => {
    pendingAuthContext = null;
    resetPageDataState("");
  });
})();
