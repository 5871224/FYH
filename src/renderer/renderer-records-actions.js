/* 打卡管理、加班審核、個人記錄與訂餐設定操作。
 * 後載入覆蓋已整合為唯一正式函式。
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
  }

async function saveAttendanceEdit(token) {
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
  }

async function openAttendanceHistoryModal(recordId) {
    try {
      const result = await window.schedulerApi.getAttendanceAdminHistory(recordId);
      openEntityListModal({
        title: "打卡修改歷程",
        body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>欄位</th><th>原值</th><th>新值</th><th>原因</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(log.field_name || log.action_type || "")}</td><td>${escapeHtml(log.old_value || "")}</td><td>${escapeHtml(log.new_value || "")}</td><td>${escapeHtml(log.reason || "")}</td><td>${escapeHtml(log.operator_name_snapshot || "")}</td></tr>`).join("") || '<tr><td colspan="6">沒有歷程</td></tr>'}</tbody></table></div>`
      });
    } catch (error) {
      setSaveStatus(`讀取歷程失敗：${error.message}`);
    }
  }

function openOvertimeReviewModal(id) {
    const row = ensureOvertimeReviewState().requests.find((item) => item.id === id);
    if (!row) return;
    openEntityListModal({
      title: "調整加班",
      hideFooterClose: true,
      body: `<div class="form-grid two-col">
        <div class="form-row"><label>提早上班</label><input id="reviewEarlyHours" type="number" min="0" step="0.5" value="${Number(row.early_overtime_hours || 0)}"></div>
        <div class="form-row"><label>延後下班</label><input id="reviewLateHours" type="number" min="0" step="0.5" value="${Number(row.late_overtime_hours || 0)}"></div>
        <div class="form-row form-row-wide"><label>備註</label><textarea id="reviewEmployeeNote" rows="4">${escapeHtml(row.employee_note || "")}</textarea></div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-overtime-review="${escapeHtml(id)}">儲存為待審</button>`
    });
  }

async function reviewOvertime(id, status, readHours = false) {
    try {
      await window.schedulerApi.reviewOvertimeRequest({
        id,
        status,
        earlyHours: readHours ? document.getElementById("reviewEarlyHours")?.value : undefined,
        lateHours: readHours ? document.getElementById("reviewLateHours")?.value : undefined,
        employeeNote: readHours ? document.getElementById("reviewEmployeeNote")?.value || "" : undefined
      });
      closeModal();
      await loadOvertimeReview();
      showInfoMessage("加班審核已更新");
    } catch (error) {
      setSaveStatus(`加班審核失敗：${error.message}`);
    }
  }

function openAdminOvertimeCreateModal() {
    const review = ensureOvertimeReviewState();
    openEntityListModal({
      title: "代為申請加班",
      hideFooterClose: true,
      body: `<div class="form-grid two-col">
        <div class="form-row"><label>人員</label><select id="adminOvertimeUser">${memberOptions("", review.members)}</select></div>
        <div class="form-row"><label>日期</label><input id="adminOvertimeDate" type="date" value="${escapeHtml(getTodayDateString())}"></div>
        <div class="form-row"><label>提早上班</label><input id="adminOvertimeEarly" type="number" min="0" step="0.5" value="0"></div>
        <div class="form-row"><label>延後下班</label><input id="adminOvertimeLate" type="number" min="0" step="0.5" value="0"></div>
        <div class="form-row form-row-wide"><label>備註</label><textarea id="adminOvertimeNote" rows="3"></textarea></div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="ghost-btn" type="button" data-admin-overtime-create="pending">建立待審</button><button class="btn-primary" type="button" data-admin-overtime-create="approved">建立並核准</button>`
    });
  }

async function createAdminOvertimeForEmployee(status) {
    try {
      await window.schedulerApi.createAdminOvertimeRequest({
        userId: document.getElementById("adminOvertimeUser")?.value || "",
        workDate: document.getElementById("adminOvertimeDate")?.value || getTodayDateString(),
        earlyHours: document.getElementById("adminOvertimeEarly")?.value || 0,
        lateHours: document.getElementById("adminOvertimeLate")?.value || 0,
        note: document.getElementById("adminOvertimeNote")?.value || "",
        status,
        approve: status === "approved"
      });
      closeModal();
      await loadOvertimeReview();
      showInfoMessage(status === "approved" ? "已建立並核准" : "已建立待審申請");
    } catch (error) {
      setSaveStatus(`建立代申請失敗：${error.message}`);
    }
  }

async function batchReviewOvertime(status) {
    const ids = Array.from(document.querySelectorAll("[data-overtime-review-check]:checked")).map((item) => item.dataset.overtimeReviewCheck).filter(Boolean);
    if (!ids.length) {
      showInfoMessage("請先勾選加班申請");
      return;
    }
    const confirmed = await confirmAction(`確定要將 ${ids.length} 筆申請${status === "approved" ? "核准" : "退回"}嗎？`);
    if (!confirmed) return;
    try {
      await window.schedulerApi.reviewOvertimeRequest({ ids, status });
      await loadOvertimeReview();
      showInfoMessage("批次審核已完成");
    } catch (error) {
      showInfoMessage(error.message || "批次審核失敗");
    }
  }

async function exportApprovedOvertimeReview() {
    const filters = ensureOvertimeReviewState().filters;
    try {
      setSaveStatus("正在準備已核准加班資料...", true);
      const result = await window.schedulerApi.getApprovedOvertimeExportRows({
        fromDate: filters.fromDate,
        toDate: filters.toDate
      });
      const exported = await window.schedulerApi.exportOvertime({
        state,
        startDate: filters.fromDate,
        endDate: filters.toDate,
        approvedOvertimeRows: result.rows || []
      });
      if (exported.empty) showInfoMessage("所選期間沒有已核准的加班資料");
      setSaveStatus("");
    } catch (error) {
      setSaveStatus(`匯出加班失敗：${error.message || error}`);
    }
  }

async function cancelMealFromRecords() {
    const confirmed = await confirmAction("確定要取消今日整張訂單嗎？");
    if (!confirmed) return;
    try {
      await window.schedulerApi.cancelTodayMealOrder();
      await loadRecordsPage();
      showInfoMessage("今日訂餐已取消");
    } catch (error) {
      showInfoMessage(error.message || "取消訂餐失敗");
    }
  }

async function deleteRecordOvertime(workDate) {
  const confirmed = await confirmAction(`確定刪除 ${workDate} 的加班申請嗎？`);
  if (!confirmed) return;
  try {
    await window.schedulerApi.deleteAttendanceOvertime(workDate);
    await loadRecordsPage();
  } catch (error) {
    showInfoMessage(error.message || "刪除加班申請失敗");
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
