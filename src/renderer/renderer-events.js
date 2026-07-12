/* 全域事件註冊總控。
 * 由 renderer.js 最終拆分；只協調各責任模組。
 */

function bindCoreMenuDismissEvent() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    const menu = document.getElementById("coreActionsMenu");
    const toggle = document.getElementById("coreActionsToggle");
    if (!menu || !toggle) {
      return;
    }
    if (menu.contains(target) || toggle.contains(target)) {
      return;
    }
    closeCoreActionsMenu();
  });
}

function bindEvents() {
  if (eventsBound) {
    return;
  }
  eventsBound = true;
  bindStaticToolbarEvents();
  bindScheduleViewportEvents();
  bindScheduleFilterEvents();
  bindScheduleSessionEvents();
  bindDelegatedClickEvents();
  bindDelegatedFormEvents();
  bindRecordsEvents();
  bindScheduleTooltipEvents();
  bindDragAndDropEvents();
  bindDragScrollPreservation();
  bindCoreMenuDismissEvent();
}
