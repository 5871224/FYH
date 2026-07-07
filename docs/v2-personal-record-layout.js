(function installV2PersonalRecordLayout() {
  if (typeof renderPersonalRecordsSection !== "function" || typeof renderAll !== "function") return;

  if (!document.getElementById("v2PersonalRecordLayoutStyle")) {
    const style = document.createElement("style");
    style.id = "v2PersonalRecordLayoutStyle";
    style.textContent = `
      .v2-personal-record-table .personal-shift-icon-col {
        width: 58px;
        min-width: 58px;
        text-align: center;
      }
      .personal-shift-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 36px;
        max-width: 52px;
        min-height: 30px;
        padding: 4px 7px;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        text-align: center;
        white-space: normal;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .05);
      }
      .personal-punch-stack {
        min-width: 118px;
        white-space: nowrap;
        line-height: 1.6;
      }
      .personal-punch-stack > div:empty::before { content: "-"; }
    `;
    document.head.appendChild(style);
  }

  function shiftTextColor(color) {
    const hex = String(color || "").trim();
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#000000" : "#ffffff";
  }

  function findRecordShift(record) {
    const name = String(record?.shiftName || "");
    return (state.shifts || []).find((shift) => shift.name === name) || null;
  }

  function renderShiftIcon(record) {
    const shift = findRecordShift(record);
    if (!shift || !record.shiftName) return "-";
    const background = shift.color || "#888780";
    const foreground = shift.autoTextColor === false && shift.textColor
      ? shift.textColor
      : shift.textColor || shiftTextColor(background);
    return `<span class="personal-shift-icon" style="background:${escapeHtml(background)};color:${escapeHtml(foreground)}">${escapeHtml(record.shiftName)}</span>`;
  }

  function punchLine(value, department) {
    if (!value) return "-";
    return `${formatRecordDateTime(value)}${department ? ` ${escapeHtml(department)}` : ""}`;
  }

  renderPersonalRecordsSection = function renderV2PersonalRecordsLayout() {
    const today = getTodayDateString();
    recordsState.personalFilters = recordsState.personalFilters || {
      fromDate: addDaysToDateString(today, -49),
      toDate: today
    };
    recordsState.personalPage = Number(recordsState.personalPage || 1);
    recordsState.personalTotal = Number(recordsState.personalTotal || 0);
    recordsState.personalPageSize = Number(recordsState.personalPageSize || 50);

    const filters = recordsState.personalFilters;
    const page = Number(recordsState.personalPage || 1);
    const pageSize = Number(recordsState.personalPageSize || 50);
    const total = Number(recordsState.personalTotal || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return `<section class="records-section">
      <h2>個人記錄</h2>
      <div class="records-filter-row">
        <input type="date" value="${escapeHtml(filters.fromDate || "")}" data-v2-personal-filter="fromDate">
        <input type="date" value="${escapeHtml(filters.toDate || "")}" data-v2-personal-filter="toDate">
        <button class="primary-btn compact-btn" type="button" data-v2-personal-search>查詢</button>
      </div>
      <div class="records-table-wrap"><table class="records-table v2-personal-record-table">
        <thead><tr><th>日期</th><th class="personal-shift-icon-col">圖示</th><th>班別</th><th>打卡時間</th><th>異常</th><th>加班</th><th>打卡備註</th><th>加班備註</th><th>訂餐</th></tr></thead>
        <tbody>${(recordsState.personal || []).map((record) => `<tr>
          <td>${escapeHtml(record.date || "")}</td>
          <td class="personal-shift-icon-col">${renderShiftIcon(record)}</td>
          <td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>
          <td class="personal-punch-stack"><div>${punchLine(record.clockIn, record.clockInDepartment)}</div><div>${punchLine(record.clockOut, record.clockOutDepartment)}</div></td>
          <td>${escapeHtml((record.issues || []).join("、") || "正常")}</td>
          <td>${escapeHtml(getOvertimeStatusLabel(record.overtimeStatus || ""))}<br><span>${Number(record.overtimeHours || 0)} 小時</span></td>
          <td>${escapeHtml(record.attendanceNote || "")}</td>
          <td>${escapeHtml(record.overtimeNote || "")}</td>
          <td><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>
        </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>
      </table></div>
      <div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-v2-personal-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-v2-personal-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>
    </section>`;
  };
})();
