/* 彈窗、返回鍵與設定頁重新開啟控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function closeModal() {
  modalContext = {};
  document.getElementById("modalRoot").innerHTML = "";
  hideLeaveTooltip();
}

function hasClosableModal() {
  return Boolean(document.querySelector("#modalRoot .modal-overlay"));
}

function pushAppBackHistoryGuard() {
  if (!window.history?.pushState) {
    return;
  }
  if (!window.history.state || window.history.state.schedulerBackGuard !== true) {
    window.history.replaceState(APP_BACK_HISTORY_STATE, "", window.location.href);
  }
  window.history.pushState(APP_BACK_HISTORY_STATE, "", window.location.href);
}

function handleAppBackNavigation() {
  if (hasClosableModal()) {
    closeModal();
  } else {
    appView = "home";
    renderAll();
  }
  pushAppBackHistoryGuard();
}

function reopenModalFromContext(context) {
  if (!context || typeof context !== "object") {
    return;
  }
  if (context.category === "department-settings") {
    departmentSettingsView = "department";
    openDepartmentSettings();
    restoreSettingsScroll(context);
    return;
  }
  if (context.category === "member-settings") {
    openMemberSettings();
    restoreSettingsScroll(context);
    return;
  }
  if (context.category === "list-settings") {
    openListSettings(context.listCategory);
    restoreSettingsScroll(context);
  }
}

function setModal(content) {
  document.getElementById("modalRoot").innerHTML = content;
}
