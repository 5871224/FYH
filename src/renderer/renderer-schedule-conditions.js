const SCHEDULE_CONDITION_SAME_SHIFT = "same_shift";
const SCHEDULE_CONDITION_SAME_LEAVE = "same_leave";

const scheduleConditionState = {
  byGroup: new Map()
};

function normalizeScheduleCondition(row) {
  const memberIds = Array.isArray(row?.member_ids)
    ? row.member_ids
    : Array.isArray(row?.memberIds)
      ? row.memberIds
      : [];
  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || row?.groupId || ""),
    type: String(row?.condition_type || row?.type || ""),
    limitCount: Math.max(0, Number(row?.limit_count ?? row?.limitCount) || 0),
    memberIds: [...new Set(memberIds.map((id) => String(id || "")).filter(Boolean))]
  };
}

function getScheduleConditionSession() {
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const sessionKey = `scheduler.supabase.session.${baseUrl}`;
  const raw = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey) || "";
  if (!raw) return { baseUrl, anonKey: String(config.supabaseAnonKey || ""), session: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      baseUrl,
      anonKey: String(config.supabaseAnonKey || ""),
      session: parsed?.session || parsed || null
    };
  } catch {
    return { baseUrl, anonKey: String(config.supabaseAnonKey || ""), session: null };
  }
}

async function callScheduleConditionRpc(functionName, payload = {}) {
  if (window.schedulerApi?.initializeAuth) {
    await window.schedulerApi.initializeAuth();
  }
  const { baseUrl, anonKey, session } = getScheduleConditionSession();
  if (!baseUrl || !anonKey || !session?.access_token) {
    throw new Error("登入已失效，請重新登入");
  }
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok) {
    if (!text) throw new Error(`HTTP ${response.status}`);
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.message || parsed.error_description || parsed.error || text);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text);
      throw error;
    }
  }
  return text ? JSON.parse(text) : null;
}

async function loadScheduleConditions(groupId = groupFeatureState.currentGroupId, force = false) {
  if (!groupId) return [];
  if (!force && scheduleConditionState.byGroup.has(groupId)) {
    return scheduleConditionState.byGroup.get(groupId);
  }
  const rows = await callScheduleConditionRpc("get_schedule_conditions_v1", { p_group_id: groupId }) || [];
  const conditions = (Array.isArray(rows) ? rows : [])
    .map(normalizeScheduleCondition)
    .filter((condition) => condition.id && condition.groupId === groupId);
  scheduleConditionState.byGroup.set(groupId, conditions);
  return conditions;
}

async function ensureScheduleConditionsLoaded(groupId = groupFeatureState.currentGroupId) {
  return loadScheduleConditions(groupId, false);
}

function getScheduleConditionsForGroup(groupId = groupFeatureState.currentGroupId) {
  return scheduleConditionState.byGroup.get(groupId) || [];
}

function getConditionEffectiveMemberIds(condition, groupId = groupFeatureState.currentGroupId) {
  if (!condition || condition.groupId !== groupId) return [];
  const currentMemberIds = new Set(
    (state.members || [])
      .filter((member) => !member.deleted && (member.groupId || groupId) === groupId)
      .map((member) => member.id)
  );
  return condition.memberIds.filter((id, index, list) => (
    currentMemberIds.has(id) && list.indexOf(id) === index
  ));
}

function getEffectiveScheduleConditions(type = "", groupId = groupFeatureState.currentGroupId) {
  return getScheduleConditionsForGroup(groupId)
    .filter((condition) => !type || condition.type === type)
    .map((condition) => ({
      ...condition,
      effectiveMemberIds: getConditionEffectiveMemberIds(condition, groupId)
    }))
    .filter((condition) => (
      condition.effectiveMemberIds.length >= 2
      && condition.limitCount >= 1
      && condition.limitCount < condition.effectiveMemberIds.length
    ));
}

function getScheduleConditionMemberNames(condition) {
  const memberById = new Map((state.members || []).map((member) => [member.id, member.name || member.code || member.id]));
  const ids = condition?.effectiveMemberIds || getConditionEffectiveMemberIds(condition);
  return ids.map((id) => memberById.get(id)).filter(Boolean);
}

function getScheduleConditionTypeLabel(type) {
  return type === SCHEDULE_CONDITION_SAME_LEAVE ? "同休限制" : "同班限制";
}

function formatScheduleConditionLabel(condition) {
  const names = getScheduleConditionMemberNames(condition);
  return `${getScheduleConditionTypeLabel(condition.type)}（${names.join("、")}；限額 ${condition.limitCount}）`;
}

function getBlockingSameLeaveConditions(scheduleMap, memberId, dateString) {
  return getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_LEAVE)
    .filter((condition) => condition.effectiveMemberIds.includes(memberId))
    .filter((condition) => {
      const currentSlot = getWorkScheduleSlot(scheduleMap, memberId, dateString);
      if (currentSlot?.leave) return false;
      const leaveCount = condition.effectiveMemberIds.reduce((count, id) => (
        count + (getWorkScheduleSlot(scheduleMap, id, dateString)?.leave ? 1 : 0)
      ), 0);
      return leaveCount >= condition.limitCount;
    });
}

function canAutoPlaceLeaveByScheduleConditions(scheduleMap, memberId, dateString) {
  return getBlockingSameLeaveConditions(scheduleMap, memberId, dateString).length === 0;
}

function getBlockingSameShiftConditions(scheduleMap, memberId, shiftId, dateString) {
  return getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_SHIFT)
    .filter((condition) => condition.effectiveMemberIds.includes(memberId))
    .filter((condition) => {
      const currentSlot = getWorkScheduleSlot(scheduleMap, memberId, dateString);
      if (currentSlot?.shift === shiftId) return false;
      const sameShiftCount = condition.effectiveMemberIds.reduce((count, id) => (
        count + (getWorkScheduleSlot(scheduleMap, id, dateString)?.shift === shiftId ? 1 : 0)
      ), 0);
      return sameShiftCount >= condition.limitCount;
    });
}

function canAutoAssignShiftByScheduleConditions(scheduleMap, memberId, shiftId, dateString) {
  return getBlockingSameShiftConditions(scheduleMap, memberId, shiftId, dateString).length === 0;
}

function noteScheduleConditionBlocks(preview, dateString, conditions, suffix) {
  if (!preview || !Array.isArray(preview.warnings) || !conditions?.length) return;
  if (!preview.scheduleConditionWarningKeys) {
    Object.defineProperty(preview, "scheduleConditionWarningKeys", {
      value: new Set(),
      enumerable: false
    });
  }
  conditions.forEach((condition) => {
    const key = `${dateString}|${condition.id}|${suffix}`;
    if (preview.scheduleConditionWarningKeys.has(key)) return;
    preview.scheduleConditionWarningKeys.add(key);
    preview.warnings.push(`${dateString} ${formatScheduleConditionLabel(condition)}：${suffix}`);
  });
}

function renderScheduleConditionStatus(condition) {
  const effectiveIds = getConditionEffectiveMemberIds(condition);
  const active = effectiveIds.length >= 2 && condition.limitCount >= 1 && condition.limitCount < effectiveIds.length;
  return active ? "" : '<span class="settings-member-chip">目前未生效</span>';
}

async function openScheduleConditions(force = true) {
  if (!canEditSchedule()) {
    showInfoMessage("沒有管理目前群組班表的權限");
    return;
  }
  try {
    const conditions = await loadScheduleConditions(groupFeatureState.currentGroupId, force);
    const body = conditions.length
      ? `
        <div class="settings-table-wrap">
          <div class="settings-table-scroll">
            <div class="settings-table">
              <div class="settings-table-row" style="grid-template-columns: 120px minmax(260px,1fr) 90px 100px;">
                <div>條件類型</div><div>人員</div><div>限額</div><div class="settings-table-actions-head">操作</div>
              </div>
              ${conditions.map((condition) => {
                const effective = { ...condition, effectiveMemberIds: getConditionEffectiveMemberIds(condition) };
                const names = getScheduleConditionMemberNames(effective);
                return `
                  <div class="settings-table-row" style="grid-template-columns: 120px minmax(260px,1fr) 90px 100px;">
                    <div>${escapeHtml(getScheduleConditionTypeLabel(condition.type))}</div>
                    <div class="settings-table-meta settings-member-list">
                      ${names.length ? names.map((name) => `<span class="settings-member-chip">${escapeHtml(name)}</span>`).join("") : "-"}
                      ${renderScheduleConditionStatus(condition)}
                    </div>
                    <div>${escapeHtml(String(condition.limitCount))}</div>
                    <div class="settings-table-actions">
                      ${renderActionIconButton("edit", `data-edit-schedule-condition="${escapeHtml(condition.id)}"`)}
                      ${renderActionIconButton("delete", `data-delete-schedule-condition="${escapeHtml(condition.id)}"`)}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>`
      : '<div class="empty-state">目前還沒有排班條件</div>';
    openEntityListModal({
      title: `排班條件${getCurrentGroup()?.name ? `－${escapeHtml(getCurrentGroup().name)}` : ""}`,
      modalClass: "modal modal-wide settings-list-modal",
      body,
      headerButtons: '<button class="btn-primary" type="button" data-add-schedule-condition="true">新增</button>',
      hideFooterClose: true
    });
  } catch (error) {
    reportValidationError(`讀取排班條件失敗：${error.message || error}`);
  }
}

function openScheduleConditionForm(conditionId = "") {
  const condition = conditionId
    ? getScheduleConditionsForGroup().find((item) => item.id === conditionId)
    : null;
  const selectedIds = new Set(condition?.memberIds || []);
  modalContext = {
    category: "schedule-condition-form",
    targetId: condition?.id || ""
  };
  openEntityListModal({
    title: condition ? "修改排班條件" : "新增排班條件",
    modalClass: "modal modal-wide modal-form-compact",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="scheduleConditionType">條件類型</label>
          <select id="scheduleConditionType">
            <option value="${SCHEDULE_CONDITION_SAME_SHIFT}" ${condition?.type === SCHEDULE_CONDITION_SAME_SHIFT ? "selected" : ""}>同班限制</option>
            <option value="${SCHEDULE_CONDITION_SAME_LEAVE}" ${condition?.type === SCHEDULE_CONDITION_SAME_LEAVE ? "selected" : ""}>同休限制</option>
          </select>
        </div>
        <div class="form-row">
          <label for="scheduleConditionLimit">限額</label>
          <input id="scheduleConditionLimit" type="number" min="1" step="1" value="${escapeHtml(String(condition?.limitCount || 1))}">
        </div>
      </div>
      <div class="form-row">
        <label>人員</label>
        <div class="permission-check-grid">
          ${(state.members || []).filter((member) => !member.deleted).map((member) => `
            <label class="permission-check-item">
              <input type="checkbox" data-schedule-condition-member="${escapeHtml(member.id)}" ${selectedIds.has(member.id) ? "checked" : ""}>
              <span>${escapeHtml(member.name)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-schedule-condition="true">儲存</button>',
    hideFooterClose: true
  });
}

async function saveScheduleConditionFromModal() {
  const memberIds = Array.from(document.querySelectorAll("[data-schedule-condition-member]:checked"))
    .map((input) => input.dataset.scheduleConditionMember || "")
    .filter(Boolean);
  const limitCount = Number(document.getElementById("scheduleConditionLimit")?.value || 0);
  const type = document.getElementById("scheduleConditionType")?.value || SCHEDULE_CONDITION_SAME_SHIFT;
  if (memberIds.length < 2) {
    reportValidationError("至少選擇 2 位人員");
    return;
  }
  if (!Number.isInteger(limitCount) || limitCount < 1 || limitCount >= memberIds.length) {
    reportValidationError("限額必須大於等於 1，且小於選取人數");
    return;
  }
  try {
    await callScheduleConditionRpc("save_schedule_condition_v1", {
      p_item: {
        id: modalContext.targetId || null,
        groupId: groupFeatureState.currentGroupId,
        type,
        limitCount,
        memberIds
      }
    });
    await loadScheduleConditions(groupFeatureState.currentGroupId, true);
    await openScheduleConditions(false);
  } catch (error) {
    reportValidationError(`儲存排班條件失敗：${error.message || error}`);
  }
}

async function deleteScheduleCondition(conditionId) {
  if (!conditionId) return;
  if (!await confirmAction("確定要刪除這筆排班條件嗎？")) return;
  try {
    await callScheduleConditionRpc("delete_schedule_condition_v1", { p_condition_id: conditionId });
    await loadScheduleConditions(groupFeatureState.currentGroupId, true);
    await openScheduleConditions(false);
  } catch (error) {
    reportValidationError(`刪除排班條件失敗：${error.message || error}`);
  }
}
