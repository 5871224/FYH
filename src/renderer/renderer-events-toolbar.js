/* 工具列、班表捲動與篩選事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function closeFunctionMenuTouchSections(menu, except = null) {
  menu.querySelectorAll(".core-actions-menu-category.touch-open").forEach((category) => {
    if (category === except) return;
    category.classList.remove("touch-open");
    category.querySelector(":scope > .core-actions-menu-trigger")?.setAttribute("aria-expanded", "false");
  });
}

async function runFunctionMenuAction(action) {
  if (action === "week-start-settings") return openWeekStartSettingModal();
  if (action === "auto-schedule-preview") return previewAutoSchedule();
  if (action === "auto-fill-schedule-preview") return openAutoFillSchedulePeriodModal();
  if (action === "auto-schedule-apply") return applyAutoSchedulePreview();
  if (action === "auto-schedule-cancel") return cancelAutoSchedulePreview();
  if (action === "print-schedule") return window.openSchedulePrintRangeDialog?.();
  if (action === "export-workday") return openExportPeriodDialog("workday");
  if (action === "export-sap") return openExportPeriodDialog("sap");
  if (action === "export-leave") return openExportPeriodDialog("leave");
  if (action === "export-overtime") return openExportPeriodDialog("overtime");
}

function bindCoreActionsMenuEvents() {
  const menu = document.getElementById("coreActionsMenu");
  if (!menu) return;
  const touchLikePointer = window.matchMedia("(hover: none), (pointer: coarse)");
  menu.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest(".core-actions-menu-trigger") : null;
    if (trigger && touchLikePointer.matches) {
      event.preventDefault();
      event.stopPropagation();
      const category = trigger.closest(".core-actions-menu-category");
      if (!category) return;
      const opening = !category.classList.contains("touch-open");
      closeFunctionMenuTouchSections(menu, category);
      category.classList.toggle("touch-open", opening);
      trigger.setAttribute("aria-expanded", opening ? "true" : "false");
      if (opening) trigger.focus({ preventScroll: true });
      return;
    }
    const button = event.target instanceof Element ? event.target.closest("button[data-function-menu-action]") : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.functionMenuAction || "";
    closeCoreActionsMenu();
    void runFunctionMenuAction(action);
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    closeFunctionMenuTouchSections(menu);
  });
}

function bindStaticToolbarEvents() {
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  };

  bindScheduleHistoryControls();
  bindAutoFillScheduleControls();
  bindCoreActionsMenuEvents();

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
  bindClick("prevPeriodButton", async () => changeSchedulePeriodWeeks(-8));
  bindClick("prevWeekButton", () => scrollScheduleByWeeks(-1));
  bindClick("nextWeekButton", () => scrollScheduleByWeeks(1));
  bindClick("nextPeriodButton", async () => changeSchedulePeriodWeeks(8));
  bindClick("tablePrevWeekButton", () => scrollScheduleByWeeks(-1));
  bindClick("tableNextWeekButton", () => scrollScheduleByWeeks(1));
  bindClick("deptSettingsButton", openDepartmentSettings);
  bindClick("shiftSettingsButton", () => openListSettings("shift"));
  bindClick("leaveSettingsButton", () => openListSettings("leave"));
  bindClick("overtimeSettingsButton", () => openListSettings("overtime"));
  bindClick("restComplianceButton", () => {
    closeCoreActionsMenu();
    openRestComplianceModal();
  });
}

function bindScheduleViewportEvents() {
  const tableWrap = document.getElementById("tableWrap");
  if (tableWrap) {
    tableWrap.addEventListener("scroll", () => {
      syncStickyHeaderScroll();
      syncScheduleWeekNavigationButtons();
    }, { passive: true });
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
    syncScheduleWeekNavigationButtons();
    if (!toolbarCollapseInitialized) {
      initializeToolbarCollapse();
    }
    syncToolbarCollapseUi();
  });
}

function bindScheduleFilterEvents() {
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
}
