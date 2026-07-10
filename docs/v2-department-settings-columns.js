(function installDepartmentSettingsColumns() {
  openDepartmentSettings = function openDepartmentSettingsWithDetails() {
    departmentSettingsView = "department";
    modalContext = { category: "department-settings", view: "department" };
    const activeMembers = state.members.filter(isMemberCurrentlyActive);
    const departmentRows = state.departments.map((department) => {
      const homeMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) === department.id);
      const startDate = department.startDate || "-";
      const endDate = department.endDate || "-";
      return `
        <div class="department-settings-row sortable-settings-item" draggable="true" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">
          <div class="department-settings-title">${escapeHtml(department.name)}</div>
          <div class="member-inline-list">
            ${homeMembers.length
              ? homeMembers.map((member) => `
                <div class="member-item draggable-member" draggable="true" data-member-card="${escapeHtml(member.id)}" data-drop-member="${escapeHtml(member.id)}" data-drop-department="${escapeHtml(department.id)}">
                  <span>${escapeHtml(member.name)}</span>
                </div>
              `).join("")
              : '<div class="dept-empty-pill">拖曳人員到這裡</div>'
            }
          </div>
          <div class="department-settings-date-stack"><span>${escapeHtml(startDate)}</span><span>${escapeHtml(endDate)}</span></div>
          <div class="department-settings-flag">${department.hiddenFromSchedule ? "是" : "否"}</div>
          <div class="department-settings-flag">${department.attendanceEnabled ? "是" : "否"}</div>
          <div class="member-table-actions">
            ${renderActionIconButton("edit", `data-edit-department="${escapeHtml(department.id)}"`)}
            ${renderActionIconButton("delete", `data-delete-department="${escapeHtml(department.id)}"`)}
          </div>
        </div>
      `;
    }).join("");
    const body = state.departments.length
      ? `
        <div class="department-settings-table-wrap">
          <div class="department-settings-table department-settings-table-department">
            <div class="department-settings-row department-settings-head">
              <div>單位</div>
              <div>所屬人員</div>
              <div>開始日期<br>結束日期</div>
              <div>不顯示</div>
              <div>可否打卡</div>
              <div>操作</div>
            </div>
            ${departmentRows}
          </div>
        </div>
      `
      : '<div class="empty-state">目前還沒有單位</div>';
    openEntityListModal({
      title: "單位設定",
      modalClass: "modal modal-wide department-settings-modal settings-list-modal",
      body,
      headerButtons: `
        <button class="ghost-btn" type="button" data-export-departments="true">匯出</button>
        <button class="ghost-btn" type="button" data-import-departments="true">匯入</button>
        <button class="btn-primary" type="button" data-open-add-department="true">新增</button>
      `,
      hideFooterClose: true
    });
  };
})();
