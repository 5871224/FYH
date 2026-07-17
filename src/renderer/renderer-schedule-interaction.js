/* 班表儲存格選取、複製貼上、儲存與復原
 * 由 renderer.js 第三階段拆分；維持既有全域 bundle 執行方式。
 */

function getSlot(memberId, day) {
  const key = getScheduleKeyForDateString(memberId, normalizeScheduleDateInput(day));
  return key ? state.schedule[key] || null : null;
}

function getPreviewSlotByKey(key) {
  return autoSchedulePreview?.slots?.[key] || null;
}

function getDisplayedSlot(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  const key = getScheduleKeyForDateString(memberId, dateString);
  return key ? (getPreviewSlotByKey(key) || state.schedule[key] || null) : null;
}

function getScheduleCellFromEvent(event) {
  const target = event.target;
  const cell = target instanceof Element ? target.closest("#mainTable .cell") : null;
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  if (!canEditSchedule() || state.tableView !== "member" || state.selected.type || cell.dataset.readonly) {
    return null;
  }
  if (!cell.dataset.memberId || !cell.dataset.date) {
    return null;
  }
  return cell;
}

function getScheduleCellPoint(cell) {
  return {
    row: Number(cell.dataset.rowIndex),
    col: Number(cell.dataset.colIndex),
    memberId: cell.dataset.memberId || "",
    date: cell.dataset.date || ""
  };
}

function getSchedulePointByRowCol(row, col) {
  const cell = document.querySelector(`#mainTable .cell[data-row-index="${row}"][data-col-index="${col}"]`);
  return cell instanceof HTMLElement ? getScheduleCellPoint(cell) : null;
}

function getScheduleGridMaxRow() {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-row-index]"))
    .reduce((max, cell) => Math.max(max, Number(cell.dataset.rowIndex)), -1);
}

function getScheduleGridMaxCol() {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-col-index]"))
    .reduce((max, cell) => Math.max(max, Number(cell.dataset.colIndex)), -1);
}

function isValidScheduleCellPoint(point) {
  return point
    && Number.isInteger(point.row)
    && Number.isInteger(point.col)
    && point.memberId
    && toDateObject(point.date);
}

function getScheduleSelectionBounds() {
  if (!scheduleRangeSelection || !isValidScheduleCellPoint(scheduleRangeSelection.anchor) || !isValidScheduleCellPoint(scheduleRangeSelection.focus)) {
    return null;
  }
  return {
    rowMin: Math.min(scheduleRangeSelection.anchor.row, scheduleRangeSelection.focus.row),
    rowMax: Math.max(scheduleRangeSelection.anchor.row, scheduleRangeSelection.focus.row),
    colMin: Math.min(scheduleRangeSelection.anchor.col, scheduleRangeSelection.focus.col),
    colMax: Math.max(scheduleRangeSelection.anchor.col, scheduleRangeSelection.focus.col)
  };
}

function clearScheduleRangeSelection() {
  scheduleRangeSelection = null;
  document.querySelectorAll("#mainTable .cell.range-selected").forEach((cell) => {
    cell.classList.remove("range-selected", "range-anchor");
  });
}

function selectScheduleColumn(col, extend = false) {
  const maxRow = getScheduleGridMaxRow();
  if (maxRow < 0) {
    return false;
  }
  const anchorCol = extend && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)
    ? scheduleRangeSelection.anchor.col
    : col;
  const anchor = getSchedulePointByRowCol(0, anchorCol);
  const focus = getSchedulePointByRowCol(maxRow, col);
  if (!anchor || !focus) {
    return false;
  }
  setScheduleRangeSelection(anchor, focus);
  return true;
}

function selectScheduleRow(row, extend = false) {
  const maxCol = getScheduleGridMaxCol();
  if (maxCol < 0) {
    return false;
  }
  const anchorRow = extend && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)
    ? scheduleRangeSelection.anchor.row
    : row;
  const anchor = getSchedulePointByRowCol(anchorRow, 0);
  const focus = getSchedulePointByRowCol(row, maxCol);
  if (!anchor || !focus) {
    return false;
  }
  setScheduleRangeSelection(anchor, focus);
  return true;
}

function syncScheduleRangeSelectionUi() {
  const bounds = getScheduleSelectionBounds();
  document.querySelectorAll("#mainTable .cell.range-selected, #mainTable .cell.range-anchor").forEach((cell) => {
    cell.classList.remove("range-selected", "range-anchor");
  });
  if (!bounds) {
    return;
  }
  document.querySelectorAll("#mainTable .cell[data-member-id][data-date]").forEach((cell) => {
    if (!(cell instanceof HTMLElement)) {
      return;
    }
    const row = Number(cell.dataset.rowIndex);
    const col = Number(cell.dataset.colIndex);
    if (row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax) {
      cell.classList.add("range-selected");
      if (row === scheduleRangeSelection.anchor.row && col === scheduleRangeSelection.anchor.col) {
        cell.classList.add("range-anchor");
      }
    }
  });
}

function setScheduleRangeSelection(anchor, focus = anchor) {
  if (!isValidScheduleCellPoint(anchor) || !isValidScheduleCellPoint(focus)) {
    clearScheduleRangeSelection();
    return;
  }
  scheduleRangeSelection = { anchor, focus };
  syncScheduleRangeSelectionUi();
}

function getSelectedScheduleCells() {
  const bounds = getScheduleSelectionBounds();
  if (!bounds) {
    return [];
  }
  return Array.from(document.querySelectorAll("#mainTable .cell[data-member-id][data-date]"))
    .filter((cell) => {
      if (!(cell instanceof HTMLElement) || cell.classList.contains("inactive-cell")) {
        return false;
      }
      const row = Number(cell.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      return row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax;
    })
    .sort((a, b) => Number(a.dataset.rowIndex) - Number(b.dataset.rowIndex) || Number(a.dataset.colIndex) - Number(b.dataset.colIndex));
}

function serializeScheduleSlotForClipboard(slot) {
  if (!slot) {
    return { shift: null, leave: null, leaveMeta: null, overtime: null, overtimeMeta: null };
  }
  return {
    shift: slot.shift || null,
    leave: slot.leave || null,
    leaveMeta: slot.leave && slot.leaveMeta ? { ...slot.leaveMeta } : null,
    overtime: slot.overtime || null,
    overtimeMeta: slot.overtime && slot.overtimeMeta ? { ...slot.overtimeMeta } : null
  };
}

async function applyClipboardSlotToScheduleCell(memberId, dateString, clipboardSlot) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || !isMemberActiveOnDateString(member, dateString)) {
    return false;
  }
  const slot = ensureScheduleSlot(memberId, dateString);
  if (!slot) {
    return false;
  }
  const nextShiftId = clipboardSlot?.shift || null;
  slot.shift = nextShiftId;
  slot.leave = clipboardSlot?.leave || null;
  if (clipboardSlot?.leaveMeta) {
    slot.leaveMeta = { ...clipboardSlot.leaveMeta };
  } else {
    delete slot.leaveMeta;
  }
  slot.overtime = clipboardSlot?.overtime || null;
  if (clipboardSlot?.overtimeMeta) {
    slot.overtimeMeta = { ...clipboardSlot.overtimeMeta };
  } else {
    delete slot.overtimeMeta;
  }
  return true;
}

async function clearScheduleCellEditableParts(memberId, dateString) {
  return applyClipboardSlotToScheduleCell(memberId, dateString, {
    shift: null,
    leave: null,
    leaveMeta: null,
    overtime: null,
    overtimeMeta: null
  });
}

function pushScheduleUndoSnapshot(snapshot = state.schedule || {}) {
  scheduleUndoStack.push(deepClone(snapshot));
  if (scheduleUndoStack.length > SCHEDULE_HISTORY_LIMIT) {
    scheduleUndoStack.shift();
  }
  scheduleRedoStack = [];
  syncScheduleHistoryButtons();
}

function rememberScheduleUndoSnapshot() {
  pushScheduleUndoSnapshot();
}

function discardLastScheduleUndoSnapshot() {
  scheduleUndoStack.pop();
  syncScheduleHistoryButtons();
}

let scheduleHistoryBusy = false;

function getScheduleUndoButton() {
  return document.getElementById("scheduleUndoButton");
}

function getScheduleRedoButton() {
  return document.getElementById("scheduleRedoButton");
}

function syncScheduleHistoryButtons() {
  const editable = typeof canEditSchedule === "function" && canEditSchedule();
  const undoButton = getScheduleUndoButton();
  const redoButton = getScheduleRedoButton();
  if (undoButton) {
    undoButton.disabled = scheduleHistoryBusy || !editable || scheduleUndoStack.length === 0;
    undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
  }
  if (redoButton) {
    redoButton.disabled = scheduleHistoryBusy || !editable || scheduleRedoStack.length === 0;
    redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
  }
}

function pushScheduleHistorySnapshot(stack, snapshot) {
  stack.push(deepClone(snapshot || {}));
  if (stack.length > SCHEDULE_HISTORY_LIMIT) {
    stack.shift();
  }
}

async function undoSchedule() {
  if (scheduleHistoryBusy || !canEditSchedule() || !scheduleUndoStack.length) {
    syncScheduleHistoryButtons();
    return false;
  }
  scheduleHistoryBusy = true;
  const targetSnapshot = scheduleUndoStack.pop();
  pushScheduleHistorySnapshot(scheduleRedoStack, state.schedule || {});
  syncScheduleHistoryButtons();
  try {
    await restoreScheduleSnapshot(targetSnapshot);
    return true;
  } catch (error) {
    showInfoMessage(`上一步失敗：${error.message || error}`);
    return false;
  } finally {
    scheduleHistoryBusy = false;
    syncScheduleHistoryButtons();
  }
}

async function redoSchedule() {
  if (scheduleHistoryBusy || !canEditSchedule() || !scheduleRedoStack.length) {
    syncScheduleHistoryButtons();
    return false;
  }
  scheduleHistoryBusy = true;
  const targetSnapshot = scheduleRedoStack.pop();
  pushScheduleHistorySnapshot(scheduleUndoStack, state.schedule || {});
  syncScheduleHistoryButtons();
  try {
    await restoreScheduleSnapshot(targetSnapshot);
    return true;
  } catch (error) {
    showInfoMessage(`下一步失敗：${error.message || error}`);
    return false;
  } finally {
    scheduleHistoryBusy = false;
    syncScheduleHistoryButtons();
  }
}

function bindScheduleHistoryControls() {
  getScheduleUndoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void undoSchedule();
  });
  getScheduleRedoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void redoSchedule();
  });
  window.schedulerScheduleHistory = {
    undo: undoSchedule,
    redo: redoSchedule,
    sync: syncScheduleHistoryButtons
  };
  syncScheduleHistoryButtons();
}

function parseScheduleKeyParts(key) {
  const parts = String(key || "").split("_");
  if (parts.length < 4) {
    return null;
  }
  const day = Number(parts.pop());
  const month = Number(parts.pop());
  const year = Number(parts.pop());
  const memberId = parts.join("_");
  if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return { memberId, dateString: toDateString(year, month, day) };
}

function getChangedScheduleCells(previousSchedule, nextSchedule) {
  const keys = new Set([
    ...Object.keys(previousSchedule || {}),
    ...Object.keys(nextSchedule || {})
  ]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(previousSchedule?.[key] || null) !== JSON.stringify(nextSchedule?.[key] || null))
    .map(parseScheduleKeyParts)
    .filter(Boolean);
}

function getScheduleCellElement(memberId, dateString) {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-member-id][data-date]"))
    .find((cell) => cell instanceof HTMLElement && cell.dataset.memberId === memberId && cell.dataset.date === dateString) || null;
}

function renderScheduleCell(memberId, dateString) {
  const cell = getScheduleCellElement(memberId, dateString);
  if (!(cell instanceof HTMLElement)) {
    return;
  }
  const key = getScheduleKeyForDateString(memberId, dateString);
  cell.innerHTML = renderCellInner(key, memberId, dateString, state.schedule[key] || null, false);
  if (state.tableView === "member" && state.tableStatsVisible) {
    const member = state.members.find((item) => item.id === memberId);
    const statsCell = cell.closest("tr")?.querySelector(".stats-col");
    if (member && statsCell) {
      statsCell.innerHTML = renderMemberStats(member);
    }
  }
}

async function persistScheduleCell(memberId, dateString) {
  await persistScheduleCells([{ memberId, dateString }]);
}

async function persistScheduleCells(cells) {
  const payloads = [];
  (Array.isArray(cells) ? cells : []).forEach(({ memberId, dateString }) => {
    const member = state.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    const key = getScheduleKeyForDateString(memberId, dateString);
    payloads.push({
      memberId,
      memberCode: member.code || "",
      dateString,
      slot: key ? state.schedule[key] || null : null
    });
  });
  if (payloads.length) {
    await window.schedulerApi.saveScheduleCells(payloads);
  }
}

async function applySchedulePreviewSlots(previewSlots) {
  const changedCells = Object.keys(previewSlots || {}).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    return 0;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
  return changedCells.length;
}

async function finishScheduleCellMutation(memberId, dateString) {
  pruneEmptySchedule();
  renderScheduleCell(memberId, dateString);
  syncScheduleRangeSelectionUi();
  await persistScheduleCell(memberId, dateString);
}

async function finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule) {
  const nextSchedule = state.schedule || {};
  if (!getChangedScheduleCells(previousSchedule, nextSchedule).length) {
    return false;
  }
  pushScheduleUndoSnapshot(previousSchedule);
  await finishScheduleCellMutation(memberId, dateString);
  return true;
}

function copyScheduleRangeToClipboard() {
  const cells = getSelectedScheduleCells();
  const bounds = getScheduleSelectionBounds();
  if (!cells.length || !bounds) {
    return false;
  }
  const rows = bounds.rowMax - bounds.rowMin + 1;
  const cols = bounds.colMax - bounds.colMin + 1;
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => serializeScheduleSlotForClipboard(null)));
  cells.forEach((cell) => {
    const row = Number(cell.dataset.rowIndex) - bounds.rowMin;
    const col = Number(cell.dataset.colIndex) - bounds.colMin;
    matrix[row][col] = serializeScheduleSlotForClipboard(getSlot(cell.dataset.memberId || "", cell.dataset.date || ""));
  });
  scheduleClipboard = { rows, cols, matrix };
  return true;
}

async function clearSelectedScheduleCells() {
  const cells = getSelectedScheduleCells();
  if (!cells.length) {
    return false;
  }
  let changed = false;
  const changedCells = [];
  for (const cell of cells) {
    const memberId = cell.dataset.memberId || "";
    const dateString = cell.dataset.date || "";
    const cellChanged = await clearScheduleCellEditableParts(memberId, dateString);
    if (cellChanged) {
      changedCells.push({ memberId, dateString });
      changed = true;
    }
  }
  if (changed) {
    pruneEmptySchedule();
    changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
    syncScheduleRangeSelectionUi();
    await persistScheduleCells(changedCells);
  }
  return changed;
}

async function pasteScheduleClipboard() {
  if (!scheduleClipboard || !scheduleRangeSelection) {
    return false;
  }
  if (scheduleClipboard.rows === 1 && scheduleClipboard.cols === 1) {
    const [clipboardSlot] = scheduleClipboard.matrix[0] || [];
    let changed = false;
    const changedCells = [];
    for (const cell of getSelectedScheduleCells()) {
      const memberId = cell.dataset.memberId || "";
      const dateString = cell.dataset.date || "";
      const cellChanged = await applyClipboardSlotToScheduleCell(memberId, dateString, clipboardSlot);
      if (cellChanged) {
        changedCells.push({ memberId, dateString });
        changed = true;
      }
    }
    if (changed) {
      pruneEmptySchedule();
      changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
      syncScheduleRangeSelectionUi();
      await persistScheduleCells(changedCells);
    }
    return changed;
  }
  let changed = false;
  const changedCells = [];
  for (let rowOffset = 0; rowOffset < scheduleClipboard.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < scheduleClipboard.cols; colOffset += 1) {
      const row = scheduleRangeSelection.anchor.row + rowOffset;
      const col = scheduleRangeSelection.anchor.col + colOffset;
      const cell = document.querySelector(`#mainTable .cell[data-row-index="${row}"][data-col-index="${col}"]`);
      if (!(cell instanceof HTMLElement) || cell.classList.contains("inactive-cell") || !cell.dataset.memberId || !cell.dataset.date) {
        continue;
      }
      const cellChanged = await applyClipboardSlotToScheduleCell(cell.dataset.memberId, cell.dataset.date, scheduleClipboard.matrix[rowOffset][colOffset]);
      if (cellChanged) {
        changedCells.push({ memberId: cell.dataset.memberId, dateString: cell.dataset.date });
        changed = true;
      }
    }
  }
  if (changed) {
    pruneEmptySchedule();
    changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
    syncScheduleRangeSelectionUi();
    await persistScheduleCells(changedCells);
  }
  return changed;
}

async function restoreScheduleSnapshot(snapshot) {
  if (!snapshot) {
    return false;
  }
  const previousSchedule = state.schedule || {};
  state.schedule = deepClone(snapshot);
  pruneEmptySchedule();
  const changedCells = getChangedScheduleCells(previousSchedule, state.schedule);
  renderTable();
  syncScheduleRangeSelectionUi();
  await persistScheduleCells(changedCells);
  return true;
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || Boolean(target instanceof HTMLElement && target.isContentEditable);
}
