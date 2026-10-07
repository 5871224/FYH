function getSelectedToolbarItem() {
  const type = state?.selected?.type || "";
  const id = state?.selected?.id || "";
  if (!id || (type !== "shift" && type !== "leave")) return null;
  const item = getItem(type, id);
  return item ? { type, item } : null;
}


function escapeScheduleCursorSvgText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSelectedScheduleItemCursor(type, item) {
  if (!item || (type !== "shift" && type !== "leave")) return "";
  const color = String(item.color || "#888780").trim() || "#888780";
  const textColor = String(getItemTextColor(item, color) || "#ffffff").trim() || "#ffffff";
  const fallbackLabel = type === "shift" ? "班" : "假";
  const label = String(getLocalizedName(item, fallbackLabel) || fallbackLabel).trim() || fallbackLabel;
  const charCount = Array.from(label).length;
  const fontSize = charCount <= 3 ? 14 : charCount <= 5 ? 12 : charCount <= 8 ? 10 : 8;
  const cursorWidth = Math.min(128, Math.max(48, Math.ceil(charCount * fontSize * 1.05 + 16)));
  const centerX = cursorWidth / 2;
  const rectWidth = cursorWidth - 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorWidth}" height="32" viewBox="0 0 ${cursorWidth} 32">`,
    `<rect x="1" y="1" width="${rectWidth}" height="29" rx="7" `,
    `fill="${escapeScheduleCursorSvgText(color)}" stroke="#000000" stroke-opacity="0.32" stroke-width="1.5"/>`,
    `<text x="${centerX}" y="16" dominant-baseline="middle" text-anchor="middle" `,
    `font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="${escapeScheduleCursorSvgText(textColor)}">`,
    `${escapeScheduleCursorSvgText(label)}</text></svg>`
  ].join("");
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2, pointer`;
}

function syncSelectedScheduleItemCursor() {
  const table = document.getElementById("mainTable");
  if (!(table instanceof HTMLElement)) return;
  const selected = getSelectedToolbarItem();
  if (!selected || !canEditSchedule() || state.tableView !== "member") {
    table.classList.remove("schedule-item-cursor-active");
    table.style.removeProperty("--schedule-item-cursor");
    return;
  }
  const cursor = buildSelectedScheduleItemCursor(selected.type, selected.item);
  if (!cursor) {
    table.classList.remove("schedule-item-cursor-active");
    table.style.removeProperty("--schedule-item-cursor");
    return;
  }
  table.style.setProperty("--schedule-item-cursor", cursor);
  table.classList.add("schedule-item-cursor-active");
}

function syncSelectedToolbarPreview() {
  const preview = document.getElementById("toolbarSelectedPreview");
  if (!preview) return;
  const selected = getSelectedToolbarItem();
  if (!selected) {
    preview.hidden = true;
    preview.textContent = "";
    preview.removeAttribute("title");
    preview.removeAttribute("aria-label");
    preview.style.backgroundColor = "";
    preview.style.color = "";
    preview.style.borderColor = "";
    return;
  }
  const { type, item } = selected;
  const categoryLabel = type === "shift" ? "班別" : "假別";
  const color = item.color || "#888780";
  const name = getLocalizedName(item, categoryLabel);
  preview.hidden = false;
  preview.style.backgroundColor = color;
  preview.style.color = getItemTextColor(item, color);
  preview.style.borderColor = color;
  preview.title = `已選擇${categoryLabel}：${name}`;
  preview.setAttribute("aria-label", preview.title);
  preview.replaceChildren(Object.assign(document.createElement("span"), {
    className: "toolbar-selected-preview-label",
    textContent: name
  }));
}

function renderDeptFilter() {
  const select = document.getElementById("deptFilter");
  const departments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
  if (state.deptFilter !== "all" && !departments.some((department) => department.id === state.deptFilter)) {
    state.deptFilter = "all";
  }
  select.innerHTML = `
    <option value="all">全部單位</option>
    ${departments.map((department) => (
      `<option value="${department.id}" ${state.deptFilter === department.id ? "selected" : ""}>${escapeHtml(getLocalizedName(department))}</option>`
    )).join("")}
  `;
}

function renderTableDeptScopeFilter() {
  const select = document.getElementById("tableDeptScopeFilter");
  if (!select) {
    return;
  }
  const departments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
  if (state.tableDeptScopeFilter !== "all" && !departments.some((department) => department.id === state.tableDeptScopeFilter)) {
    state.tableDeptScopeFilter = "all";
  }
  select.innerHTML = `
    <option value="all">全部顯示</option>
    ${departments.map((department) => (
      `<option value="${department.id}" ${state.tableDeptScopeFilter === department.id ? "selected" : ""}>${escapeHtml(getLocalizedName(department))}</option>`
    )).join("")}
  `;
}

function renderTableViewSelect() {
  const select = document.getElementById("tableViewSelect");
  if (!select) {
    return;
  }
  select.value = state.tableView === "shift" ? "shift" : state.tableStatsVisible ? "member-stats" : "member";
}

function renderChips(containerId, category, items) {
  const container = document.getElementById(containerId);
  const chips = items.map((item) => {
    const active = state.selected.type === category && state.selected.id === item.id;
    const foreground = getItemTextColor(item, item.color);
    const style = `color:${foreground};background:${item.color};border-color:${item.color};`;
    return `<button class="chip ${active ? "active" : ""}" style="${style}" type="button" data-chip-type="${category}" data-chip-id="${item.id}">${escapeHtml(getLocalizedName(item))}</button>`;
  });
  const cancelType = `cancel-${category}`;
  const cancelActive = state.selected.type === cancelType;
  chips.push(`<button class="chip cancel ${cancelActive ? "active" : ""}" type="button" data-chip-type="${cancelType}" data-chip-id="">取消</button>`);
  container.innerHTML = chips.join("");
}

function renderToolbar() {
  renderDeptFilter();
  renderTableViewSelect();
  renderTableDeptScopeFilter();
  const visibleShifts = state.deptFilter === "all"
    ? state.shifts
    : state.shifts.filter((shift) => shiftAllowsDepartment(shift, state.deptFilter));
  renderChips("shiftChips", "shift", visibleShifts.filter((item) => !item.hiddenFromToolbar));
  renderChips("leaveChips", "leave", state.leaves.filter((item) => !item.hiddenFromToolbar));
  renderChips("overtimeChips", "overtime", state.overtime.filter((item) => !item.hiddenFromToolbar));
  syncRoleUi();
  syncSelectedToolbarPreview();
  syncSelectedScheduleItemCursor();
  refreshLocalization(document.querySelector(".toolbar-card"));
}

function memberMatchesSelectedShift(member) {
  if (state.selected.type !== "shift" || !state.selected.id) {
    return false;
  }
  const shift = getItem("shift", state.selected.id);
  if (!shift) {
    return false;
  }
  return memberCanScheduleShift(member, shift.id);
}

function memberLabel(member) {
  const selectedShiftClass = memberMatchesSelectedShift(member) ? "shift-eligible-member-name" : "";
  const payTypeLabel = member.payByDay ? '<span class="member-pay-type">PT</span>' : "";
  return `<span class="member-main ${selectedShiftClass}">${escapeHtml(getLocalizedName(member))}${payTypeLabel}</span>`;
}
