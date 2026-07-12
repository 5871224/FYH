(function installV2SettingsDragHandles() {

  function createDragColumn() {
    const column = document.createElement("div");
    column.className = "settings-order-drag-col";
    const handle = document.createElement("span");
    handle.className = "settings-order-drag-handle";
    handle.draggable = true;
    handle.title = "拖曳排序";
    handle.setAttribute("aria-label", "拖曳排序");
    handle.textContent = "≡";
    column.appendChild(handle);
    return column;
  }

  function addHeaderColumn(row) {
    if (!(row instanceof HTMLElement) || row.querySelector(":scope > .settings-order-drag-col")) return;
    const column = document.createElement("div");
    column.className = "settings-order-drag-col";
    row.prepend(column);
  }

  function addRowHandle(row) {
    if (!(row instanceof HTMLElement)) return;
    row.draggable = false;
    row.removeAttribute("draggable");
    if (!row.querySelector(":scope > .settings-order-drag-col")) row.prepend(createDragColumn());
  }

  function enhanceSettingsModals() {
    document.querySelectorAll(".member-settings-modal .member-table-head").forEach(addHeaderColumn);
    document.querySelectorAll('.member-settings-modal .sortable-settings-item[data-sort-category="member"]').forEach(addRowHandle);

    document.querySelectorAll(".catalog-settings-modal .settings-table-head").forEach(addHeaderColumn);
    document.querySelectorAll(".catalog-settings-modal .sortable-settings-item[data-sort-item]").forEach(addRowHandle);

    document.querySelectorAll(".department-settings-table-department .department-settings-head").forEach(addHeaderColumn);
    document.querySelectorAll('.department-settings-table-department .sortable-settings-item[data-sort-category="department"]').forEach(addRowHandle);
  }

  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    new MutationObserver(enhanceSettingsModals).observe(modalRoot, { childList: true, subtree: true });
  }
  enhanceSettingsModals();

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest(".member-settings-modal [data-sort-item], .catalog-settings-modal [data-sort-item], .department-settings-modal [data-sort-item]");
    if (!row) return;
    if (target.closest("[data-member-card]")) return;
    if (!target.closest(".settings-order-drag-handle")) event.preventDefault();
  }, true);
})();
