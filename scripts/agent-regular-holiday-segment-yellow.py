from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    write(path, text.replace(old, new, 1))


# 人員檢視：移除額外的黃色＋圖示，只將例假段落標成黃色。
# 班別檢視：沒有上下段結構，因此只將對應人員的小區塊標成黃色。
cells_path = "src/renderer/renderer-schedule-cells.js"
cells = read(cells_path)
old_shift_render = '''function renderRegularHolidayWorkIndicator() {
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
new_shift_render = '''function renderShiftViewCell(members, dateString) {
  if (!members.length) {
    return '<div class="shift-view-members"></div>';
  }
  return `
    <div class="shift-view-members">
      ${members.map((member) => {
        const regularHolidayWorkClass = isRegularHolidayWorkSlot(getDisplayedSlot(member.id, dateString))
          ? " regular-holiday-work-member"
          : "";
        return `<div class="shift-view-member${regularHolidayWorkClass}">${escapeHtml(member.name)}</div>`;
      }).join("")}
    </div>
  `;
}
'''
if cells.count(old_shift_render) != 1:
    raise SystemExit("renderer-schedule-cells.js: previous plus indicator block not found exactly once")
cells = cells.replace(old_shift_render, new_shift_render, 1)

old_leave_segment = '''      segments.push({
        category: "leave",
        name: cellState.leaveMeta?.displayName || leave.name,
        color: leave.color,
        textColor: leave.code === "0047" && cellState.shift ? "rgb(112, 112, 112)" : getItemTextColor(leave, leave.color)
      });'''
new_leave_segment = '''      segments.push({
        category: "leave",
        name: cellState.leaveMeta?.displayName || leave.name,
        color: leave.color,
        textColor: leave.code === "0047" && cellState.shift ? "rgb(112, 112, 112)" : getItemTextColor(leave, leave.color),
        regularHolidayWork: isRegularHolidayWorkSlot(cellState)
      });'''
if cells.count(old_leave_segment) != 1:
    raise SystemExit("renderer-schedule-cells.js: leave segment block not found exactly once")
cells = cells.replace(old_leave_segment, new_leave_segment, 1)

old_render_tail = '''  const visibleSegments = segments.slice(0, 3);
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
  )).join("")}${regularHolidayWorkIndicator}</div>`;'''
new_render_tail = '''  const visibleSegments = segments.slice(0, 3);
  return `<div class="cell-inner">${visibleSegments.map((segment) => (
    `<div class="seg${segment.regularHolidayWork ? " regular-holiday-work-seg" : ""}" style="background-color:${segment.color};color:${segment.textColor || textColor(segment.color)}" ${
      segment.category === "leave" && !isPreview && shouldPromptLeaveDetail(getItem("leave", cellState.leave), cellState.leaveMeta)
        ? `data-hover-schedule-detail="${memberId}:${day}:leave"`
        : segment.category === "overtime" && !isPreview && cellState.overtimeMeta
          ? `data-hover-schedule-detail="${memberId}:${day}:overtime"`
          : ""
    }><span class="seg-label ${getScheduleSegmentSizeClass(segment, visibleSegments.length)}">${escapeHtml(segment.name)}</span></div>`
  )).join("")}</div>`;'''
if cells.count(old_render_tail) != 1:
    raise SystemExit("renderer-schedule-cells.js: previous indicator rendering tail not found exactly once")
cells = cells.replace(old_render_tail, new_render_tail, 1)
write(cells_path, cells)


pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
old_css = '''.cell-inner {
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
new_css = '''.seg.regular-holiday-work-seg {
  background: #ffe58f !important;
  color: #4f3d00 !important;
  box-shadow: inset 0 0 0 1px #d8a600;
}

.shift-view-member.regular-holiday-work-member {
  background: #ffe58f;
  color: #4f3d00;
  box-shadow: inset 0 0 0 1px #d8a600;
}
'''
if pages.count(old_css) != 1:
    raise SystemExit("pages.css: previous plus indicator styles not found exactly once")
pages = pages.replace(old_css, new_css, 1)
write(pages_path, pages)


ui_test_path = "tests/schedule-ui-update.test.js"
ui_test = read(ui_test_path)
ui_test = ui_test.replace(
    '  assert.match(cells, /function renderRegularHolidayWorkIndicator\\(\\)/);\n  assert.match(cells, /renderShiftViewCell\\(members, dateString\\)/);',
    '  assert.doesNotMatch(cells, /renderRegularHolidayWorkIndicator|regular-holiday-work-indicator/);\n  assert.match(cells, /renderShiftViewCell\\(members, dateString\\)/);\n  assert.match(cells, /regular-holiday-work-seg/);\n  assert.match(cells, /regular-holiday-work-member/);',
    1,
)
ui_test = ui_test.replace(
    '  assert.match(css, /\\.regular-holiday-work-indicator \\{[\\s\\S]*?background: #ffe58f;/);\n  assert.match(css, /\\.shift-view-member\\.has-regular-holiday-work[\\s\\S]*?display: flex;/);',
    '  assert.doesNotMatch(css, /regular-holiday-work-indicator/);\n  assert.match(css, /\\.seg\\.regular-holiday-work-seg \\{[\\s\\S]*?background: #ffe58f !important;/);\n  assert.match(css, /\\.shift-view-member\\.regular-holiday-work-member \\{[\\s\\S]*?background: #ffe58f;/);',
    1,
)
write(ui_test_path, ui_test)


render_test_path = "tests/renderer-schedule-rendering.test.js"
render_test = read(render_test_path)
anchor = '''test("需填時間或需填原因的假別應產生明細提示標記", () => {'''
new_test = '''test("例假排班只變更例假段落與班別檢視人員區塊", () => {
  const items = {
    shift: { A: { name: "早班", color: "#111111" } },
    leave: { R: { name: "例假", color: "#ff9bb0", code: "0036" } },
    overtime: {}
  };
  const slot = { shift: "A", leave: "R" };
  const context = {
    state: { schedule: {} },
    getItem: (category, id) => items[category][id] || null,
    getItemTextColor: () => "#ffffff",
    textColor: () => "#ffffff",
    escapeHtml: String,
    shouldPromptLeaveDetail: () => false,
    getDisplayedSlot: () => slot
  };
  const api = evaluate(["renderer-schedule-cells.js"], "({ renderCellInner, renderShiftViewCell })", context);
  const memberHtml = api.renderCellInner("K", "M", "2026-07-01", slot, false);
  assert.equal((memberHtml.match(/regular-holiday-work-seg/g) || []).length, 1);
  assert.equal(memberHtml.includes("regular-holiday-work-indicator") || memberHtml.includes("＋"), false);
  const shiftHtml = api.renderShiftViewCell([{ id: "M", name: "王小明" }], "2026-07-01");
  assert.equal(shiftHtml.includes("regular-holiday-work-member"), true);
  assert.equal(shiftHtml.includes("＋"), false);
});

'''
if render_test.count(anchor) != 1:
    raise SystemExit("renderer-schedule-rendering.test.js: insertion anchor not found exactly once")
render_test = render_test.replace(anchor, new_test + anchor, 1)
write(render_test_path, render_test)


spec_path = "規格書.md"
spec = read(spec_path)
old_spec = "24. 人員檢視與班別檢視中，例假（代碼 0036）當日同時排有班別時，只在該人員的加班提示圖示顯示黃色底色；班表格、班別、假別、人名及其他區塊均維持原本配色與狀態樣式。"
new_spec = "24. 例假（代碼 0036）當日同時排有班別時，不顯示額外的黃色「＋」圖示。人員檢視中僅將該日期格內下方的「例假」區塊底色改為黃色，上方班別區塊及整個班表格維持原樣；班別檢視中僅將對應人員名稱的小區塊底色改為黃色，其他人員與格子狀態樣式均維持原樣。"
if spec.count(old_spec) != 1:
    raise SystemExit("規格書.md: previous holiday indicator rule not found exactly once")
spec = spec.replace(old_spec, new_spec, 1)
write(spec_path, spec)
