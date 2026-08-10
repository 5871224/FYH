(() => {
  const INSTALL_FLAG = "__FYH_PERMISSION_ROLE_ORDERING_INSTALLED__";
  const TABLE_SELECTOR = "#modalRoot .permission-settings-table";
  let draggedRoleId = "";

  function installPermissionRoleOrderingStyles() {
    if (document.getElementById("fyhPermissionRoleOrderingStyles")) return;
    const style = document.createElement("style");
    style.id = "fyhPermissionRoleOrderingStyles";
    style.textContent = `
      .permission-settings-table .permission-role-drag-col {
        width: var(--settings-drag-column-width, 30px);
        min-width: var(--settings-drag-column-width, 30px);
        max-width: var(--settings-drag-column-width, 30px);
        padding-right: 4px !important;
        padding-left: 4px !important;
        text-align: center;
        vertical-align: middle;
      }

      .permission-settings-table .permission-role-drag-col .settings-order-drag-handle {
        margin: 0 auto;
      }

      .permission-settings-table tr.permission-role-dragging {
        opacity: .62;
      }
    `;
    document.head.appendChild(style);
  }

  function getRoleIdFromRow(row) {
    if (!(row instanceof HTMLTableRowElement)) return "";
    return row.dataset.permissionRoleId
      || row.querySelector("[data-edit-access-role]")?.dataset.editAccessRole
      || "";
  }

  function getOrderedRoleIds(table) {
    const body = table?.tBodies?.[0];
    return Array.from(body?.rows || []).map(getRoleIdFromRow).filter(Boolean);
  }

  function clearDraggingState(body) {
    draggedRoleId = "";
    body?.querySelectorAll(".permission-role-dragging").forEach((row) => {
      row.classList.remove("permission-role-dragging");
    });
  }

  async function persistRoleOrder(table) {
    const orderedIds = getOrderedRoleIds(table);
    if (!orderedIds.length) return;
    try {
      await window.schedulerApi.reorderSettings("access-role", orderedIds);
      if (typeof loadGroupAccessData === "function") {
        await loadGroupAccessData();
      }
      if (typeof setSaveStatus === "function") {
        setSaveStatus("角色排序已儲存");
      }
    } catch (error) {
      if (typeof setSaveStatus === "function") {
        setSaveStatus(`角色排序儲存失敗：${error?.message || error}`);
      }
      try {
        if (typeof loadGroupAccessData === "function") {
          await loadGroupAccessData();
        }
        if (table.isConnected && typeof openPermissionSettings === "function") {
          openPermissionSettings();
        }
      } catch {
        // 保留原錯誤訊息，不以回復畫面失敗覆蓋。
      }
    }
  }

  function enhancePermissionSettingsTable() {
    const table = document.querySelector(TABLE_SELECTOR);
    if (!(table instanceof HTMLTableElement) || table.dataset.roleOrderingReady === "true") return;
    const headerRow = table.tHead?.rows?.[0];
    const body = table.tBodies?.[0];
    if (!headerRow || !body) return;

    const header = document.createElement("th");
    header.className = "permission-role-drag-col";
    header.setAttribute("aria-label", "排序");
    headerRow.insertBefore(header, headerRow.firstElementChild);

    Array.from(body.rows).forEach((row) => {
      const roleId = getRoleIdFromRow(row);
      if (!roleId) return;
      row.dataset.permissionRoleId = roleId;

      const cell = document.createElement("td");
      cell.className = "permission-role-drag-col";
      const handle = document.createElement("span");
      handle.className = "settings-order-drag-handle";
      handle.draggable = true;
      handle.textContent = "≡";
      handle.title = "拖曳排序";
      handle.setAttribute("aria-label", "拖曳排序");
      cell.appendChild(handle);
      row.insertBefore(cell, row.firstElementChild);
    });

    table.dataset.roleOrderingReady = "true";

    body.addEventListener("dragstart", (event) => {
      const handle = event.target instanceof Element
        ? event.target.closest(".settings-order-drag-handle")
        : null;
      const row = handle?.closest("tr[data-permission-role-id]");
      if (!handle || !row) return;

      draggedRoleId = row.dataset.permissionRoleId || "";
      if (!draggedRoleId) return;
      row.classList.add("permission-role-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedRoleId);
      }
    });

    body.addEventListener("dragover", (event) => {
      if (!draggedRoleId) return;
      const targetRow = event.target instanceof Element
        ? event.target.closest("tr[data-permission-role-id]")
        : null;
      const draggedRow = Array.from(body.rows).find((row) => getRoleIdFromRow(row) === draggedRoleId);
      if (!targetRow || !draggedRow || targetRow === draggedRow) return;

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const rect = targetRow.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      body.insertBefore(draggedRow, insertAfter ? targetRow.nextSibling : targetRow);
    });

    body.addEventListener("drop", (event) => {
      if (!draggedRoleId) return;
      event.preventDefault();
      clearDraggingState(body);
      void persistRoleOrder(table);
    });

    body.addEventListener("dragend", () => {
      clearDraggingState(body);
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (window[INSTALL_FLAG]) return;
    window[INSTALL_FLAG] = true;
    installPermissionRoleOrderingStyles();

    const modalRoot = document.getElementById("modalRoot");
    if (modalRoot) {
      new MutationObserver(enhancePermissionSettingsTable).observe(modalRoot, {
        childList: true,
        subtree: true
      });
    }
    enhancePermissionSettingsTable();
  });
})();
