(function installV2EmployeeOvertimeUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;

  function selectedDate() {
    return attendanceOvertimeState.selectedWorkDate || getTodayDateString();
  }

  loadTodayAttendanceOvertime = async function loadV2AttendanceOvertime(shouldRender = true) {
    if (!isLoggedIn()) return null;
    const workDate = selectedDate();
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "", selectedWorkDate: workDate };
    if (shouldRender) renderAll();
    let status = null;
    try {
      const [dateResult, result] = await Promise.all([
        window.schedulerApi.getEmployeeOvertimeDates(),
        window.schedulerApi.getAttendanceOvertimeForDate(workDate)
      ]);
      status = result;
      attendanceOvertimeState = {
        ...attendanceOvertimeState,
        loading: false,
        status,
        dates: dateResult.dates || [],
        selectedWorkDate: workDate,
        error: ""
      };
    } catch (error) {
      attendanceOvertimeState = {
        ...attendanceOvertimeState,
        loading: false,
        status: null,
        selectedWorkDate: workDate,
        error: error.message || "讀取加班申請狀態失敗"
      };
    }
    if (shouldRender) renderAll();
    return status;
  };

  submitTodayOvertimeRequest = async function submitV2OvertimeRequest() {
    if (attendanceOvertimeState.loading) return;
    const workDate = selectedDate();
    const earlyHours = Number(document.getElementById("overtimeEarlyHours")?.value || 0);
    const lateHours = Number(document.getElementById("overtimeLateHours")?.value || 0);
    const note = document.getElementById("overtimeEmployeeNote")?.value || "";
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
    renderAll();
    try {
      await window.schedulerApi.submitAttendanceOvertime({ workDate, earlyHours, lateHours, note });
      await loadTodayAttendanceOvertime(false);
      showInfoMessage(`${workDate} 加班申請已送出`);
    } catch (error) {
      attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "送出加班申請失敗" };
    }
    renderAll();
  };

  deleteTodayOvertimeRequest = async function deleteV2OvertimeRequest() {
    const workDate = selectedDate();
    const confirmed = await confirmAction(`確定要刪除 ${workDate} 的加班申請嗎？`);
    if (!confirmed) return;
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
    renderAll();
    try {
      await window.schedulerApi.deleteAttendanceOvertime(workDate);
      await loadTodayAttendanceOvertime(false);
      showInfoMessage("加班申請已刪除");
    } catch (error) {
      attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "刪除加班申請失敗" };
    }
    renderAll();
  };

  renderTodayOvertimePanel = function renderV2OvertimePanel() {
    const checked = Boolean(attendanceOvertimeState.expanded);
    const toggle = `<label class="overtime-use-label"><input type="checkbox" data-toggle-overtime-panel="true" ${checked ? "checked" : ""}> 加班申請</label>`;
    if (!checked) {
      return `<section class="overtime-request-panel overtime-request-toggle-only">${toggle}</section>`;
    }

    const stateValue = attendanceOvertimeState.status;
    const eligibility = stateValue?.eligibility || null;
    const request = stateValue?.request || null;
    const workDate = selectedDate();
    const dateRows = attendanceOvertimeState.dates || [];
    const dateValues = [...new Set([workDate, ...dateRows.map((row) => row.workDate).filter(Boolean)])]
      .sort((left, right) => String(right).localeCompare(String(left)));
    const selector = `<div class="form-row overtime-date-row"><label for="overtimeWorkDate">申請日期</label><select id="overtimeWorkDate">${dateValues.map((date) => `<option value="${escapeHtml(date)}" ${date === workDate ? "selected" : ""}>${escapeHtml(date)}</option>`).join("")}</select></div>`;

    if (attendanceOvertimeState.loading) return `<section class="overtime-request-panel">${toggle}${selector}<p class="clock-loading">讀取加班狀態...</p></section>`;
    if (attendanceOvertimeState.error) return `<section class="overtime-request-panel">${toggle}${selector}<div class="auth-error">${escapeHtml(attendanceOvertimeState.error)}</div></section>`;
    if (!stateValue) return `<section class="overtime-request-panel">${toggle}${selector}</section>`;

    if (request) {
      const canDelete = request.status === "pending" || request.status === "returned";
      return `<section class="overtime-request-panel">
        ${toggle}
        ${selector}
        <div class="overtime-request-status-row">
          <p class="home-subtitle overtime-request-status">${getOvertimeStatusLabel(request.status)}，合計 ${Number(request.total_overtime_hours || 0)} 小時</p>
          ${canDelete ? '<button class="ghost-btn" type="button" data-delete-today-overtime="true">刪除申請</button>' : ""}
        </div>
        ${request.attendance_changed_warning ? '<div class="auth-error">打卡時間已異動，需重新審核</div>' : ""}
        <div class="clock-status-grid overtime-hours-summary"><div><span>提早上班</span><strong>${Number(request.early_overtime_hours || 0)} 小時</strong></div><div><span>延後下班</span><strong>${Number(request.late_overtime_hours || 0)} 小時</strong></div></div>
      </section>`;
    }

    if (!eligibility?.eligible) {
      return `<section class="overtime-request-panel">${toggle}${selector}<p class="home-subtitle">${escapeHtml(eligibility?.reasons?.[0] || "目前不可申請加班")}</p>${eligibility?.deadlineDate ? `<p class="home-subtitle">申請期限：${escapeHtml(eligibility.deadlineDate)} 23:59</p>` : ""}</section>`;
    }

    const estimateText = stateValue.shift
      ? `系統依班別估算 ${Number(eligibility.totalHours || 0)} 小時；可依實際情況向上或向下調整。`
      : "請依實際加班情況填寫時數。";
    return `<section class="overtime-request-panel">
      ${toggle}
      ${selector}
      <p class="home-subtitle overtime-estimate-text">${estimateText}</p>
      <div class="form-grid two-col overtime-hours-grid">
        <div class="form-row"><label for="overtimeEarlyHours">提早上班時數</label><input id="overtimeEarlyHours" type="number" min="0" step="0.5" value="${Number(eligibility.earlyHours || 0)}"></div>
        <div class="form-row"><label for="overtimeLateHours">延後下班時數</label><input id="overtimeLateHours" type="number" min="0" step="0.5" value="${Number(eligibility.lateHours || 0)}"></div>
        <div class="form-row form-row-wide"><label for="overtimeEmployeeNote">加班備註</label><textarea id="overtimeEmployeeNote" rows="3" placeholder="可填寫加班原因或補充說明"></textarea></div>
      </div>
      <p class="home-subtitle">申請期限：${escapeHtml(eligibility.deadlineDate || "")} 23:59</p>
      <button class="btn-primary overtime-submit-btn" type="button" data-submit-today-overtime="true">送出加班申請</button>
    </section>`;
  };

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === "overtimeWorkDate") {
      attendanceOvertimeState = { ...attendanceOvertimeState, selectedWorkDate: target.value };
      void loadTodayAttendanceOvertime();
    }
  });
})();