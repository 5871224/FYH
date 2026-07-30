window.SCHEDULER_CONFIG = {
  supabaseUrl: "https://crxxkazdgsaqwqrppbhy.supabase.co",
  supabaseAnonKey: "sb_publishable_t4QuCEqPIF_q2YO9VYa0QA_z7S3JFt7",
  documentId: "default"
};

window.addEventListener("DOMContentLoaded", () => {
  if (
    window.__FYH_EMPTY_DEPARTMENT_DISPLAY_INSTALLED__
    || typeof renderTable !== "function"
    || typeof getVisibleTableGroups !== "function"
  ) {
    return;
  }
  window.__FYH_EMPTY_DEPARTMENT_DISPLAY_INSTALLED__ = true;

  const baseGetVisibleTableGroups = getVisibleTableGroups;
  getVisibleTableGroups = function getVisibleTableGroupsWithEmptyDepartments() {
    const groups = baseGetVisibleTableGroups();
    if (state.tableView === "shift" || state.tableDeptScopeFilter !== "all") {
      return groups;
    }
    const groupsByDepartmentId = new Map(groups.map((group) => [group.department.id, group]));
    return state.departments
      .filter((department) => isDepartmentVisibleInScheduleRange(department))
      .map((department) => groupsByDepartmentId.get(department.id) || { department, members: [] });
  };

  function createEmptyDepartmentRow(department, visibleDates, today, canEditOrder) {
    const row = document.createElement("tr");
    row.className = "empty-department-row";
    row.dataset.tableEmptyDepartmentId = department.id || "";
    row.title = "可將人員拖曳到此單位";

    const departmentCell = document.createElement("td");
    departmentCell.className = `dept-col${canEditOrder ? " schedule-order-drag" : ""}`;
    departmentCell.textContent = department.name || "";
    if (canEditOrder) {
      departmentCell.draggable = true;
      departmentCell.dataset.tableDepartmentId = department.id || "";
    }
    row.appendChild(departmentCell);

    const memberCell = document.createElement("td");
    memberCell.className = "person-col empty-department-person-col";
    memberCell.setAttribute("aria-label", "目前沒有所屬人員");
    row.appendChild(memberCell);

    if (state.tableStatsVisible) {
      const statsCell = document.createElement("td");
      statsCell.className = "stats-col empty-department-stats-col";
      row.appendChild(statsCell);
    }

    visibleDates.forEach((dateString, dateIndex) => {
      const cell = document.createElement("td");
      const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, dateIndex, visibleDates.length);
      cell.className = `cell inactive-cell empty-department-cell ${weekBoundaryClass} ${dateString === today ? "today" : ""}`;
      cell.dataset.readonly = "true";
      cell.innerHTML = '<div class="cell-inner"></div>';
      row.appendChild(cell);
    });
    return row;
  }

  function renderVisibleEmptyDepartments() {
    if (state.tableView === "shift" || state.tableDeptScopeFilter !== "all") {
      return;
    }
    const table = document.getElementById("mainTable");
    const body = table?.tBodies?.[0];
    if (!body) {
      return;
    }

    const groups = getVisibleTableGroups();
    if (!groups.some(({ members }) => members.length === 0)) {
      return;
    }

    body.querySelector("td.empty-table")?.closest("tr")?.remove();
    const visibleDates = getVisibleDates();
    const today = getTodayDateString();
    const canEditOrder = canEditSchedule();
    let rowCursor = 0;
    groups.forEach(({ department, members }) => {
      if (members.length) {
        rowCursor += members.length;
        return;
      }
      const row = createEmptyDepartmentRow(department, visibleDates, today, canEditOrder);
      body.insertBefore(row, body.children[rowCursor] || null);
      rowCursor += 1;
    });
    syncScheduleColumnWidths();
    renderStickyTableHeader(visibleDates);
  }

  async function moveScheduleTableMemberToDepartment(memberId, departmentId) {
    const draggedMember = state.members.find((member) => member.id === memberId);
    const targetDepartment = state.departments.find((department) => department.id === departmentId);
    if (!draggedMember || !targetDepartment || getMemberHomeDeptId(draggedMember) === departmentId) {
      return false;
    }

    const viewport = captureScheduleViewport();
    const remainingMembers = state.members.filter((member) => member.id !== memberId);
    const departmentOrder = new Map(state.departments.map((department, index) => [department.id, index]));
    let insertionIndex = -1;

    for (let index = remainingMembers.length - 1; index >= 0; index -= 1) {
      if (getMemberHomeDeptId(remainingMembers[index]) === departmentId) {
        insertionIndex = index + 1;
        break;
      }
    }

    if (insertionIndex < 0) {
      const targetOrder = departmentOrder.get(departmentId) ?? Number.MAX_SAFE_INTEGER;
      insertionIndex = remainingMembers.findIndex((member) => {
        const memberOrder = departmentOrder.get(getMemberHomeDeptId(member)) ?? Number.MAX_SAFE_INTEGER;
        return memberOrder > targetOrder;
      });
      if (insertionIndex < 0) {
        insertionIndex = remainingMembers.length;
      }
    }

    remainingMembers.splice(insertionIndex, 0, { ...draggedMember, deptId: departmentId });
    state.members = remainingMembers;
    currentMember = resolveCurrentMember();
    clearScheduleRangeSelection();
    await finishScheduleTableOrderChange(viewport);
    return true;
  }

  function installToolbarStackedLayout() {
    const toolbar = document.querySelector(".toolbar-floating-card");
    const collapseButton = document.getElementById("toolbarCollapseToggle");
    const selectedPreview = document.getElementById("toolbarSelectedPreview");
    const undoButton = document.getElementById("scheduleUndoButton");
    const redoButton = document.getElementById("scheduleRedoButton");
    const toolbarGrid = document.getElementById("toolbarGrid");
    if (!toolbar || !collapseButton || !selectedPreview || !undoButton || !redoButton || !toolbarGrid) {
      return;
    }

    if (!toolbar.querySelector(".toolbar-control-stack")) {
      const controlStack = document.createElement("div");
      controlStack.className = "toolbar-control-stack";

      const primaryRow = document.createElement("div");
      primaryRow.className = "toolbar-control-primary";
      primaryRow.append(collapseButton, selectedPreview);

      const historyRow = document.createElement("div");
      historyRow.className = "toolbar-control-history";
      historyRow.setAttribute("aria-label", "班表操作歷程");
      historyRow.append(undoButton, redoButton);

      controlStack.append(primaryRow, historyRow);
      toolbar.insertBefore(controlStack, toolbarGrid);
    }

    if (!document.getElementById("fyhToolbarStackedLayoutStyles")) {
      const style = document.createElement("style");
      style.id = "fyhToolbarStackedLayoutStyles";
      style.textContent = `
        .toolbar-floating-card {
          grid-template-columns: auto minmax(0, 1fr) !important;
          grid-template-rows: auto !important;
          align-items: start;
          gap: 8px 12px;
        }

        .toolbar-control-stack {
          grid-column: 1;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          min-width: 96px;
        }

        .toolbar-control-primary,
        .toolbar-control-history {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-control-stack #toolbarCollapseToggle,
        .toolbar-control-stack #scheduleUndoButton,
        .toolbar-control-stack #scheduleRedoButton {
          position: static !important;
          box-sizing: border-box;
          width: 44px;
          min-width: 44px;
          margin: 0 !important;
          padding: 0;
        }

        .toolbar-control-stack #toolbarCollapseToggle {
          height: 44px;
          min-height: 44px;
          border: 1px solid var(--ui-accent-strong);
          border-radius: 14px;
          background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-strong) 100%);
          color: #fff;
          box-shadow: 0 8px 18px rgba(72, 52, 31, 0.2);
        }

        .toolbar-control-stack #scheduleUndoButton,
        .toolbar-control-stack #scheduleRedoButton {
          height: 40px;
          min-height: 40px;
          border-radius: 12px;
          background: rgba(255, 253, 248, 0.96);
        }

        .toolbar-control-primary .toolbar-selected-preview {
          flex: 0 0 44px;
          width: 44px;
          min-width: 44px;
          height: 44px;
          min-height: 44px;
        }

        .toolbar-floating-card > .toolbar-grid {
          grid-column: 2;
          grid-row: 1 !important;
          width: 100%;
          min-width: 0;
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-rows: auto auto !important;
          gap: 10px !important;
        }

        .toolbar-floating-card > .toolbar-grid > .toolbar-section-combined {
          grid-column: 1;
          grid-row: 1;
        }

        .toolbar-floating-card > .toolbar-grid > .toolbar-section-leave {
          grid-column: 1;
          grid-row: 2;
        }

        .toolbar-floating-card > .toolbar-grid > .toolbar-section-combined,
        .toolbar-floating-card > .toolbar-grid > .toolbar-section-leave {
          display: flex !important;
          align-items: center;
          flex-wrap: nowrap;
          gap: 10px;
          min-width: 0;
        }

        .toolbar-floating-card .toolbar-title-row,
        .toolbar-floating-card .toolbar-title-row-combined {
          display: flex !important;
          flex: 0 0 auto;
          align-items: center;
          flex-wrap: nowrap !important;
          gap: 6px;
          min-width: max-content;
        }

        .toolbar-floating-card #shiftChips,
        .toolbar-floating-card #leaveChips {
          display: flex !important;
          flex: 1 1 auto;
          align-items: center;
          flex-wrap: nowrap !important;
          gap: 6px;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 2px;
          scrollbar-width: thin;
        }

        .toolbar-floating-card #shiftChips .chip,
        .toolbar-floating-card #leaveChips .chip {
          flex: 0 0 auto;
        }

        .toolbar-floating-card.toolbar-floating-card-collapsed {
          grid-template-columns: auto !important;
          grid-template-rows: auto !important;
        }

        .toolbar-floating-card.toolbar-floating-card-collapsed > .toolbar-grid {
          display: none !important;
        }

        @media (max-width: 768px) {
          .toolbar-control-stack {
            min-width: 92px;
          }

          .toolbar-control-stack #toolbarCollapseToggle,
          .toolbar-control-stack #scheduleUndoButton,
          .toolbar-control-stack #scheduleRedoButton,
          .toolbar-control-primary .toolbar-selected-preview {
            width: 42px;
            min-width: 42px;
          }

          .toolbar-control-stack #toolbarCollapseToggle,
          .toolbar-control-primary .toolbar-selected-preview {
            height: 42px;
            min-height: 42px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function installToolbarRapidEdit() {
    const chipSelector = '#shiftChips [data-chip-type="shift"][data-chip-id], #leaveChips [data-chip-type="leave"][data-chip-id]';
    let lastChipKey = "";
    let lastChipClickAt = 0;
    let rapidEditOpenedAt = 0;

    document.body.addEventListener("click", (event) => {
      const chip = event.target instanceof Element ? event.target.closest(chipSelector) : null;
      if (!chip) {
        return;
      }
      const type = chip.dataset.chipType || "";
      const id = chip.dataset.chipId || "";
      if (!id || (type !== "shift" && type !== "leave")) {
        return;
      }

      const now = Date.now();
      const key = `${type}:${id}`;
      const isRapidSecondClick = key === lastChipKey && now - lastChipClickAt <= 550;
      lastChipKey = key;
      lastChipClickAt = now;
      if (!isRapidSecondClick) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      lastChipKey = "";
      lastChipClickAt = 0;
      rapidEditOpenedAt = now;

      if (!canEditSchedule()) {
        promptManagerAccess(`修改${type === "shift" ? "班別" : "假別"}需先登入主管帳號`);
        return;
      }

      state.selected = { type, id };
      renderToolbar();
      renderTable();
      if (type === "shift") {
        openShiftFormModal("edit", id);
      } else {
        openNamedColorFormModal("leave", "edit", id);
      }
    }, true);

    document.body.addEventListener("dblclick", (event) => {
      const chip = event.target instanceof Element ? event.target.closest(chipSelector) : null;
      if (!chip || Date.now() - rapidEditOpenedAt > 700) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  const baseRenderTable = renderTable;
  renderTable = function renderTableWithVisibleEmptyDepartments(...args) {
    const result = baseRenderTable.apply(this, args);
    renderVisibleEmptyDepartments();
    return result;
  };

  document.body.addEventListener("dragover", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-table-empty-department-id]")
      : null;
    if (!target || !dragScheduleTableMemberId || !canEditSchedule() || state.tableView === "shift") {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    markDragPreviewTarget(target);
  }, true);

  document.body.addEventListener("drop", async (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-table-empty-department-id]")
      : null;
    if (!target || !dragScheduleTableMemberId || !canEditSchedule() || state.tableView === "shift") {
      return;
    }
    const memberId = dragScheduleTableMemberId;
    const departmentId = target.dataset.tableEmptyDepartmentId || "";
    if (!memberId || !departmentId) {
      return;
    }
    event.preventDefault();
    clearDragPreviewState();
    dragScheduleTableMemberId = "";
    try {
      await moveScheduleTableMemberToDepartment(memberId, departmentId);
    } catch (error) {
      setSaveStatus(`移動人員失敗：${error.message}`);
      renderAll();
    }
  }, true);

  installToolbarStackedLayout();
  installToolbarRapidEdit();
  renderVisibleEmptyDepartments();
});
