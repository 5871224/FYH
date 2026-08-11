/* 按鈕、儲存格與雙擊的委派事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

let toolbarRapidEditKey = "";
let toolbarRapidEditAt = 0;
let toolbarRapidEditOpenedAt = 0;

function openToolbarChipEditor(type, id) {
  if (!id || (type !== "shift" && type !== "leave")) return false;
  if (!canEditSchedule()) {
    promptManagerAccess(`修改${type === "shift" ? "班別" : "假別"}需先登入主管帳號`);
    return true;
  }
  toolbarRapidEditOpenedAt = Date.now();
  state.selected = { type, id };
  renderToolbar();
  renderTable();
  if (type === "shift") openShiftFormModal("edit", id);
  else openNamedColorFormModal("leave", "edit", id);
  return true;
}

function handleToolbarChipClick(type, id) {
  if (!id || (type !== "shift" && type !== "leave")) return false;
  const now = Date.now();
  const key = `${type}:${id}`;
  const rapidSecondClick = key === toolbarRapidEditKey && now - toolbarRapidEditAt <= 550;
  toolbarRapidEditKey = key;
  toolbarRapidEditAt = now;
  if (!rapidSecondClick) return false;
  toolbarRapidEditKey = "";
  toolbarRapidEditAt = 0;
  return openToolbarChipEditor(type, id);
}

async function openScheduleMemberEditor(memberId) {
  if (!memberId || !canManageMembersInCurrentGroup()) {
    return;
  }
  await ensureManagerDirectoryLoaded();
  openMemberForm("edit", memberId);
}

function bindDelegatedClickEvents() {
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
      if (target.dataset.homeAction === "schedule") {
        const firstLoad = !scheduleApplicationLoaded;
        target.disabled = true;
        target.setAttribute("aria-busy", "true");
        if (firstLoad) await showScheduleLoadingIndicator();
        try {
          await ensureScheduleApplicationLoaded();
          appView = "schedule";
          renderAll();
        } catch (error) {
          showInfoMessage(`讀取班表失敗：${error.message || error}`);
        } finally {
          if (firstLoad) hideScheduleLoadingIndicator();
          target.disabled = false;
          target.removeAttribute("aria-busy");
        }
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
    if (target.dataset.personalClockAction) {
      await submitAttendanceClock(target.dataset.personalClockAction, target.dataset.personalClockDate || "");
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
      const nextTab = target.dataset.recordsTab;
      recordsState.activeTab = nextTab;
      if (nextTab === "review" && hasPermission("attendance_review") && !ensureAttendanceReviewState().loaded) {
        await loadAttendanceReview();
      } else {
        renderAll();
      }
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
    if (target.dataset.runPeriodExport) {
      await runPeriodExport(target.dataset.runPeriodExport);
      return;
    }
    if (target.dataset.editAttendanceReview) {
      openAttendanceReviewEditModal(target.dataset.editAttendanceReview);
      return;
    }
    if (target.dataset.saveAttendanceReview) {
      await saveAttendanceReviewEdit(target.dataset.saveAttendanceReview);
      return;
    }
    if (target.dataset.toggleAttendanceReview) {
      await setAttendanceReviewed(target.dataset.toggleAttendanceReview, target.dataset.reviewed !== "true");
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
    if (target.dataset.deleteMealProduct !== undefined) {
      await deleteMealProduct(target);
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
    if (target instanceof HTMLElement && target.dataset.tableMemberId && target.dataset.rowIndex && canEditSchedule()) {
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
    if (managerOnlyAction && !hasManagementAccess()) {
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
      const chipType = target.dataset.chipType || "";
      const chipId = target.dataset.chipId || "";
      if (handleToolbarChipClick(chipType, chipId)) return;
      selectChip(chipType, chipId || null);
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
    if (target.dataset.editMember) {
      openMemberForm("edit", target.dataset.editMember);
      return;
    }
    if (target.dataset.saveMember) {
      await saveMember(target.dataset.saveMember);
      return;
    }
    if (target.dataset.deleteMember) {
      await deleteMember(target.dataset.deleteMember);
    }
  });

  document.body.addEventListener("dblclick", async (event) => {
    const toolbarChip = event.target.closest('#shiftChips [data-chip-type="shift"][data-chip-id], #leaveChips [data-chip-type="leave"][data-chip-id]');
    if (toolbarChip) {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - toolbarRapidEditOpenedAt > 700) {
        openToolbarChipEditor(toolbarChip.dataset.chipType || "", toolbarChip.dataset.chipId || "");
      }
      return;
    }
    const shiftMember = event.target.closest("[data-shift-schedule-member]");
    if (shiftMember) {
      const memberId = shiftMember.dataset.shiftScheduleMember || "";
      if (memberId) {
        await openScheduleMemberEditor(memberId);
      }
      return;
    }
    const target = event.target.closest("[data-table-member-id], [data-table-department-id]");
    if (!target) return;
    const memberId = target.dataset.tableMemberId;
    if (memberId) {
      await openScheduleMemberEditor(memberId);
      return;
    }
    const deptId = target.dataset.tableDepartmentId;
    if (deptId && canManageDepartmentsInCurrentGroup()) {
      openDepartmentForm("edit", deptId);
    }
  });
}
