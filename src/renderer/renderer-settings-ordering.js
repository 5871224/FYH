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

function commitSortedListFromDom(category) {
  const orderedIds = getOrderedIdsFromDom(`[data-sort-category="${cssEscapeValue(category)}"][data-sort-item]`, "sortItem");
  const currentList = category === "department"
    ? state.departments
    : getItemList(category);
  if (!orderedIds.length || orderedIds.join("|") === currentList.map((item) => item.id).join("|")) {
    return false;
  }
  const returnTo = captureSettingsReturnContext({
    category: category === "department" ? "department-settings" : "list-settings",
    listCategory: category,
    view: departmentSettingsView
  });
  const nextList = applyOrderedIds(currentList, orderedIds);
  if (category === "department") {
    state.departments = nextList;
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
  if (category === "department") {
    openDepartmentSettings();
  } else {
    openListSettings(category);
  }
  restoreSettingsScroll(returnTo);
  queueSave();
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
  openDepartmentSettings();
  restoreSettingsScroll(returnTo);
  renderAll();
  queueSave();
  return true;
}
