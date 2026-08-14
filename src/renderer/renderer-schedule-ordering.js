/* 班表單位與人員拖曳排序、捲動位置保存。
 * 由 renderer.js 拆分；不變更排序或儲存規則。
 */

function getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter) {
  if (!draggedId || !targetId || draggedId === targetId || !visibleIds.includes(draggedId) || !visibleIds.includes(targetId)) {
    return visibleIds;
  }
  const reorderedIds = visibleIds.filter((id) => id !== draggedId);
  const targetIndex = reorderedIds.indexOf(targetId);
  if (targetIndex < 0) {
    return visibleIds;
  }
  reorderedIds.splice(targetIndex + (insertAfter ? 1 : 0), 0, draggedId);
  return reorderedIds;
}

function applyVisibleOrderById(items, visibleIds) {
  const orderedQueue = visibleIds.slice();
  const orderedById = new Map(items.map((item) => [item.id, item]));
  const visibleIdSet = new Set(visibleIds);
  return items.map((item) => {
    if (!visibleIdSet.has(item.id)) {
      return item;
    }
    const nextId = orderedQueue.shift();
    return orderedById.get(nextId) || item;
  });
}

function captureScheduleViewport() {
  return { scrollX: window.scrollX || 0, scrollY: window.scrollY || 0 };
}

function restoreScheduleViewport(viewport) {
  requestAnimationFrame(() => {
    window.scrollTo(viewport?.scrollX || 0, viewport?.scrollY || 0);
    syncStickyHeaderScroll();
  });
}

async function finishScheduleTableOrderChange(viewport) {
  renderAll();
  restoreScheduleViewport(viewport);
  await forceSave();
}

async function reorderScheduleTableDepartment(draggedId, targetId, insertAfter = false) {
  const visibleIds = getVisibleTableGroups().map(({ department }) => department.id);
  const nextVisibleIds = getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter);
  if (nextVisibleIds.join("|") === visibleIds.join("|")) {
    return false;
  }
  const viewport = captureScheduleViewport();
  state.departments = applyVisibleOrderById(state.departments, nextVisibleIds);
  await finishScheduleTableOrderChange(viewport);
  return true;
}

async function reorderScheduleTableMember(draggedMemberId, targetMemberId, insertAfter = false) {
  const draggedMember = state.members.find((member) => member.id === draggedMemberId);
  const targetMember = state.members.find((member) => member.id === targetMemberId);
  if (!draggedMember || !targetMember || draggedMemberId === targetMemberId) {
    return false;
  }

  const targetDepartmentId = getMemberHomeDeptId(targetMember);
  if (!targetDepartmentId) {
    return false;
  }

  const remainingMembers = state.members.filter((member) => member.id !== draggedMemberId);
  const targetIndex = remainingMembers.findIndex((member) => member.id === targetMemberId);
  if (targetIndex < 0) {
    return false;
  }

  const movedMember = {
    ...draggedMember,
    deptId: targetDepartmentId
  };
  remainingMembers.splice(targetIndex + (insertAfter ? 1 : 0), 0, movedMember);
  state.members = remainingMembers;
  currentMember = resolveCurrentMember();
  clearScheduleRangeSelection();
  renderAll();
  await forceSave();
  return true;
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
    if (insertionIndex < 0) insertionIndex = remainingMembers.length;
  }

  remainingMembers.splice(insertionIndex, 0, { ...draggedMember, deptId: departmentId });
  state.members = remainingMembers;
  currentMember = resolveCurrentMember();
  clearScheduleRangeSelection();
  await finishScheduleTableOrderChange(viewport);
  return true;
}
