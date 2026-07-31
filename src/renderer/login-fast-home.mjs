(() => {
  if (typeof window === "undefined" || window.__FYH_FAST_LOGIN_BOOTSTRAP_INSTALLED__) {
    return;
  }
  window.__FYH_FAST_LOGIN_BOOTSTRAP_INSTALLED__ = true;

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

  function renderAuthenticatedHomeEarly(authContext) {
    if (!canRenderAuthenticatedHome(authContext)) {
      return;
    }
    currentSession = authContext.session;
    currentProfile = authContext.profile;
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
        return authContext;
      };
    }

    if (typeof api.initializeAuth === "function") {
      const baseInitializeAuth = api.initializeAuth.bind(api);
      api.initializeAuth = async (...args) => {
        const authContext = pendingAuthContext || await baseInitializeAuth(...args);
        pendingAuthContext = null;
        renderAuthenticatedHomeEarly(authContext);
        return authContext;
      };
    }

    if (typeof api.signOut === "function") {
      const baseSignOut = api.signOut.bind(api);
      api.signOut = async (...args) => {
        pendingAuthContext = null;
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
})();
