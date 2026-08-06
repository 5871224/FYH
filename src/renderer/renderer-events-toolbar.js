/* 工具列、班表捲動與篩選事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindStaticToolbarEvents() {
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  };

  bindScheduleHistoryControls();
  bindAutoFillScheduleControls();

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
    openExportPeriodDialog("sap");
  });
  bindClick("exportOvertimeButton", () => {
    closeCoreActionsMenu();
    openExportPeriodDialog("overtime");
  });
  bindClick("exportLeaveButton", () => {
    closeCoreActionsMenu();
    openExportPeriodDialog("leave");
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
}

function bindScheduleViewportEvents() {
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
