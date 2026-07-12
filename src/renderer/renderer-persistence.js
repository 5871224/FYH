/* 班表狀態整理、延遲儲存與強制儲存。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function ensureScheduleSlot(memberId, day) {
  const key = getScheduleKeyForDateString(memberId, normalizeScheduleDateInput(day));
  if (!key) {
    return null;
  }
  if (!state.schedule[key]) {
    state.schedule[key] = { shift: null, leave: null, overtime: null };
  }
  return state.schedule[key];
}

function pruneEmptySchedule() {
  Object.keys(state.schedule).forEach((key) => {
    const slot = state.schedule[key];
    if (!slot || (!slot.shift && !slot.leave && !slot.overtime)) {
      delete state.schedule[key];
    }
  });
}

function buildPersistedState() {
  const nextState = {
    ...state,
    schedule: {}
  };
  Object.entries(state.schedule || {}).forEach(([key, slot]) => {
    if (!slot) {
      return;
    }
    const nextSlot = {
      shift: slot.shift || null,
      leave: slot.leave || null,
      overtime: slot.overtime || null
    };
    if (nextSlot.leave && slot.leaveMeta) {
      nextSlot.leaveMeta = {
        ...slot.leaveMeta
      };
    }
    if (nextSlot.overtime && slot.overtimeMeta) {
      nextSlot.overtimeMeta = {
        ...slot.overtimeMeta
      };
    }
    if (nextSlot.shift || nextSlot.leave || nextSlot.overtime) {
      nextState.schedule[key] = nextSlot;
    }
  });
  return nextState;
}

function queueSave() {
  if (!canEditSchedule()) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void forceSave();
}

async function forceSave() {
  if (!canEditSchedule()) {
    return false;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await window.schedulerApi.saveState(buildPersistedState());
    return true;
  } catch (error) {
    setSaveStatus(`儲存失敗：${error.message}`);
    return false;
  }
}
