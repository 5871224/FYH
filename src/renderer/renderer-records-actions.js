/* 打卡管理、加班審核與訂餐設定操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function timeValueFromIso(value) {
  return value ? formatClockTime(value) : "";
}

function findAttendanceAdminRow(userId, workDate, recordId) {
  return recordsState.attendanceAdmin.rows.find((row) => (
    row.user_id === userId
    && row.work_date === workDate
    && (!recordId || row.id === recordId)
  )) || null;
}

function openAttendanceEditModal(token) {
  const [userId, workDate, recordId] = String(token || "").split(":");
  const row = findAttendanceAdminRow(userId, workDate, recordId) || { user_id: userId, work_date: workDate };
  openEntityListModal({
    title: "編輯打卡",
    modalClass: "modal modal-form-compact attendance-edit-modal",
    hideFooterClose: true,
    body: `
      <div class="form-grid two-col">
        <div class="form-row"><label>上班時間</label><input id="adminClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>
        <div class="form-row"><label>上班單位</label><select id="adminClockInDepartment"><option value="">未指定</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${row.clock_in_department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></div>
        <div class="form-row"><label>下班時間</label><input id="adminClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>
        <div class="form-row"><label>下班單位</label><select id="adminClockOutDepartment"><option value="">未指定</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${row.clock_out_department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></div>
        <div class="form-row form-row-wide"><label>備註</label><textarea id="adminAttendanceNote" rows="3">${escapeHtml(row.attendance_note || "")}</textarea></div>
      </div>
    `,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-edit="${escapeHtml(userId)}:${escapeHtml(workDate)}:${escapeHtml(row.id || "")}">儲存</button>`
  });
}

async function saveAttendanceEdit(token) {
  const [userId, workDate, recordId] = String(token || "").split(":");
  try {
    await window.schedulerApi.saveAttendanceAdminRecord({
      id: recordId || "",
      userId,
      workDate,
      clockInTime: document.getElementById("adminClockInTime")?.value || "",
      clockInDepartmentId: document.getElementById("adminClockInDepartment")?.value || "",
      clockOutTime: document.getElementById("adminClockOutTime")?.value || "",
      clockOutDepartmentId: document.getElementById("adminClockOutDepartment")?.value || "",
      attendanceNote: document.getElementById("adminAttendanceNote")?.value || ""
    });
    closeModal();
    await loadAttendanceAdmin();
    await loadOvertimeReview(false);
    showInfoMessage("打卡資料已更新");
  } catch (error) {
    setSaveStatus(`儲存打卡失敗：${error.message}`);
  }
}

async function openAttendanceHistoryModal(recordId) {
  try {
    const result = await window.schedulerApi.getAttendanceAdminHistory(recordId);
    openEntityListModal({
      title: "打卡修改歷程",
      body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>欄位</th><th>原值</th><th>新值</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(log.field_name || log.action_type || "")}</td><td>${escapeHtml(log.old_value || "")}</td><td>${escapeHtml(log.new_value || "")}</td><td>${escapeHtml(log.operator_name_snapshot || "")}</td></tr>`).join("") || '<tr><td colspan="5">沒有歷程</td></tr>'}</tbody></table></div>`
    });
  } catch (error) {
    setSaveStatus(`讀取歷程失敗：${error.message}`);
  }
}

function openOvertimeReviewModal(id) {
  const row = recordsState.overtimeReview.requests.find((item) => item.id === id);
  if (!row) return;
  openEntityListModal({
    title: "調整加班時數",
    hideFooterClose: true,
    body: `<div class="form-grid two-col"><div class="form-row"><label>提早上班</label><input id="reviewEarlyHours" type="number" min="0" step="0.5" value="${Number(row.early_overtime_hours || 0)}"></div><div class="form-row"><label>延後下班</label><input id="reviewLateHours" type="number" min="0" step="0.5" value="${Number(row.late_overtime_hours || 0)}"></div></div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-overtime-review="${escapeHtml(id)}">儲存為待審</button>`
  });
}

async function reviewOvertime(id, status, readHours = false) {
  try {
    await window.schedulerApi.reviewOvertimeRequest({
      id,
      status,
      earlyHours: readHours ? document.getElementById("reviewEarlyHours")?.value : undefined,
      lateHours: readHours ? document.getElementById("reviewLateHours")?.value : undefined
    });
    closeModal();
    await loadOvertimeReview();
    showInfoMessage("加班審核已更新");
  } catch (error) {
    setSaveStatus(`加班審核失敗：${error.message}`);
  }
}

function openAdminOvertimeCreateModal() {
  const members = recordsState.overtimeReview.members?.length
    ? recordsState.overtimeReview.members
    : recordsState.attendanceAdmin.members;
  openEntityListModal({
    title: "代為申請加班",
    hideFooterClose: true,
    body: `<div class="form-grid two-col"><div class="form-row"><label>人員</label><select id="adminOvertimeUser">${memberOptions("", members)}</select></div><div class="form-row"><label>日期</label><input id="adminOvertimeDate" type="date" value="${escapeHtml(getTodayDateString())}"></div><div class="form-row"><label>提早上班</label><input id="adminOvertimeEarly" type="number" min="0" step="0.5" value="0"></div><div class="form-row"><label>延後下班</label><input id="adminOvertimeLate" type="number" min="0" step="0.5" value="0"></div><div class="form-row form-row-wide"><label>備註</label><textarea id="adminOvertimeNote" rows="3"></textarea></div></div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-admin-overtime-create="true">建立</button>`
  });
}

async function saveAdminOvertimeCreate() {
  try {
    await window.schedulerApi.createAdminOvertimeRequest({
      userId: document.getElementById("adminOvertimeUser")?.value || "",
      workDate: document.getElementById("adminOvertimeDate")?.value || getTodayDateString(),
      earlyHours: document.getElementById("adminOvertimeEarly")?.value || 0,
      lateHours: document.getElementById("adminOvertimeLate")?.value || 0,
      note: document.getElementById("adminOvertimeNote")?.value || ""
    });
    closeModal();
    await loadOvertimeReview();
    showInfoMessage("已建立代申請");
  } catch (error) {
    setSaveStatus(`建立代申請失敗：${error.message}`);
  }
}

function readMealAdminProducts() {
  return Array.from(document.querySelectorAll("[data-meal-product-row]")).map((row) => ({
    id: row.querySelector('[data-meal-product-field="id"]')?.value || "",
    name: row.querySelector('[data-meal-product-field="name"]')?.value || "",
    price: Number(row.querySelector('[data-meal-product-field="price"]')?.value || 0),
    isActive: Boolean(row.querySelector('[data-meal-product-field="isActive"]')?.checked),
    is_active: Boolean(row.querySelector('[data-meal-product-field="isActive"]')?.checked)
  })).filter((item) => item.name.trim());
}

function commitMealProductOrderFromDom() {
  recordsState.mealAdmin.products = readMealAdminProducts();
  renderAll();
}

async function deleteMealProduct(button) {
    const row = button.closest("[data-meal-product-row]");
    if (!(row instanceof HTMLTableRowElement)) return;
    const productId = row.querySelector('[data-meal-product-field="id"]')?.value || "";
    const productName = row.querySelector('[data-meal-product-field="name"]')?.value?.trim() || "此品項";
    const rowIndex = Number(row.dataset.mealProductRow || button.dataset.deleteMealProduct || -1);

    if (!productId) {
      if (rowIndex >= 0) recordsState.mealAdmin.products.splice(rowIndex, 1);
      renderAll();
      return;
    }

    const confirmed = await confirmAction(`確定刪除「${productName}」嗎？已有訂餐記錄的品項不能刪除，只能取消啟用。`);
    if (!confirmed) return;
    try {
      await window.schedulerApi.deleteMealProduct(productId);
      await loadMealAdminSettings(false);
      renderAll();
      showInfoMessage("品項已刪除");
    } catch (error) {
      showInfoMessage(error.message || "刪除品項失敗");
    }
  }

async function saveMealSettingsFromPage() {
    const subsidyInput = document.querySelector("[data-meal-company-subsidy]");
    const rawSubsidy = subsidyInput instanceof HTMLInputElement ? subsidyInput.value.trim() : "";
    if (!/^[1-9]\d*$/.test(rawSubsidy)) {
      if (subsidyInput instanceof HTMLInputElement) rejectInput(subsidyInput, null, MEAL_SUBSIDY_ERROR);
      return;
    }
    try {
      await window.schedulerApi.saveMealAdminSettings({
        dailyCutoffTime: document.querySelector("[data-meal-cutoff-time]")?.value || "10:30",
        companySubsidy: Number(rawSubsidy),
        products: readMealAdminProducts()
      });
      await loadMealAdminSettings(false);
      await loadTodayMealOrder();
      showInfoMessage("訂餐設定已儲存");
    } catch (error) {
      setSaveStatus(`訂餐設定儲存失敗：${error.message}`);
    }
  }
