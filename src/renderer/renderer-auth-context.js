/* 登入狀態、權限判斷、工具列外殼與密碼修改。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function isLoggedIn() {
  return Boolean(currentSession?.user);
}

function resolveCurrentMember() {
  if (currentProfile?.id) {
    const byId = state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
  return state.members.find((member) => member.code === currentProfile.employee_code) || null;
}

function normalizeRole(role) {
  return role === "admin" || role === "manager" ? role : "employee";
}

function isAdmin() {
  return normalizeRole(currentProfile?.role) === "admin";
}

function isManager() {
  const role = normalizeRole(currentProfile?.role);
  return role === "admin" || role === "manager";
}

function canEditSchedule() {
  return isManager();
}

async function ensureManagerDirectoryLoaded() {
  if (!isManager() || managerDirectoryLoaded) {
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
  return currentProfile?.full_name || currentSession?.user?.email || "";
}

function getCurrentRoleLabel() {
  return getRoleLabel(currentProfile?.role);
}

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === normalizeRole(role))?.label || "員工";
}

function canEditMemberAccount(member) {
  return isAdmin() || normalizeRole(member?.role) !== "admin";
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

function promptManagerAccess(message) {
  if (!isLoggedIn()) {
    openSignInDialog(message || "此功能需先登入主管帳號");
    return false;
  }
  if (!isManager()) {
    showInfoMessage("此功能限主管使用");
    return false;
  }
  return true;
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
  initializeToolbarCollapse();
  const toolbarGrid = document.getElementById("toolbarGrid");
  if (toolbarGrid) {
    toolbarGrid.style.display = isManager() ? "grid" : "none";
  }
  if (toolbarCard) {
    toolbarCard.classList.toggle("toolbar-floating-card-compact", !isManager());
  }
  syncToolbarCollapseUi();
  const coreActionsShell = document.getElementById("coreActionsShell");
  if (coreActionsShell) {
    coreActionsShell.style.display = isManager() ? "" : "none";
  }
  document.querySelectorAll(".manager-action").forEach((element) => {
    element.style.display = isManager() ? "" : "none";
    element.disabled = !isManager();
  });
  const managerOnlyIds = [
    "deptSettingsButton",
    "shiftSettingsButton",
    "restComplianceButton",
    "leaveSettingsButton",
    "overtimeSettingsButton",
    "weekStartSettingsButton"
  ];
  managerOnlyIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.style.display = isManager() ? "" : "none";
    element.disabled = !isManager();
  });

  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.classList.toggle("chips-readonly", !canEditSchedule());
  });

}

function renderAuthBar() {
  const toggle = document.getElementById("coreActionsToggle");
  const menu = document.getElementById("coreActionsMenu");
  const homeButton = document.getElementById("coreHomeButton");
  if (!toggle || !menu) {
    return;
  }
  const loggedIn = isLoggedIn();
  const manager = loggedIn && isManager();
  const hasProfile = Boolean(currentProfile);
  toggle.textContent = "功能";
  toggle.title = "開啟功能";
  toggle.style.display = manager ? "" : "none";
  if (homeButton) {
    homeButton.style.display = loggedIn ? "" : "none";
  }
  menu.querySelectorAll(".user-menu-login").forEach((element) => {
    element.style.display = loggedIn ? "none" : "";
  });
  menu.querySelectorAll(".user-menu-auth").forEach((element) => {
    element.style.display = loggedIn ? "" : "none";
  });
  const changePasswordButton = menu.querySelector("[data-open-change-password]");
  if (changePasswordButton) {
    changePasswordButton.style.display = loggedIn && hasProfile ? "" : "none";
  }
  menu.querySelectorAll(".manager-action").forEach((element) => {
    element.style.display = manager ? "" : "none";
    element.disabled = !manager;
  });
  if (!loggedIn) {
    closeCoreActionsMenu();
  } else if (!manager) {
    closeCoreActionsMenu();
  }
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
