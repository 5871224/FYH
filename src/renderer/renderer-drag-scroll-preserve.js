/* 拖曳排序期間保存視窗與表格捲動位置。 */
let dragScrollSnapshot = null;
let dragScrollRestoreUntil = 0;

const DRAG_SCROLL_SELECTORS = [
  ".department-settings-modal [data-sort-item]",
  ".catalog-settings-modal [data-sort-item]",
  "[data-meal-product-row]",
  "[data-table-member-id]",
  "[data-table-department-id]"
].join(",");

function getDragScrollKey(element, index) {
  if (!(element instanceof HTMLElement)) return `scroll-${index}`;
  const classKey = Array.from(element.classList).filter((name) => /scroll|body|wrap/.test(name)).join(".");
  return classKey ? `.${classKey}` : `scroll-${index}`;
}

function collectDragScrollableElements() {
  const modal = document.querySelector("#modalRoot .modal-overlay");
  const scope = modal || document;
  return Array.from(scope.querySelectorAll(".modal-body, .settings-table-scroll, .member-table-scroll, .department-settings-table-wrap, .settings-table-wrap, .member-table-wrap, .table-wrap"))
    .filter((element) => element instanceof HTMLElement)
    .filter((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
}

function captureDragScrollPosition() {
  dragScrollSnapshot = {
    windowX: window.scrollX,
    windowY: window.scrollY,
    entries: collectDragScrollableElements().map((element, index) => ({
      key: getDragScrollKey(element, index),
      top: element.scrollTop,
      left: element.scrollLeft
    }))
  };
  dragScrollRestoreUntil = Date.now() + 1500;
}

function findDragScrollableElement(key, index) {
  if (key.startsWith(".")) {
    const selector = key.split(".").filter(Boolean).map((part) => `.${CSS.escape(part)}`).join("");
    const found = document.querySelector(`#modalRoot ${selector}, ${selector}`);
    if (found instanceof HTMLElement) return found;
  }
  return collectDragScrollableElements()[index] || null;
}

function restoreDragScrollPosition() {
  if (!dragScrollSnapshot || Date.now() > dragScrollRestoreUntil) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo(dragScrollSnapshot.windowX, dragScrollSnapshot.windowY);
    dragScrollSnapshot.entries.forEach((entry, index) => {
      const element = findDragScrollableElement(entry.key, index);
      if (element) {
        element.scrollTop = entry.top;
        element.scrollLeft = entry.left;
      }
    });
  }));
}

function bindDragScrollPreservation() {
  document.addEventListener("dragstart", (event) => {
    const target = event.target instanceof Element ? event.target.closest(DRAG_SCROLL_SELECTORS) : null;
    if (target) captureDragScrollPosition();
  }, true);
  document.addEventListener("drop", () => {
    if (!dragScrollSnapshot) return;
    dragScrollRestoreUntil = Date.now() + 1500;
    restoreDragScrollPosition();
    setTimeout(restoreDragScrollPosition, 0);
    setTimeout(restoreDragScrollPosition, 80);
    setTimeout(restoreDragScrollPosition, 220);
  }, true);
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) new MutationObserver(restoreDragScrollPosition).observe(modalRoot, { childList: true, subtree: true });
}
