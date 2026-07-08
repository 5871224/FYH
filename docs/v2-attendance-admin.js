(function installV2AttendanceAdminUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");

  async function call(name, payload) {
    const session = window.schedulerApi.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "打卡管理操作失敗");
    return result;
  }

  window.schedulerApi.getAttendanceAdminRecords = (filters = {}) => call("attendance-admin-list-v2", filters);
  window.schedulerApi.getAttendanceAdminHistory = (recordId) => call("attendance-admin-action-v2", { action: "history", recordId });
  window.schedulerApi.saveAttendanceAdminRecord = (record) => call("attendance-admin-action-v2", { action: "save", record });

  loadAttendanceAdmin = async function loadV2AttendanceAdmin(shouldRender = true) {
    if (!isAdmin()) return;
    recordsState = { ...recordsState, attendanceAdmin: { ...recordsState.attendanceAdmin, loading: true, error: "" } };
    if (shouldRender) renderAll();
    try {
      const result = await window.schedulerApi.getAttendanceAdminRecords({
        ...recordsState.attendanceAdmin.filters,
        page: recordsState.attendanceAdmin.page
      });
      recordsState = {
        ...recordsState,
        attendanceAdmin: {
          ...recordsState.attendanceAdmin,
          loading: false,
          rows: result.rows || [],
          members: result.members || [],
          issueTypes: result.issueTypes || [],
          total: Number(result.total || 0),
          page: Number(result.page || 1),
          pageSize: Number(result.pageSize || 50),
          error: ""
        }
      };
    } catch (error) {
      recordsState = { ...recordsState, attendanceAdmin: { ...recordsState.attendanceAdmin, loading: false, rows: [], error: error.message || "讀取打卡管理失敗" } };
    }
    if (shouldRender) renderAll();
  };

  renderAttendanceAdminSection = function renderV2AttendanceAdminSection() {
    const admin = recordsState.attendanceAdmin;
    const filters = admin.filters;
    const page = Number(admin.page || 1);
    const pageSize = Number(admin.pageSize || 50);
    const total = Number(admin.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<section class="records-section">
      <h2>打卡管理</h2>
      <div class="records-filter-row">
        <input type="date" value="${escapeHtml(filters.fromDate)}" data-attendance-filter="fromDate">
        <input type="date" value="${escapeHtml(filters.toDate)}" data-attendance-filter="toDate">
        <select data-attendance-filter="memberId">${memberOptions(filters.memberId, admin.members)}</select>
        <select data-attendance-filter="issueType"><option value="">全部異常</option>${admin.issueTypes.map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select>
        <label class="overtime-use-label"><input type="checkbox" ${filters.abnormalOnly ? "checked" : ""} data-attendance-filter="abnormalOnly">只顯示異常</label>
        
      </div>
      ${admin.error ? `<div class="auth-error">${escapeHtml(admin.error)}</div>` : ""}
      <div class="records-table-wrap"><table class="records-table">
        <thead><tr><th>日期</th><th>員工</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th>操作</th></tr></thead>
        <tbody>${admin.rows.map((row) => `<tr>
          <td>${escapeHtml(row.work_date || "")}</td>
          <td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td>
          <td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td>
          <td>${formatRecordDateTime(row.clock_in_at)}<br><span>${escapeHtml(row.clock_in_department_name_snapshot || "")}</span></td>
          <td>${formatRecordDateTime(row.clock_out_at)}<br><span>${escapeHtml(row.clock_out_department_name_snapshot || "")}</span></td>
          <td>${escapeHtml((row.issues || []).join("、") || "正常")}</td>
          <td>${escapeHtml(row.attendance_note || "")}</td>
          <td><button class="ghost-btn compact-btn" type="button" data-edit-attendance="${escapeHtml(row.user_id)}:${escapeHtml(row.work_date)}:${escapeHtml(row.id || "")}">編輯</button>${row.id ? `<button class="ghost-btn compact-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}">歷程</button>` : ""}</td>
        </tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody>
      </table></div>
      <div class="records-filter-row records-pagination">
        <button class="ghost-btn compact-btn" type="button" data-v2-attendance-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
        <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
        <button class="ghost-btn compact-btn" type="button" data-v2-attendance-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
      </div>
    </section>`;
  };

  openAttendanceEditModal = function openV2AttendanceEditModal(token) {
    const [userId, workDate, recordId] = String(token || "").split(":");
    const row = findAttendanceAdminRow(userId, workDate, recordId) || { user_id: userId, work_date: workDate };
    openEntityListModal({
      title: "編輯打卡",
      hideFooterClose: true,
      body: `<div class="form-grid two-col">
        <div class="form-row"><label>上班時間</label><input id="adminClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>
        <div class="form-row"><label>上班單位</label><select id="adminClockInDepartment"><option value="">未指定</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${row.clock_in_department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></div>
        <div class="form-row"><label>下班時間</label><input id="adminClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>
        <div class="form-row"><label>下班單位</label><select id="adminClockOutDepartment"><option value="">未指定</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${row.clock_out_department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></div>
        <div class="form-row form-row-wide"><label>每日打卡備註</label><textarea id="adminAttendanceNote" rows="3">${escapeHtml(row.attendance_note || "")}</textarea></div>
        <div class="form-row form-row-wide"><label>本次異動原因</label><textarea id="adminAttendanceReason" rows="2" placeholder="選填，會保存於修改歷程"></textarea></div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-edit="${escapeHtml(userId)}:${escapeHtml(workDate)}:${escapeHtml(row.id || "")}">儲存</button>`
    });
  };

  saveAttendanceEdit = async function saveV2AttendanceEdit(token) {
    const [userId, workDate, recordId] = String(token || "").split(":");
    const reason = document.getElementById("adminAttendanceReason")?.value.trim() || "";
    try {
      await window.schedulerApi.saveAttendanceAdminRecord({
        id: recordId || "",
        userId,
        workDate,
        clockInTime: document.getElementById("adminClockInTime")?.value || "",
        clockInDepartmentId: document.getElementById("adminClockInDepartment")?.value || "",
        clockOutTime: document.getElementById("adminClockOutTime")?.value || "",
        clockOutDepartmentId: document.getElementById("adminClockOutDepartment")?.value || "",
        attendanceNote: document.getElementById("adminAttendanceNote")?.value || "",
        reason
      });
      closeModal();
      await loadAttendanceAdmin();
      await loadOvertimeReview(false);
      showInfoMessage("打卡資料已更新");
    } catch (error) {
      setSaveStatus(`儲存打卡失敗：${error.message}`);
    }
  };

  openAttendanceHistoryModal = async function openV2AttendanceHistory(recordId) {
    try {
      const result = await window.schedulerApi.getAttendanceAdminHistory(recordId);
      openEntityListModal({
        title: "打卡修改歷程",
        body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>欄位</th><th>原值</th><th>新值</th><th>原因</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(log.field_name || log.action_type || "")}</td><td>${escapeHtml(log.old_value || "")}</td><td>${escapeHtml(log.new_value || "")}</td><td>${escapeHtml(log.reason || "")}</td><td>${escapeHtml(log.operator_name_snapshot || "")}</td></tr>`).join("") || '<tr><td colspan="6">沒有歷程</td></tr>'}</tbody></table></div>`
      });
    } catch (error) {
      setSaveStatus(`讀取歷程失敗：${error.message}`);
    }
  };

  document.addEventListener("change", (event) => {
    const target = event.target;
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.attendanceFilter) {
      recordsState.attendanceAdmin.page = 1;
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target?.dataset.v2AttendancePage) return;
    const page = Number(target.dataset.v2AttendancePage || 1);
    if (page > 0) {
      recordsState.attendanceAdmin.page = page;
      void loadAttendanceAdmin();
    }
  });
})();
