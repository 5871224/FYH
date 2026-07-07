(function installV2SettingsDragHandles() {
  const DRAG_COLUMN_WIDTH = "30px";

  if (!document.getElementById("v2SettingsDragHandleStyle")) {
    const style = document.createElement("style");
    style.id = "v2SettingsDragHandleStyle";
    style.textContent = `
      .member-settings-modal .member-table-row {
        grid-template-columns: ${DRAG_COLUMN_WIDTH} 104px minmax(86px, .9fr) minmax(170px, 1.45fr) 64px 108px 84px 78px 76px;
      }
      .catalog-settings-modal .settings-table-row-shift {
        grid-template-columns: ${DRAG_COLUMN_WIDTH} minmax(76px, .55fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) minmax(72px, .45fr);
      }
      .catalog-settings-modal .settings-table-row-leave,
      .catalog-settings-modal .settings-table-row-overtime {
        grid-template-columns: ${DRAG_COLUMN_WIDTH} repeat(7, minmax(0, 1fr));
      }
      .department-settings-table-department .department-settings-row {
        grid-template-columns: ${DRAG_COLUMN_WIDTH} minmax(76px, .55fr) minmax(220px, 2.1fr) minmax(74px, .45fr);
      }
      .member-order-drag-col,
      .settings-order-drag-col {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        width: 100%;
      }
      .member-order-drag-handle,
      .settings-order-drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 26px;
        border-radius: 7px;
        color: var(--muted);
        cursor: grab;
        user-select: none;
        touch-action: none;
        font-size: 17px;
        line-height: 1;
      }
      .member-order-drag-handle:hover,
      .settings-order-drag-handle:hover {
        background: #f4eee3;
        color: var(--accent-strong);
      }
      .member-order-drag-handle:active,
      .settings-order-drag-handle:active {
        cursor: grabbing;
      }
      .catalog-settings-modal .sortable-settings-item,
      .department-settings-modal .sortable-settings-item {
        cursor: default;
      }
      @media (max-width: 900px) {
        .member-settings-modal .member-table-row {
          grid-template-columns: ${DRAG_COLUMN_WIDTH} 92px minmax(72px, .85fr) minmax(150px, 1.25fr) 54px 92px 72px 68px 70px;
        }
      }
    `;
    document.head.appendChild(style);
  }

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
    const row = target.closest(".catalog-settings-modal [data-sort-item], .department-settings-modal [data-sort-item]");
    if (!row) return;
    if (target.closest("[data-member-card]")) return;
    if (!target.closest(".settings-order-drag-handle")) event.preventDefault();
  }, true);
})();
