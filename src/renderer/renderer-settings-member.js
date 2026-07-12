function buildSelectOptions(items, valueField, labelBuilder, selectedValue, includeEmpty = false, emptyLabel = "未指定") {
  const entries = [];
  if (includeEmpty) {
    entries.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  }
  entries.push(...items.map((item) => `<option value="${escapeHtml(item[valueField])}" ${item[valueField] === selectedValue ? "selected" : ""}>${escapeHtml(labelBuilder(item))}</option>`));
  return entries.join("");
}

function renderScheduleShiftSelector(member) {
  const selectedIds = getMemberScheduleShiftIds(member);
  const visibleShifts = state.shifts.filter((shift) => !shift.hiddenFromToolbar);
  const orderedShifts = [
    ...selectedIds.map((shiftId) => visibleShifts.find((shift) => shift.id === shiftId)).filter(Boolean),
    ...visibleShifts.filter((shift) => !selectedIds.includes(shift.id))
  ];
  return `
    <div class="schedule-dept-list" id="memberScheduleShiftList" hidden>
      ${orderedShifts.map((shift, index) => {
        const checked = selectedIds.includes(shift.id);
        return `
          <label class="schedule-dept-option" draggable="true" data-schedule-shift-option="${escapeHtml(shift.id)}">
            <input type="checkbox" value="${escapeHtml(shift.id)}" ${checked ? "checked" : ""}>
            <span class="schedule-dept-rank">${checked ? index + 1 : "-"}</span>
            <span>${escapeHtml(shift.name)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function readMemberScheduleShiftIds() {
  return Array.from(document.querySelectorAll("#memberScheduleShiftList [data-schedule-shift-option]"))
    .filter((row) => row.querySelector("input")?.checked)
    .map((row) => row.dataset.scheduleShiftOption || "")
    .filter(Boolean);
}

function syncScheduleShiftSummary() {
  const summary = document.querySelector(".schedule-shift-summary");
  if (!summary) {
    return;
  }
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = readMemberScheduleShiftIds()
    .map((shiftId) => shiftMap.get(shiftId))
    .filter(Boolean);
  summary.textContent = names.length ? names.join("、") : "未指定";
}

function syncScheduleShiftSelectorRanks() {
  let rank = 1;
  document.querySelectorAll("#memberScheduleShiftList [data-schedule-shift-option]").forEach((row) => {
    const rankElement = row.querySelector(".schedule-dept-rank");
    const checked = Boolean(row.querySelector("input")?.checked);
    if (rankElement) {
      rankElement.textContent = checked ? String(rank) : "-";
    }
    if (checked) {
      rank += 1;
    }
  });
}

function getFilteredMemberSettingsMembers() {
  const normalizedName = memberSettingsFilters.name.trim().toLowerCase();
  const sourceMembers = state.members;
  const filteredMembers = sourceMembers.filter((member) => {
    const matchesName = !normalizedName || member.name.toLowerCase().includes(normalizedName);
    const matchesDepartment = memberSettingsFilters.department === "all"
      ? true
      : memberSettingsFilters.department === "__none__"
        ? !getMemberHomeDeptId(member)
        : getMemberHomeDeptId(member) === memberSettingsFilters.department;
    const matchesRole = memberSettingsFilters.role === "all"
      ? true
      : normalizeRole(member.role) === memberSettingsFilters.role;
    const active = isMemberCurrentlyActive(member);
    const matchesEmployment = memberSettingsFilters.employment === "all"
      ? true
      : memberSettingsFilters.employment === "inactive"
        ? !active
        : active;
    const matchesSalaryType = memberSettingsFilters.salaryType === "all"
      ? true
      : memberSettingsFilters.salaryType === "daily"
        ? Boolean(member.payByDay)
        : !member.payByDay;
    return matchesName && matchesDepartment && matchesRole && matchesEmployment && matchesSalaryType;
  });
  return { sourceMembers, filteredMembers };
}

function renderMemberSettingsList() {
  const { sourceMembers, filteredMembers } = getFilteredMemberSettingsMembers();
  return `
      ${sourceMembers.length
        ? `
      <div class="member-table-wrap">
        <div class="member-table-scroll">
          <div class="member-table">
            <div class="member-table-row member-table-head">
              <div>工號</div>
              <div>姓名</div>
              <div>排班班別</div>
              <div>權限</div>
              <div>到職日<br>離職日</div>
              <div>計薪方式</div>
              <div>例假星期</div>
              <div class="member-table-actions-head">操作</div>
            </div>
            ${filteredMembers.map((member) => {
              const canEditAccount = canEditMemberAccount(member);
              return `
              <div class="member-table-row sortable-settings-item" draggable="true" data-sort-category="member" data-sort-item="${escapeHtml(member.id)}" data-member-settings-row="${escapeHtml(member.id)}">
                <div class="member-table-code">${escapeHtml(member.code)}</div>
                <div class="member-table-name">${escapeHtml(member.name)}</div>
                <div class="member-shift-pill-list">${renderMemberScheduleShiftPills(member)}</div>
                <div>${getRoleLabel(member.role)}</div>
                <div class="member-date-stack"><span>${escapeHtml(member.hireDate || "-")}</span><span>${escapeHtml(member.leaveDate || "-")}</span></div>
                <div>${getSalaryTypeLabel(member)}</div>
                <div>${getRestWeekdayLabel(member.fixedRestWeekday)}</div>
                <div class="member-table-actions">
                  ${canEditAccount ? renderActionIconButton("edit", `data-edit-member="${escapeHtml(member.id)}"`) : ""}
                  ${canEditAccount ? renderActionIconButton("delete", `data-delete-member="${escapeHtml(member.id)}"`) : ""}
                </div>
              </div>
            `;
            }).join("")}
          </div>
        </div>
      </div>
        `
        : '<div class="empty-state">目前還沒有人員</div>'
      }
      ${sourceMembers.length && !filteredMembers.length ? '<div class="empty-state">沒有符合篩選條件的人員</div>' : ""}
    `;
}

function refreshMemberSettingsList() {
  const list = document.getElementById("memberSettingsList");
  if (!list) return;

  const scroll = list.querySelector(".member-table-scroll");
  const scrollTop = scroll?.scrollTop || 0;
  const active = document.activeElement;
  const field = active?.matches?.("[data-member-settings-filter-field]")
    ? active.dataset.memberSettingsFilterField
    : "";
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;

  list.innerHTML = renderMemberSettingsList();

  const nextScroll = list.querySelector(".member-table-scroll");
  if (nextScroll) nextScroll.scrollTop = scrollTop;
  if (field) {
    const next = list.querySelector(`[data-member-settings-filter-field="${field}"]`);
    next?.focus();
    if (typeof next?.setSelectionRange === "function" && Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
      next.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

async function openMemberSettings() {
  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {
    showInfoMessage(`讀取管理資料失敗：${error.message || error}`);
    return;
  }
  modalContext = { category: "member-settings" };
  const body = `
      <div class="member-settings-filters">
        <div class="form-row">
          <label for="memberSettingsNameFilter">姓名</label>
          <input id="memberSettingsNameFilter" type="text" value="${escapeHtml(memberSettingsFilters.name)}" placeholder="輸入姓名" data-member-settings-filter-field="name">
        </div>
        <div class="form-row">
          <label for="memberSettingsDepartmentFilter">單位</label>
          <select id="memberSettingsDepartmentFilter" data-member-settings-filter-field="department">
            <option value="all" ${memberSettingsFilters.department === "all" ? "selected" : ""}>全部</option>
            ${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${memberSettingsFilters.department === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}
            <option value="__none__" ${memberSettingsFilters.department === "__none__" ? "selected" : ""}>未指定</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsRoleFilter">權限</label>
          <select id="memberSettingsRoleFilter" data-member-settings-filter-field="role">
            <option value="all" ${memberSettingsFilters.role === "all" ? "selected" : ""}>全部</option>
            <option value="admin" ${memberSettingsFilters.role === "admin" ? "selected" : ""}>管理員</option>
            <option value="manager" ${memberSettingsFilters.role === "manager" ? "selected" : ""}>主管</option>
            <option value="employee" ${memberSettingsFilters.role === "employee" ? "selected" : ""}>員工</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsEmploymentFilter">狀態</label>
          <select id="memberSettingsEmploymentFilter" data-member-settings-filter-field="employment">
            <option value="active" ${memberSettingsFilters.employment === "active" ? "selected" : ""}>在職</option>
            <option value="inactive" ${memberSettingsFilters.employment === "inactive" ? "selected" : ""}>離職</option>
            <option value="all" ${memberSettingsFilters.employment === "all" ? "selected" : ""}>全部</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsSalaryTypeFilter">計薪方式</label>
          <select id="memberSettingsSalaryTypeFilter" data-member-settings-filter-field="salaryType">
            <option value="all" ${memberSettingsFilters.salaryType === "all" ? "selected" : ""}>全部</option>
            <option value="monthly" ${memberSettingsFilters.salaryType === "monthly" ? "selected" : ""}>月薪</option>
            <option value="daily" ${memberSettingsFilters.salaryType === "daily" ? "selected" : ""}>日薪</option>
          </select>
        </div>
      </div>
      <div class="member-settings-list" id="memberSettingsList">${renderMemberSettingsList()}</div>
    `;
  openEntityListModal({
    title: "人員設定",
    modalClass: "modal modal-wide member-settings-modal settings-list-modal",
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-members="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-members="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-member="true">新增</button>
    `,
    hideFooterClose: true
  });
}

function renderMemberRoleOptions(member) {
  const currentRole = normalizeRole(member?.role);
  const options = isAdmin()
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value === currentRole);
  return options.map((option) => (
    `<option value="${option.value}" ${currentRole === option.value ? "selected" : ""}>${option.label}</option>`
  )).join("");
}

function openMemberForm(mode, memberId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: modalContext.view || departmentSettingsView })
    : modalContext?.category === "member-settings"
      ? captureSettingsReturnContext({ category: "member-settings" })
      : null;
  const member = mode === "edit"
    ? state.members.find((item) => item.id === memberId)
    : {
      id: "",
      code: "",
      name: "",
      deptId: state.departments[0]?.id || "",
      positionId: "",
      proxyMemberId: "",
      hireDate: "",
      leaveDate: "",
      payByDay: false,
      fixedRestWeekday: 0,
      scheduleShiftIds: [],
      role: "employee"
    };
  if (!member) {
    return;
  }
  if (!canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以修改管理員帳號");
    return;
  }
  modalContext = { mode, category: "member", targetId: memberId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}人員`,
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid two-col">
        <div class="form-row">
          <label for="memberCode">工號</label>
          <input id="memberCode" type="text" maxlength="12" value="${escapeHtml(member.code)}" placeholder="請輸入員工編號">
        </div>
        <div class="form-row">
          <label for="memberName">姓名</label>
          <input id="memberName" type="text" maxlength="12" value="${escapeHtml(member.name)}" placeholder="請輸入姓名">
        </div>
        <div class="form-row">
          <label for="memberRole">權限</label>
          <select id="memberRole" ${isAdmin() ? "" : "disabled"}>
            ${renderMemberRoleOptions(member)}
          </select>
        </div>
        <div class="form-row">
          <label for="memberSalaryType">計薪方式</label>
          <select id="memberSalaryType">
            <option value="monthly" ${member.payByDay ? "" : "selected"}>月薪</option>
            <option value="daily" ${member.payByDay ? "selected" : ""}>日薪</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberHireDate">到職日</label>
          <input id="memberHireDate" type="date" value="${escapeHtml(member.hireDate)}">
        </div>
        <div class="form-row">
          <label for="memberLeaveDate">離職日</label>
          <input id="memberLeaveDate" type="date" value="${escapeHtml(member.leaveDate)}">
        </div>
        <div class="form-row">
          <label for="memberFixedRestWeekday">例假星期</label>
          <select id="memberFixedRestWeekday">
            ${REST_WEEKDAY_OPTIONS.map((option) => (
              `<option value="${option.value}" ${normalizeRestWeekday(member.fixedRestWeekday) === option.value ? "selected" : ""}>${option.label}</option>`
            )).join("")}
          </select>
        </div>
        <div class="form-row">
          <label for="memberDept">所屬單位</label>
          <select id="memberDept">
            ${buildSelectOptions(state.departments, "id", (department) => department.name, member.deptId || "")}
          </select>
        </div>
        ${mode === "edit" ? `
          <div class="form-row">
            <button class="ghost-btn" type="button" data-reset-member-password="${escapeHtml(member.code)}">重設密碼為 0000</button>
          </div>
        ` : ""}
        <div class="form-row form-row-wide">
          <label>排班班別</label>
          <div class="schedule-dept-summary-row">
            <div class="readonly-pill schedule-shift-summary">${escapeHtml(getMemberScheduleShiftNames(member))}</div>
            <button class="ghost-btn compact-btn" type="button" data-toggle-schedule-shifts="true">設定</button>
          </div>
          ${renderScheduleShiftSelector(member)}
        </div>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-member="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveMember(mode) {
  const returnTo = modalContext.returnTo || null;
  const hireDate = document.getElementById("memberHireDate")?.value || "";
  const leaveDate = document.getElementById("memberLeaveDate")?.value || "";
  if (hireDate && leaveDate && !isValidDateRange(hireDate, leaveDate)) {
    reportValidationError("到職日必須早於離職日");
    return;
  }
  const previousMember = mode === "edit"
    ? state.members.find((member) => member.id === modalContext.targetId) || null
    : null;
  const selectedHomeDeptId = document.getElementById("memberDept")?.value || "";
  const scheduleShiftIds = readMemberScheduleShiftIds();
  const homeDeptId = selectedHomeDeptId || previousMember?.deptId || "";
  const monthlyRestDays = Math.max(0, Number(previousMember?.monthlyRestDays) || 0);
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("m"),
    code: document.getElementById("memberCode")?.value.trim(),
    name: document.getElementById("memberName")?.value.trim(),
    deptId: homeDeptId,
    scheduleShiftIds,
    positionId: mode === "edit" ? (state.members.find((member) => member.id === modalContext.targetId)?.positionId || "") : "",
    proxyMemberId: "",
    hireDate,
    leaveDate,
    payByDay: document.getElementById("memberSalaryType")?.value === "daily",
    fixedRestWeekday: normalizeRestWeekday(document.getElementById("memberFixedRestWeekday")?.value),
    monthlyRestDays,
    role: isAdmin() ? normalizeRole(document.getElementById("memberRole")?.value) : normalizeRole(previousMember?.role)
  };
  if (!payload.code || !payload.name) {
    reportValidationError("請填寫人員編號與姓名");
    return;
  }
  if (!payload.deptId) {
    reportValidationError("請選擇所屬單位");
    return;
  }
  try {
    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");
  } catch (error) {
    reportValidationError(`同步人員資料失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.members = state.members.map((member) => member.id === payload.id ? payload : member);
  } else {
    state.members.push(payload);
  }
  if (currentProfile && currentProfile.employee_code === (previousMember?.code || payload.code)) {
    currentProfile = {
      ...currentProfile,
      employee_code: payload.code,
      full_name: payload.name,
      role: payload.role
    };
  }
  currentMember = resolveCurrentMember();
  closeModal();
  renderAll();
  reopenModalFromContext(returnTo);
}

async function exportMembersFromSettings() {
  try {
    await window.schedulerApi.exportMembers({
      state,
      year: state.year,
      month: state.month
    });
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function importMembersFromSettings() {
  try {
    const result = await window.schedulerApi.importMembers();
    if (result.canceled) {
      return;
    }
    const departmentMap = new Map(state.departments.map((department) => [department.name.trim(), department.id]));
    const shiftMap = new Map(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id]));
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let syncFailed = 0;
    let firstSyncError = "";

    for (const row of result.rows || []) {
      const code = String(row.code || "").trim();
      const name = String(row.name || "").trim();
      const departmentName = String(row.departmentName || "").trim();
      const deptId = departmentMap.get(departmentName);
      const scheduleShiftNames = String(row.scheduleShiftNames || "")
        .split(/[、,，]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const hasUnknownScheduleShift = scheduleShiftNames.some((value) => !shiftMap.has(value));
      const scheduleShiftIds = scheduleShiftNames
        .map((value) => shiftMap.get(value))
        .filter((shiftIdValue, index, list) => shiftIdValue && list.indexOf(shiftIdValue) === index);
      if (!code || !name || !deptId || hasUnknownScheduleShift) {
        skipped += 1;
        continue;
      }
      if (row.hireDate && row.leaveDate && !isValidDateRange(row.hireDate, row.leaveDate)) {
        skipped += 1;
        continue;
      }
      const existing = state.members.find((member) => member.code === code) || null;
      const payload = {
        id: existing?.id || uid("m"),
        code,
        name,
        deptId,
        scheduleShiftIds,
        positionId: existing?.positionId || "",
        proxyMemberId: existing?.proxyMemberId || "",
        hireDate: row.hireDate || "",
        leaveDate: row.leaveDate || "",
        payByDay: Boolean(row.payByDay),
        fixedRestWeekday: normalizeRestWeekday(row.fixedRestWeekday),
        monthlyRestDays: Math.max(0, Number(row.monthlyRestDays) || 0),
        role: isAdmin() ? normalizeRole(row.role) : normalizeRole(existing?.role)
      };
      if (!existing) {
        try {
          await window.schedulerApi.syncMemberProfile(payload, "");
        } catch (error) {
          syncFailed += 1;
          if (!firstSyncError) {
            firstSyncError = `${code || "(空白工號)"}：${error.message || "同步失敗"}`;
          }
          continue;
        }
      }
      if (existing) {
        state.members = state.members.map((member) => member.id === existing.id ? payload : member);
        updated += 1;
      } else {
        state.members.push(payload);
        imported += 1;
      }
    }

    currentMember = resolveCurrentMember();
    renderAll();
    openMemberSettings();
    queueSave();
    const summary = `匯入完成：新增 ${imported} 筆，更新 ${updated} 筆，略過 ${skipped} 筆，同步失敗 ${syncFailed} 筆`;
    if (syncFailed > 0) {
      showInfoMessage(`${summary}\n第一筆同步失敗：${firstSyncError}`);
      setSaveStatus(`匯入同步失敗：${firstSyncError}`);
      return;
    }
    showInfoMessage(summary);
  } catch (error) {
    setSaveStatus(`匯入失敗：${error.message}`);
  }
}

async function deleteMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (member && !canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以刪除管理員帳號");
    return;
  }
  const confirmed = await confirmAction("確定要刪除這位人員嗎？");
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.deleteMemberProfile(member?.code || "");
  } catch (error) {
    showInfoMessage(error.message || "刪除人員失敗");
    return;
  }
  if (member?.code && member.code === currentProfile?.employee_code) {
    await signOut();
    showInfoMessage("目前登入帳號已刪除，已自動登出。");
    return;
  }
  state.members = state.members.filter((member) => member.id !== memberId);
  state.members = state.members.map((member) => ({
    ...member,
    proxyMemberId: member.proxyMemberId === memberId ? "" : member.proxyMemberId
  }));
  renderAll();
  openMemberSettings();
}

async function resetMemberPasswordFromModal(employeeCode) {
  const code = String(employeeCode || "").trim();
  if (!code) {
    return;
  }
  const member = state.members.find((item) => item.code === code);
  if (member && !canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以重設管理員密碼");
    return;
  }
  const confirmed = await confirmAction(`確定要將 ${code} 的密碼重設為 0000 嗎？`);
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.resetMemberPassword(code);
    showInfoMessage(`${code} 的密碼已重設為 0000`);
  } catch (error) {
    setSaveStatus(`重設密碼失敗：${error.message}`);
  }
}
