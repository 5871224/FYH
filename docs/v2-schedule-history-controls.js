(function installScheduleHistoryControls() {
  const HISTORY_LIMIT = typeof SCHEDULE_HISTORY_LIMIT === "number" ? SCHEDULE_HISTORY_LIMIT : 20;
  let busy = false;

  function getUndoButton() {
    return document.getElementById("scheduleUndoButton");
  }

  function getRedoButton() {
    return document.getElementById("scheduleRedoButton");
  }

  function canUseHistory() {
    return typeof canEditSchedule === "function" ? canEditSchedule() : false;
  }

  function syncButtons() {
    const undoButton = getUndoButton();
    const redoButton = getRedoButton();
    const editable = canUseHistory();
    if (undoButton) {
      undoButton.disabled = busy || !editable || !Array.isArray(scheduleUndoStack) || scheduleUndoStack.length === 0;
      undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
    }
    if (redoButton) {
      redoButton.disabled = busy || !editable || !Array.isArray(scheduleRedoStack) || scheduleRedoStack.length === 0;
      redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
    }
  }

  function pushWithLimit(stack, snapshot) {
    stack.push(deepClone(snapshot || {}));
    if (stack.length > HISTORY_LIMIT) stack.shift();
  }

  async function undoSchedule() {
    if (busy || !canUseHistory() || !scheduleUndoStack.length) {
      syncButtons();
      return false;
    }
    busy = true;
    const targetSnapshot = scheduleUndoStack.pop();
    pushWithLimit(scheduleRedoStack, state.schedule || {});
    syncButtons();
    try {
      await restoreScheduleSnapshot(targetSnapshot);
      return true;
    } catch (error) {
      showInfoMessage(`上一步失敗：${error.message || error}`);
      return false;
    } finally {
      busy = false;
      syncButtons();
    }
  }

  async function redoSchedule() {
    if (busy || !canUseHistory() || !scheduleRedoStack.length) {
      syncButtons();
      return false;
    }
    busy = true;
    const targetSnapshot = scheduleRedoStack.pop();
    pushWithLimit(scheduleUndoStack, state.schedule || {});
    syncButtons();
    try {
      await restoreScheduleSnapshot(targetSnapshot);
      return true;
    } catch (error) {
      showInfoMessage(`下一步失敗：${error.message || error}`);
      return false;
    } finally {
      busy = false;
      syncButtons();
    }
  }

  function bindButtons() {
    getUndoButton()?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void undoSchedule();
    });
    getRedoButton()?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void redoSchedule();
    });
  }

  const originalPushScheduleUndoSnapshot = pushScheduleUndoSnapshot;
  pushScheduleUndoSnapshot = function pushScheduleUndoSnapshotWithUi(...args) {
    const result = originalPushScheduleUndoSnapshot(...args);
    syncButtons();
    return result;
  };

  const originalDiscardLastScheduleUndoSnapshot = discardLastScheduleUndoSnapshot;
  discardLastScheduleUndoSnapshot = function discardLastScheduleUndoSnapshotWithUi(...args) {
    const result = originalDiscardLastScheduleUndoSnapshot(...args);
    syncButtons();
    return result;
  };

  document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "z" || key === "y") setTimeout(syncButtons, 0);
  }, true);

  window.schedulerScheduleHistory = {
    undo: undoSchedule,
    redo: redoSchedule,
    sync: syncButtons
  };

  bindButtons();
  syncButtons();
})();
