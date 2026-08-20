const SCHEDULE_CONDITION_SAME_SHIFT = "same_shift";
const SCHEDULE_CONDITION_SAME_LEAVE = "same_leave";

const scheduleConditionState = { byGroup: new Map() };

function normalizeScheduleCondition(row) {
  const memberIds = Array.isArray(row?.member_ids) ? row.member_ids : Array.isArray(row?.memberIds) ? row.memberIds : [];
  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || row?.groupId || ""),
    type: String(row?.condition_type || row?.type || ""),
    limitCount: Math.max(0, Number(row?.limit_count ?? row?.limitCount) || 0),
    memberIds: [...new Set(memberIds.map((id) => String(id || "")).filter(Boolean))]
  };
}

async function loadScheduleConditions(groupId = groupFeatureState.currentGroupId, force = false) {
  if (!groupId) return [];
  if (!force && scheduleConditionState.byGroup.has(groupId)) return scheduleConditionState.byGroup.get(groupId);
  const rows = await window.schedulerApi.getScheduleConditions(groupId) || [];
  const conditions = (Array.isArray(rows) ? rows : []).map(normalizeScheduleCondition).filter((condition) => condition.id && condition.groupId === groupId);
  scheduleConditionState.byGroup.set(groupId, conditions);
  return conditions;
}

async function ensureScheduleConditionsLoaded(groupId = groupFeatureState.currentGroupId) { return loadScheduleConditions(groupId, false); }
function getScheduleConditionsForGroup(groupId = groupFeatureState.currentGroupId) { return scheduleConditionState.byGroup.get(groupId) || []; }

function getConditionEffectiveMemberIds(condition, groupId = groupFeatureState.currentGroupId) {
  if (!condition || condition.groupId !== groupId) return [];
  const currentMemberIds = new Set((state.members || []).filter((member) => !member.deleted && (member.groupId || groupId) === groupId).map((member) => member.id));
  return condition.memberIds.filter((id, index, list) => currentMemberIds.has(id) && list.indexOf(id) === index);
}

function getEffectiveScheduleConditions(type = "", groupId = groupFeatureState.currentGroupId) {
  return getScheduleConditionsForGroup(groupId)
    .filter((condition) => !type || condition.type === type)
    .map((condition) => ({ ...condition, effectiveMemberIds: getConditionEffectiveMemberIds(condition, groupId) }))
    .filter((condition) => condition.effectiveMemberIds.length >= 2 && condition.limitCount >= 1 && condition.limitCount < condition.effectiveMemberIds.length);
}

function getScheduleConditionMemberNames(condition) {
  const memberById = new Map((state.members || []).map((member) => [member.id, member.name || member.code || member.id]));
  const ids = condition?.effectiveMemberIds || getConditionEffectiveMemberIds(condition);
  return ids.map((id) => memberById.get(id)).filter(Boolean);
}

function getScheduleConditionTypeLabel(type) { return type === SCHEDULE_CONDITION_SAME_LEAVE ? "同休限制" : "同班限制"; }
function formatScheduleConditionLabel(condition) { return `${getScheduleConditionTypeLabel(condition.type)}（${getScheduleConditionMemberNames(condition).join("、")}；限額 ${condition.limitCount}）`; }

function getBlockingSameLeaveConditions(scheduleMap, memberId, dateString) {
  return getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_LEAVE)
    .filter((condition) => condition.effectiveMemberIds.includes(memberId))
    .filter((condition) => {
      if (getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave) return false;
      const count = condition.effectiveMemberIds.reduce((sum, id) => sum + (getWorkScheduleSlot(scheduleMap, id, dateString)?.leave ? 1 : 0), 0);
      return count >= condition.limitCount;
    });
}
function canAutoPlaceLeaveByScheduleConditions(scheduleMap, memberId, dateString) { return getBlockingSameLeaveConditions(scheduleMap, memberId, dateString).length === 0; }

function getBlockingSameShiftConditions(scheduleMap, memberId, shiftId, dateString) {
  return getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_SHIFT)
    .filter((condition) => condition.effectiveMemberIds.includes(memberId))
    .filter((condition) => {
      if (getWorkScheduleSlot(scheduleMap, memberId, dateString)?.shift === shiftId) return false;
      const count = condition.effectiveMemberIds.reduce((sum, id) => sum + (getWorkScheduleSlot(scheduleMap, id, dateString)?.shift === shiftId ? 1 : 0), 0);
      return count >= condition.limitCount;
    });
}
function canAutoAssignShiftByScheduleConditions(scheduleMap, memberId, shiftId, dateString) { return getBlockingSameShiftConditions(scheduleMap, memberId, shiftId, dateString).length === 0; }

function noteScheduleConditionBlocks(preview, dateString, conditions, suffix) {
  if (!preview || !Array.isArray(preview.warnings) || !conditions?.length) return;
  if (!preview.scheduleConditionWarningKeys) Object.defineProperty(preview, "scheduleConditionWarningKeys", { value: new Set(), enumerable: false });
  conditions.forEach((condition) => {
    const key = `${dateString}|${condition.id}|${suffix}`;
    if (preview.scheduleConditionWarningKeys.has(key)) return;
    preview.scheduleConditionWarningKeys.add(key);
    preview.warnings.push(`${dateString} ${formatScheduleConditionLabel(condition)}：${suffix}`);
  });
}

function renderScheduleConditionStatus(condition) {
  const ids = getConditionEffectiveMemberIds(condition);
  return ids.length >= 2 && condition.limitCount >= 1 && condition.limitCount < ids.length ? "" : '<span class="settings-member-chip">目前未生效</span>';
}

async function openScheduleConditions(force = true) {
  if (!canEditSchedule()) { showInfoMessage("沒有管理目前群組班表的權限"); return; }
  try {
    const conditions = await loadScheduleConditions(groupFeatureState.currentGroupId, force);
    const body = conditions.length ? `<div class="settings-table-wrap"><div class="settings-table-scroll"><div class="settings-table"><div class="settings-table-row" style="grid-template-columns:120px minmax(260px,1fr) 90px 100px;"><div>條件類型</div><div>人員</div><div>限額</div><div class="settings-table-actions-head">操作</div></div>${conditions.map((condition) => {
      const effective = { ...condition, effectiveMemberIds: getConditionEffectiveMemberIds(condition) };
      const names = getScheduleConditionMemberNames(effective);
      return `<div class="settings-table-row" style="grid-template-columns:120px minmax(260px,1fr) 90px 100px;"><div>${escapeHtml(getScheduleConditionTypeLabel(condition.type))}</div><div class="settings-table-meta settings-member-list">${names.length ? names.map((name) => `<span class="settings-member-chip">${escapeHtml(name)}</span>`).join("") : "-"}${renderScheduleConditionStatus(condition)}</div><div>${escapeHtml(String(condition.limitCount))}</div><div class="settings-table-actions">${renderActionIconButton("edit", `data-edit-schedule-condition="${escapeHtml(condition.id)}"`)}${renderActionIconButton("delete", `data-delete-schedule-condition="${escapeHtml(condition.id)}"`)}</div></div>`;
    }).join("")}</div></div></div>` : '<div class="empty-state">目前還沒有排班條件</div>';
    openEntityListModal({ title: `排班條件${getCurrentGroup()?.name ? `－${escapeHtml(getCurrentGroup().name)}` : ""}`, modalClass: "modal modal-wide settings-list-modal", body, headerButtons: '<button class="btn-primary" type="button" data-add-schedule-condition="true">新增</button>', hideFooterClose: true });
  } catch (error) { reportValidationError(`讀取排班條件失敗：${error.message || error}`); }
}

function getScheduleConditionMemberChoices() {
  return (state.members || [])
    .filter((member) => !member.deleted)
    .map((member) => ({
      id: String(member.id || ""),
      name: String(member.name || member.code || member.id || "")
    }))
    .filter((member) => member.id && member.name);
}

function getSelectedScheduleConditionMemberIds() {
  return [...new Set(Array.from(document.querySelectorAll("[data-schedule-condition-member-select]"))
    .map((select) => String(select.value || ""))
    .filter(Boolean))];
}

function renderScheduleConditionMemberSelects(selectedIds = []) {
  const members = getScheduleConditionMemberChoices();
  if (!members.length) return '<div class="empty-state">目前沒有可選人員</div>';
  const validIds = new Set(members.map((member) => member.id));
  const selected = [...new Set((Array.isArray(selectedIds) ? selectedIds : [])
    .map((id) => String(id || ""))
    .filter((id) => validIds.has(id)))];
  const selectedSet = new Set(selected);
  const values = selected.slice();
  if (!values.length || values.length < members.length) values.push("");
  return values.map((value, index) => {
    const options = members.filter((member) => member.id === value || !selectedSet.has(member.id));
    return `<select data-schedule-condition-member-select aria-label="人員 ${index + 1}" style="width:100%;min-width:0;"><option value="">請選擇人員</option>${options.map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === value ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}</select>`;
  }).join("");
}

function refreshScheduleConditionMemberSelects() {
  const container = document.querySelector("[data-schedule-condition-member-selects]");
  if (!container) return;
  container.innerHTML = renderScheduleConditionMemberSelects(getSelectedScheduleConditionMemberIds());
}

function openScheduleConditionForm(conditionId = "") {
  const condition = conditionId ? getScheduleConditionsForGroup().find((item) => item.id === conditionId) : null;
  const selectedIds = condition?.memberIds || [];
  modalContext = { category: "schedule-condition-form", targetId: condition?.id || "" };
  openEntityListModal({
    title: condition ? "修改排班條件" : "新增排班條件",
    modalClass: "modal modal-wide modal-form-compact",
    body: `<div class="form-grid"><div class="form-row"><label for="scheduleConditionType">條件類型</label><select id="scheduleConditionType"><option value="${SCHEDULE_CONDITION_SAME_SHIFT}" ${condition?.type === SCHEDULE_CONDITION_SAME_SHIFT ? "selected" : ""}>同班限制</option><option value="${SCHEDULE_CONDITION_SAME_LEAVE}" ${condition?.type === SCHEDULE_CONDITION_SAME_LEAVE ? "selected" : ""}>同休限制</option></select></div><div class="form-row"><label for="scheduleConditionLimit">限額</label><input id="scheduleConditionLimit" type="number" min="1" step="1" value="${escapeHtml(String(condition?.limitCount || 1))}"></div></div><div class="form-row"><label>人員</label><div data-schedule-condition-member-selects style="display:grid;gap:8px;">${renderScheduleConditionMemberSelects(selectedIds)}</div></div>`,
    headerButtons: '<button class="btn-primary" type="button" data-save-schedule-condition="true">儲存</button>', hideFooterClose: true
  });
}

async function saveScheduleConditionFromModal() {
  const memberIds = getSelectedScheduleConditionMemberIds();
  const limitCount = Number(document.getElementById("scheduleConditionLimit")?.value || 0);
  const type = document.getElementById("scheduleConditionType")?.value || SCHEDULE_CONDITION_SAME_SHIFT;
  if (memberIds.length < 2) { reportValidationError("至少選擇 2 位人員"); return; }
  if (!Number.isInteger(limitCount) || limitCount < 1 || limitCount >= memberIds.length) { reportValidationError("限額必須大於等於 1，且小於選取人數"); return; }
  try {
    await window.schedulerApi.saveScheduleCondition({ id: modalContext.targetId || null, groupId: groupFeatureState.currentGroupId, type, limitCount, memberIds });
    await loadScheduleConditions(groupFeatureState.currentGroupId, true);
    await openScheduleConditions(false);
  } catch (error) { reportValidationError(`儲存排班條件失敗：${error.message || error}`); }
}

async function deleteScheduleCondition(conditionId) {
  if (!conditionId || !await confirmAction("確定要刪除這筆排班條件嗎？")) return;
  try {
    await window.schedulerApi.deleteScheduleCondition(conditionId);
    await loadScheduleConditions(groupFeatureState.currentGroupId, true);
    await openScheduleConditions(false);
  } catch (error) { reportValidationError(`刪除排班條件失敗：${error.message || error}`); }
}
