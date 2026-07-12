/* 班表欄列、範圍選取與鍵盤剪貼簿控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function beginScheduleHeaderColumnSelection(event) {
  if (event.button !== 0) {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-schedule-column]") : null;
  if (!(target instanceof HTMLElement) || !canEditSchedule() || state.tableView !== "member" || state.selected.type) {
    return;
  }
  const col = Number(target.dataset.scheduleColumn);
  if (!Number.isInteger(col)) {
    return;
  }
  selectScheduleColumn(col, event.shiftKey);
  scheduleHeaderDragSelection = { type: "column" };
  event.preventDefault();
}

function updateScheduleHeaderColumnSelection(event) {
  if (scheduleHeaderDragSelection?.type !== "column") {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-schedule-column]") : null;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const col = Number(target.dataset.scheduleColumn);
  if (Number.isInteger(col)) {
    selectScheduleColumn(col, true);
  }
}

function selectScheduleRowFromMemberCell(cell, extend = false) {
  const row = Number(cell?.dataset?.rowIndex);
  return Number.isInteger(row) && selectScheduleRow(row, extend);
}

function beginScheduleRangeSelection(event) {
  if (event.button !== 0) {
    return;
  }
  const cell = getScheduleCellFromEvent(event);
  if (!cell) {
    return;
  }
  const point = getScheduleCellPoint(cell);
  if (event.shiftKey && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)) {
    setScheduleRangeSelection(scheduleRangeSelection.anchor, point);
  } else {
    setScheduleRangeSelection(point);
  }
  scheduleDragSelecting = true;
  scheduleSuppressNextCellClick = true;
  event.preventDefault();
}

function updateScheduleRangeSelection(event) {
  if (!scheduleDragSelecting || !scheduleRangeSelection) {
    return;
  }
  const cell = getScheduleCellFromEvent(event);
  if (!cell) {
    return;
  }
  setScheduleRangeSelection(scheduleRangeSelection.anchor, getScheduleCellPoint(cell));
}

function endScheduleRangeSelection() {
  scheduleDragSelecting = false;
  scheduleHeaderDragSelection = null;
}

function clearSelectedChip() {
  if (!state.selected.type) {
    return false;
  }
  state.selected = { type: null, id: null };
  clearScheduleRangeSelection();
  renderToolbar();
  renderTable();
  return true;
}

async function handleScheduleGridKeydown(event) {
  if (event.key === "Escape"
    && !document.querySelector("#modalRoot .modal-overlay")
    && !isTypingTarget(event.target)
    && canEditSchedule()
    && clearSelectedChip()) {
    event.preventDefault();
    return;
  }
  if (document.querySelector("#modalRoot .modal-overlay")
    || isTypingTarget(event.target)
    || !canEditSchedule()) {
    return;
  }
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
    event.preventDefault();
    const redoRequested = key === "y" || event.shiftKey;
    await (redoRequested ? redoSchedule() : undoSchedule());
    return;
  }
  if (state.tableView !== "member" || !scheduleRangeSelection) {
    return;
  }
  if (key === "delete" || key === "backspace") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }
  if (key === "c") {
    event.preventDefault();
    copyScheduleRangeToClipboard();
    return;
  }
  if (key === "x") {
    event.preventDefault();
    if (!copyScheduleRangeToClipboard()) {
      return;
    }
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
  if (key === "v") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await pasteScheduleClipboard()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
}
