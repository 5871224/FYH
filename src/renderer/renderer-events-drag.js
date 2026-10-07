/* 班表、設定、人員與訂餐品項拖曳事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */


let generalDragAutoScrollController = null;
let generalDragScrollContainer = null;

function isScheduleTableOrderDragging() {
  return Boolean(dragScheduleTableDeptId || dragScheduleTableMemberId);
}

function isGeneralSortableDragging() {
  return Boolean(
    dragScheduleTableDeptId
    || dragScheduleTableMemberId
    || dragScheduleShiftId
    || dragMemberId
    || dragMealProductIndex
    || dragSortItemId
  );
}

function getScheduleTableOrderAutoScrollBounds() {
  const tableWrap = document.getElementById("tableWrap");
  if (!(tableWrap instanceof HTMLElement)) return null;
  const rect = tableWrap.getBoundingClientRect();
  const stickyHeader = document.getElementById("tableStickyHeader");
  const stickyBottom = stickyHeader?.getBoundingClientRect?.().bottom || 0;
  return {
    left: rect.left,
    right: rect.right,
    top: Math.max(rect.top, stickyBottom, 0),
    bottom: Math.min(rect.bottom, window.innerHeight || document.documentElement.clientHeight || rect.bottom)
  };
}

function getGeneralDragAutoScrollBounds() {
  return isScheduleTableOrderDragging()
    ? getScheduleTableOrderAutoScrollBounds()
    : getVerticalDragScrollBounds(generalDragScrollContainer);
}

function refreshGeneralDragPreviewAtPointer(pointer) {
  if (!pointer || typeof document.elementFromPoint !== "function") return;
  const target = document.elementFromPoint(pointer.x, pointer.y);
  if (!(target instanceof Element)) return;
  const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";

  const tableDepartment = target.closest("[data-table-department-id]");
  if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
    markScheduleTableOrderTarget(tableDepartment, pointer.y);
    return;
  }
  const tableMember = target.closest("[data-table-member-id]");
  if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder && tableMember.dataset.tableMemberId !== dragScheduleTableMemberId) {
    markScheduleTableOrderTarget(tableMember, pointer.y);
    return;
  }
  const scheduleShiftOption = target.closest("[data-schedule-shift-option]");
  if (scheduleShiftOption && dragScheduleShiftId) {
    previewScheduleShiftOption(scheduleShiftOption, pointer.y);
    return;
  }
  const emptyDepartmentTarget = target.closest("[data-table-empty-department-id]");
  if (emptyDepartmentTarget && dragScheduleTableMemberId && canDragScheduleOrder) {
    markDragPreviewTarget(emptyDepartmentTarget);
    return;
  }
  const memberTarget = target.closest("[data-drop-member]");
  if (memberTarget && dragMemberId) {
    previewDepartmentMember(memberTarget, pointer.y);
    return;
  }
  const mealProductRow = target.closest("[data-meal-product-row]");
  if (mealProductRow && dragMealProductIndex) {
    const draggedElement = document.querySelector(`[data-meal-product-row="${cssEscapeValue(dragMealProductIndex)}"]`);
    if (draggedElement instanceof HTMLElement) {
      draggedElement.classList.add("drag-preview-active");
      moveDragPreviewElement(draggedElement, mealProductRow, pointer.y);
    }
    return;
  }
  const sortItem = target.closest("[data-sort-item]");
  if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
    previewSortableSettingsItem(sortItem, pointer.y);
  }
}

function applyGeneralDragAutoScroll({ deltaY, pointer }) {
  const changed = scrollVerticalDragTarget(
    isScheduleTableOrderDragging() ? null : generalDragScrollContainer,
    deltaY
  );
  if (changed) refreshGeneralDragPreviewAtPointer(pointer);
  return changed;
}

function getGeneralDragAutoScrollController() {
  if (!generalDragAutoScrollController) {
    generalDragAutoScrollController = createFixedEdgeAutoScrollController({
      isActive: isGeneralSortableDragging,
      getBounds: getGeneralDragAutoScrollBounds,
      onStep: applyGeneralDragAutoScroll,
      horizontal: false,
      vertical: true,
      edgeSize: 56,
      speedY: 18
    });
  }
  return generalDragAutoScrollController;
}

function updateGeneralDragAutoScroll(event) {
  if (!isGeneralSortableDragging()) return;
  if (!isScheduleTableOrderDragging()) {
    generalDragScrollContainer = findNearestVerticalDragScrollContainer(event.target);
  }
  getGeneralDragAutoScrollController().updatePointer(event.clientX, event.clientY);
}

function stopGeneralDragAutoScroll() {
  generalDragAutoScrollController?.stop();
  generalDragScrollContainer = null;
}

function bindDragAndDropEvents() {
  document.body.addEventListener("dragstart", (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && canDragScheduleOrder) {
      dragScheduleTableDeptId = tableDepartment.dataset.tableDepartmentId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleTableDeptId);
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && canDragScheduleOrder) {
      dragScheduleTableMemberId = tableMember.dataset.tableMemberId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleTableMemberId);
      return;
    }
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption) {
      dragScheduleShiftId = scheduleShiftOption.dataset.scheduleShiftOption || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleShiftId);
      return;
    }
    const card = event.target.closest("[data-member-card]");
    if (card) {
      dragMemberId = card.dataset.memberCard || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMemberId);
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow) {
      if (!event.target.closest(".meal-drag-handle")) {
        event.preventDefault();
        return;
      }
      dragMealProductIndex = mealProductRow.dataset.mealProductRow || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMealProductIndex);
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem) {
      if (!event.target.closest(".settings-order-drag-handle")) {
        event.preventDefault();
        return;
      }
      dragSortItemId = sortItem.dataset.sortItem || "";
      dragSortCategory = sortItem.dataset.sortCategory || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragSortItemId);
      return;
    }
  });

  document.body.addEventListener("dragover", (event) => {
    updateGeneralDragAutoScroll(event);
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markScheduleTableOrderTarget(tableDepartment, event.clientY);
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder && tableMember.dataset.tableMemberId !== dragScheduleTableMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markScheduleTableOrderTarget(tableMember, event.clientY);
      return;
    }
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption && dragScheduleShiftId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewScheduleShiftOption(scheduleShiftOption, event.clientY);
      return;
    }
    const emptyDepartmentTarget = event.target.closest("[data-table-empty-department-id]");
    if (emptyDepartmentTarget && dragScheduleTableMemberId && canDragScheduleOrder) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markDragPreviewTarget(emptyDepartmentTarget);
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewDepartmentMember(memberTarget, event.clientY);
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow && dragMealProductIndex) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const draggedElement = document.querySelector(`[data-meal-product-row="${cssEscapeValue(dragMealProductIndex)}"]`);
      if (draggedElement instanceof HTMLElement) {
        draggedElement.classList.add("drag-preview-active");
        moveDragPreviewElement(draggedElement, mealProductRow, event.clientY);
      }
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewSortableSettingsItem(sortItem, event.clientY);
      return;
    }
    const dropZone = event.target.closest("[data-drop-department]");
    if (!dropZone || !dragMemberId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  document.body.addEventListener("drop", async (event) => {
    stopGeneralDragAutoScroll();
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
      event.preventDefault();
      await reorderScheduleTableDepartment(dragScheduleTableDeptId, tableDepartment.dataset.tableDepartmentId || "", getScheduleTableOrderInsertAfter(tableDepartment, event.clientY));
      clearDragPreviewState();
      dragScheduleTableDeptId = "";
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder) {
      event.preventDefault();
      await reorderScheduleTableMember(dragScheduleTableMemberId, tableMember.dataset.tableMemberId || "", getScheduleTableOrderInsertAfter(tableMember, event.clientY));
      clearDragPreviewState();
      dragScheduleTableMemberId = "";
      return;
    }
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption && dragScheduleShiftId) {
      event.preventDefault();
      syncScheduleShiftSelectorRanks();
      syncScheduleShiftSummary();
      clearDragPreviewState();
      dragScheduleShiftId = "";
      return;
    }
    const emptyDepartmentTarget = event.target.closest("[data-table-empty-department-id]");
    if (emptyDepartmentTarget && dragScheduleTableMemberId && canDragScheduleOrder) {
      event.preventDefault();
      const memberId = dragScheduleTableMemberId;
      const departmentId = emptyDepartmentTarget.dataset.tableEmptyDepartmentId || "";
      clearDragPreviewState();
      dragScheduleTableMemberId = "";
      try {
        await moveScheduleTableMemberToDepartment(memberId, departmentId);
      } catch (error) {
        setSaveStatus(`移動人員失敗：${error.message}`);
        renderAll();
      }
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      if (dragPreviewElement?.dataset.memberCard === dragMemberId) {
        commitDepartmentMemberOrderFromDom();
      } else {
        await moveMemberToDepartment(
          dragMemberId,
          memberTarget.dataset.dropDepartment || "",
          memberTarget.dataset.dropMember || ""
        );
      }
      clearDragPreviewState();
      dragMemberId = "";
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow && dragMealProductIndex) {
      event.preventDefault();
      commitMealProductOrderFromDom();
      clearDragPreviewState();
      dragMealProductIndex = "";
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
      event.preventDefault();
      commitSortedListFromDom(dragSortCategory);
      clearDragPreviewState();
      dragSortItemId = "";
      dragSortCategory = "";
      return;
    }
    const dropZone = event.target.closest("[data-drop-department]");
    if (!dropZone || !dragMemberId) {
      return;
    }
    event.preventDefault();
    await moveMemberToDepartment(dragMemberId, dropZone.dataset.dropDepartment);
    clearDragPreviewState();
    dragMemberId = "";
  });

  document.body.addEventListener("dragend", () => {
    stopGeneralDragAutoScroll();
    clearDragPreviewState();
    dragMemberId = "";
    dragScheduleShiftId = "";
    dragSortItemId = "";
    dragSortCategory = "";
    dragScheduleTableDeptId = "";
    dragScheduleTableMemberId = "";
    dragMealProductIndex = "";
  });
  window.addEventListener("blur", stopGeneralDragAutoScroll);
}
