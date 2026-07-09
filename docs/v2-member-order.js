(function installV2MemberOrderUi() {
  if (!window.schedulerApi || typeof renderAll !== "function" || typeof renderMemberSettingsList !== "function") return;

  let draggedMemberId = "";
  let draggingRow = null;


  function renderList() {
    const { sourceMembers, filteredMembers } = getFilteredMemberSettingsMembers();
    return `
      ${sourceMembers.length ? `
        <div class="member-table-wrap">
          <div class="member-table-scroll">
            <div class="member-table" data-member-order-list>
              <div class="member-table-row member-table-head">
                <div class="member-order-drag-col"></div>
                <div>工號</div>
                <div>姓名</div>
                <div>排班班別</div>
                <div>權限</div>
                <div>到職日<br>離職日</div>
                <div>計薪方式</div>
                <div>例假星期</div>
                <div class="member-table-actions-head">操作</div>
              </div>
              ${filteredMembers.map((member) => {
                const canEditAccount = canEditMemberAccount(member);
                return `
                  <div class="member-table-row member-order-row" data-member-order-row="${escapeHtml(member.id)}">
                    <div class="member-order-drag-col"><span class="member-order-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span></div>
                    <div class="member-table-code">${escapeHtml(member.code)}</div>
                    <div class="member-table-name">${escapeHtml(member.name)}</div>
                    <div class="member-shift-pill-list">${renderMemberScheduleShiftPills(member)}</div>
                    <div>${getRoleLabel(member.role)}</div>
                    <div class="member-date-stack"><span>${escapeHtml(member.hireDate || "-")}</span><span>${escapeHtml(member.leaveDate || "-")}</span></div>
                    <div>${getSalaryTypeLabel(member)}</div>
                    <div>${getRestWeekdayLabel(member.fixedRestWeekday)}</div>
                    <div class="member-table-actions">
                      ${canEditAccount ? renderActionIconButton("edit", `data-edit-member="${member.id}"`) : ""}
                      ${canEditAccount ? renderActionIconButton("delete", `data-delete-member="${member.id}"`) : ""}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      ` : '<div class="empty-state">目前還沒有人員</div>'}
      ${sourceMembers.length && !filteredMembers.length ? '<div class="empty-state">沒有符合篩選條件的人員</div>' : ""}
    `;
  }

  renderMemberSettingsList = renderList;
  refreshMemberSettingsList = function refreshV2MemberSettingsList() {
    const list = document.getElementById("memberSettingsList");
    if (list) list.innerHTML = renderList();
  };

  function clearDropMarks() {
    document.querySelectorAll(".member-order-drop-before, .member-order-drop-after").forEach((row) => {
      row.classList.remove("member-order-drop-before", "member-order-drop-after");
    });
  }

  function movePreview(targetRow, clientY) {
    if (!(draggingRow instanceof HTMLElement) || !(targetRow instanceof HTMLElement) || draggingRow === targetRow) return;
    const parent = targetRow.parentElement;
    if (!parent || parent !== draggingRow.parentElement) return;
    clearDropMarks();
    const rect = targetRow.getBoundingClientRect();
    const insertAfter = clientY > rect.top + rect.height / 2;
    targetRow.classList.add(insertAfter ? "member-order-drop-after" : "member-order-drop-before");
    const reference = insertAfter ? targetRow.nextElementSibling : targetRow;
    if (reference !== draggingRow && draggingRow.nextElementSibling !== reference) {
      parent.insertBefore(draggingRow, reference);
    }
  }

  function applyVisibleOrder(orderedIds) {
    const orderedSet = new Set(orderedIds);
    const byId = new Map(state.members.map((member) => [member.id, member]));
    const queue = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    return state.members.map((member) => orderedSet.has(member.id) ? queue.shift() || member : member);
  }

  async function saveOrderFromDom() {
    const rows = Array.from(document.querySelectorAll("[data-member-order-list] [data-member-order-row]"));
    const visibleIds = rows.map((row) => row.dataset.memberOrderRow || "").filter(Boolean);
    if (!visibleIds.length) return;
    const previous = state.members.slice();
    const next = applyVisibleOrder(visibleIds);
    if (next.map((member) => member.id).join("|") === previous.map((member) => member.id).join("|")) return;
    state.members = next;
    try {
      await window.schedulerApi.saveMemberOrder(state.members.map((member) => member.id));
      renderAll();
      refreshMemberSettingsList();
    } catch (error) {
      state.members = previous;
      refreshMemberSettingsList();
      showInfoMessage(error.message || "儲存人員排序失敗");
    }
  }

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("[data-member-order-row]");
    if (!row) return;
    if (!target.closest(".member-order-drag-handle")) {
      event.preventDefault();
      return;
    }
    draggedMemberId = row.dataset.memberOrderRow || "";
    draggingRow = row;
    row.classList.add("member-order-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedMemberId);
    }
  }, true);

  document.addEventListener("dragover", (event) => {
    if (!draggedMemberId) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("[data-member-order-row]");
    if (!row) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    movePreview(row, event.clientY);
  });

  document.addEventListener("drop", (event) => {
    if (!draggedMemberId) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("[data-member-order-row]")) return;
    event.preventDefault();
    void saveOrderFromDom();
  });

  document.addEventListener("dragend", () => {
    draggingRow?.classList.remove("member-order-dragging");
    clearDropMarks();
    draggedMemberId = "";
    draggingRow = null;
  });
})();
