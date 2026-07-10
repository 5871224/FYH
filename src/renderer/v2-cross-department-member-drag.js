(() => {
  const originalReorderScheduleTableMember = reorderScheduleTableMember;

  reorderScheduleTableMember = async function reorderScheduleTableMemberAcrossDepartments(draggedMemberId, targetMemberId, insertAfter = false) {
    const draggedMember = state.members.find((member) => member.id === draggedMemberId);
    const targetMember = state.members.find((member) => member.id === targetMemberId);
    if (!draggedMember || !targetMember || draggedMemberId === targetMemberId) {
      return false;
    }

    const targetDepartmentId = getMemberHomeDeptId(targetMember);
    if (!targetDepartmentId) {
      return originalReorderScheduleTableMember(draggedMemberId, targetMemberId, insertAfter);
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
  };

  document.body.addEventListener("dragover", (event) => {
    if (!dragScheduleTableMemberId || !canEditSchedule() || state.tableView === "shift") {
      return;
    }
    const targetMember = event.target instanceof Element
      ? event.target.closest("[data-table-member-id]")
      : null;
    if (!(targetMember instanceof HTMLElement) || targetMember.dataset.tableMemberId === dragScheduleTableMemberId) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    markScheduleTableOrderTarget(targetMember, event.clientY);
  }, true);

  const detailStyle = document.createElement("link");
  detailStyle.rel = "stylesheet";
  detailStyle.href = "./v2-department-settings-columns.css?v=20260710183000";
  document.head.appendChild(detailStyle);

  const detailScript = document.createElement("script");
  detailScript.src = "./v2-department-settings-columns.js?v=20260710183000";
  document.head.appendChild(detailScript);
})();
