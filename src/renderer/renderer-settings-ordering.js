function renderSettingsOrderDragColumn(isHeader = false) {
  return `<div class="settings-order-drag-col">${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span>'}</div>`;
}

function getOrderedIdsFromDom(selector, attributeName) {
  return Array.from(document.querySelectorAll(selector))
    .map((element) => element instanceof HTMLElement ? element.dataset[attributeName] || "" : "")
    .filter(Boolean);
}

function applyOrderedIds(list, orderedIds) {
  const byId = new Map(list.map((item) => [item.id, item]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const missing = list.filter((item) => !orderedIds.includes(item.id));
  return [...ordered, ...missing];
}

function getSortableSettingsList(category) {
  if (category === "department") return state.departments;
  if (category === "member") return state.members;
  if (["shift", "leave", "overtime"].includes(category)) return getItemList(category);
  return null;
}

function captureSortableSettingsReturnContext(category) {
  if (category === "department") {
    return captureSettingsReturnContext({
      category: "department-settings",
      view: departmentSettingsView
    });
  }
  if (category === "member") {
    return captureSettingsReturnContext({ category: "member-settings" });
  }
  return captureSettingsReturnContext({
    category: "list-settings",
    listCategory: category
  });
}

function reopenSortedSettings(_category, returnTo) {
  void reopenSettingsModalPreservingScroll(returnTo);
}

function commitSortedListFromDom(category) {
  const currentList = getSortableSettingsList(category);
  if (!currentList) {
    return false;
  }
  const orderedIds = getOrderedIdsFromDom(`[data-sort-category="${cssEscapeValue(category)}"][data-sort-item]`, "sortItem");
  if (!orderedIds.length || orderedIds.join("|") === currentList.map((item) => item.id).join("|")) {
    return false;
  }
  const returnTo = captureSortableSettingsReturnContext(category);
  const nextList = applyOrderedIds(currentList, orderedIds);
  if (category === "department") {
    state.departments = nextList;
  }
  if (category === "member") {
    state.members = nextList;
  }
  if (category === "shift") {
    state.shifts = nextList;
  }
  if (category === "leave") {
    state.leaves = nextList;
  }
  if (category === "overtime") {
    state.overtime = nextList;
  }
  renderAll();
  reopenSortedSettings(category, returnTo);
  void window.schedulerApi.reorderSettings(category, orderedIds).catch((error) => setSaveStatus(`排序儲存失敗：${error.message}`));
  return true;
}

function commitDepartmentMemberOrderFromDom() {
  const visibleIds = getOrderedIdsFromDom("[data-member-card]", "memberCard");
  if (!visibleIds.length) {
    return false;
  }
  const visibleIdSet = new Set(visibleIds);
  const visibleById = new Map(state.members.filter((member) => visibleIdSet.has(member.id)).map((member) => [member.id, member]));
  const groupedVisibleIds = new Map(state.departments.map((department) => [department.id, []]));
  document.querySelectorAll(".department-settings-row[data-drop-department]").forEach((container) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const departmentId = container.dataset.dropDepartment || "";
    if (!groupedVisibleIds.has(departmentId)) {
      return;
    }
    container.querySelectorAll("[data-member-card]").forEach((element) => {
      if (element instanceof HTMLElement && element.dataset.memberCard) {
        groupedVisibleIds.get(departmentId).push(element.dataset.memberCard);
      }
    });
  });
  const nextMembers = [];
  state.departments.forEach((department) => {
    const visibleMembers = (groupedVisibleIds.get(department.id) || [])
      .map((memberId) => visibleById.get(memberId))
      .filter(Boolean);
    const hiddenMembers = state.members.filter((member) => getMemberHomeDeptId(member) === department.id && !visibleIdSet.has(member.id));
    nextMembers.push(...visibleMembers, ...hiddenMembers);
  });
  const includedIds = new Set(nextMembers.map((member) => member.id));
  nextMembers.push(...state.members.filter((member) => !includedIds.has(member.id)));
  if (nextMembers.map((member) => member.id).join("|") === state.members.map((member) => member.id).join("|")) {
    return false;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  state.members = nextMembers;
  renderAll();
  void reopenSettingsModalPreservingScroll(returnTo);
  void window.schedulerApi.reorderSettings("member", nextMembers.filter((member) => !member.deleted).map((member) => member.id)).catch((error) => setSaveStatus(`人員排序儲存失敗：${error.message}`));
  return true;
}
