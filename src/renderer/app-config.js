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

  renderVisibleEmptyDepartments();
});
