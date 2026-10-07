function getSelectedToolbarItem() {
  const type = state?.selected?.type || "";
  const id = state?.selected?.id || "";
  if (!id || (type !== "shift" && type !== "leave")) return null;
  const item = getItem(type, id);
  return item ? { type, item } : null;
}



let selectedScheduleItemPointerPreview = null;

function getSelectedScheduleItemPointerPreview() {
  if (selectedScheduleItemPointerPreview instanceof HTMLElement && selectedScheduleItemPointerPreview.isConnected) {
    return selectedScheduleItemPointerPreview;
  }
  const preview = document.createElement("div");
  preview.className = "schedule-item-pointer-preview";
  preview.hidden = true;
  preview.setAttribute("aria-hidden", "true");
  document.body.appendChild(preview);
  selectedScheduleItemPointerPreview = preview;
  return preview;
}

function hideSelectedScheduleItemPointerPreview() {
  if (selectedScheduleItemPointerPreview instanceof HTMLElement) {
    selectedScheduleItemPointerPreview.hidden = true;
  }
}

function syncSelectedScheduleItemCursor() {
  const table = document.getElementById("mainTable");
  const preview = getSelectedScheduleItemPointerPreview();
  if (!(table instanceof HTMLElement)) {
    preview.hidden = true;
    return;
  }
  const selected = getSelectedToolbarItem();
  if (!selected || !canEditSchedule() || state.tableView !== "member") {
    table.classList.remove("schedule-item-cursor-active");
    preview.hidden = true;
    preview.textContent = "";
    preview.style.backgroundColor = "";
    preview.style.color = "";
    preview.style.borderColor = "";
    return;
  }
  const name = String(getLocalizedName(selected.item)).trim();
  if (!name) {
    table.classList.remove("schedule-item-cursor-active");
    preview.hidden = true;
    preview.textContent = "";
    return;
  }
  const color = selected.item.color || "#888780";
  table.classList.add("schedule-item-cursor-active");
  preview.textContent = name;
  preview.style.backgroundColor = color;
  preview.style.color = getItemTextColor(selected.item, color);
  preview.style.borderColor = color;
}

function updateSelectedScheduleItemPointerPreview(event) {
  const preview = getSelectedScheduleItemPointerPreview();
  const target = event?.target;
  const cell = target instanceof Element ? target.closest("#mainTable .cell") : null;
  const selected = getSelectedToolbarItem();
  if (!(cell instanceof HTMLElement)
      || !selected
      || !canEditSchedule()
      || state.tableView !== "member") {
    preview.hidden = true;
    return;
  }
  preview.hidden = false;
  const rect = preview.getBoundingClientRect();
  const margin = 4;
  let left = event.clientX + 2;
  let top = event.clientY + 2;
  if (left + rect.width + margin > window.innerWidth) {
    left = event.clientX - rect.width - 2;
  }
  if (top + rect.height + margin > window.innerHeight) {
    top = event.clientY - rect.height - 2;
  }
  preview.style.left = `${Math.round(Math.max(margin, left))}px`;
  preview.style.top = `${Math.round(Math.max(margin, top))}px`;
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
  const name = getLocalizedName(item);
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
