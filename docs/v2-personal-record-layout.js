(function installV2PersonalRecordLayout() {
  if (typeof renderPersonalRecordsSection !== "function" || typeof renderAll !== "function") return;


  function findSegmentItem(segment) {
    const itemId = String(segment?.itemId || "");
    if (!itemId) return null;
    if (segment.category === "shift") return (state.shifts || []).find((item) => item.id === itemId) || null;
    if (segment.category === "leave") return (state.leaves || []).find((item) => item.id === itemId) || null;
    if (segment.category === "overtime") return (state.overtime || []).find((item) => item.id === itemId) || null;
    return null;
  }

  function normalizeScheduleSegments(record) {
    const source = Array.isArray(record?.scheduleSegments) ? record.scheduleSegments : [];
    if (source.length) return source.slice(0, 3);
    if (!record?.shiftName) return [];
    const shift = (state.shifts || []).find((item) => item.name === record.shiftName) || null;
    return [{
      category: "shift",
      itemId: shift?.id || "",
      name: record.shiftName,
      color: shift?.color || "#888780",
      textColor: shift?.textColor || ""
    }];
  }

  function renderScheduleIcon(record) {
    const segments = normalizeScheduleSegments(record);
    if (!segments.length) return '<div class="cell-inner personal-record-schedule-cell"></div>';
    const hasShift = segments.some((segment) => segment.category === "shift");
    return `<div class="cell-inner personal-record-schedule-cell">${segments.map((segment) => {
      const item = findSegmentItem(segment);
      const color = item?.color || segment.color || (segment.category === "overtime" ? "#D85A30" : "#888780");
      const itemText = item ? getItemTextColor(item, color) : (segment.textColor || textColor(color));
      const specialLeaveText = segment.category === "leave" && String(segment.code || item?.code || "") === "0047" && hasShift;
      const foreground = specialLeaveText ? "rgb(112, 112, 112)" : itemText;
      const name = item?.name || segment.name || (segment.category === "overtime" ? "加班" : "");
      return `<div class="seg" style="background-color:${escapeHtml(color)};color:${escapeHtml(foreground)}"><span class="seg-label ${getScheduleSegmentSizeClass({ name }, segments.length)}">${escapeHtml(name)}</span></div>`;
    }).join("")}</div>`;
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
      <div class="records-admin-toolbar personal-record-toolbar">
        <div class="records-admin-filters personal-record-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-v2-personal-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-v2-personal-filter="toDate"></label>
        </div>
      </div>
      <div class="records-table-wrap"><table class="records-table v2-personal-record-table">
        <thead><tr><th>日期</th><th class="personal-schedule-icon-col">圖示</th><th>班別</th><th>打卡時間</th><th>異常</th><th>加班</th><th>打卡備註</th><th>加班備註</th><th>訂餐</th></tr></thead>
        <tbody>${(recordsState.personal || []).map((record) => `<tr>
          <td>${escapeHtml(record.date || "")}</td>
          <td class="personal-schedule-icon-col">${renderScheduleIcon(record)}</td>
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
