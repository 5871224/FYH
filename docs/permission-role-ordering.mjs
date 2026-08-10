(() => {
  const INSTALL_FLAG = "__FYH_PERMISSION_ROLE_ORDERING_INSTALLED__";
  const TABLE_SELECTOR = "#modalRoot .permission-settings-table";
  let draggedRoleId = "";
  let dragStartOrder = [];
  let dropHandled = false;

  function sameOrder(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

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

  function getCurrentRoles() {
    if (typeof groupFeatureState === "undefined") return [];
    return Array.isArray(groupFeatureState.bundle?.roles) ? groupFeatureState.bundle.roles : [];
  }

  function applyRoleOrderLocally(orderedIds) {
    const roleMap = new Map(getCurrentRoles().map((role) => [role.id, role]));
    const orderedRoles = orderedIds.map((id) => roleMap.get(id)).filter(Boolean);
    getCurrentRoles().forEach((role) => {
      if (!orderedIds.includes(role.id)) orderedRoles.push(role);
    });
    orderedRoles.forEach((role, index) => {
      role.sortOrder = index;
    });
    if (typeof groupFeatureState !== "undefined") {
      groupFeatureState.bundle.roles = orderedRoles;
    }
    if (typeof state !== "undefined" && state && typeof state === "object") {
      state.accessRoles = orderedRoles;
    }
  }

  function getRoleOrderMap() {
    return new Map(getCurrentRoles().map((role, index) => [role.id, index]));
  }

  function syncRoleSelectOrder(scope = document) {
    const orderMap = getRoleOrderMap();
    if (orderMap.size < 2) return;

    scope.querySelectorAll("select").forEach((select) => {
      const allOptions = Array.from(select.options);
      const roleOptions = allOptions.filter((option) => orderMap.has(option.value));
      if (roleOptions.length < 2) return;
      const expectedIds = [...roleOptions]
        .sort((left, right) => orderMap.get(left.value) - orderMap.get(right.value))
        .map((option) => option.value);
      const currentIds = roleOptions.map((option) => option.value);
      if (sameOrder(currentIds, expectedIds)) return;

      const selectedValue = select.value;
      const firstRoleIndex = allOptions.findIndex((option) => orderMap.has(option.value));
      const sortedOptions = [...roleOptions].sort((left, right) => orderMap.get(left.value) - orderMap.get(right.value));
      roleOptions.forEach((option) => option.remove());
      const reference = select.options[firstRoleIndex] || null;
      sortedOptions.forEach((option) => select.insertBefore(option, reference));
      select.value = selectedValue;
    });
  }

  function clearDraggingState(body) {
    draggedRoleId = "";
    body?.querySelectorAll(".permission-role-dragging").forEach((row) => {
      row.classList.remove("permission-role-dragging");
    });
  }

  async function persistRoleOrder(table, orderedIds = getOrderedRoleIds(table)) {
    if (!orderedIds.length) return;
    applyRoleOrderLocally(orderedIds);
    syncRoleSelectOrder(document);
    if (typeof setSaveStatus === "function") {
      setSaveStatus("角色排序儲存中…");
    }
    try {
      await window.schedulerApi.reorderSettings("access-role", orderedIds);
      if (typeof loadGroupAccessData === "function") {
        await loadGroupAccessData();
        if (typeof state !== "undefined" && state && typeof state === "object") {
          state.accessRoles = getCurrentRoles();
        }
      }
      syncRoleSelectOrder(document);
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
          if (typeof state !== "undefined" && state && typeof state === "object") {
            state.accessRoles = getCurrentRoles();
          }
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
      dragStartOrder = getOrderedRoleIds(table);
      dropHandled = false;
      row.classList.add("permission-role-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedRoleId);
      }
    });

    body.addEventListener("dragover", (event) => {
      if (!draggedRoleId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

      const targetRow = event.target instanceof Element
        ? event.target.closest("tr[data-permission-role-id]")
        : null;
      const draggedRow = Array.from(body.rows).find((row) => getRoleIdFromRow(row) === draggedRoleId);
      if (!targetRow || !draggedRow || targetRow === draggedRow) return;

      const rect = targetRow.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      body.insertBefore(draggedRow, insertAfter ? targetRow.nextSibling : targetRow);
    });

    body.addEventListener("drop", (event) => {
      if (!draggedRoleId) return;
      event.preventDefault();
      dropHandled = true;
      const orderedIds = getOrderedRoleIds(table);
      const changed = !sameOrder(dragStartOrder, orderedIds);
      clearDraggingState(body);
      if (changed) void persistRoleOrder(table, orderedIds);
    });

    body.addEventListener("dragend", () => {
      const orderedIds = getOrderedRoleIds(table);
      const changed = dragStartOrder.length > 0 && !sameOrder(dragStartOrder, orderedIds);
      const shouldPersist = !dropHandled && changed;
      clearDraggingState(body);
      dragStartOrder = [];
      dropHandled = false;
      if (shouldPersist) void persistRoleOrder(table, orderedIds);
    });
  }

  function refreshRoleOrderingEnhancements() {
    enhancePermissionSettingsTable();
    const modalRoot = document.getElementById("modalRoot");
    if (modalRoot) syncRoleSelectOrder(modalRoot);
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (window[INSTALL_FLAG]) return;
    window[INSTALL_FLAG] = true;
    installPermissionRoleOrderingStyles();

    const modalRoot = document.getElementById("modalRoot");
    if (modalRoot) {
      new MutationObserver(refreshRoleOrderingEnhancements).observe(modalRoot, {
        childList: true,
        subtree: true
      });
    }
    refreshRoleOrderingEnhancements();
  });
})();
