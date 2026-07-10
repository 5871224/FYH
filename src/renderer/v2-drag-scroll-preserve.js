(() => {
  let snapshot = null;
  let restoreUntil = 0;

  const dragSelectors = [
    ".department-settings-modal [data-sort-item]",
    ".catalog-settings-modal [data-sort-item]",
    "[data-meal-product-row]",
    "[data-table-member-id]",
    "[data-table-department-id]"
  ].join(",");

  function getScrollKey(element, index) {
    if (!(element instanceof HTMLElement)) return `scroll-${index}`;
    const classKey = Array.from(element.classList).filter((name) => /scroll|body|wrap/.test(name)).join(".");
    return classKey ? `.${classKey}` : `scroll-${index}`;
  }

  function collectScrollableElements() {
    const modal = document.querySelector("#modalRoot .modal-overlay");
    const scope = modal || document;
    return Array.from(scope.querySelectorAll(".modal-body, .settings-table-scroll, .member-table-scroll, .department-settings-table-wrap, .settings-table-wrap, .member-table-wrap, .table-wrap"))
      .filter((element) => element instanceof HTMLElement)
      .filter((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
  }

  function captureScroll() {
    const elements = collectScrollableElements();
    snapshot = {
      windowX: window.scrollX,
      windowY: window.scrollY,
      entries: elements.map((element, index) => ({
        key: getScrollKey(element, index),
        top: element.scrollTop,
        left: element.scrollLeft
      }))
    };
    restoreUntil = Date.now() + 1500;
  }

  function findByKey(key, index) {
    if (key.startsWith(".")) {
      const selector = key.split(".").filter(Boolean).map((part) => `.${CSS.escape(part)}`).join("");
      const found = document.querySelector(`#modalRoot ${selector}, ${selector}`);
      if (found instanceof HTMLElement) return found;
    }
    return collectScrollableElements()[index] || null;
  }

  function restoreScroll() {
    if (!snapshot || Date.now() > restoreUntil) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(snapshot.windowX, snapshot.windowY);
        snapshot.entries.forEach((entry, index) => {
          const element = findByKey(entry.key, index);
          if (element) {
            element.scrollTop = entry.top;
            element.scrollLeft = entry.left;
          }
        });
      });
    });
  }

  document.addEventListener("dragstart", (event) => {
    const target = event.target instanceof Element ? event.target.closest(dragSelectors) : null;
    if (!target) return;
    captureScroll();
  }, true);

  document.addEventListener("drop", () => {
    if (!snapshot) return;
    restoreUntil = Date.now() + 1500;
    restoreScroll();
    setTimeout(restoreScroll, 0);
    setTimeout(restoreScroll, 80);
    setTimeout(restoreScroll, 220);
  }, true);

  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    new MutationObserver(() => restoreScroll()).observe(modalRoot, { childList: true, subtree: true });
  }
})();
