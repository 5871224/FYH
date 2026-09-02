/* 登入狀態、權限判斷、工具列外殼與密碼修改。
 * 由固定建置清單載入。
 */

function applyAuthContext(context) {
  const source = context && typeof context === "object" ? context : {};
  authenticated = Boolean(source.authenticated && source.user);
  currentUser = authenticated ? source.user : null;
  currentProfile = authenticated ? (source.profile || null) : null;
  return authenticated;
}

function clearAuthIdentity() {
  authenticated = false;
  currentUser = null;
  currentProfile = null;
}

function isLoggedIn() {
  return authenticated && Boolean(currentUser?.id);
}

function resolveCurrentMember() {
  const allMembers = typeof groupFeatureState !== "undefined" && Array.isArray(groupFeatureState.catalog.members)
    ? groupFeatureState.catalog.members
    : state.members;
  if (currentProfile?.id) {
    const byId = allMembers.find((member) => member.id === currentProfile.id)
      || state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
  return allMembers.find((member) => member.code === currentProfile.employee_code)
    || state.members.find((member) => member.code === currentProfile.employee_code)
    || null;
}

function canManagePermissions() {
  return hasCommonPermission("settings");
}

function canEditSchedule() {
  return hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage");
}

function canUseScheduleToolbar() {
  return canEditSchedule() || hasCommonPermission("leave_settings");
}

function requireCommonUiPermission(permission, label = "此功能") {
  if (!isLoggedIn()) {
    openSignInDialog(`${label}前請先登入`);
    return false;
  }
  if (!hasCommonPermission(permission)) {
    showInfoMessage(`沒有${label}權限`);
    return false;
  }
  return true;
}

function requireCurrentGroupUiPermission(permission, label = "此功能") {
  if (!isLoggedIn()) {
    openSignInDialog(`${label}前請先登入`);
    return false;
  }
  if (!hasGroupPermission(groupFeatureState.currentGroupId, permission)) {
    showInfoMessage(`沒有${label}權限`);
    return false;
  }
  return true;
}

function canManageMembersInCurrentGroup() {
  return hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage");
}

function canManageDepartmentsInCurrentGroup() {
  return hasGroupPermission(groupFeatureState.currentGroupId, "department_settings");
}

async function ensureManagerDirectoryLoaded() {
  if (!hasAnyGroupPermission("schedule_manage") || managerDirectoryLoaded) {
    return;
  }
  if (!managerDirectoryLoading) {
    managerDirectoryLoading = window.schedulerApi.loadEmployeeAdminDirectory()
      .then((adminMembers) => {
        const adminById = new Map((adminMembers || []).map((member) => [member.id, member]));
        state.members = state.members.map((member) => {
          const adminMember = adminById.get(member.id);
          return adminMember ? { ...member, ...adminMember, id: member.id } : member;
        });
        managerDirectoryLoaded = true;
        currentMember = resolveCurrentMember();
      })
      .finally(() => {
        managerDirectoryLoading = null;
      });
  }
  await managerDirectoryLoading;
}

function getCurrentProfileName() {
  return currentProfile?.full_name || currentUser?.email || "";
}

function getRoleLabel(roleId) {
  return getRoleById(roleId)?.name || "未指定";
}


function canEditMemberAccount(member) {
  return hasGroupPermission(member?.groupId || groupFeatureState.currentGroupId, "schedule_manage");
}


function openSignInDialog(message = "") {
  authPromptMessage = message;
  authErrorMessage = "";
  authModalOpen = true;
  renderAuthGate();
}

function closeSignInDialog() {
  authPromptMessage = "";
  authErrorMessage = "";
  authModalOpen = false;
  renderAuthGate();
}

function shouldDefaultCollapseToolbar() {
  return window.innerWidth <= 960;
}

function syncToolbarCollapseUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  const toggle = document.getElementById("toolbarCollapseToggle");
  if (!toolbarCard || !toggle) {
    return;
  }
  toolbarCard.classList.toggle("toolbar-floating-card-collapsed", toolbarCollapsed);
  toggle.setAttribute("aria-expanded", toolbarCollapsed ? "false" : "true");
  toggle.setAttribute("aria-label", toolbarCollapsed ? "展開工具列" : "收合工具列");
  toggle.setAttribute("title", toolbarCollapsed ? "展開工具列" : "收合工具列");
  toggle.innerHTML = toolbarCollapsed
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 15l6-6 6 6"></path>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6"></path>
      </svg>
    `;
}

function initializeToolbarCollapse() {
  if (toolbarCollapseInitialized) {
    return;
  }
  toolbarCollapsed = shouldDefaultCollapseToolbar();
  toolbarCollapseInitialized = true;
}

function toggleToolbarCollapse() {
  toolbarCollapsed = !toolbarCollapsed;
  syncToolbarCollapseUi();
}

function syncRoleUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  const toolbarGrid = document.getElementById("toolbarGrid");
  const toolbarEnabled = canUseScheduleToolbar();
  initializeToolbarCollapse();
  if (toolbarGrid) toolbarGrid.hidden = !toolbarEnabled;
  if (toolbarCard) toolbarCard.classList.toggle("toolbar-floating-card-compact", !toolbarEnabled);
  syncToolbarCollapseUi();
  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.classList.toggle("chips-readonly", !canEditSchedule());
  });
  syncPermissionUi();
}

function renderAuthBar() {
  const toggle = document.getElementById("coreActionsToggle");
  const menu = document.getElementById("coreActionsMenu");
  const shell = document.getElementById("coreActionsShell");
  const homeButton = document.getElementById("coreHomeButton");
  if (!toggle || !menu) return;
  const loggedIn = isLoggedIn();
  const hasFunctions = loggedIn && hasFunctionMenuAccess();
  toggle.textContent = "功能";
  toggle.title = "開啟功能";
  toggle.hidden = !hasFunctions;
  if (shell) shell.hidden = !hasFunctions;
  if (homeButton) homeButton.hidden = !loggedIn;
  if (!hasFunctions) closeCoreActionsMenu();
}

function renderAuthGate() {
  const root = document.getElementById("authRoot");
  if (!root) {
    return;
  }
  if (!authModalOpen) {
    root.innerHTML = "";
    return;
  }
  if (!isLoggedIn()) {
    root.innerHTML = `
      <div class="auth-overlay">
        <div class="auth-card">
          <h3>登入</h3>
          ${authPromptMessage ? `<p class="modal-description">${escapeHtml(authPromptMessage)}</p>` : ""}
          <div class="form-row">
            <label for="loginAccount">工號</label>
            <input id="loginAccount" type="text" autocomplete="username" placeholder="請輸入工號">
          </div>
          <div class="form-row">
            <label for="loginPassword">密碼</label>
            <input id="loginPassword" type="password" autocomplete="current-password" placeholder="請輸入密碼">
          </div>
          ${authErrorMessage ? `<div class="auth-error">${escapeHtml(authErrorMessage)}</div>` : ""}
          <div class="modal-footer auth-footer">
            <button class="btn-primary" type="button" data-auth-sign-in="true">登入</button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  root.innerHTML = "";
}

function openChangePasswordModal() {
  if (!isLoggedIn()) {
    openSignInDialog("修改密碼前請先登入");
    return;
  }
  openEntityListModal({
    title: "修改密碼",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label for="changePasswordValue">新密碼</label>
        <input id="changePasswordValue" type="password" maxlength="64" placeholder="請輸入新密碼">
      </div>
      <div class="form-row">
        <label for="changePasswordConfirm">確認新密碼</label>
        <input id="changePasswordConfirm" type="password" maxlength="64" placeholder="請再次輸入新密碼">
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-change-password="true">儲存修改</button>',
    hideFooterClose: true
  });
}

async function saveChangedPassword() {
  const password = document.getElementById("changePasswordValue")?.value || "";
  const confirmPassword = document.getElementById("changePasswordConfirm")?.value || "";
  if (password.length < 4) {
    reportValidationError("密碼至少需要 4 碼");
    return;
  }
  if (password !== confirmPassword) {
    reportValidationError("兩次輸入的密碼不一致");
    return;
  }
  try {
    await window.schedulerApi.changePassword(password);
    closeModal();
    showInfoMessage("密碼已修改");
  } catch (error) {
    setSaveStatus(`修改密碼失敗：${error.message}`);
  }
}
