function renderTable() {
  queueMicrotask(markArchivedScheduleCells);

  hideLeaveTooltip();
  const table = document.getElementById("mainTable");
  const visibleDates = getVisibleDates();
  const days = visibleDates.length;
  const today = getTodayDateString();

  let html = '<colgroup><col class="col-dept"><col class="col-person">';
  if (state.tableView === "member" && state.tableStatsVisible) {
    html += '<col class="col-stats">';
  }
  visibleDates.forEach(() => {
    html += '<col class="col-day">';
  });
  html += "</colgroup><tbody>";

  if (state.tableView === "shift") {
    const shifts = getVisibleShiftRows();
    if (!shifts.length) {
      html += `<tr><td class="empty-table" colspan="${days + 2}">目前沒有符合範圍的班別</td></tr>`;
    } else {
      shifts.forEach((shift) => {
        html += "<tr>";
        html += `<td class="dept-col">${escapeHtml(shift.name)}</td>`;
        html += `<td class="person-col demand-col">${escapeHtml(String(shift.requiredStaffCount ?? 0))}</td>`;
        visibleDates.forEach((dateString, index) => {
          const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, index, days);
          const shiftViewCellState = getShiftViewCellState(shift, dateString);
          const inactiveClass = shiftViewCellState.isOperating ? "" : "inactive-cell";
          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members, dateString)}</td>`;
        });
        html += "</tr>";
      });
    }
  } else {
    const groups = getVisibleTableGroups();
    const canEditScheduleOrder = canEditSchedule();
    const canEditMemberSettings = canManageMembersInCurrentGroup();
    const canEditDepartmentSettings = canManageDepartmentsInCurrentGroup();
    const orderDragClass = canEditScheduleOrder ? " schedule-order-drag" : "";
    const draggableAttr = canEditScheduleOrder ? ' draggable="true"' : "";
    let rowIndex = 0;
    if (!groups.length) {
      html += `<tr><td class="empty-table" colspan="${days + 2 + (state.tableStatsVisible ? 1 : 0)}">${state.tableDeptScopeFilter === "all" ? "目前還沒有人員" : "目前週期沒有排到此單位班別的人員"}</td></tr>`;
    } else {
      groups.forEach(({ department, members }) => {
        if (!members.length) {
          const departmentDragAttrs = canEditScheduleOrder ? ` draggable="true" data-table-department-id="${escapeHtml(department.id)}"` : "";
          const departmentEditAttrs = !canEditScheduleOrder && canEditDepartmentSettings
            ? ` data-table-department-id="${escapeHtml(department.id)}"`
            : "";
          html += `<tr class="empty-department-row" data-table-empty-department-id="${escapeHtml(department.id)}" title="可將人員拖曳到此單位">`;
          html += `<td class="dept-col${orderDragClass}"${departmentDragAttrs}${departmentEditAttrs}>${escapeHtml(department.name)}</td>`;
          html += '<td class="person-col empty-department-person-col" aria-label="目前沒有所屬人員"></td>';
          if (state.tableStatsVisible) {
            html += '<td class="stats-col empty-department-stats-col"></td>';
          }
          visibleDates.forEach((dateString, dateIndex) => {
            const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, dateIndex, days);
            html += `<td class="cell inactive-cell empty-department-cell ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-date="${dateString}"><div class="cell-inner"></div></td>`;
          });
          html += "</tr>";
          return;
        }
        members.forEach((member, index) => {
          html += `<tr class="${member.payByDay ? "pay-daily-row" : ""}">`;
          if (index === 0) {
            const departmentEditAttrs = (canEditScheduleOrder || canEditDepartmentSettings)
              ? ` data-table-department-id="${escapeHtml(department.id)}"`
              : "";
            html += `<td class="dept-col${orderDragClass}"${draggableAttr} rowspan="${members.length}"${departmentEditAttrs}>${escapeHtml(department.name)}</td>`;
          }
          const memberEditAttrs = canEditMemberSettings
            ? ` data-table-member-id="${escapeHtml(member.id)}" data-table-member-department-id="${escapeHtml(getMemberHomeDeptId(member))}"`
            : "";
          const shiftEligibleClass = memberMatchesSelectedShift(member) ? " shift-eligible-person-col" : "";
          html += `<td class="person-col${orderDragClass}${shiftEligibleClass}"${draggableAttr}${memberEditAttrs} data-row-index="${rowIndex}"><div class="member-label">${memberLabel(member)}</div></td>`;
          if (state.tableStatsVisible) {
            html += `<td class="stats-col">${renderMemberStats(member)}</td>`;
          }
          visibleDates.forEach((dateString, dateIndex) => {
            const active = isMemberActiveOnDateString(member, dateString);
            const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, dateIndex, days);
            if (!active) {
              html += `<td class="cell inactive-cell ${weekBoundaryClass}" data-disabled="true" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}"><div class="cell-inner"></div></td>`;
              return;
            }
            const key = getScheduleKeyForDateString(member.id, dateString);
            const previewSlot = getPreviewSlotByKey(key);
            const displayedSlot = previewSlot || state.schedule[key] || null;
            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            html += `<td class="cell ${previewClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;
          });
          html += "</tr>";
          rowIndex += 1;
        });
      });
    }
  }

  html += "</tbody>";
  table.innerHTML = html;
  syncScheduleColumnWidths();
  renderStickyTableHeader(visibleDates);
  syncScheduleRangeSelectionUi();
  requestAnimationFrame(syncScheduleWeekNavigationButtons);
}

function renderHeader() {
  const { startDate, endDate } = getVisibleDateRange();
  document.getElementById("monthTitle").textContent = `${startDate} ～ ${endDate}`;
  syncScheduleWeekNavigationButtons();
  renderAuthBar();
}
