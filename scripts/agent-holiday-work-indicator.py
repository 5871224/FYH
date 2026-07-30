from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


# Replace whole-cell holiday-work highlighting with a small yellow overtime indicator.
cells_path = "src/renderer/renderer-schedule-cells.js"
cells = read(cells_path)
old_state = '''function getShiftViewCellState(shift, dateString) {
  const members = getShiftViewMembersForDay(shift.id, dateString);
  const isOperating = isShiftOperatingOnDate(shift, dateString);
  const requiredStaffCount = getShiftDemandForDate(shift, dateString);
  const hasRegularHolidayWork = members.some((member) => {
    const slot = getDisplayedSlot(member.id, dateString);
    return Boolean(slot?.shift && isRegularRestLeaveId(slot.leave));
  });
  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount,
    hasRegularHolidayWork
  };
}

function renderShiftViewCell(members) {
  if (!members.length) {
    return '<div class="shift-view-members"></div>';
  }
  return `
    <div class="shift-view-members">
      ${members.map((member) => `<div class="shift-view-member">${escapeHtml(member.name)}</div>`).join("")}
    </div>
  `;
}
'''
new_state = '''function getShiftViewCellState(shift, dateString) {
  const members = getShiftViewMembersForDay(shift.id, dateString);
  const isOperating = isShiftOperatingOnDate(shift, dateString);
  const requiredStaffCount = getShiftDemandForDate(shift, dateString);
  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount
  };
}

function isRegularHolidayWorkSlot(slot) {
  return Boolean(slot?.shift && isRegularRestLeaveId(slot.leave));
}

function renderRegularHolidayWorkIndicator() {
  return '<span class="regular-holiday-work-indicator" aria-label="例假排班" title="例假排班">＋</span>';
}

function renderShiftViewCell(members, dateString) {
  if (!members.length) {
    return '<div class="shift-view-members"></div>';
  }
  return `
    <div class="shift-view-members">
      ${members.map((member) => {
        const isRegularHolidayWork = isRegularHolidayWorkSlot(getDisplayedSlot(member.id, dateString));
        return `<div class="shift-view-member ${isRegularHolidayWork ? "has-regular-holiday-work" : ""}"><span class="shift-view-member-name">${escapeHtml(member.name)}</span>${isRegularHolidayWork ? renderRegularHolidayWorkIndicator() : ""}</div>`;
      }).join("")}
    </div>
  `;
}
'''
if cells.count(old_state) != 1:
    raise SystemExit("renderer-schedule-cells.js: shift-view holiday state block not found exactly once")
cells = cells.replace(old_state, new_state, 1)
old_return = '''  const visibleSegments = segments.slice(0, 3);
  return `<div class="cell-inner">${visibleSegments.map((segment) => (
    `<div class="seg" style="background-color:${segment.color};color:${segment.textColor || textColor(segment.color)}" ${
      segment.category === "leave" && !isPreview && shouldPromptLeaveDetail(getItem("leave", cellState.leave), cellState.leaveMeta)
        ? `data-hover-schedule-detail="${memberId}:${day}:leave"`
        : segment.category === "overtime" && !isPreview && cellState.overtimeMeta
          ? `data-hover-schedule-detail="${memberId}:${day}:overtime"`
          : ""
    }><span class="seg-label ${getScheduleSegmentSizeClass(segment, visibleSegments.length)}">${escapeHtml(segment.name)}</span></div>`
  )).join("")}</div>`;
'''
new_return = '''  const visibleSegments = segments.slice(0, 3);
  const regularHolidayWorkIndicator = isRegularHolidayWorkSlot(cellState)
    ? renderRegularHolidayWorkIndicator()
    : "";
  return `<div class="cell-inner">${visibleSegments.map((segment) => (
    `<div class="seg" style="background-color:${segment.color};color:${segment.textColor || textColor(segment.color)}" ${
      segment.category === "leave" && !isPreview && shouldPromptLeaveDetail(getItem("leave", cellState.leave), cellState.leaveMeta)
        ? `data-hover-schedule-detail="${memberId}:${day}:leave"`
        : segment.category === "overtime" && !isPreview && cellState.overtimeMeta
          ? `data-hover-schedule-detail="${memberId}:${day}:overtime"`
          : ""
    }><span class="seg-label ${getScheduleSegmentSizeClass(segment, visibleSegments.length)}">${escapeHtml(segment.name)}</span></div>`
  )).join("")}${regularHolidayWorkIndicator}</div>`;
'''
if cells.count(old_return) != 1:
    raise SystemExit("renderer-schedule-cells.js: cell rendering block not found exactly once")
cells = cells.replace(old_return, new_return, 1)
write(cells_path, cells)


table_path = "src/renderer/renderer-schedule-table.js"
table = read(table_path)
old_shift_cell = '''          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${shiftViewCellState.hasRegularHolidayWork ? "regular-holiday-work-cell" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members)}</td>`;'''
new_shift_cell = '''          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members, dateString)}</td>`;'''
if table.count(old_shift_cell) != 1:
    raise SystemExit("renderer-schedule-table.js: shift cell whole-background rule not found exactly once")
table = table.replace(old_shift_cell, new_shift_cell, 1)
old_member_block = '''            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            const regularHolidayWorkClass = displayedSlot?.shift && isRegularRestLeaveId(displayedSlot.leave)
              ? "regular-holiday-work-cell"
              : "";
            html += `<td class="cell ${previewClass} ${regularHolidayWorkClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;'''
new_member_block = '''            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            html += `<td class="cell ${previewClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;'''
if table.count(old_member_block) != 1:
    raise SystemExit("renderer-schedule-table.js: member whole-background rule not found exactly once")
table = table.replace(old_member_block, new_member_block, 1)
write(table_path, table)


pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
old_css = '''.cell.regular-holiday-work-cell,
.cell.regular-holiday-work-cell .cell-inner,
.cell.regular-holiday-work-cell .seg,
.shift-view-cell.regular-holiday-work-cell .shift-view-member {
  background: #ffe58f !important;
  color: #2b241c !important;
}

.cell.regular-holiday-work-cell {
  box-shadow: inset 0 0 0 2px #d8a600;
}

.cell.regular-holiday-work-cell .seg {
  border-color: rgba(120, 88, 0, 0.24) !important;
}
'''
new_css = '''.cell-inner {
  position: relative;
}

.regular-holiday-work-indicator {
  position: absolute;
  top: 1px;
  right: 1px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  min-width: 12px;
  height: 12px;
  min-height: 12px;
  padding: 0;
  border: 1px solid #d8a600;
  border-radius: 50%;
  background: #ffe58f;
  color: #4f3d00;
  box-shadow: 0 1px 2px rgba(92, 69, 0, 0.24);
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
  pointer-events: none;
}

.shift-view-member.has-regular-holiday-work {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.shift-view-member.has-regular-holiday-work .shift-view-member-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.shift-view-member .regular-holiday-work-indicator {
  position: static;
  flex: 0 0 12px;
}
'''
if pages.count(old_css) != 1:
    raise SystemExit("pages.css: whole-cell yellow style block not found exactly once")
pages = pages.replace(old_css, new_css, 1)
write(pages_path, pages)


test_path = "tests/schedule-ui-update.test.js"
test_text = read(test_path)
test_text = test_text.replace(
    '  assert.match(table, /regularHolidayWorkClass/);\n  assert.match(cells, /hasRegularHolidayWork/);',
    '  assert.doesNotMatch(table, /regularHolidayWorkClass|regular-holiday-work-cell/);\n  assert.match(cells, /function isRegularHolidayWorkSlot\\(slot\\)/);\n  assert.match(cells, /function renderRegularHolidayWorkIndicator\\(\\)/);\n  assert.match(cells, /renderShiftViewCell\\(members, dateString\\)/);',
    1,
)
test_text = test_text.replace(
    '  assert.match(css, /\\.cell\\.regular-holiday-work-cell[\\s\\S]*?#ffe58f/);',
    '  assert.doesNotMatch(css, /\\.cell\\.regular-holiday-work-cell/);\n  assert.match(css, /\\.regular-holiday-work-indicator \\{[\\s\\S]*?background: #ffe58f;/);\n  assert.match(css, /\\.shift-view-member\\.has-regular-holiday-work[\\s\\S]*?display: flex;/);',
    1,
)
write(test_path, test_text)


spec_path = "規格書.md"
spec = read(spec_path)
old_spec = "24. 人員檢視與班別檢視中，例假（代碼 0036）當日同時排有班別時，該班表格底色改為黃色並維持文字可讀性。"
new_spec = "24. 人員檢視與班別檢視中，例假（代碼 0036）當日同時排有班別時，只在該人員的加班提示圖示顯示黃色底色；班表格、班別、假別、人名及其他區塊均維持原本配色與狀態樣式。"
if spec.count(old_spec) != 1:
    raise SystemExit("規格書.md: previous whole-cell holiday work rule not found exactly once")
spec = spec.replace(old_spec, new_spec, 1)
write(spec_path, spec)
