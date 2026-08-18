/* 輸入欄位與選單異動的委派事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindDelegatedFormEvents() {
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
    if (isMealQuantityInput(target)) {
      const raw = target.value.trim();
      if (raw !== "" && !/^\d+$/.test(raw)) {
        target.value = target.dataset.lastValidMealQuantity || "0";
        rejectQuantityInput(target, event);
        return;
      }
      target.setCustomValidity("");
      target.dataset.lastValidMealQuantity = raw || "0";
      updateMealOrderLiveSummary();
      return;
    }
    if (isCompanySubsidyInput(target)) {
      const raw = target.value.trim();
      if (raw !== "" && !/^[1-9]\d*$/.test(raw)) {
        target.value = target.dataset.lastValidCompanySubsidy || "55";
        rejectInput(target, event, MEAL_SUBSIDY_ERROR);
        return;
      }
      target.setCustomValidity("");
      if (raw) target.dataset.lastValidCompanySubsidy = raw;
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
    if (!(target instanceof HTMLInputElement)) {
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
      moveChangedScheduleShiftOptionToSelectionOrder(target);
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

  document.addEventListener("keydown", (event) => {
    const input = event.target;
    if (isMealQuantityInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectQuantityInput(input, event);
    }
    if (isCompanySubsidyInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectInput(input, event, MEAL_SUBSIDY_ERROR);
    }
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !String(event.inputType || "").startsWith("insert")) return;
    if (event.inputType === "insertFromPaste") return;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    const nextValue = `${input.value.slice(0, start)}${event.data || ""}${input.value.slice(end)}`;
    if (isMealQuantityInput(input) && !/^\d*$/.test(nextValue)) rejectQuantityInput(input, event);
    if (isCompanySubsidyInput(input) && !/^(?:|[1-9]\d*)$/.test(nextValue)) rejectInput(input, event, MEAL_SUBSIDY_ERROR);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const pasted = event.clipboardData?.getData("text")?.trim() || "";
    if (isMealQuantityInput(input) && !/^\d+$/.test(pasted)) rejectQuantityInput(input, event);
    if (isCompanySubsidyInput(input) && !/^[1-9]\d*$/.test(pasted)) rejectInput(input, event, MEAL_SUBSIDY_ERROR);
  }, true);
}
