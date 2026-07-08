(function installV2AdminDataFixes() {
  const api = window.schedulerApi;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  if (!api || !baseUrl || !anonKey) return;

  async function callFunction(name, payload = {}) {
    const session = api.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "操作失敗");
    return result;
  }

  api.syncMemberProfile = (member, previousEmployeeCode = "") => callFunction("member-auth-admin", {
    action: "upsert_member",
    member: {
      employeeCode: String(member?.code || "").trim(),
      fullName: member?.name || "",
      role: member?.role || "employee",
      hireDate: member?.hireDate || null,
      leaveDate: member?.leaveDate || null,
      payByDay: Boolean(member?.payByDay),
      fixedRestWeekday: Math.min(6, Math.max(0, Number(member?.fixedRestWeekday) || 0)),
      homeDepartmentId: member?.deptId || "",
      scheduleShiftIds: Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [],
      monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0)
    },
    previousEmployeeCode: String(previousEmployeeCode || "").trim(),
    defaultPassword: "0000"
  });

  api.deleteCatalogItem = (category, itemId) => callFunction("catalog-admin", {
    action: "delete",
    category: String(category || "").trim(),
    itemId: String(itemId || "").trim()
  });

  deleteListItem = async function deleteV2ListItem(category, id) {
    const labelMap = {
      shift: "班別",
      leave: "假別",
      overtime: "加班"
    };
    const label = labelMap[category] || "項目";
    const confirmed = await confirmAction(`確定要刪除這個${label}嗎？`);
    if (!confirmed) return;

    try {
      const result = await api.deleteCatalogItem(category, id);
      if (!result?.deleted) {
        throw new Error(`${label}不存在或已被刪除，請重新整理後再試`);
      }
    } catch (error) {
      showInfoMessage(`${label}刪除失敗：${error.message || error}`);
      return;
    }

    if (category === "shift") {
      state.shifts = state.shifts.filter((item) => item.id !== id);
      state.members = state.members.map((member) => ({
        ...member,
        scheduleShiftIds: getMemberScheduleShiftIds(member).filter((shiftId) => shiftId !== id)
      }));
    }
    if (category === "leave") state.leaves = state.leaves.filter((item) => item.id !== id);
    if (category === "overtime") state.overtime = state.overtime.filter((item) => item.id !== id);
    if (state.selected.type === category && state.selected.id === id) {
      state.selected = { type: null, id: null };
    }
    removeAssignmentsByItem(category, id);
    renderAll();
    openListSettings(category);
    showInfoMessage(`${label}已刪除`);
  };
})();
