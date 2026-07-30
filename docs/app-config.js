window.SCHEDULER_CONFIG = {
  supabaseUrl: "https://crxxkazdgsaqwqrppbhy.supabase.co",
  supabaseAnonKey: "sb_publishable_t4QuCEqPIF_q2YO9VYa0QA_z7S3JFt7",
  documentId: "default"
};

window.addEventListener("DOMContentLoaded", () => {
  if (window.__FYH_EMPTY_DEPARTMENT_DISPLAY_INSTALLED__ || typeof renderTable !== "function") {
    return;
  }
  window.__FYH_EMPTY_DEPARTMENT_DISPLAY_INSTALLED__ = true;

  function getVisibleDepartmentMemberCounts() {
    const counts = new Map();
    state.members.forEach((member) => {
      if (!isMemberActiveInVisibleRange(member)) {
        return;
      }
      const departmentId = getMemberHomeDeptId(member);
      if (!departmentId) {
        return;
      }
      counts.set(departmentId, (counts.get(departmentId) || 0) + 1);
    });
    return counts;
  }

  function createEmptyDepartmentRow(department, visibleDates, today, canEditOrder) {
    const row = document.createElement("tr");
    row.className = "empty-department-row";

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

    const visibleDepartments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
    if (!visibleDepartments.length) {
      return;
    }
    const memberCounts = getVisibleDepartmentMemberCounts();
    const emptyDepartments = visibleDepartments.filter((department) => !memberCounts.get(department.id));
    if (!emptyDepartments.length) {
      return;
    }

    body.querySelector("td.empty-table")?.closest("tr")?.remove();
    const visibleDates = getVisibleDates();
    const today = getTodayDateString();
    const canEditOrder = canEditSchedule();
    let rowCursor = 0;
    visibleDepartments.forEach((department) => {
      const memberCount = memberCounts.get(department.id) || 0;
      if (memberCount > 0) {
        rowCursor += memberCount;
        return;
      }
      const row = createEmptyDepartmentRow(department, visibleDates, today, canEditOrder);
      body.insertBefore(row, body.children[rowCursor] || null);
      rowCursor += 1;
    });
    syncScheduleColumnWidths();
    renderStickyTableHeader(visibleDates);
  }

  const baseRenderTable = renderTable;
  renderTable = function renderTableWithVisibleEmptyDepartments(...args) {
    const result = baseRenderTable.apply(this, args);
    renderVisibleEmptyDepartments();
    return result;
  };

  renderVisibleEmptyDepartments();
});
