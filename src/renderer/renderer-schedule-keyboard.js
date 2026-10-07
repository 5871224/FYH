/* 班表欄列、範圍選取與鍵盤剪貼簿控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */


let scheduleRangeAutoScrollController = null;

function getScheduleRangeAutoScrollBounds() {
  const tableWrap = document.getElementById("tableWrap");
  if (!(tableWrap instanceof HTMLElement)) return null;
  const rect = tableWrap.getBoundingClientRect();
  const rootStyle = getComputedStyle(document.documentElement);
  const frozenWidth = parseFloat(rootStyle.getPropertyValue("--schedule-frozen-width")) || 0;
  const stickyHeader = document.getElementById("tableStickyHeader");
  const stickyBottom = stickyHeader?.getBoundingClientRect?.().bottom || 0;
  return {
    left: Math.min(rect.right, rect.left + frozenWidth),
    right: rect.right,
    top: Math.max(rect.top, stickyBottom, 0),
    bottom: Math.min(rect.bottom, window.innerHeight || document.documentElement.clientHeight || rect.bottom)
  };
}

function updateScheduleRangeFocusAtPointer(pointer, tableWrap) {
  if (!pointer || !tableWrap || typeof document.elementFromPoint !== "function") return;
  const rect = tableWrap.getBoundingClientRect();
  const rootStyle = getComputedStyle(document.documentElement);
  const frozenWidth = parseFloat(rootStyle.getPropertyValue("--schedule-frozen-width")) || 0;
  const stickyHeader = document.getElementById("tableStickyHeader");
  const stickyBottom = stickyHeader?.getBoundingClientRect?.().bottom || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rect.bottom;
  const sampleX = Math.min(rect.right - 2, Math.max(rect.left + frozenWidth + 2, pointer.x));
  const sampleY = Math.min(
    Math.min(rect.bottom - 2, viewportHeight - 2),
    Math.max(Math.max(rect.top + 2, stickyBottom + 2), pointer.y)
  );
  const target = document.elementFromPoint(sampleX, sampleY);
  const cell = target instanceof Element ? target.closest("#mainTable .cell") : null;
  if (!(cell instanceof HTMLElement) || !cell.dataset.memberId || !cell.dataset.date) return;
  setScheduleRangeSelection(scheduleRangeSelection.anchor, getScheduleCellPoint(cell));
}

function applyScheduleRangeAutoScroll({ deltaX, deltaY, pointer }) {
  const tableWrap = document.getElementById("tableWrap");
  if (!(tableWrap instanceof HTMLElement)) return false;
  let changed = false;
  const maxScrollLeft = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth);
  const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, tableWrap.scrollLeft + deltaX));
  if (Math.abs(nextScrollLeft - tableWrap.scrollLeft) > 0.1) {
    tableWrap.scrollLeft = nextScrollLeft;
    syncStickyHeaderScroll();
    changed = true;
  }
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const pageHeight = Math.max(document.documentElement.scrollHeight || 0, document.body?.scrollHeight || 0);
  const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const maxScrollY = Math.max(0, pageHeight - viewportHeight);
  const nextScrollY = Math.min(maxScrollY, Math.max(0, currentScrollY + deltaY));
  if (Math.abs(nextScrollY - currentScrollY) > 0.1) {
    window.scrollTo(window.scrollX || 0, nextScrollY);
    changed = true;
  }
  if (changed) updateScheduleRangeFocusAtPointer(pointer, tableWrap);
  return changed;
}

function getScheduleRangeAutoScrollController() {
  if (!scheduleRangeAutoScrollController) {
    scheduleRangeAutoScrollController = createFixedEdgeAutoScrollController({
      isActive: () => scheduleDragSelecting && Boolean(scheduleRangeSelection),
      getBounds: getScheduleRangeAutoScrollBounds,
      onStep: applyScheduleRangeAutoScroll,
      horizontal: true,
      vertical: true,
      edgeSize: 56,
      speedX: 24,
      speedY: 18
    });
  }
  return scheduleRangeAutoScrollController;
}

function scheduleRangeAutoScroll(x, y) {
  getScheduleRangeAutoScrollController().updatePointer(x, y);
}

function stopScheduleRangeAutoScroll() {
  scheduleRangeAutoScrollController?.stop();
}

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
  scheduleRangeAutoScroll(event.clientX, event.clientY);
  event.preventDefault();
}

function updateScheduleRangeSelection(event) {
  if (!scheduleDragSelecting || !scheduleRangeSelection) return;
  if (typeof event.buttons === "number" && (event.buttons & 1) === 0) {
    endScheduleRangeSelection();
    return;
  }
  scheduleRangeAutoScroll(event.clientX, event.clientY);
  const cell = getScheduleCellFromEvent(event);
  if (cell) setScheduleRangeSelection(scheduleRangeSelection.anchor, getScheduleCellPoint(cell));
}

function handleScheduleRangeSelectionMouseLeave(event) {
  if (scheduleDragSelecting && typeof event.buttons === "number" && (event.buttons & 1) === 1) {
    scheduleHeaderDragSelection = null;
    scheduleRangeAutoScroll(event.clientX, event.clientY);
    return;
  }
  endScheduleRangeSelection();
}

function endScheduleRangeSelection() {
  scheduleDragSelecting = false;
  scheduleHeaderDragSelection = null;
  stopScheduleRangeAutoScroll();
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
