/* GENERATED FILE - DO NOT EDIT DIRECTLY.
 * Source order: scripts/build-js.js
 * Build: npm run js:build
 * This generated bundle preserves the declared module execution order.
 */

/* ===== browser-exporter.js ===== */
(function installBrowserExporter() {
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getItemMap(items) {
    return new Map((items || []).map((item) => [item.id, item]));
  }

  function getScheduleKey(memberId, year, month, day) {
    return `${memberId}_${year}_${month}_${day}`;
  }

  function normalizeRole(role) {
    return role === "admin" || role === "manager" ? role : "employee";
  }

  function getRoleLabel(role) {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === "admin") return "管理員";
    if (normalizedRole === "manager") return "主管";
    return "員工";
  }

  function parseRoleLabel(label) {
    const text = String(label || "").trim();
    if (text === "管理員" || /^admin$/i.test(text)) return "admin";
    if (text === "主管" || /^manager$/i.test(text)) return "manager";
    return "employee";
  }

  function formatYmd(year, month, day) {
    return `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  }

  function formatIsoDate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function formatCompactTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):?(\d{2})/);
    return match ? `${match[1].padStart(2, "0")}${match[2]}` : "";
  }

  function toArgb(hex) {
    return `FF${String(hex || "#FFFFFF").replace("#", "").toUpperCase()}`;
  }

  function formatDisplayDate(value) {
    if (!value) {
      return "";
    }
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text.replaceAll("-", "/");
    }
    return text;
  }

  function normalizeImportedDate(value) {
    if (!value) {
      return "";
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatIsoDate(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      // ponytail: Excel serial date先用1899基準直接換，已足夠支援目前匯入格式；若未來遇到1904系統再補分支。
      const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!Number.isNaN(utc.getTime())) {
        return formatIsoDate(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
      }
    }
    const text = String(value).trim();
    if (!text || text === "年/月/日") {
      return "";
    }
    const match = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!match) {
      return "";
    }
    return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
  }

  function normalizeImportedTime(value) {
    if (!value) {
      return "";
    }
    const text = String(value).trim();
    if (!text) {
      return "";
    }
    const match = text.match(/^(\d{1,2}):(\d{2})$/) || text.match(/^(\d{2})(\d{2})$/);
    if (!match) {
      return "";
    }
    return `${String(Number(match[1])).padStart(2, "0")}:${String(Number(match[2])).padStart(2, "0")}`;
  }

  function normalizeImportedBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }
    const text = String(value ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "是"].includes(text);
  }

  function getCellDisplayValue(cell) {
    return String(cell?.text ?? cell?.value ?? "").trim();
  }

  function getHeaderColumnIndex(sheet, names, fallback) {
    const wanted = new Set(names);
    const header = sheet?.getRow(1);
    if (header) {
      for (let index = 1; index <= header.cellCount; index += 1) {
        if (wanted.has(getCellDisplayValue(header.getCell(index)))) {
          return index;
        }
      }
    }
    return fallback;
  }

  function getDepartmentNameForMember(member, departments) {
    const departmentMap = new Map((departments || []).map((department) => [department.id, department.name]));
    return departmentMap.get(member?.deptId) || "";
  }

  function getShiftNamesForMember(member, shifts) {
    const shiftMap = new Map((shifts || []).map((shift) => [shift.id, shift.name]));
    return (Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [])
      .filter((shiftId, index, list) => shiftMap.has(shiftId) && list.indexOf(shiftId) === index)
      .map((shiftId) => shiftMap.get(shiftId))
      .filter(Boolean);
  }

  function isMemberActiveOnDate(member, year, month, day) {
    const date = formatIsoDate(year, month, day);
    if (member.hireDate && date < member.hireDate) {
      return false;
    }
    if (member.leaveDate && date > member.leaveDate) {
      return false;
    }
    return true;
  }

  function hasOfficialScheduleExportRows(payload) {
    return Array.isArray(payload?.exportRows);
  }

  function compactIsoDate(value) {
    return String(value || "").replaceAll("-", "");
  }

  function getOfficialSapLeaveRows(payload) {
    const sapCodeMap = new Map([["0036", "OFF"], ["0047", "REST"], ["休息日", "REST"], ["休假", "REST"], ["例假", "OFF"]]);
    return (payload.exportRows || []).flatMap((row) => {
      if (row.pay_by_day || !row.leave_type_id) return [];
      const sapCode = sapCodeMap.get(row.leave_code) || sapCodeMap.get(row.leave_name);
      if (!sapCode) return [];
      const date = compactIsoDate(row.work_date);
      return [[row.employee_name || "", row.employee_code || "", date, date, sapCode]];
    });
  }

  function getOfficialOvertimeRows(payload) {
    return (payload.exportRows || []).flatMap((row) => {
      if (!row.overtime_type_id) return [];
      return [[
        row.employee_code || "",
        compactIsoDate(row.work_date),
        formatCompactTime(row.overtime_start_time),
        formatCompactTime(row.overtime_end_time),
        0,
        1,
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_start_time) : "",
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_end_time) : "",
        row.overtime_use_rest_1 ? 0 : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_start_time) : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_end_time) : "",
        row.overtime_use_rest_2 ? 0 : ""
      ]];
    });
  }

  function formatApprovedOvertimeDuration(value) {
    const totalMinutes = Math.round(Number(value) * 60);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "";
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}${String(totalMinutes % 60).padStart(2, "0")}`;
  }

  function getApprovedOvertimeRows(payload) {
    return (payload.approvedOvertimeRows || []).map((row) => [
      row.employee_code || "",
      compactIsoDate(row.work_date),
      "0000",
      formatApprovedOvertimeDuration(row.total_overtime_hours),
      0,
      1,
      "", "", "", "", "", ""
    ]);
  }

  function getOfficialLeaveRows(payload) {
    const excludedLeaveCodes = new Set(["0036", "0047"]);
    const hiddenDepartmentIds = new Set((payload.state?.departments || []).filter((department) => department?.hiddenFromSchedule).map((department) => department.id));
    return (payload.exportRows || []).flatMap((row) => {
      if (!row.leave_type_id || excludedLeaveCodes.has(row.leave_code) || hiddenDepartmentIds.has(row.home_department_id)) return [];
      const date = compactIsoDate(row.work_date);
      const allDay = row.leave_all_day !== false;
      return [[
        row.employee_code || "",
        date,
        date,
        allDay ? "" : formatCompactTime(row.leave_start_time),
        allDay ? "" : formatCompactTime(row.leave_end_time),
        row.leave_code || "",
        row.leave_reason || row.leave_name || ""
      ]];
    });
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (!/[",\r\n]/.test(text)) {
      return text;
    }
    return `"${text.replaceAll('"', '""')}"`;
  }

  function getScheduleCellText(cell, maps) {
    if (!cell) {
      return "";
    }
    const names = [];
    if (cell.shift && maps.shifts.has(cell.shift)) {
      names.push(maps.shifts.get(cell.shift).name);
    }
    if (cell.leave && maps.leaves.has(cell.leave)) {
      names.push(maps.leaves.get(cell.leave).name);
    }
    if (cell.overtime && maps.overtime.has(cell.overtime)) {
      names.push("加班");
    }
    return names.join("\n");
  }

  function getSapLeaveExportRows(payload) {
    if (hasOfficialScheduleExportRows(payload)) {
      return getOfficialSapLeaveRows(payload);
    }
    const { state, year, month } = payload;
    const leaveMap = getItemMap(state.leaves);
    const sapCodeMap = new Map([
      ["0036", "OFF"],
      ["0047", "REST"],
      ["休息日", "REST"],
      ["休假", "REST"],
      ["例假", "OFF"]
    ]);
    const rows = [];

    for (const member of state.members) {
      if (member.payByDay) {
        continue;
      }
      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        if (!isMemberActiveOnDate(member, year, month, day)) {
          continue;
        }
        const slot = state.schedule[getScheduleKey(member.id, year, month, day)];
        const leave = leaveMap.get(slot?.leave);
        const sapCode = sapCodeMap.get(leave?.code) || sapCodeMap.get(leave?.name);
        if (!sapCode) {
          continue;
        }
        const date = formatYmd(year, month, day);
        rows.push([member.name, member.code, date, date, sapCode]);
      }
    }

    return rows;
  }

  function buildSapLeaveCsvContent(payload) {
    const rows = getSapLeaveExportRows(payload);
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    return rows.length ? `\uFEFF${csv}\r\n` : "\uFEFF";
  }

  function getOvertimeExportRows(payload) {
    if (Array.isArray(payload?.approvedOvertimeRows)) {
      return getApprovedOvertimeRows(payload);
    }
    if (hasOfficialScheduleExportRows(payload)) {
      return getOfficialOvertimeRows(payload);
    }
    const { state, year, month } = payload;
    const overtimeMap = getItemMap(state.overtime);
    const rows = [];

    for (const member of state.members) {
      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        if (!isMemberActiveOnDate(member, year, month, day)) {
          continue;
        }
        const slot = state.schedule[getScheduleKey(member.id, year, month, day)];
        const overtime = slot?.overtimeMeta || overtimeMap.get(slot?.overtime);
        if (!overtime) {
          continue;
        }
        rows.push([
          member.code,
          formatYmd(year, month, day),
          formatCompactTime(overtime.startTime),
          formatCompactTime(overtime.endTime),
          0,
          1,
          overtime.useRest1 ? formatCompactTime(overtime.rest1StartTime) : "",
          overtime.useRest1 ? formatCompactTime(overtime.rest1EndTime) : "",
          overtime.useRest1 ? 0 : "",
          overtime.useRest2 ? formatCompactTime(overtime.rest2StartTime) : "",
          overtime.useRest2 ? formatCompactTime(overtime.rest2EndTime) : "",
          overtime.useRest2 ? 0 : ""
        ]);
      }
    }

    return rows;
  }

  function getLeaveExportRows(payload) {
    if (hasOfficialScheduleExportRows(payload)) {
      return getOfficialLeaveRows(payload);
    }
    const { state, year, month } = payload;
    const leaveMap = getItemMap(state.leaves);
    const excludedLeaveCodes = new Set(["0036", "0047"]);
    const rows = [];
    const hiddenDepartmentIds = new Set(
      (state.departments || [])
        .filter((department) => department?.hiddenFromSchedule)
        .map((department) => department.id)
    );

    for (const member of state.members) {
      if (hiddenDepartmentIds.has(member.deptId)) {
        continue;
      }
      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        if (!isMemberActiveOnDate(member, year, month, day)) {
          continue;
        }
        const slot = state.schedule[getScheduleKey(member.id, year, month, day)];
        const leave = leaveMap.get(slot?.leave);
        if (!leave || excludedLeaveCodes.has(leave.code)) {
          continue;
        }
        const leaveMeta = slot?.leaveMeta || null;
        const allDay = leaveMeta?.allDay !== false;
        rows.push([
          member.code,
          formatYmd(year, month, day),
          formatYmd(year, month, day),
          allDay ? "" : formatCompactTime(leaveMeta?.startTime || ""),
          allDay ? "" : formatCompactTime(leaveMeta?.endTime || ""),
          leave.code || "",
          leaveMeta?.reason || leave.name || ""
        ]);
      }
    }

    return rows;
  }

  function applySheetBorder(sheet) {
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD8D2C7" } },
          left: { style: "thin", color: { argb: "FFD8D2C7" } },
          bottom: { style: "thin", color: { argb: "FFD8D2C7" } },
          right: { style: "thin", color: { argb: "FFD8D2C7" } }
        };
        if (!cell.alignment) {
          cell.alignment = rowNumber === 1
            ? { horizontal: "center", vertical: "middle", wrapText: true }
            : { horizontal: "center", vertical: "middle", wrapText: true };
        }
      });
    });
  }

  async function createScheduleWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("排班表", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 2 }]
    });
    const { state, year, month } = payload;
    const maps = {
      departments: getItemMap(state.departments),
      shifts: getItemMap(state.shifts),
      leaves: getItemMap(state.leaves),
      overtime: getItemMap(state.overtime)
    };
    const days = daysInMonth(year, month);
    const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

    sheet.mergeCells(1, 1, 1, days + 2);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `${year} 年 ${month + 1} 月`;
    titleCell.font = { name: "Microsoft JhengHei UI", bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };

    const headerRow = sheet.getRow(2);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.getCell(1).value = "單位";
    headerRow.getCell(2).value = "人員";
    headerRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F6F0" } };
    headerRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F6F0" } };

    for (let day = 1; day <= days; day += 1) {
      const weekday = new Date(year, month, day).getDay();
      const cell = sheet.getCell(2, day + 2);
      cell.value = `${day}\n${weekLabels[weekday]}`;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = {
        bold: true,
        color: weekday === 0 ? { argb: "FFD64545" } : weekday === 6 ? { argb: "FF165DAB" } : undefined
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F6F0" } };
    }

    let rowIndex = 3;
    for (const department of state.departments) {
      const members = state.members.filter((member) => member.deptId === department.id);
      if (!members.length) {
        continue;
      }
      for (const member of members) {
        const row = sheet.getRow(rowIndex);
        row.getCell(1).value = maps.departments.get(member.deptId)?.name || "";
        row.getCell(2).value = member.name;
        row.getCell(1).alignment = { vertical: "middle", wrapText: true };
        row.getCell(2).alignment = { vertical: "middle", wrapText: true };

        for (let day = 1; day <= days; day += 1) {
          const cell = row.getCell(day + 2);
          if (!isMemberActiveOnDate(member, year, month, day)) {
            cell.value = "";
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9B9B9B" } };
            cell.font = { color: { argb: "FFFFFFFF" }, size: 10 };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            continue;
          }

          const slot = state.schedule[getScheduleKey(member.id, year, month, day)];
          cell.value = getScheduleCellText(slot, maps);
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

          const colors = [];
          if (slot?.shift && maps.shifts.has(slot.shift)) {
            colors.push(maps.shifts.get(slot.shift).color);
          }
          if (slot?.leave && maps.leaves.has(slot.leave)) {
            colors.push(maps.leaves.get(slot.leave).color);
          }
          if (slot?.overtime && maps.overtime.has(slot.overtime)) {
            colors.push(maps.overtime.get(slot.overtime).color);
          }

          if (colors.length === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(colors[0]) } };
            cell.font = { color: { argb: "FFFFFFFF" }, size: 10 };
          } else if (colors.length > 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5EFE0" } };
            cell.font = { size: 10 };
          } else {
            cell.font = { size: 10 };
          }
        }

        row.height = 42;
        rowIndex += 1;
      }
    }

    sheet.columns = [
      { width: 18 },
      { width: 16 },
      ...Array.from({ length: days }, () => ({ width: 12 }))
    ];
    applySheetBorder(sheet);
    return workbook;
  }

  async function createOvertimeWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("匯出加班");
    const headers = [
      "員工編號",
      "加班日期",
      "加班時間(起)",
      "加班時間(迄)",
      "前一日",
      "加班補貼類型",
      "休息1(起)",
      "休息1(迄)",
      "支薪1",
      "休息2(起)",
      "休息2(迄)",
      "支薪2"
    ];

    sheet.addRow(headers);
    getOvertimeExportRows(payload).forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = headers.map((_, index) => ({ width: index === 0 ? 14 : [4, 5, 8, 11].includes(index) ? 10 : 14 }));
    applySheetBorder(sheet);
    return workbook;
  }

  async function createLeaveWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("匯出請假");
    const headers = [
      "員工編號",
      "請假日期(起)",
      "請假日期(迄)",
      "請假時間(起)",
      "請假時間(迄)",
      "假別",
      "說明"
    ];

    sheet.addRow(headers);
    getLeaveExportRows(payload).forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = [
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 28 }
    ];
    applySheetBorder(sheet);
    return workbook;
  }

  async function createMemberWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("人員資料");
    const headers = ["工號", "姓名", "排班班別", "權限", "到職日", "離職日", "計薪方式", "例假星期", "所屬單位"];
    const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    const departments = payload.state?.departments || [];
    const shifts = payload.state?.shifts || [];

    sheet.addRow(headers);
    (payload.state?.members || []).forEach((member) => {
      const scheduleShiftNames = getShiftNamesForMember(member, shifts);
      sheet.addRow([
        member.code || "",
        member.name || "",
        scheduleShiftNames.join("、"),
        getRoleLabel(member.role),
        formatDisplayDate(member.hireDate || ""),
        formatDisplayDate(member.leaveDate || ""),
        member.payByDay ? "日薪" : "月薪",
        weekdayLabels[Math.max(0, Math.min(6, Number(member.fixedRestWeekday) || 0))] || "週日",
        getDepartmentNameForMember(member, departments)
      ]);
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = [
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 20 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 }
    ];
    applySheetBorder(sheet);
    return workbook;
  }

  async function createDepartmentWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("單位設定");
    const headers = ["單位", "開始日期", "結束日期", "不顯示"];

    sheet.addRow(headers);
    (payload.state?.departments || []).forEach((department) => {
      sheet.addRow([
        department.name || "",
        formatDisplayDate(department.startDate || ""),
        formatDisplayDate(department.endDate || ""),
        department.hiddenFromSchedule ? "是" : "否"
      ]);
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = [
      { width: 18 },
      { width: 14 },
      { width: 14 },
      { width: 16 }
    ];
    applySheetBorder(sheet);
    return workbook;
  }

  async function createShiftWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("班別設定");
    const headers = ["班別", "適用單位", "需求人數", "上班時間", "下班時間", "底色", "字色", "自動字色", "不顯示"];
    const departmentMap = new Map((payload.state?.departments || []).map((item) => [item.id, item.name]));

    sheet.addRow(headers);
    (payload.state?.shifts || []).forEach((shift) => {
      sheet.addRow([
        shift.name || "",
        departmentMap.get(shift.applicableDeptId || "") || "",
        Math.max(0, Number(shift.requiredStaffCount) || 0),
        shift.startTime || "",
        shift.endTime || "",
        shift.color || "",
        shift.textColor || "",
        shift.autoTextColor ? "是" : "否",
        shift.hiddenFromToolbar ? "是" : "否"
      ]);
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = headers.map((_, index) => ({ width: index === 0 ? 18 : 14 }));
    applySheetBorder(sheet);
    return workbook;
  }

  async function createLeaveSettingsWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("假別設定");
    const headers = ["假別代碼", "名稱", "需填時間", "需填原因", "底色", "字色", "自動字色", "不顯示"];
    sheet.addRow(headers);
    (payload.state?.leaves || []).forEach((item) => {
      sheet.addRow([
        item.code || "",
        item.name || "",
        item.requiresTime ? "是" : "否",
        item.requiresReason ? "是" : "否",
        item.color || "",
        item.textColor || "",
        item.autoTextColor ? "是" : "否",
        item.hiddenFromToolbar ? "是" : "否"
      ]);
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = headers.map((_, index) => ({ width: index < 2 ? 18 : 14 }));
    applySheetBorder(sheet);
    return workbook;
  }

  async function createOvertimeSettingsWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("加班設定");
    const headers = ["名稱", "上班時間", "下班時間", "使用休息1", "休息1開始", "休息1結束", "使用休息2", "休息2開始", "休息2結束", "底色", "字色", "自動字色", "不顯示"];
    sheet.addRow(headers);
    (payload.state?.overtime || []).forEach((item) => {
      sheet.addRow([
        item.name || "",
        item.startTime || "",
        item.endTime || "",
        item.useRest1 ? "是" : "否",
        item.rest1StartTime || "",
        item.rest1EndTime || "",
        item.useRest2 ? "是" : "否",
        item.rest2StartTime || "",
        item.rest2EndTime || "",
        item.color || "",
        item.textColor || "",
        item.autoTextColor ? "是" : "否",
        item.hiddenFromToolbar ? "是" : "否"
      ]);
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = headers.map((_, index) => ({ width: index === 0 ? 18 : 14 }));
    applySheetBorder(sheet);
    return workbook;
  }

  async function parseMemberWorkbook(arrayBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return [];
    }
    const fixedRestWeekdayMap = new Map([
      ["週一", 1],
      ["週二", 2],
      ["週三", 3],
      ["週四", 4],
      ["週五", 5],
      ["週六", 6],
      ["週日", 0],
      ["星期一", 1],
      ["星期二", 2],
      ["星期三", 3],
      ["星期四", 4],
      ["星期五", 5],
      ["星期六", 6],
      ["星期日", 0]
    ]);
    const rows = [];
    const codeColumn = getHeaderColumnIndex(sheet, ["工號"], 1);
    const nameColumn = getHeaderColumnIndex(sheet, ["姓名"], 2);
    const departmentColumn = getHeaderColumnIndex(sheet, ["所屬單位", "單位"], 9);
    const scheduleShiftColumn = getHeaderColumnIndex(sheet, ["排班班別"], 0);
    const roleColumn = getHeaderColumnIndex(sheet, ["權限"], scheduleShiftColumn ? 5 : 4);
    const hireDateColumn = getHeaderColumnIndex(sheet, ["到職日"], scheduleShiftColumn ? 6 : 5);
    const leaveDateColumn = getHeaderColumnIndex(sheet, ["離職日"], scheduleShiftColumn ? 7 : 6);
    const salaryTypeColumn = getHeaderColumnIndex(sheet, ["計薪方式"], scheduleShiftColumn ? 8 : 7);
    const fixedRestWeekdayColumn = getHeaderColumnIndex(sheet, ["例假星期"], scheduleShiftColumn ? 9 : 8);
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const code = getCellDisplayValue(row.getCell(codeColumn));
      const name = getCellDisplayValue(row.getCell(nameColumn));
      const departmentName = getCellDisplayValue(row.getCell(departmentColumn));
      const scheduleShiftNames = scheduleShiftColumn ? getCellDisplayValue(row.getCell(scheduleShiftColumn)) : "";
      const roleText = getCellDisplayValue(row.getCell(roleColumn));
      const hireDate = normalizeImportedDate(row.getCell(hireDateColumn).value);
      const leaveDate = normalizeImportedDate(row.getCell(leaveDateColumn).value);
      const salaryType = getCellDisplayValue(row.getCell(salaryTypeColumn));
      const fixedRestWeekdayText = getCellDisplayValue(row.getCell(fixedRestWeekdayColumn));
      if (![code, name, departmentName, scheduleShiftNames, roleText, hireDate, leaveDate, salaryType, fixedRestWeekdayText].some(Boolean)) {
        return;
      }
      rows.push({
        code,
        name,
        departmentName,
        scheduleShiftNames,
        role: parseRoleLabel(roleText),
        hireDate,
        leaveDate,
        payByDay: salaryType === "日薪" || salaryType === "按日計薪",
        fixedRestWeekday: fixedRestWeekdayMap.has(fixedRestWeekdayText) ? fixedRestWeekdayMap.get(fixedRestWeekdayText) : 0
      });
    });
    return rows;
  }

  async function parseDepartmentWorkbook(arrayBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return [];
    }
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const name = getCellDisplayValue(row.getCell(1));
      const startDate = normalizeImportedDate(row.getCell(2).value);
      const endDate = normalizeImportedDate(row.getCell(3).value);
      const hiddenFromSchedule = normalizeImportedBoolean(getCellDisplayValue(row.getCell(4)));
      if (![name, startDate, endDate, hiddenFromSchedule].some(Boolean)) {
        return;
      }
      rows.push({ name, startDate, endDate, hiddenFromSchedule });
    });
    return rows;
  }

  async function parseShiftWorkbook(arrayBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return [];
    }
    const rows = [];
    const nameColumn = getHeaderColumnIndex(sheet, ["班別"], 1);
    const departmentColumn = getHeaderColumnIndex(sheet, ["適用單位"], 2);
    const requiredStaffCountColumn = getHeaderColumnIndex(sheet, ["需求人數"], 0);
    const offset = requiredStaffCountColumn ? 1 : 0;
    const startTimeColumn = getHeaderColumnIndex(sheet, ["上班時間"], 3 + offset);
    const endTimeColumn = getHeaderColumnIndex(sheet, ["下班時間"], 4 + offset);
    const colorColumn = getHeaderColumnIndex(sheet, ["底色"], 5 + offset);
    const textColorColumn = getHeaderColumnIndex(sheet, ["字色"], 6 + offset);
    const autoTextColorColumn = getHeaderColumnIndex(sheet, ["自動字色"], 7 + offset);
    const hiddenFromToolbarColumn = getHeaderColumnIndex(sheet, ["不顯示"], 8 + offset);
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const name = getCellDisplayValue(row.getCell(nameColumn));
      const departmentName = getCellDisplayValue(row.getCell(departmentColumn));
      const requiredStaffCount = requiredStaffCountColumn ? Number(getCellDisplayValue(row.getCell(requiredStaffCountColumn))) : 0;
      const startTime = normalizeImportedTime(row.getCell(startTimeColumn).value);
      const endTime = normalizeImportedTime(row.getCell(endTimeColumn).value);
      const color = getCellDisplayValue(row.getCell(colorColumn));
      const textColor = getCellDisplayValue(row.getCell(textColorColumn));
      const autoTextColor = normalizeImportedBoolean(getCellDisplayValue(row.getCell(autoTextColorColumn)));
      const hiddenFromToolbar = normalizeImportedBoolean(getCellDisplayValue(row.getCell(hiddenFromToolbarColumn)));
      if (![name, departmentName, requiredStaffCount, startTime, endTime, color, textColor, autoTextColor, hiddenFromToolbar].some(Boolean)) {
        return;
      }
      rows.push({
        name,
        departmentName,
        requiredStaffCount: Number.isFinite(requiredStaffCount) ? requiredStaffCount : 0,
        startTime,
        endTime,
        color,
        textColor,
        autoTextColor,
        hiddenFromToolbar
      });
    });
    return rows;
  }

  async function parseLeaveSettingsWorkbook(arrayBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.getWorksheet("假別設定") || workbook.worksheets[0];
    const items = [];
    if (sheet) {
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        const code = getCellDisplayValue(row.getCell(1));
        const name = getCellDisplayValue(row.getCell(2));
        const requiresTime = normalizeImportedBoolean(getCellDisplayValue(row.getCell(3)));
        const requiresReason = normalizeImportedBoolean(getCellDisplayValue(row.getCell(4)));
        const color = getCellDisplayValue(row.getCell(5));
        const textColor = getCellDisplayValue(row.getCell(6));
        const autoTextColor = normalizeImportedBoolean(getCellDisplayValue(row.getCell(7)));
        const hiddenFromToolbar = normalizeImportedBoolean(getCellDisplayValue(row.getCell(8)));
        if (![code, name, requiresTime, requiresReason, color, textColor, autoTextColor, hiddenFromToolbar].some(Boolean)) {
          return;
        }
        items.push({ code, name, requiresTime, requiresReason, color, textColor, autoTextColor, hiddenFromToolbar });
      });
    }
    return { items };
  }

  async function parseOvertimeSettingsWorkbook(arrayBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.getWorksheet("加班設定") || workbook.worksheets[0];
    const items = [];
    if (sheet) {
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        const name = getCellDisplayValue(row.getCell(1));
        const startTime = normalizeImportedTime(row.getCell(2).value);
        const endTime = normalizeImportedTime(row.getCell(3).value);
        const useRest1 = normalizeImportedBoolean(getCellDisplayValue(row.getCell(4)));
        const rest1StartTime = normalizeImportedTime(row.getCell(5).value);
        const rest1EndTime = normalizeImportedTime(row.getCell(6).value);
        const useRest2 = normalizeImportedBoolean(getCellDisplayValue(row.getCell(7)));
        const rest2StartTime = normalizeImportedTime(row.getCell(8).value);
        const rest2EndTime = normalizeImportedTime(row.getCell(9).value);
        const color = getCellDisplayValue(row.getCell(10));
        const textColor = getCellDisplayValue(row.getCell(11));
        const autoTextColor = normalizeImportedBoolean(getCellDisplayValue(row.getCell(12)));
        const hiddenFromToolbar = normalizeImportedBoolean(getCellDisplayValue(row.getCell(13)));
        if (![name, startTime, endTime, useRest1, rest1StartTime, rest1EndTime, useRest2, rest2StartTime, rest2EndTime, color, textColor, autoTextColor, hiddenFromToolbar].some(Boolean)) {
          return;
        }
        items.push({ name, startTime, endTime, useRest1, rest1StartTime, rest1EndTime, useRest2, rest2StartTime, rest2EndTime, color, textColor, autoTextColor, hiddenFromToolbar });
      });
    }
    return { items };
  }

  async function workbookToBlob(workbook) {
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob(
      [buffer],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
  }

  function runSelfCheck() {
    const csv = buildSapLeaveCsvContent({
      year: 2026,
      month: 4,
      state: {
        members: [{ id: "self-check-member", name: "Self Check", code: "SELF_CHECK", hireDate: "", leaveDate: "", payByDay: false }],
        leaves: [{ id: "self-check-rest", name: "休息日" }, { id: "self-check-off", name: "例假" }],
        schedule: {
          [getScheduleKey("self-check-member", 2026, 4, 3)]: { leave: "self-check-rest" },
          [getScheduleKey("self-check-member", 2026, 4, 4)]: { leave: "self-check-off" }
        }
      }
    });
    if (!csv.includes("REST") || !csv.includes("OFF")) {
      throw new Error("browser exporter self-check failed");
    }
    if (normalizeImportedDate("2025/01/02") !== "2025-01-02") {
      throw new Error("browser exporter date self-check failed");
    }
    const officialPayload = {
      state: { departments: [] },
      exportRows: [{
        employee_code: "SELF_CHECK",
        employee_name: "Self Check",
        home_department_id: null,
        pay_by_day: false,
        work_date: "2026-07-17",
        leave_type_id: "leave-id",
        leave_code: "0010",
        leave_name: "事假",
        leave_all_day: true,
        overtime_type_id: "overtime-id",
        overtime_start_time: "18:00:00",
        overtime_end_time: "20:00:00",
        overtime_use_rest_1: false,
        overtime_use_rest_2: false
      }]
    };
    if (getLeaveExportRows(officialPayload).length !== 1 || getOvertimeExportRows(officialPayload).length !== 1) {
      throw new Error("browser exporter official rows self-check failed");
    }
  }

  runSelfCheck();

  window.schedulerBrowserExporter = {
    buildSapLeaveCsvContent,
    getSapLeaveExportRows,
    getOvertimeExportRows,
    getLeaveExportRows,
    createScheduleWorkbook,
    createOvertimeWorkbook,
    createLeaveWorkbook,
    createMemberWorkbook,
    createDepartmentWorkbook,
    createShiftWorkbook,
    createLeaveSettingsWorkbook,
    createOvertimeSettingsWorkbook,
    parseMemberWorkbook,
    parseDepartmentWorkbook,
    parseShiftWorkbook,
    parseLeaveSettingsWorkbook,
    parseOvertimeSettingsWorkbook,
    workbookToBlob
  };
})();
;

/* ===== rest-compliance.js ===== */
(function initRestCompliance(globalScope) {
  const REGULAR_HOLIDAY_CODE = "0036";
  const REST_DAY_CODE = "0047";
  const DEFAULT_WEEK_START = 0;

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toDateString(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function createDate(year, month, day) {
    return new Date(year, month, day);
  }

  function addDays(date, count) {
    const next = new Date(date);
    next.setDate(next.getDate() + count);
    return next;
  }

  function startOfWeek(date, weekStart = DEFAULT_WEEK_START) {
    const offset = (date.getDay() - weekStart + 7) % 7;
    return addDays(date, -offset);
  }

  function endOfWeek(date, weekStart = DEFAULT_WEEK_START) {
    return addDays(startOfWeek(date, weekStart), 6);
  }

  function buildCalendarWeeks(year, month, weekStart = DEFAULT_WEEK_START) {
    const monthStart = createDate(year, month, 1);
    const monthEnd = createDate(year, month + 1, 0);
    const rangeStart = startOfWeek(monthStart, weekStart);
    const rangeEnd = endOfWeek(monthEnd, weekStart);
    const weeks = [];
    let cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const dates = [];
      for (let index = 0; index < 7; index += 1) {
        dates.push(toDateString(addDays(cursor, index)));
      }
      weeks.push({
        startDate: dates[0],
        endDate: dates[6],
        dates
      });
      cursor = addDays(cursor, 7);
    }

    return weeks;
  }

  function buildDayMap(days) {
    return new Map((Array.isArray(days) ? days : []).map((day) => [day.date, day]));
  }

  function isHireOrLeaveWeek(member, week) {
    return Boolean(
      (member.hireDate && week.dates.includes(member.hireDate)) ||
      (member.leaveDate && week.dates.includes(member.leaveDate))
    );
  }

  function isWorkDay(day) {
    return Boolean(day.active && (day.hasShift || day.hasOvertime));
  }

  function pushIssue(issues, issue) {
    issues.push(issue);
  }

  function findWeekForDate(weeks, dateString) {
    return weeks.find((week) => week.dates.includes(dateString)) || null;
  }

  function buildWeekDays(week, dayMap) {
    return week.dates.map((date) => ({ date, ...(dayMap.get(date) || {}) }));
  }

  function checkHireOrLeaveWeek(member, week, dayMap, issues) {
    const weekDays = buildWeekDays(week, dayMap);
    const protectionDays = weekDays.filter((day) => (
      !day.active ||
      day.leaveCode === REGULAR_HOLIDAY_CODE ||
      day.leaveCode === REST_DAY_CODE
    ));

    if (protectionDays.length >= 2) {
      return;
    }

    pushIssue(issues, {
      severity: "error",
      type: "insufficient_non_employment_or_rest_days",
      memberId: member.memberId,
      memberName: member.memberName,
      memberCode: member.memberCode || "",
      weekStart: week.startDate,
      weekEnd: week.endDate,
      message: "到職/離職週未在職日＋例假＋休息日少於 2 天"
    });
  }

  function checkSlidingConsecutiveWorkDays(member, weeks, slidingDayMap, issues, maxConsecutiveWorkDays, reportStartDate, reportEndDate) {
    const dates = [...slidingDayMap.keys()].sort();
    let streak = 0;
    let streakStartDate = "";
    let reportedCurrentStreak = false;

    dates.forEach((dateString) => {
      const week = findWeekForDate(weeks, dateString);
      const day = { date: dateString, ...(slidingDayMap.get(dateString) || {}) };
      if (isWorkDay(day)) {
        if (streak === 0) {
          streakStartDate = dateString;
          reportedCurrentStreak = false;
        }
        streak += 1;
        if (
          streak > maxConsecutiveWorkDays &&
          dateString >= reportStartDate &&
          dateString <= reportEndDate &&
          !reportedCurrentStreak
        ) {
          pushIssue(issues, {
            severity: "error",
            type: "consecutive_work_days_exceeded",
            memberId: member.memberId,
            memberName: member.memberName,
            memberCode: member.memberCode || "",
            weekStart: week?.startDate || dateString,
            weekEnd: week?.endDate || dateString,
            date: dateString,
            streakStartDate,
            streakLength: streak,
            message: `連續出勤超過 ${maxConsecutiveWorkDays} 天`
          });
          reportedCurrentStreak = true;
        }
        return;
      }

      streak = 0;
      streakStartDate = "";
      reportedCurrentStreak = false;
    });
  }

  function checkRestCompliance(config) {
    const weeks = Array.isArray(config.weeks) && config.weeks.length
      ? config.weeks
      : buildCalendarWeeks(config.year, config.month, config.weekStart);
    const issues = [];
    const maxConsecutiveWorkDays = Math.max(1, Number(config.maxConsecutiveWorkDays) || 6);
    const reportStartDate = config.reportStartDate || weeks[0]?.startDate || "";
    const reportEndDate = config.reportEndDate || weeks[weeks.length - 1]?.endDate || "";
    let checkedWeeks = 0;
    let skippedWeeks = 0;

    (config.memberCalendars || []).forEach((member) => {
      const dayMap = buildDayMap(member.days);
      const slidingDayMap = buildDayMap(member.slidingDays || member.days);

      weeks.forEach((week) => {
        if (isHireOrLeaveWeek(member, week)) {
          skippedWeeks += 1;
          checkHireOrLeaveWeek(member, week, dayMap, issues);
          return;
        }

        const activeDays = buildWeekDays(week, dayMap).filter((day) => day.active);
        if (!activeDays.length) {
          return;
        }

        checkedWeeks += 1;
        const regularHolidays = activeDays.filter((day) => day.leaveCode === REGULAR_HOLIDAY_CODE);
        if (!regularHolidays.length) {
          pushIssue(issues, {
            severity: "error",
            type: "missing_regular_holiday",
            memberId: member.memberId,
            memberName: member.memberName,
            memberCode: member.memberCode || "",
            weekStart: week.startDate,
            weekEnd: week.endDate,
            message: "本週未標記例假"
          });
        }

        regularHolidays.forEach((day) => {
          if (!day.hasShift && !day.hasOvertime) {
            return;
          }
          pushIssue(issues, {
            severity: "warning",
            type: "regular_holiday_work",
            memberId: member.memberId,
            memberName: member.memberName,
            memberCode: member.memberCode || "",
            weekStart: week.startDate,
            weekEnd: week.endDate,
            date: day.date,
            message: "例假日有排班或加班，請確認是否符合第40條例外事由"
          });
        });
      });

      checkSlidingConsecutiveWorkDays(
        member,
        weeks,
        slidingDayMap,
        issues,
        maxConsecutiveWorkDays,
        reportStartDate,
        reportEndDate
      );
    });

    return {
      weeks,
      checkedWeeks,
      skippedWeeks,
      checkedMembers: (config.memberCalendars || []).length,
      issues
    };
  }

  const api = {
    REGULAR_HOLIDAY_CODE,
    REST_DAY_CODE,
    DEFAULT_WEEK_START,
    buildCalendarWeeks,
    checkRestCompliance
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.restCompliance = api;
})(typeof window !== "undefined" ? window : globalThis);
;

/* ===== web-api.js ===== */
(function installWebSchedulerApi() {
  if (window.schedulerApi) {
    return;
  }

  const config = window.SCHEDULER_CONFIG || {};
  const exporter = window.schedulerBrowserExporter;
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const documentId = String(config.documentId || "default");
  const sessionStorageKey = `scheduler.supabase.session.${baseUrl}`;
  const mobileSessionMaxIdleMs = 48 * 60 * 60 * 1000;
  const desktopSessionMaxIdleMs = 30 * 60 * 1000;

  if (!baseUrl || !anonKey || !exporter) {
    throw new Error("缺少 Supabase 設定");
  }

  let currentSession = null;
  let currentProfile = null;

  function normalizeRole(role) {
    return role === "admin" || role === "manager" ? role : "employee";
  }

  function hasManagerAccess(role) {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === "admin" || normalizedRole === "manager";
  }

  function hasAdminAccess(role) {
    return normalizeRole(role) === "admin";
  }

  function makeFileName(prefix, payload, extension) {
    return `${prefix}_${payload.year}_${String(payload.month + 1).padStart(2, "0")}.${extension}`;
  }

  function downloadBlob(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        resolve(file);
      }, { once: true });
      input.click();
    });
  }

  function normalizeSession(payload) {
    if (!payload?.access_token || !payload?.user) {
      return null;
    }
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || "",
      token_type: payload.token_type || "bearer",
      expires_in: Number(payload.expires_in || 0),
      expires_at: Number(payload.expires_at || 0),
      user: payload.user
    };
  }

  function isTabletDevice() {
    const userAgent = navigator.userAgent || "";
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const isIPad = /iPad/i.test(userAgent)
      || (/Macintosh/i.test(userAgent) && touchPoints > 1);
    const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent);
    return Boolean(isIPad || isAndroidTablet || /Tablet|Silk/i.test(userAgent));
  }

  function isPhoneDevice() {
    const userAgent = navigator.userAgent || "";
    const isTablet = isTabletDevice();
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
    return Boolean(
      navigator.userAgentData?.mobile
        || narrowTouch
        || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent))
    );
  }

  function getSessionStore() {
    return isPhoneDevice() ? localStorage : sessionStorage;
  }

  function getSessionMaxIdleMs() {
    return isPhoneDevice() ? mobileSessionMaxIdleMs : desktopSessionMaxIdleMs;
  }

  function migrateLegacyTabletSession() {
    if (!isTabletDevice()) {
      return;
    }
    const tabSession = sessionStorage.getItem(sessionStorageKey);
    const legacySession = localStorage.getItem(sessionStorageKey);
    if (!tabSession && legacySession) {
      sessionStorage.setItem(sessionStorageKey, legacySession);
    }
    localStorage.removeItem(sessionStorageKey);
  }

  function readStoredSession() {
    try {
      const stored = JSON.parse(getSessionStore().getItem(sessionStorageKey) || "null");
      const session = normalizeSession(stored?.session || stored);
      const lastActivityAt = Number(stored?.lastActivityAt || 0);
      if (!session || !lastActivityAt || Date.now() - lastActivityAt > getSessionMaxIdleMs()) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function persistSession(session) {
    currentSession = normalizeSession(session);
    if (currentSession) {
      const store = getSessionStore();
      const otherStore = store === localStorage ? sessionStorage : localStorage;
      store.setItem(sessionStorageKey, JSON.stringify({
        session: currentSession,
        lastActivityAt: Date.now(),
        device: isTabletDevice() ? "tablet" : isPhoneDevice() ? "phone" : "desktop"
      }));
      otherStore.removeItem(sessionStorageKey);
    } else {
      localStorage.removeItem(sessionStorageKey);
      sessionStorage.removeItem(sessionStorageKey);
    }
  }

  function clearSession() {
    currentSession = null;
    currentProfile = null;
    localStorage.removeItem(sessionStorageKey);
    sessionStorage.removeItem(sessionStorageKey);
  }

  function readSessionMeta() {
    try {
      return JSON.parse(getSessionStore().getItem(sessionStorageKey) || "null");
    } catch {
      return null;
    }
  }

  function isSessionIdleExpired() {
    const stored = readSessionMeta();
    const lastActivityAt = Number(stored?.lastActivityAt || 0);
    return Boolean(currentSession && (!lastActivityAt || Date.now() - lastActivityAt > getSessionMaxIdleMs()));
  }

  function expireSession() {
    clearSession();
    window.dispatchEvent(new CustomEvent("scheduler-session-expired"));
  }

  function assertSessionActive() {
    if (isSessionIdleExpired()) {
      expireSession();
      throw new Error("登入已逾時，請重新登入");
    }
  }

  let lastActivityWriteAt = 0;

  function touchSession(force = false) {
    if (!currentSession) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastActivityWriteAt < 15000) {
      return;
    }
    persistSession(currentSession);
    lastActivityWriteAt = now;
  }

  function buildHeaders(options = {}) {
    const { auth = false, contentType = true, extra = {} } = options;
    const headers = {
      apikey: anonKey,
      ...extra
    };
    if (auth && currentSession?.access_token) {
      headers.Authorization = `Bearer ${currentSession.access_token}`;
    }
    if (contentType) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  async function readError(response) {
    const text = await response.text();
    if (!text) {
      return `HTTP ${response.status}`;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error_description || parsed.error || text;
    } catch {
      return text;
    }
  }

  async function requestJson(pathname, options = {}) {
    if (options.auth) {
      assertSessionActive();
    }
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers: buildHeaders({
        auth: options.auth,
        contentType: options.contentType !== false,
        extra: options.headers || {}
      })
    });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    if (options.auth) {
      touchSession();
    }
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function requestFunction(functionName, payload) {
    assertSessionActive();
    const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      cache: "no-store",
      headers: buildHeaders({
        auth: true,
        extra: {
          Accept: "application/json"
        }
      }),
      body: JSON.stringify(payload || {})
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`尚未部署 ${functionName} Edge Function`);
      }
      throw new Error(await readError(response));
    }
    touchSession();
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function buildQuery(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    });
    const query = search.toString();
    return query ? `?${query}` : "";
  }

  function quoteFilterValue(value) {
    return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }

  function buildInFilter(values) {
    return `in.(${values.map((value) => quoteFilterValue(value)).join(",")})`;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
  }

  async function restSelect(table, options = {}) {
    const { select = "*", filters = {}, order = "", limit = "", auth = false } = options;
    if (!limit) {
      return restSelectAll(table, { select, filters, order, auth });
    }
    return requestJson(
      `/rest/v1/${table}${buildQuery({
        select,
        order,
        limit,
        ...filters
      })}`,
      {
        method: "GET",
        auth,
        headers: {
          Accept: "application/json"
        }
      }
    );
  }

  async function restSelectAll(table, options = {}) {
    const { select = "*", filters = {}, order = "", auth = false } = options;
    const pageSize = 1000;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await requestJson(
        `/rest/v1/${table}${buildQuery({
          select,
          order,
          offset,
          limit: pageSize,
          ...filters
        })}`,
        {
          method: "GET",
          auth,
          headers: {
            Accept: "application/json"
          }
        }
      );
      rows.push(...(Array.isArray(page) ? page : []));
      if (!Array.isArray(page) || page.length < pageSize) {
        return rows;
      }
    }
  }

  async function restInsert(table, rows, options = {}) {
    const { auth = false, onConflict = "", prefer = "return=representation" } = options;
    return requestJson(
      `/rest/v1/${table}${buildQuery(onConflict ? { on_conflict: onConflict } : {})}`,
      {
        method: "POST",
        auth,
        headers: {
          Prefer: prefer
        },
        body: JSON.stringify(rows)
      }
    );
  }

  async function restUpdate(table, filters, payload, options = {}) {
    const { auth = false, prefer = "return=representation" } = options;
    return requestJson(
      `/rest/v1/${table}${buildQuery(filters)}`,
      {
        method: "PATCH",
        auth,
        headers: {
          Prefer: prefer
        },
        body: JSON.stringify(payload)
      }
    );
  }

  async function restDelete(table, filters, options = {}) {
    const { auth = false, prefer = "return=minimal" } = options;
    return requestJson(
      `/rest/v1/${table}${buildQuery(filters)}`,
      {
        method: "DELETE",
        auth,
        headers: {
          Prefer: prefer
        }
      }
    );
  }

  async function restRpc(functionName, payload = {}, options = {}) {
    const { auth = false, prefer = "return=representation" } = options;
    return requestJson(
      `/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        auth,
        headers: {
          Accept: "application/json",
          Prefer: prefer
        },
        body: JSON.stringify(payload || {})
      }
    );
  }

  async function getMyProfileRow() {
    const rows = await restRpc("get_my_profile_v2", {}, { auth: true }) || [];
    return rows[0] || null;
  }

  async function getScheduleDirectoryRows() {
    return await restRpc("get_schedule_directory_v2", {}, { auth: true }) || [];
  }

  async function getEmployeeAdminDirectoryRows() {
    ensureManager();
    return await restRpc("get_employee_admin_directory_v2", {}, { auth: true }) || [];
  }

  async function getDepartmentDirectoryRows() {
    return await restRpc("get_department_directory_v2", {}, { auth: true }) || [];
  }

  function ensureSignedIn() {
    if (!currentSession?.user) {
      throw new Error("請先登入");
    }
  }

  function ensureManager() {
    ensureSignedIn();
    if (!hasManagerAccess(currentProfile?.role)) {
      throw new Error("此功能需要主管權限");
    }
  }

  async function refreshSessionIfNeeded() {
    if (!currentSession?.refresh_token) {
      return currentSession;
    }
    if (currentSession.expires_at && Date.now() < (currentSession.expires_at - 60) * 1000) {
      return currentSession;
    }
    const payload = await requestJson("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({
        refresh_token: currentSession.refresh_token
      })
    });
    persistSession(payload);
    return currentSession;
  }

  async function fetchProfile(userId) {
    const profile = await getMyProfileRow();
    return profile?.id === userId ? profile : null;
  }

  async function refreshAuthContext() {
    currentProfile = null;
    if (!currentSession?.user) {
      return {
        session: null,
        profile: null
      };
    }
    await refreshSessionIfNeeded();
    currentProfile = await fetchProfile(currentSession.user.id);
    if (!currentProfile) {
      throw new Error("帳號尚未綁定身份");
    }
    assertProfileCanLogin(currentProfile);
    return {
      session: currentSession,
      profile: currentProfile
    };
  }

  async function initializeAuth() {
    migrateLegacyTabletSession();
    persistSession(readStoredSession());
    if (!currentSession?.user) {
      return { session: null, profile: null };
    }
    try {
      return await refreshAuthContext();
    } catch {
      clearSession();
      return { session: null, profile: null };
    }
  }

  function buildLocalLoginEmail(employeeCode) {
    const normalized = String(employeeCode || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized ? `${normalized}@local.invalid` : "";
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, () => touchSession(), {
      capture: true,
      passive: eventName === "touchstart"
    });
  });
  window.addEventListener("focus", () => touchSession());

  setInterval(() => {
    if (isSessionIdleExpired()) {
      expireSession();
    }
  }, 60 * 1000);

  async function signIn(loginAccount, password) {
    const employeeCode = String(loginAccount || "").trim();
    const email = buildLocalLoginEmail(employeeCode);
    if (!email) {
      throw new Error("找不到這個工號，或尚未設定登入帳號");
    }
    const payload = await requestJson("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });
    persistSession(payload);
    try {
      return await refreshAuthContext();
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function signOut() {
    if (currentSession?.access_token) {
      try {
        await requestJson("/auth/v1/logout", {
          method: "POST",
          auth: true,
          contentType: false
        });
      } catch {
        // logout 失敗時仍直接清本機 session，避免使用者卡住；若要更嚴謹可再補重試。
      }
    }
    clearSession();
    return { session: null, profile: null };
  }

  async function changePassword(newPassword) {
    ensureSignedIn();
    await requestJson("/auth/v1/user", {
      method: "PUT",
      auth: true,
      body: JSON.stringify({
        password: String(newPassword || "")
      })
    });
    return { ok: true };
  }

  function nullableDate(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function nullableTime(value) {
    const text = String(value || "").trim();
    return /^\d{2}:\d{2}$/.test(text) ? text : null;
  }

  function clampInteger(value, min, max, fallback = min) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }

  function normalizeTextArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const text = String(value || "").trim();
    if (!text) {
      return [];
    }
    const body = text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1) : text;
    // scheduler ids do not contain commas; use a full Postgres array parser if that changes.
    return body
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, "").replace(/\\"/g, "\""))
      .filter(Boolean);
  }

  function notInFilter(values) {
    const list = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
    return list.length ? `not.${buildInFilter(list)}` : "not.is.null";
  }

  function makeScheduleKey(memberId, workDate) {
    const [yearText, monthText, dayText] = String(workDate || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return "";
    }
    return `${memberId}_${year}_${month - 1}_${day}`;
  }

  function parseScheduleKey(key) {
    const parts = String(key || "").split("_");
    if (parts.length < 4) {
      return null;
    }
    const memberId = parts.slice(0, -3).join("_");
    const year = Number(parts[parts.length - 3]);
    const month = Number(parts[parts.length - 2]);
    const day = Number(parts[parts.length - 1]);
    if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }
    return {
      memberId,
      workDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      year,
      month: month + 1
    };
  }

  function makeScheduleEntryKey(memberId, workDate) {
    return `${memberId || ""}|${workDate || ""}`;
  }

  function toDateObject(dateString) {
    const [year, month, day] = String(dateString || "").split("-").map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  function toDateStringFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function taipeiDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function addDaysToDateString(dateString, count) {
    const date = toDateObject(dateString);
    if (!date) {
      return "";
    }
    date.setDate(date.getDate() + count);
    return toDateStringFromDate(date);
  }

  function diffDays(startDateString, endDateString) {
    const start = toDateObject(startDateString);
    const end = toDateObject(endDateString);
    if (!start || !end) {
      return 0;
    }
    return Math.floor((end - start) / (24 * 60 * 60 * 1000));
  }

  function getScheduleLoadRange(settings = {}) {
    const today = toDateStringFromDate(new Date());
    const anchorDate = toDateObject(settings.eight_week_start_date) ? settings.eight_week_start_date : today;
    const periods = Math.floor(diffDays(anchorDate, today) / 56);
    const visibleStart = addDaysToDateString(anchorDate, periods * 56) || today;
    // 7-day buffer covers the current 6-day consecutive-work rule; widen this if rules look farther.
    return {
      startDate: addDaysToDateString(visibleStart, -7),
      endDate: addDaysToDateString(visibleStart, 62)
    };
  }

  function getScheduleEntryFilters(range = {}) {
    const filters = {};
    const startDate = toDateObject(range.startDate) ? range.startDate : "";
    const endDate = toDateObject(range.endDate) ? range.endDate : "";
    if (startDate && endDate) {
      filters.and = `(work_date.gte.${startDate},work_date.lte.${endDate})`;
    } else if (startDate) {
      filters.work_date = `gte.${startDate}`;
    } else if (endDate) {
      filters.work_date = `lte.${endDate}`;
    }
    return filters;
  }

  function mapScheduleRows(scheduleEntryRows = [], members = []) {
    const memberIds = new Set((members || []).map((member) => member.id).filter(Boolean));
    const schedule = {};
    (scheduleEntryRows || []).forEach((row) => {
      if (memberIds.size && !memberIds.has(row.member_id)) {
        return;
      }
      const key = makeScheduleKey(row.member_id, row.work_date);
      if (!key) {
        return;
      }
      const shift = row.shift_type_id || null;
      const leave = row.leave_type_id || null;
      const overtime = row.overtime_type_id || null;
      if (!shift && !leave && !overtime) {
        return;
      }
      schedule[key] = {
        shift,
        leave,
        overtime,
        leaveMeta: leave ? {
          allDay: row.leave_all_day !== false,
          startTime: (row.leave_start_time || "").slice(0, 5),
          endTime: (row.leave_end_time || "").slice(0, 5),
          reasonEnabled: Boolean(row.leave_reason),
          reason: row.leave_reason || ""
        } : null,
        overtimeMeta: overtime ? {
          startTime: (row.overtime_start_time || "").slice(0, 5),
          endTime: (row.overtime_end_time || "").slice(0, 5),
          useRest1: Boolean(row.overtime_use_rest_1),
          rest1StartTime: (row.overtime_rest_1_start_time || "").slice(0, 5),
          rest1EndTime: (row.overtime_rest_1_end_time || "").slice(0, 5),
          useRest2: Boolean(row.overtime_use_rest_2),
          rest2StartTime: (row.overtime_rest_2_start_time || "").slice(0, 5),
          rest2EndTime: (row.overtime_rest_2_end_time || "").slice(0, 5),
          reason: row.overtime_reason || ""
        } : null
      };
    });
    return schedule;
  }

  function normalizeScheduleLoadedRanges(ranges = []) {
    return (Array.isArray(ranges) ? ranges : [])
      .map((range) => ({
        startDate: toDateObject(range?.startDate) ? range.startDate : "",
        endDate: toDateObject(range?.endDate) ? range.endDate : ""
      }))
      .filter((range) => range.startDate && range.endDate && range.startDate <= range.endDate);
  }

  async function fetchExistingScheduleRowsForRanges(ranges) {
    const loadedRanges = normalizeScheduleLoadedRanges(ranges);
    if (!loadedRanges.length) {
      return [];
    }
    const pages = await Promise.all(loadedRanges.map((range) => restSelect("schedule_entries", {
      select: "id,member_id,work_date",
      filters: getScheduleEntryFilters(range),
      auth: true
    })));
    const rowsByKey = new Map();
    pages.flat().forEach((row) => {
      if (row?.id) {
        rowsByKey.set(row.id, row);
      }
    });
    return [...rowsByKey.values()];
  }

  async function deleteRowsNotIn(table, ids) {
    await restDelete(table, {
      id: notInFilter(ids)
    }, {
      auth: true
    });
  }

  async function getTodayAttendance() {
    ensureSignedIn();
    return requestFunction("attendance-clock", {
      action: "today"
    });
  }

  async function clockAttendance(action, position = {}) {
    ensureSignedIn();
    return requestFunction("attendance-clock", {
      action,
      deviceType: isPhoneDevice() ? "phone" : "desktop",
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      geolocationError: position.geolocationError || ""
    });
  }

  async function getEmployeeOvertimeDates() {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "dates" });
  }

  async function getAttendanceOvertimeForDate(workDate) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "status", workDate });
  }

  async function getTodayAttendanceOvertime() {
    return getAttendanceOvertimeForDate(taipeiDateString());
  }

  async function submitAttendanceOvertime(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", {
      action: "submit",
      workDate: payload.workDate,
      earlyHours: payload.earlyHours,
      lateHours: payload.lateHours,
      note: payload.note || ""
    });
  }

  async function deleteAttendanceOvertime(workDate) {
    ensureSignedIn();
    return requestFunction("attendance-overtime-employee", { action: "delete", workDate });
  }

  async function getOvertimeReviewList(filters = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-list", filters);
  }

  async function getApprovedOvertimeExportRows(filters = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-list", {
      action: "export_approved",
      fromDate: filters.fromDate,
      toDate: filters.toDate
    });
  }

  async function reviewOvertimeRequest(payload = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-action", { action: "review", ...payload });
  }

  async function createAdminOvertimeRequest(payload = {}) {
    ensureManager();
    return requestFunction("attendance-overtime-admin-action", { action: "create", ...payload });
  }

  async function getMemberOrder() {
    ensureSignedIn();
    return requestFunction("member-order-v2", { action: "list" });
  }

  async function saveMemberOrder(memberIds = []) {
    ensureManager();
    return requestFunction("member-order-v2", { action: "save", memberIds });
  }

  async function getTodayMealOrder() {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "today_status"
    });
  }

  async function saveTodayMealOrder(payload = {}) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "save",
      items: Array.isArray(payload.items) ? payload.items : [],
      note: payload.note || ""
    });
  }

  async function getPersonalRecords(filters = {}) {
    ensureSignedIn();
    return requestFunction("personal-records-v2", filters);
  }

  async function getMealStatsReport(filters = {}) {
    return getMealReport(filters);
  }

  async function getAttendanceAdminRecords(filters = {}) {
    ensureSignedIn();
    return requestFunction("attendance-admin-list-v2", filters);
  }

  async function getAttendanceAdminHistory(recordId) {
    ensureSignedIn();
    return requestFunction("attendance-admin-action-v2", { action: "history", recordId });
  }

  async function saveAttendanceAdminRecord(record) {
    ensureSignedIn();
    return requestFunction("attendance-admin-action-v2", { action: "save", record });
  }

        async function cancelTodayMealOrder() {
    ensureSignedIn();
    return requestFunction("meal-cancel-v2", {});
  }

  async function getMealAdminSettings() {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "admin_settings"
    });
  }

  async function saveMealAdminSettings(payload = {}) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "save_admin_settings",
      products: Array.isArray(payload.products) ? payload.products : [],
      dailyCutoffTime: payload.dailyCutoffTime || "10:30",
      companySubsidy: Number(payload.companySubsidy)
    });
  }

  async function deleteMealProduct(productId) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "delete_admin_product",
      productId: String(productId || "")
    });
  }

  async function getMealReport(filters = {}) {
    ensureSignedIn();
    return requestFunction("meal-report-v2", filters);
  }

  async function fetchRowsById(table) {
    const rows = table === "set_employee"
      ? await getEmployeeAdminDirectoryRows()
      : table === "set_departments"
        ? await getDepartmentDirectoryRows()
        : await restSelect(table, {
          select: "*",
          auth: Boolean(currentSession?.access_token)
        });
    return new Map((rows || [])
      .filter((row) => row.id)
      .map((row) => [row.id, row]));
  }

  async function fetchRowById(table, id) {
    const rowId = String(id || "").trim();
    if (!rowId) {
      return null;
    }
    if (table === "set_employee") {
      return (await getEmployeeAdminDirectoryRows()).find((row) => row.id === rowId) || null;
    }
    if (table === "set_departments") {
      return (await getDepartmentDirectoryRows()).find((row) => row.id === rowId) || null;
    }
    const rows = await restSelect(table, {
      select: "*",
      filters: {
        id: `eq.${rowId}`
      },
      limit: "1",
      auth: true
    });
    return rows?.[0] || null;
  }

  function assertProfileCanLogin(profile) {
    const today = taipeiDateString();
    const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
    if ((profile.hire_date && today < profile.hire_date) || (effectiveEndDate && today > effectiveEndDate)) {
      throw new Error("此帳號目前不在有效期間，無法登入");
    }
  }

  function getRemovedRowIds(rowMap, keptRowIds) {
    const keptIds = new Set((keptRowIds || []).map((value) => String(value || "").trim()).filter(Boolean));
    return [...rowMap.entries()]
      .filter(([rowId, row]) => rowId && !keptIds.has(rowId) && row?.id)
      .map(([, row]) => row.id);
  }

  function isLegacyRequestCatalogRow(row) {
    return String(row?.id || "").startsWith("catalog:");
  }

  async function deleteRowsByForeignIds(table, column, ids) {
    const values = [...new Set((ids || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!values.length) {
      return;
    }
    await restDelete(table, {
      [column]: buildInFilter(values)
    }, {
      auth: true
    });
  }

  async function clearScheduleEntriesByForeignIds(column, ids, payload) {
    const values = [...new Set((ids || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!values.length) {
      return;
    }
    await restUpdate("schedule_entries", {
      [column]: buildInFilter(values)
    }, payload, {
      auth: true,
      prefer: "return=minimal"
    });
  }

  function mapDepartmentRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.id,
        name: row.name || "",
        startDate: row.start_date || "",
        endDate: row.end_date || "",
        hiddenFromSchedule: Boolean(row.hidden_from_schedule),
        address: row.address || "",
        latitude: row.latitude ?? "",
        longitude: row.longitude ?? "",
        publicIp: hasAdminAccess(currentProfile?.role) ? row.public_ip || "" : "",
        attendanceEnabled: Boolean(row.attendance_enabled)
      }));
  }

  function mapDepartmentWriteRow(department, sortOrder) {
    return {
      id: department.id,
      name: department.name || department.id,
      start_date: nullableDate(department.startDate),
      end_date: nullableDate(department.endDate),
      hidden_from_schedule: Boolean(department.hiddenFromSchedule),
      sort_order: sortOrder
    };
  }

  async function saveDepartmentAttendanceSettings(departments) {
    if (!hasAdminAccess(currentProfile?.role)) {
      return;
    }
    await restRpc("save_department_attendance_fields_bulk", {
      settings: (departments || []).map((department) => ({
        department_id: department.id,
        address: department.address || "",
        latitude: department.latitude === "" || department.latitude === null || department.latitude === undefined ? null : Number(department.latitude),
        longitude: department.longitude === "" || department.longitude === null || department.longitude === undefined ? null : Number(department.longitude),
        attendance_enabled: Boolean(department.attendanceEnabled),
        public_ip: department.publicIp || ""
      }))
    }, {
      auth: true,
      prefer: "return=minimal"
    });
  }

  async function saveDepartmentGeneralSettings(departments) {
    ensureManager();
    await restRpc("save_departments_general_v2", {
      p_departments: (departments || []).map((department, index) => ({
        ...mapDepartmentWriteRow(department, Number.isInteger(department.sortOrder) ? department.sortOrder : index)
      }))
    }, {
      auth: true,
      prefer: "return=minimal"
    });
  }

  async function loadScheduleExportRows(startDate, endDate) {
    ensureManager();
    const normalizedStart = nullableDate(startDate);
    const normalizedEnd = nullableDate(endDate);
    if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
      throw new Error("匯出日期範圍不正確");
    }
    return await restRpc("get_schedule_export_rows_v2", {
      p_start_date: normalizedStart,
      p_end_date: normalizedEnd
    }, { auth: true }) || [];
  }

  function mapShiftRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.id,
        name: row.name || "",
        color: row.color || "#378ADD",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        startTime: (row.start_time || "").slice(0, 5),
        endTime: (row.end_time || "").slice(0, 5),
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
        requiredStaffCount: Math.max(0, Number(row.required_staff_count) || 0),
        applicableDeptId: row.applicable_department_id || "",
        positionRequirements: []
      }));
  }

  function mapLeaveRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .filter((row) => !isLegacyRequestCatalogRow(row))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.code || "").localeCompare(String(b.code || "")))
      .map((row) => ({
        id: row.id,
        code: row.code || "",
        name: row.name || "",
        color: row.color || "#888780",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
        requiresTime: Boolean(row.requires_time),
        requiresReason: Boolean(row.requires_reason)
      }));
  }

  function mapOvertimeRows(rows = []) {
    return (rows || [])
      .filter((row) => row.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")))
      .map((row) => ({
        id: row.id,
        name: row.name || "加班",
        color: row.color || "#D85A30",
        textColor: row.text_color || "",
        autoTextColor: row.auto_text_color !== false,
        hiddenFromToolbar: Boolean(row.hidden_from_toolbar),
        startTime: (row.start_time || "").slice(0, 5),
        endTime: (row.end_time || "").slice(0, 5),
        useRest1: Boolean(row.use_rest_1),
        rest1StartTime: (row.rest_1_start_time || "").slice(0, 5),
        rest1EndTime: (row.rest_1_end_time || "").slice(0, 5),
        useRest2: Boolean(row.use_rest_2),
        rest2StartTime: (row.rest_2_start_time || "").slice(0, 5),
        rest2EndTime: (row.rest_2_end_time || "").slice(0, 5)
      }));
  }

  function mapHolidayRows(rows = []) {
    return (rows || [])
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.holiday_date || "").localeCompare(String(b.holiday_date || "")))
      .map((row) => ({
        id: row.id,
        date: row.holiday_date || "",
        name: row.name || ""
      }));
  }

  function mapMemberDirectoryRows(profileRows = []) {
    return (profileRows || []).map((row) => {
      const fallbackDeptId = row.home_department_id || "";
      const scheduleShiftIds = normalizeTextArray(row.schedule_shift_ids)
        .filter((value, index, list) => value && list.indexOf(value) === index);
      return {
        id: row.id,
        code: row.employee_code || "",
        name: row.full_name || "",
        deptId: fallbackDeptId,
        scheduleShiftIds,
        positionId: "",
        proxyMemberId: "",
        hireDate: row.hire_date || "",
        leaveDate: row.leave_date || "",
        payByDay: Boolean(row.pay_by_day),
        fixedRestWeekday: clampInteger(row.fixed_rest_weekday, 0, 6, 0),
        monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),
        role: normalizeRole(row.role)
      };
    });
  }

  async function loadEmployeeAdminDirectory() {
    ensureManager();
    return mapMemberDirectoryRows(await getEmployeeAdminDirectoryRows());
  }

  function applyMemberOrder(members, orderedIds) {
    const list = Array.isArray(members) ? members : [];
    const ids = Array.isArray(orderedIds) ? orderedIds.map(String).filter(Boolean) : [];
    if (!ids.length) return list;
    const byId = new Map(list.map((member) => [String(member.id || ""), member]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const orderedSet = new Set(ids);
    return [...ordered, ...list.filter((member) => !orderedSet.has(String(member.id || "")))];
  }

  async function loadState() {
    const auth = Boolean(currentSession?.access_token);
    try {
      const [
        settingsRows,
        departmentRows,
        profileRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows
      ] = await Promise.all([
        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),
        getDepartmentDirectoryRows(),
        getScheduleDirectoryRows(),
        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })
      ]);

      const settings = settingsRows?.[0] || {};
      const scheduleRange = getScheduleLoadRange(settings);
      const scheduleEntryRows = await restSelect("schedule_entries", {
        select: "*",
        filters: getScheduleEntryFilters(scheduleRange),
        order: "work_date.asc",
        auth
      });

      let departments = mapDepartmentRows(departmentRows);
      if (currentProfile?.role === "admin") {
        const result = await requestFunction("department-attendance-v2", {});
        const byDepartment = new Map((result.settings || []).map((row) => [row.departmentId, row]));
        departments = departments.map((department) => {
          const attendance = byDepartment.get(department.id);
          return attendance ? {
            ...department,
            address: attendance.address || "",
            latitude: attendance.latitude ?? "",
            longitude: attendance.longitude ?? "",
            publicIp: attendance.publicIp || "",
            attendanceEnabled: Boolean(attendance.attendanceEnabled)
          } : department;
        });
      }

      let members = mapMemberDirectoryRows(profileRows);
      if (currentSession?.access_token) {
        try {
          const result = await requestFunction("member-order-v2", { action: "list" });
          members = applyMemberOrder(members, result.memberIds);
        } catch {
          // Keep database sort order until member-order-v2 is available.
        }
      }
      const schedule = mapScheduleRows(scheduleEntryRows, members);

      return {
        year: Number(settings.current_year) || new Date().getFullYear(),
        month: clampInteger(settings.current_month, 0, 11, new Date().getMonth()),
        selected: { type: null, id: null },
        deptFilter: settings.dept_filter || "all",
        tableView: settings.table_view === "shift" ? "shift" : "member",
        tableDeptScopeFilter: settings.table_dept_scope_filter || "all",
        tableStatsVisible: settings.table_stats_visible !== false,
        scheduleStartDate: settings.schedule_start_date || "",
        departments,
        members,
        shifts: mapShiftRows(shiftRows),
        leaves: mapLeaveRows(leaveRows),
        overtime: mapOvertimeRows(overtimeRows),
        holidays: mapHolidayRows(holidayRows),
        rules: {
          weekStart: clampInteger(settings.week_start, 0, 6, 0),
          monthStartDay: clampInteger(settings.month_start_day, 1, 31, 1),
          eightWeekStartDate: settings.eight_week_start_date || ""
        },
        schedule,
        scheduleLoadedRanges: [scheduleRange]
      };
    } catch (error) {
      if (!currentSession?.access_token && /permission denied|42501|401|403/i.test(error.message || "")) {
        throw new Error("未登入時無法讀取正式班表，請檢查正規化資料表的匿名讀取權限");
      }
      throw error;
    }
  }

  async function syncLeaveAndOvertimeCatalogs(state) {
    const leaveItems = (state.leaves || []).filter((item) => item?.id && item?.code && !String(item.id).startsWith("catalog:"));
    if (leaveItems.length) {
      await restInsert("set_leave", leaveItems.map((item, index) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.requiresTime),
        requires_reason: Boolean(item.requiresReason),
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }

    const overtimeItems = (state.overtime || []).filter((item) => item?.id && item?.name);
    if (overtimeItems.length) {
      await restInsert("set_overtime", overtimeItems.map((item, index) => ({
        id: item.id,
        name: item.name,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        start_time: nullableTime(item.startTime),
        end_time: nullableTime(item.endTime),
        use_rest_1: Boolean(item.useRest1),
        rest_1_start_time: item.useRest1 ? nullableTime(item.rest1StartTime) : null,
        rest_1_end_time: item.useRest1 ? nullableTime(item.rest1EndTime) : null,
        use_rest_2: Boolean(item.useRest2),
        rest_2_start_time: item.useRest2 ? nullableTime(item.rest2StartTime) : null,
        rest_2_end_time: item.useRest2 ? nullableTime(item.rest2EndTime) : null,
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
  }

  async function syncMemberProfile(member, previousEmployeeCode = "") {
    ensureManager();
    return requestFunction("member-auth-admin", {
      action: "upsert_member",
      member: {
        employeeCode: String(member?.code || "").trim(),
        fullName: member?.name || "",
        role: normalizeRole(member?.role),
        hireDate: member?.hireDate || null,
        leaveDate: member?.leaveDate || null,
        payByDay: Boolean(member?.payByDay),
        fixedRestWeekday: clampInteger(member?.fixedRestWeekday, 0, 6, 0),
        homeDepartmentId: member?.deptId || "",
        scheduleShiftIds: Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [],
        monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0)
      },
      previousEmployeeCode: String(previousEmployeeCode || "").trim(),
      defaultPassword: "0000"
    });
  }

  async function resetMemberPassword(employeeCode) {
    ensureManager();
    return requestFunction("member-auth-admin", {
      action: "reset_password",
      employeeCode: String(employeeCode || "").trim(),
      password: "0000"
    });
  }

  async function deleteMemberProfile(employeeCode, currentPassword = "") {
    ensureManager();
    return requestFunction("member-delete-v2", {
      employeeCode: String(employeeCode || "").trim(),
      currentPassword: String(currentPassword || "")
    });
  }

  async function ensureMemberProfiles(state) {
    const members = Array.isArray(state.members) ? state.members.filter((member) => member?.code && member?.name) : [];
    if (!members.length) {
      return new Map();
    }
    let rows = await getEmployeeAdminDirectoryRows();
    const requestedCodes = new Set(members.map((member) => member.code));
    const existingCodes = new Set((rows || []).map((row) => row.employee_code).filter(Boolean));
    for (const member of members) {
      if (!existingCodes.has(member.code)) {
        await syncMemberProfile(member, member.code);
      }
    }
    rows = await getEmployeeAdminDirectoryRows();
    return new Map((rows || [])
      .filter((row) => requestedCodes.has(row.employee_code))
      .map((row) => [row.employee_code, row]));
  }

  async function loadScheduleEntries(range = {}) {
    const startDate = toDateObject(range.startDate) ? range.startDate : "";
    const endDate = toDateObject(range.endDate) ? range.endDate : "";
    if (!startDate || !endDate) {
      throw new Error("schedule range is required");
    }
    const auth = Boolean(currentSession?.access_token);
    const rows = await restSelect("schedule_entries", {
      select: "*",
      filters: getScheduleEntryFilters({ startDate, endDate }),
      order: "work_date.asc",
      auth
    });
    const members = Array.isArray(range.members) ? range.members : [];
    return {
      schedule: mapScheduleRows(rows, members),
      scheduleLoadedRanges: [{ startDate, endDate }]
    };
  }

  async function saveState(state) {
    ensureManager();
    const departments = Array.isArray(state.departments) ? state.departments : [];
    const shifts = Array.isArray(state.shifts) ? state.shifts : [];
    const leaves = Array.isArray(state.leaves) ? state.leaves : [];
    const overtime = Array.isArray(state.overtime) ? state.overtime : [];
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    if (departments.length) {
      await saveDepartmentGeneralSettings(departments.map((department, index) => ({ ...department, sortOrder: index })));
      await saveDepartmentAttendanceSettings(departments);
    }
    const departmentMap = await fetchRowsById("set_departments");

    if (leaves.length) {
      await restInsert("set_leave", leaves.map((item, index) => ({
        id: item.id,
        code: item.code || item.id,
        name: item.name || item.code || item.id,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.requiresTime),
        requires_reason: Boolean(item.requiresReason),
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    const keptLeaveIds = leaves.map((item) => item.id).filter((id) => !String(id).startsWith("catalog:"));
    const existingLeaveMap = await fetchRowsById("set_leave");
    const removedLeaveRowIds = getRemovedRowIds(existingLeaveMap, keptLeaveIds);
    await clearScheduleEntriesByForeignIds("leave_type_id", removedLeaveRowIds, {
      leave_type_id: null,
      leave_all_day: true,
      leave_start_time: null,
      leave_end_time: null,
      leave_reason: null
    });
    await deleteRowsNotIn("set_leave", keptLeaveIds);
    const leaveMap = await fetchRowsById("set_leave");

    if (overtime.length) {
      await restInsert("set_overtime", overtime.map((item, index) => ({
        id: item.id,
        name: item.name || "加班",
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        start_time: nullableTime(item.startTime),
        end_time: nullableTime(item.endTime),
        use_rest_1: Boolean(item.useRest1),
        rest_1_start_time: item.useRest1 ? nullableTime(item.rest1StartTime) : null,
        rest_1_end_time: item.useRest1 ? nullableTime(item.rest1EndTime) : null,
        use_rest_2: Boolean(item.useRest2),
        rest_2_start_time: item.useRest2 ? nullableTime(item.rest2StartTime) : null,
        rest_2_end_time: item.useRest2 ? nullableTime(item.rest2EndTime) : null,
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    const keptOvertimeIds = overtime.map((item) => item.id);
    const existingOvertimeMap = await fetchRowsById("set_overtime");
    const removedOvertimeRowIds = getRemovedRowIds(existingOvertimeMap, keptOvertimeIds);
    await clearScheduleEntriesByForeignIds("overtime_type_id", removedOvertimeRowIds, {
      overtime_type_id: null,
      overtime_start_time: null,
      overtime_end_time: null,
      overtime_use_rest_1: false,
      overtime_rest_1_start_time: null,
      overtime_rest_1_end_time: null,
      overtime_use_rest_2: false,
      overtime_rest_2_start_time: null,
      overtime_rest_2_end_time: null,
      overtime_reason: null
    });
    await deleteRowsNotIn("set_overtime", keptOvertimeIds);
    const overtimeMap = await fetchRowsById("set_overtime");

    if (shifts.length) {
      await restInsert("set_shift", shifts.map((shift, index) => ({
        id: shift.id,
        name: shift.name || shift.id,
        applicable_department_id: departmentMap.has(shift.applicableDeptId) ? shift.applicableDeptId : null,
        color: shift.color || null,
        text_color: shift.textColor || null,
        auto_text_color: shift.autoTextColor !== false,
        hidden_from_toolbar: Boolean(shift.hiddenFromToolbar),
        start_time: nullableTime(shift.startTime),
        end_time: nullableTime(shift.endTime),
        required_staff_count: Math.max(0, Number(shift.requiredStaffCount) || 0),
        sort_order: index
      })), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteRowsNotIn("set_shift", shifts.map((shift) => shift.id));
    const shiftMap = await fetchRowsById("set_shift");
    const shiftIds = new Set(shifts.map((shift) => shift.id));

    if (holidays.length) {
      await restInsert("holidays", holidays
        .filter((holiday) => nullableDate(holiday.date))
        .map((holiday, index) => ({
          id: holiday.id,
          holiday_date: nullableDate(holiday.date),
          name: holiday.name || "假日",
          sort_order: index
        })), {
        auth: true,
        onConflict: "holiday_date",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    }
    await deleteRowsNotIn("holidays", holidays.map((holiday) => holiday.id));

    const profileMap = await ensureMemberProfiles(state);
    for (const member of state.members || []) {
      const profile = profileMap.get(member.code);
      if (!profile?.id) {
        continue;
      }
      const scheduleShiftIds = (Array.isArray(member.scheduleShiftIds) ? member.scheduleShiftIds : [])
        .filter((shiftId, index, list) => shiftIds.has(shiftId) && list.indexOf(shiftId) === index);
      const homeDeptId = member.deptId || "";
      await restUpdate("set_employee", {
        id: `eq.${profile.id}`
      }, {
        employee_code: member.code,
        full_name: member.name,
        role: normalizeRole(member.role),
        hire_date: nullableDate(member.hireDate),
        leave_date: nullableDate(member.leaveDate),
        pay_by_day: Boolean(member.payByDay),
        fixed_rest_weekday: clampInteger(member.fixedRestWeekday, 0, 6, 0),
        monthly_rest_days: clampInteger(member.monthlyRestDays, 0, 31, 0),
        home_department_id: departmentMap.get(homeDeptId)?.id || null,
        schedule_shift_ids: scheduleShiftIds,
      }, {
        auth: true,
        prefer: "return=minimal"
      });
    }

    await restInsert("scheduler_settings", [{
      id: documentId,
      current_year: Number(state.year) || new Date().getFullYear(),
      current_month: clampInteger(state.month, 0, 11, new Date().getMonth()),
      dept_filter: state.deptFilter || "all",
      table_view: state.tableView === "shift" ? "shift" : "member",
      table_dept_scope_filter: state.tableDeptScopeFilter || "all",
      table_stats_visible: state.tableStatsVisible !== false,
      schedule_start_date: nullableDate(state.scheduleStartDate),
      week_start: clampInteger(state.rules?.weekStart, 0, 6, 0),
      month_start_day: clampInteger(state.rules?.monthStartDay, 1, 31, 1),
      eight_week_start_date: nullableDate(state.rules?.eightWeekStartDate),
      updated_at: new Date().toISOString()
    }], {
      auth: true,
      onConflict: "id",
      prefer: "resolution=merge-duplicates,return=minimal"
    });

    const scheduleEntries = [];
    Object.entries(state.schedule || {}).forEach(([key, slot]) => {
      const parsed = parseScheduleKey(key);
      if (!parsed || !slot) {
        return;
      }
      const member = (state.members || []).find((item) => item.id === parsed.memberId);
      const profile = member ? profileMap.get(member.code) : null;
      if (!profile?.id) {
        return;
      }
      scheduleEntries.push({ parsed, slot, profile });
    });
    const scheduleRows = scheduleEntries.map(({ parsed, slot, profile }) => {
      return {
        member_id: profile.id,
        work_date: parsed.workDate,
        shift_type_id: shiftMap.get(slot.shift)?.id || null,
        leave_type_id: leaveMap.get(slot.leave)?.id || null,
        leave_all_day: slot.leaveMeta?.allDay !== false,
        leave_start_time: slot.leaveMeta?.allDay === false ? nullableTime(slot.leaveMeta?.startTime) : null,
        leave_end_time: slot.leaveMeta?.allDay === false ? nullableTime(slot.leaveMeta?.endTime) : null,
        leave_reason: slot.leaveMeta?.reason || null,
        overtime_type_id: overtimeMap.get(slot.overtime)?.id || null,
        overtime_start_time: nullableTime(slot.overtimeMeta?.startTime),
        overtime_end_time: nullableTime(slot.overtimeMeta?.endTime),
        overtime_use_rest_1: Boolean(slot.overtimeMeta?.useRest1),
        overtime_rest_1_start_time: slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,
        overtime_rest_1_end_time: slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,
        overtime_use_rest_2: Boolean(slot.overtimeMeta?.useRest2),
        overtime_rest_2_start_time: slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,
        overtime_rest_2_end_time: slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,
        overtime_reason: slot.overtimeMeta?.reason || null
      };
    }).filter((row) => row && (row.shift_type_id || row.leave_type_id || row.overtime_type_id));
    const savedScheduleKeys = new Set(scheduleRows.map((row) => makeScheduleEntryKey(row.member_id, row.work_date)));
    const existingScheduleRows = await fetchExistingScheduleRowsForRanges(state.scheduleLoadedRanges);
    const obsoleteScheduleRows = (existingScheduleRows || [])
      .filter((row) => row?.id && !savedScheduleKeys.has(makeScheduleEntryKey(row.member_id, row.work_date)))
      .map((row) => ({
        member_id: row.member_id,
        work_date: row.work_date,
        delete_entry: true
      }));
    await saveScheduleEntryRows([...scheduleRows, ...obsoleteScheduleRows]);

    await syncLeaveAndOvertimeCatalogs(state);
    return { ok: true, savedAt: new Date().toISOString() };
  }

  async function syncCatalogs(state) {
    ensureManager();
    await syncLeaveAndOvertimeCatalogs(state);
  }

  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureManager();
    await saveDepartmentGeneralSettings([{ ...department, sortOrder }]);
    await saveDepartmentAttendanceSettings([department]);
    return { ok: true };
  }

  async function deleteDepartmentItem(departmentId) {
    ensureManager();
    await restRpc("delete_department_general_v2", {
      p_department_id: String(departmentId || "").trim()
    }, {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }

  async function saveShiftItem(shift, sortOrder = 0) {
    ensureManager();
    await restInsert("set_shift", [{
      id: shift.id,
      name: shift.name || shift.id,
      applicable_department_id: shift.applicableDeptId || null,
      color: shift.color || null,
      text_color: shift.textColor || null,
      auto_text_color: shift.autoTextColor !== false,
      hidden_from_toolbar: Boolean(shift.hiddenFromToolbar),
      start_time: nullableTime(shift.startTime),
      end_time: nullableTime(shift.endTime),
      required_staff_count: Math.max(0, Number(shift.requiredStaffCount) || 0),
      sort_order: sortOrder
    }], {
      auth: true,
      onConflict: "id",
      prefer: "resolution=merge-duplicates,return=minimal"
    });
    return { ok: true };
  }

  async function saveCatalogItem(category, item, sortOrder = 0) {
    ensureManager();
    if (category === "leave") {
      await restInsert("set_leave", [{
        id: item.id,
        code: item.code || item.id,
        name: item.name || item.code || item.id,
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        requires_time: Boolean(item.requiresTime),
        requires_reason: Boolean(item.requiresReason),
        sort_order: sortOrder
      }], {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      return { ok: true };
    }
    if (category === "overtime") {
      await restInsert("set_overtime", [{
        id: item.id,
        name: item.name || "加班",
        color: item.color || null,
        text_color: item.textColor || null,
        auto_text_color: item.autoTextColor !== false,
        hidden_from_toolbar: Boolean(item.hiddenFromToolbar),
        start_time: nullableTime(item.startTime),
        end_time: nullableTime(item.endTime),
        use_rest_1: Boolean(item.useRest1),
        rest_1_start_time: item.useRest1 ? nullableTime(item.rest1StartTime) : null,
        rest_1_end_time: item.useRest1 ? nullableTime(item.rest1EndTime) : null,
        use_rest_2: Boolean(item.useRest2),
        rest_2_start_time: item.useRest2 ? nullableTime(item.rest2StartTime) : null,
        rest_2_end_time: item.useRest2 ? nullableTime(item.rest2EndTime) : null,
        sort_order: sortOrder
      }], {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      return { ok: true };
    }
    throw new Error(`不支援的設定類型：${category}`);
  }

  async function deleteCatalogItem(category, itemId) {
    ensureManager();
    return requestFunction("catalog-admin", {
      action: "delete",
      category: String(category || ""),
      itemId: String(itemId || "")
    });
  }

  async function resolveManagerMemberProfileId(memberId, memberCode) {
    const normalizedMemberId = String(memberId || "").trim();
    if (isUuid(normalizedMemberId)) {
      return normalizedMemberId;
    }
    const normalizedMemberCode = String(memberCode || "").trim();
    if (!normalizedMemberCode) {
      throw new Error("找不到人員工號");
    }
    const profile = (await getEmployeeAdminDirectoryRows())
      .find((row) => String(row.employee_code || "").trim() === normalizedMemberCode);
    if (!profile?.id) {
      throw new Error(`找不到對應的人員資料：${normalizedMemberCode}`);
    }
    return profile.id;
  }

  async function pruneEmptyScheduleEntry(rowOrId) {
    const rowId = typeof rowOrId === "string" ? rowOrId : rowOrId?.id;
    if (!rowId) {
      return;
    }
    const rows = typeof rowOrId === "string"
      ? await restSelect("schedule_entries", {
        select: "id,shift_type_id,leave_type_id,overtime_type_id",
        filters: { id: `eq.${rowId}` },
        limit: "1",
        auth: true
      })
      : [rowOrId];
    const row = rows?.[0];
    if (row && !row.shift_type_id && !row.leave_type_id && !row.overtime_type_id) {
      await restDelete("schedule_entries", { id: `eq.${row.id}` }, { auth: true });
    }
  }

  async function saveScheduleEntryRows(rows) {
    const entries = (Array.isArray(rows) ? rows : [])
      .filter((row) => row?.member_id && row?.work_date);
    if (!entries.length) {
      return [];
    }
    return await restRpc("save_schedule_entries_bulk", { entries }, { auth: true }) || [];
  }

  async function saveScheduleCells(payloads) {
    ensureManager();
    const rowCache = new Map();
    const resolveCatalogRow = async (table, id) => {
      const rowId = String(id || "").trim();
      if (!rowId) {
        return null;
      }
      const cacheKey = `${table}:${rowId}`;
      if (!rowCache.has(cacheKey)) {
        rowCache.set(cacheKey, fetchRowById(table, rowId));
      }
      return await rowCache.get(cacheKey);
    };
    const rows = [];
    for (const payload of Array.isArray(payloads) ? payloads : []) {
      const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
      const workDate = nullableDate(payload.dateString || payload.workDate);
      if (!profileMemberId || !workDate) {
        throw new Error("schedule cell member and date are required");
      }
      const slot = payload.slot || {};
      const [shiftType, leaveType, overtimeType] = await Promise.all([
        resolveCatalogRow("set_shift", slot.shift),
        resolveCatalogRow("set_leave", slot.leave),
        resolveCatalogRow("set_overtime", slot.overtime)
      ]);
      if (!shiftType?.id && !leaveType?.id && !overtimeType?.id) {
        rows.push({
          member_id: profileMemberId,
          work_date: workDate,
          delete_entry: true
        });
        continue;
      }
      const leaveAllDay = slot.leaveMeta?.allDay !== false;
      rows.push({
        member_id: profileMemberId,
        work_date: workDate,
        shift_type_id: shiftType?.id || null,
        leave_type_id: leaveType?.id || null,
        leave_all_day: leaveAllDay,
        leave_start_time: leaveType?.id && !leaveAllDay ? nullableTime(slot.leaveMeta?.startTime) : null,
        leave_end_time: leaveType?.id && !leaveAllDay ? nullableTime(slot.leaveMeta?.endTime) : null,
        leave_reason: leaveType?.id ? slot.leaveMeta?.reason || null : null,
        overtime_type_id: overtimeType?.id || null,
        overtime_start_time: overtimeType?.id ? nullableTime(slot.overtimeMeta?.startTime) : null,
        overtime_end_time: overtimeType?.id ? nullableTime(slot.overtimeMeta?.endTime) : null,
        overtime_use_rest_1: overtimeType?.id ? Boolean(slot.overtimeMeta?.useRest1) : false,
        overtime_rest_1_start_time: overtimeType?.id && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,
        overtime_rest_1_end_time: overtimeType?.id && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,
        overtime_use_rest_2: overtimeType?.id ? Boolean(slot.overtimeMeta?.useRest2) : false,
        overtime_rest_2_start_time: overtimeType?.id && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,
        overtime_rest_2_end_time: overtimeType?.id && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,
        overtime_reason: overtimeType?.id ? slot.overtimeMeta?.reason || null : null
      });
    }
    const savedRows = await saveScheduleEntryRows(rows);
    return { ok: true, rows: savedRows };
  }

  async function saveScheduleCell(payload) {
    const result = await saveScheduleCells([payload]);
    return { ok: true, row: result.rows?.[0] || null };
  }

  async function exportSapCsv(payload) {
    if (!exporter.getSapLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = new Blob(
      [exporter.buildSapLeaveCsvContent(payload)],
      { type: "text/csv;charset=utf-8" }
    );
    const fileName = makeFileName("sap請假", payload, "csv");
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportOvertime(payload) {
    if (!exporter.getOvertimeExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload));
    const fileName = makeFileName("匯出加班", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportLeave(payload) {
    if (!exporter.getLeaveExportRows(payload).length) {
      return { canceled: true, empty: true };
    }
    const blob = await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload));
    const fileName = makeFileName("匯出請假", payload, "xlsx");
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  function compactMealExportDate(value) {
    return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
  }

  function buildMealEmployeeRows(report, details) {
    const companySubsidy = Number(report.companySubsidy || 55);
    const employees = new Map();
    details.forEach((row) => {
      const key = String(row.employeeId || row.employeeCode || row.employeeName || "");
      if (!key) return;
      const current = employees.get(key) || {
        employeeName: row.employeeName || "",
        employeeCode: row.employeeCode || "",
        dates: new Set(),
        amount: 0
      };
      const quantity = Number(row.quantity || 0);
      const amount = Number(row.amount ?? (quantity * Number(row.unitPrice || 0))) || 0;
      if (quantity > 0 && row.date) current.dates.add(row.date);
      current.amount += amount;
      if (!current.employeeName && row.employeeName) current.employeeName = row.employeeName;
      if (!current.employeeCode && row.employeeCode) current.employeeCode = row.employeeCode;
      employees.set(key, current);
    });
    return [...employees.values()].map((row) => {
      const mealDays = row.dates.size;
      return {
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        lunchAmount: row.amount - mealDays * companySubsidy,
        lunchCount: mealDays
      };
    }).sort((a, b) => (
      String(a.employeeName).localeCompare(String(b.employeeName), "zh-Hant")
      || String(a.employeeCode).localeCompare(String(b.employeeCode))
    ));
  }

  function styleMealExportSheet(sheet) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
    sheet.columns = Array.from({ length: 10 }, (_, index) => ({ width: index === 0 ? 18 : index === 1 ? 16 : 14 }));
    sheet.getColumn(2).numFmt = "@";
    sheet.getColumn(10).numFmt = "@";
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
  }

  async function exportMealReport(report = {}) {
    const details = Array.isArray(report.exportDetails)
      ? report.exportDetails
      : Array.isArray(report.details)
        ? report.details
        : [];
    if (!details.length) return { canceled: true, empty: true };
    const rows = buildMealEmployeeRows(report, details);
    if (!rows.length) return { canceled: true, empty: true };
    const reportDate = compactMealExportDate(report.toDate);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("訂餐統計");
    sheet.addRow(["員工姓名", "員工編號", "早餐金額", "午餐金額", "晚餐金額", "早餐份數", "午餐份數", "晚餐份數", "總計", "日期"]);
    rows.forEach((row) => {
      sheet.addRow([row.employeeName, row.employeeCode, "", row.lunchAmount, "", "", row.lunchCount, "", "", reportDate]);
    });
    styleMealExportSheet(sheet);
    const blob = await exporter.workbookToBlob(workbook);
    const fileName = `訂餐統計_${compactMealExportDate(report.fromDate)}-${reportDate}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function exportMembers(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createMemberWorkbook(payload));
    const fileName = "人員資料.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importMembers() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, rows: [] };
    }
    return {
      canceled: false,
      rows: await exporter.parseMemberWorkbook(await file.arrayBuffer())
    };
  }

  async function exportDepartments(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createDepartmentWorkbook(payload));
    const fileName = "單位設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importDepartments() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, rows: [] };
    }
    return {
      canceled: false,
      rows: await exporter.parseDepartmentWorkbook(await file.arrayBuffer())
    };
  }

  async function exportShifts(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createShiftWorkbook(payload));
    const fileName = "班別設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importShifts() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, rows: [] };
    }
    return {
      canceled: false,
      rows: await exporter.parseShiftWorkbook(await file.arrayBuffer())
    };
  }

  async function exportLeaveSettings(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createLeaveSettingsWorkbook(payload));
    const fileName = "假別設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importLeaveSettings() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, result: null };
    }
    return {
      canceled: false,
      result: await exporter.parseLeaveSettingsWorkbook(await file.arrayBuffer())
    };
  }

  async function exportOvertimeSettings(payload) {
    const blob = await exporter.workbookToBlob(await exporter.createOvertimeSettingsWorkbook(payload));
    const fileName = "加班設定.xlsx";
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }

  async function importOvertimeSettings() {
    const file = await pickFile(".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (!file) {
      return { canceled: true, result: null };
    }
    return {
      canceled: false,
      result: await exporter.parseOvertimeSettingsWorkbook(await file.arrayBuffer())
    };
  }

  window.schedulerApi = {
    initializeAuth,
    getAuthContext: () => ({ session: currentSession, profile: currentProfile }),
    signIn,
    signOut,
    changePassword,
    getTodayAttendance,
    clockAttendance,
    getEmployeeOvertimeDates,
    getAttendanceOvertimeForDate,
    getTodayAttendanceOvertime,
    submitAttendanceOvertime,
    deleteAttendanceOvertime,
    getTodayMealOrder,
    saveTodayMealOrder,
    getPersonalRecords,
    getMealStatsReport,
    getAttendanceAdminRecords,
    getAttendanceAdminHistory,
    saveAttendanceAdminRecord,
    getOvertimeReviewList,
    getApprovedOvertimeExportRows,
    reviewOvertimeRequest,
    createAdminOvertimeRequest,
    getMemberOrder,
    saveMemberOrder,
    getMealAdminSettings,
    saveMealAdminSettings,
    deleteMealProduct,
    getMealReport,
    cancelTodayMealOrder,
    deleteMemberProfile,
    loadState,
    loadEmployeeAdminDirectory,
    loadScheduleEntries,
    loadScheduleExportRows,
    saveState,
    syncCatalogs,
    saveDepartmentItem,
    deleteDepartmentItem,
    saveShiftItem,
    saveCatalogItem,
    deleteCatalogItem,
    saveScheduleCells,
    saveScheduleCell,
    syncMemberProfile,
    resetMemberPassword,
    exportSapCsv,
    exportOvertime,
    exportLeave,
    exportMealReport,
    exportMembers,
    importMembers,
    exportDepartments,
    importDepartments,
    exportShifts,
    importShifts,
    exportLeaveSettings,
    importLeaveSettings,
    exportOvertimeSettings,
    importOvertimeSettings,
    getAppInfo: async () => ({
      databasePath: `Supabase / normalized scheduler tables / ${documentId}`,
      backend: "supabase-static",
      updatedAt: null
    }),
    showMessage: async (_title, message) => {
      window.alert(message);
    },
    confirmAction: async (_title, message) => window.confirm(message)
  };
})();
;

/* ===== renderer-foundation.js ===== */
/* 排班主程式共用常數與初始狀態工廠
 * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。
 */

const COLORS = [
  { hex: "#378ADD", label: "藍色" },
  { hex: "#185FA5", label: "深藍" },
  { hex: "#23395B", label: "海軍藍" },
  { hex: "#355070", label: "鋼藍" },
  { hex: "#1D9E75", label: "綠色" },
  { hex: "#2F6F4F", label: "墨綠" },
  { hex: "#2A9D8F", label: "青綠" },
  { hex: "#3A5A40", label: "森林綠" },
  { hex: "#E24B4A", label: "紅色" },
  { hex: "#9C2F2F", label: "深紅" },
  { hex: "#A44A3F", label: "磚紅" },
  { hex: "#D85A30", label: "橘紅" },
  { hex: "#EF9F27", label: "橙色" },
  { hex: "#C46B2D", label: "土橘" },
  { hex: "#BA7517", label: "琥珀" },
  { hex: "#639922", label: "草綠" },
  { hex: "#7F77DD", label: "紫色" },
  { hex: "#5B4B8A", label: "深紫" },
  { hex: "#8F3B76", label: "莓紫" },
  { hex: "#6D597A", label: "灰紫" },
  { hex: "#D4537E", label: "粉紅" },
  { hex: "#5DCAA5", label: "薄荷" },
  { hex: "#888780", label: "石灰" }
];

const LEAVE_CATALOG = [
  { code: "0010", name: "事假" },
  { code: "0011", name: "病假" },
  { code: "0012", name: "婚假" },
  { code: "0013", name: "喪假" },
  { code: "0014", name: "公假" },
  { code: "0015", name: "公傷假" },
  { code: "0016", name: "產假" },
  { code: "0017", name: "特休假" },
  { code: "0018", name: "陪產(檢)假" },
  { code: "0019", name: "補休假" },
  { code: "0020", name: "產檢假" },
  { code: "0022", name: "無薪病假(時)" },
  { code: "0023", name: "彈性假" },
  { code: "0024", name: "特准半薪病假" },
  { code: "0026", name: "家庭照顧假" },
  { code: "0027", name: "半薪生理假" },
  { code: "0028", name: "全薪流產假" },
  { code: "0029", name: "半薪流產假" },
  { code: "0031", name: "無薪病假(天)" },
  { code: "0033", name: "特准事假" },
  { code: "0034", name: "刷卡遲到" },
  { code: "0035", name: "刷卡早退" },
  { code: "0036", name: "例假" },
  { code: "0038", name: "公傷假(天)" },
  { code: "0039", name: "曠職" },
  { code: "0040", name: "教育訓練假" },
  { code: "0041", name: "颱風豪雨假" },
  { code: "0042", name: "選舉假" },
  { code: "0043", name: "國定假日假" },
  { code: "0044", name: "颱風豪雨假(不扣薪)" },
  { code: "0045", name: "內部會議假" },
  { code: "0046", name: "原住民祭儀假" },
  { code: "0047", name: "休息日" },
  { code: "0048", name: "無薪生理假" },
  { code: "0049", name: "防疫假(有薪)" },
  { code: "0050", name: "防疫假(無薪)" },
  { code: "0051", name: "特別補休假" },
  { code: "0052", name: "遲到/早退(SK)" },
  { code: "0053", name: "婚假(天)(SK)" },
  { code: "0054", name: "公傷假(半薪)(時)(SK)" },
  { code: "0090", name: "系統使用的假" },
  { code: "0091", name: "家庭照顧假(扣事假用)" },
  { code: "0092", name: "半薪生理假(扣病假用)" }
];

const LEGACY_LEAVE_NAME_MAP = {
  "特休": "0017",
  "病假": "0011",
  "事假": "0010",
  "例假": "0036",
  "休假": "0047"
};

const DEFAULT_STATE = {
  role: "manager",
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selected: { type: null, id: null },
  deptFilter: "all",
  tableView: "member",
  tableDeptScopeFilter: "all",
  tableStatsVisible: true,
  scheduleStartDate: "",
  departments: [],
  positions: [],
  members: [],
  shifts: [],
  leaves: [],
  overtime: [],
  holidays: [],
  rules: {
    maxConsecutiveWorkDays: 6,
    weekStart: 0,
    monthStartDay: 1,
    eightWeekStartDate: ""
  },
  schedule: {},
  scheduleLoadedRanges: []
};

const ROLE_OPTIONS = [
  { value: "admin", label: "管理員" },
  { value: "manager", label: "主管" },
  { value: "employee", label: "員工" }
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
const WEEK_START_OPTIONS = [
  { value: 0, label: "星期日" },
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" }
];
const REST_WEEKDAY_OPTIONS = [
  { value: 1, label: "週一" },
  { value: 2, label: "週二" },
  { value: 3, label: "週三" },
  { value: 4, label: "週四" },
  { value: 5, label: "週五" },
  { value: 6, label: "週六" },
  { value: 0, label: "週日" }
];

const SCHEDULE_HISTORY_LIMIT = 20;

function createAttendanceState() {
  return { loading: false, saving: false, record: null, serverDate: "", error: "" };
}

function createAttendanceOvertimeState() {
  return { loading: false, expanded: false, status: null, error: "" };
}

function createMealOrderState() {
  return { loading: false, status: null, error: "" };
}

function resetLoadedUserRuntimeState() {
  currentMember = null;
  attendanceState = createAttendanceState();
  attendanceOvertimeState = createAttendanceOvertimeState();
  mealOrderState = createMealOrderState();
  recordsState = createRecordsState();
  appInfo = null;
}

function createRecordsState() {
  const today = getTodayDateString();
  return {
    loading: false,
    activeTab: "personal",
    personal: [],
    mealStats: null,
    mealFilters: { fromDate: today, toDate: today, departmentId: "", memberId: "" },
    overtimeReview: { loading: false, requests: [], members: [], filters: { status: "pending", fromDate: addDaysToDateString(today, -30), toDate: today }, error: "" },
    attendanceAdmin: { loading: false, rows: [], members: [], issueTypes: [], total: 0, page: 1, filters: { fromDate: today, toDate: today, memberId: "", abnormalOnly: true, issueType: "" }, error: "" },
    mealAdmin: { loading: false, products: [], settings: { daily_cutoff_time: "10:30" }, error: "" },
    error: ""
  };
}
;

/* ===== renderer-settings-navigation.js ===== */
/* 設定彈窗捲動位置與返回狀態
 * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。
 */

function getSettingsScrollElement(selector = "") {
  if (selector) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  const candidates = [
    ".department-settings-modal .modal-body",
    ".member-settings-modal .member-table-scroll",
    ".catalog-settings-modal .settings-table-scroll",
    ".member-settings-modal .member-table-wrap",
    ".catalog-settings-modal .settings-table-wrap",
    ".settings-table-scroll",
    ".member-table-scroll",
    ".settings-table-wrap",
    ".member-table-wrap",
    ".modal-body"
  ];
  return candidates
    .map((candidate) => document.querySelector(candidate))
    .find((element) => element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1)
    || candidates.map((candidate) => document.querySelector(candidate)).find((element) => element instanceof HTMLElement)
    || null;
}

function captureSettingsReturnContext(fallback = null) {
  const scrollElement = getSettingsScrollElement();
  return {
    ...(fallback || {}),
    scrollSelector: scrollElement?.matches(".department-settings-modal .modal-body")
      ? ".department-settings-modal .modal-body"
      : scrollElement?.matches(".member-settings-modal .member-table-scroll")
        ? ".member-settings-modal .member-table-scroll"
        : scrollElement?.matches(".catalog-settings-modal .settings-table-scroll")
          ? ".catalog-settings-modal .settings-table-scroll"
          : "",
    scrollTop: scrollElement?.scrollTop || 0
  };
}

function restoreSettingsScroll(context) {
  if (!context || !Number.isFinite(Number(context.scrollTop))) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollElement = getSettingsScrollElement(context.scrollSelector || "");
      if (scrollElement) {
        scrollElement.scrollTop = Number(context.scrollTop) || 0;
      }
    });
  });
}


async function reopenSettingsModalPreservingScroll(context) {
  if (!context?.category) {
    return false;
  }
  if (context.category === "department-settings") {
    await openDepartmentSettings();
  } else if (context.category === "member-settings") {
    await openMemberSettings();
  } else if (context.category === "list-settings" && context.listCategory) {
    openListSettings(context.listCategory);
  } else {
    return false;
  }
  restoreSettingsScroll(context);
  return true;
}
;

/* ===== renderer-schedule-layout.js ===== */
/* 班表固定表頭與欄寬版面計算
 * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。
 */

function renderStickyTableHeader(dates) {
  const container = document.getElementById("tableStickyHeaderDays");
  const stickyHeader = document.getElementById("tableStickyHeader");
  if (!container || !stickyHeader) {
    return;
  }
  renderStickyHeaderTitleCells();
  const today = getTodayDateString();
  const cells = [];
  dates.forEach((dateString, index) => {
    const date = toDateObject(dateString);
    if (!date) {
      return;
    }
    const day = date.getDate();
    const weekday = date.getDay();
    const cls = weekday === 0 ? "sun" : weekday === 6 ? "sat" : "";
    const weekStripeClass = getWeekStripeClassForDate(dateString);
    const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, index, dates.length);
    cells.push(
      `<div class="table-sticky-cell table-sticky-cell-day ${cls} ${weekStripeClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-schedule-column="${index}" data-date="${dateString}">${date.getMonth() + 1}/${day}<span>${WEEKDAY_LABELS[weekday]}</span></div>`
    );
  });
  container.innerHTML = cells.join("");
  requestAnimationFrame(() => {
    syncStickyHeaderLayout();
    syncStickyHeaderScroll();
  });
}

function renderStickyHeaderTitleCells() {
  const deptCell = document.querySelector(".table-sticky-cell-dept");
  const personCell = document.querySelector(".table-sticky-cell-person");
  const statsCell = document.querySelector(".table-sticky-cell-stats");
  if (!deptCell || !personCell) {
    return;
  }
  const renderCell = (label, dataAttr = "") => `
    <div class="table-sticky-cell-title">
      <span class="table-sticky-cell-label">${label}</span>
      ${isManager() && dataAttr ? renderActionIconButton("edit", `${dataAttr}=\"true\"`, "table-header-settings-btn") : ""}
    </div>
  `;
  if (state.tableView === "shift") {
    deptCell.innerHTML = renderCell("班別");
    personCell.innerHTML = renderCell("需求人數");
    if (statsCell) {
      statsCell.innerHTML = "";
      statsCell.hidden = true;
    }
    return;
  }
  deptCell.innerHTML = renderCell("單位", "data-open-department-settings");
  personCell.innerHTML = renderCell("人員", "data-open-member-settings");
  if (statsCell) {
    statsCell.innerHTML = renderCell("統計");
    statsCell.hidden = !state.tableStatsVisible;
  }
}

function syncStickyHeaderLayout() {
  const deptCell = document.querySelector(".table-sticky-cell-dept");
  const personCell = document.querySelector(".table-sticky-cell-person");
  const statsCell = document.querySelector(".table-sticky-cell-stats");
  const prevWeekButton = document.getElementById("tablePrevWeekButton");
  const dayCells = Array.from(document.querySelectorAll(".table-sticky-cell-day"));
  const rootStyle = getComputedStyle(document.documentElement);
  const deptWidth = parseFloat(rootStyle.getPropertyValue("--dept-col-width")) || 72;
  const personWidth = parseFloat(rootStyle.getPropertyValue("--person-col-width")) || 92;
  const statsWidth = parseFloat(rootStyle.getPropertyValue("--stats-col-width")) || 86;
  const dayWidth = parseFloat(rootStyle.getPropertyValue("--day-col-width")) || 44;
  if (!deptCell || !personCell) {
    return;
  }

  const setWidth = (element, width) => {
    const px = `${Math.round(width)}px`;
    element.style.width = px;
    element.style.minWidth = px;
    element.style.maxWidth = px;
  };

  setWidth(deptCell, deptWidth);
  setWidth(personCell, personWidth);
  if (statsCell) {
    if (state.tableView === "member" && state.tableStatsVisible) {
      statsCell.hidden = false;
      setWidth(statsCell, statsWidth);
    } else {
      statsCell.hidden = true;
      setWidth(statsCell, 0);
    }
  }
  if (prevWeekButton) {
    const frozenWidth = deptWidth + personWidth + (state.tableView === "member" && state.tableStatsVisible ? statsWidth : 0);
    prevWeekButton.style.left = `${Math.round(frozenWidth)}px`;
    document.documentElement.style.setProperty("--schedule-frozen-width", `${Math.round(frozenWidth)}px`);
  }
  dayCells.forEach((cell) => setWidth(cell, dayWidth));
  const topScrollbarContent = document.getElementById("tableTopScrollbarContent");
  if (topScrollbarContent) {
    topScrollbarContent.style.width = `${Math.round(dayCells.length * dayWidth)}px`;
  }
}

function syncStickyHeaderScroll() {
  const tableWrap = document.getElementById("tableWrap");
  const container = document.getElementById("tableStickyHeaderDays");
  if (!tableWrap || !container) {
    return;
  }
  container.style.marginLeft = `${-tableWrap.scrollLeft}px`;
  const topScrollbar = document.getElementById("tableTopScrollbar");
  if (topScrollbar && topScrollbar.scrollLeft !== tableWrap.scrollLeft) {
    topScrollbar.scrollLeft = tableWrap.scrollLeft;
  }
}

function scrollScheduleHorizontallyFromTopScrollbar(event) {
  const tableWrap = document.getElementById("tableWrap");
  const topScrollbar = event.target;
  if (!tableWrap || !(topScrollbar instanceof HTMLElement)) {
    return;
  }
  tableWrap.scrollLeft = topScrollbar.scrollLeft;
  syncStickyHeaderScroll();
}

function scrollScheduleHorizontallyFromHeader(event) {
  const tableWrap = document.getElementById("tableWrap");
  if (!tableWrap) {
    return;
  }
  if (!event.deltaY && !event.deltaX) {
    return;
  }
  event.preventDefault();
  tableWrap.scrollLeft += event.deltaX || event.deltaY;
  syncStickyHeaderScroll();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultState() {
  return deepClone(DEFAULT_STATE);
}

function createEmptyState() {
  const empty = createDefaultState();
  empty.departments = [];
  empty.members = [];
  empty.shifts = [];
  empty.leaves = [];
  empty.overtime = [];
  empty.holidays = [];
  empty.schedule = {};
  empty.selected = { type: null, id: null };
  empty.deptFilter = "all";
  empty.tableView = "member";
  empty.tableDeptScopeFilter = "all";
  empty.scheduleStartDate = "";
  return empty;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid(_prefix) {
  return crypto.randomUUID();
}

function getMeasureTextContext() {
  if (!measureTextContext) {
    measureTextContext = document.createElement("canvas").getContext("2d");
  }
  return measureTextContext;
}

function measureTextWidth(text, computedStyle) {
  const context = getMeasureTextContext();
  if (!context) {
    return String(text || "").length * 16;
  }
  context.font = [
    computedStyle.fontStyle,
    computedStyle.fontVariant,
    computedStyle.fontWeight,
    computedStyle.fontSize,
    computedStyle.fontFamily
  ].filter(Boolean).join(" ");
  return context.measureText(String(text || "")).width;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function syncScheduleColumnWidths() {
  const root = document.documentElement;
  const deptSample = document.querySelector(".dept-col");
  const personSample = document.querySelector(".person-col .member-main") || document.querySelector(".person-col");
  const tableWrap = document.getElementById("tableWrap");
  if (!root || !deptSample || !personSample) {
    return;
  }

  const deptStyle = getComputedStyle(deptSample);
  const personStyle = getComputedStyle(personSample);
  const headerStyle = getComputedStyle(document.querySelector(".table-sticky-cell") || deptSample);
  const managerButtonAllowance = isManager() && state.tableView !== "shift" ? 28 : 0;
  let deptWidth = 72;
  let personWidth = 92;
  const statsWidth = state.tableView === "member" && state.tableStatsVisible ? 86 : 0;
  if (state.tableView === "shift") {
    const visibleShifts = getVisibleShiftRows();
    const shiftContentWidth = visibleShifts.reduce((max, shift) => Math.max(max, measureTextWidth(shift.name, deptStyle)), 0);
    const demandValues = visibleShifts.map((shift) => String(shift.requiredStaffCount ?? 0));
    const demandContentWidth = demandValues.reduce((max, text) => Math.max(max, measureTextWidth(text, personStyle)), 0);
    const shiftHeaderWidth = measureTextWidth("班別", headerStyle);
    const demandHeaderWidth = measureTextWidth("需求人數", headerStyle);
    deptWidth = clamp(Math.ceil(Math.max(shiftContentWidth, shiftHeaderWidth) + 18), 64, 118);
    personWidth = clamp(Math.ceil(Math.max(demandContentWidth, demandHeaderWidth) + 18), 74, 104);
  } else {
    const visibleGroups = getVisibleTableGroups();
    const visibleDepartments = visibleGroups.map(({ department }) => department.name);
    const visibleMembers = visibleGroups.flatMap(({ members }) => (
      members.map((member) => `${member.name || ""}${member.payByDay ? "PT" : ""}`)
    ));
    const deptContentWidth = visibleDepartments.reduce((max, text) => Math.max(max, measureTextWidth(text, deptStyle)), 0);
    const personContentWidth = visibleMembers.reduce((max, text) => Math.max(max, measureTextWidth(text, personStyle)), 0);
    const deptHeaderWidth = measureTextWidth("單位", headerStyle) + managerButtonAllowance;
    const personHeaderWidth = measureTextWidth("人員", headerStyle) + managerButtonAllowance;
    deptWidth = clamp(Math.ceil(Math.max(deptContentWidth, deptHeaderWidth) + 18), 52, 88);
    personWidth = Math.max(Math.ceil(Math.max(personContentWidth, personHeaderWidth) + 18), 64);
  }
  const days = getVisibleDates().length;
  const availableDayWidth = tableWrap
    ? Math.floor((tableWrap.clientWidth - deptWidth - personWidth - statsWidth - 2) / Math.max(days, 1))
    : 0;
  const dayWidth = clamp(availableDayWidth || 44, 44, 56);
  root.style.setProperty("--dept-col-width", `${deptWidth}px`);
  root.style.setProperty("--person-col-width", `${personWidth}px`);
  root.style.setProperty("--stats-col-width", `${statsWidth}px`);
  root.style.setProperty("--day-col-width", `${dayWidth}px`);
}
;

/* ===== renderer-date-utils.js ===== */
/* 班表日期、週期、時間與區間工具。
 * 由正式 bundle 依宣告順序載入。
 */

function scheduleKey(memberId, year, month, day) {
  return `${memberId}_${year}_${month}_${day}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function weekdayOf(day) {
  return new Date(state.year, state.month, day).getDay();
}

function getConfiguredWeekStart() {
  const value = Number(state.rules?.weekStart);
  return Number.isInteger(value) && value >= 0 && value <= 6 ? value : 0;
}

function getWeekIndexForDay(day) {
  const offset = (weekdayOf(1) - getConfiguredWeekStart() + 7) % 7;
  return Math.floor((day + offset - 1) / 7);
}

function getWeekStripeClass(day) {
  return getWeekIndexForDay(day) % 2 === 1 ? "week-alt" : "";
}

function getWeekIndexForDate(dateString) {
  const dates = getVisibleDates();
  const index = dates.indexOf(dateString);
  const firstDate = toDateObject(dates[0]);
  if (index < 0 || !firstDate) {
    return 0;
  }
  const offset = (firstDate.getDay() - getConfiguredWeekStart() + 7) % 7;
  return Math.floor((index + offset) / 7);
}

function getWeekStripeClassForDate(dateString) {
  return getWeekIndexForDate(dateString) % 2 === 1 ? "week-alt" : "";
}

function getWeekBoundaryClass(day, daysInCurrentMonth) {
  const classes = [];
  const weekday = weekdayOf(day);
  const weekStart = getConfiguredWeekStart();
  const weekEnd = (weekStart + 6) % 7;
  if (weekday === weekStart && day !== 1) {
    classes.push("week-boundary-start");
  }
  if (weekday === weekEnd && day !== daysInCurrentMonth) {
    classes.push("week-boundary-end");
  }
  return classes.join(" ");
}

function getWeekBoundaryClassForDate(dateString, index, totalDays) {
  const classes = [];
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  const weekday = date.getDay();
  const weekStart = getConfiguredWeekStart();
  const weekEnd = (weekStart + 6) % 7;
  if (weekday === weekStart && index !== 0) {
    classes.push("week-boundary-start");
  }
  if (weekday === weekEnd && index !== totalDays - 1) {
    classes.push("week-boundary-end");
  }
  return classes.join(" ");
}

function toDateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toDateStringFromDate(date) {
  return toDateString(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayDateString() {
  return toDateStringFromDate(new Date());
}

function addDaysToDateString(dateString, count) {
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  date.setDate(date.getDate() + count);
  return toDateStringFromDate(date);
}

function diffDays(startDateString, endDateString) {
  const start = toDateObject(startDateString);
  const end = toDateObject(endDateString);
  if (!start || !end) {
    return 0;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / dayMs);
}

function getConfiguredEightWeekAnchorDate() {
  return toDateObject(state.rules?.eightWeekStartDate) ? state.rules.eightWeekStartDate : getTodayDateString();
}

function getEightWeekCycleStartForDate(dateString) {
  const anchorDate = getConfiguredEightWeekAnchorDate();
  const offset = diffDays(anchorDate, dateString);
  const periodLength = 56;
  const periods = Math.floor(offset / periodLength);
  return addDaysToDateString(anchorDate, periods * periodLength) || dateString;
}

function syncVisibleDatePartsFromStart() {
  const start = toDateObject(state.scheduleStartDate);
  if (!start) {
    return;
  }
  state.year = start.getFullYear();
  state.month = start.getMonth();
}

function resetScheduleWindowToToday() {
  const today = getTodayDateString();
  if (!toDateObject(state.rules?.eightWeekStartDate)) {
    state.rules.eightWeekStartDate = today;
  }
  state.scheduleStartDate = getEightWeekCycleStartForDate(today);
  state.tableView = "member";
  state.tableDeptScopeFilter = "all";
  syncVisibleDatePartsFromStart();
}

function getVisibleDates() {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  return enumerateDateRange(startDate, addDaysToDateString(startDate, 55));
}

function getVisibleDateRange() {
  const dates = getVisibleDates();
  return {
    startDate: dates[0] || getTodayDateString(),
    endDate: dates[dates.length - 1] || getTodayDateString()
  };
}

function getBufferedVisibleDateRange() {
  const range = getVisibleDateRange();
  // 7-day buffer matches the current 6-day consecutive-work ceiling; widen if compliance rules look farther.
  return {
    startDate: addDaysToDateString(range.startDate, -7),
    endDate: addDaysToDateString(range.endDate, 7)
  };
}

function normalizeScheduleLoadedRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .map((range) => ({
      startDate: toDateObject(range?.startDate) ? range.startDate : "",
      endDate: toDateObject(range?.endDate) ? range.endDate : ""
    }))
    .filter((range) => range.startDate && range.endDate && range.startDate <= range.endDate);
}

function isScheduleRangeLoaded(range) {
  return normalizeScheduleLoadedRanges(state.scheduleLoadedRanges)
    .some((loaded) => loaded.startDate <= range.startDate && loaded.endDate >= range.endDate);
}

function rememberScheduleLoadedRange(range) {
  state.scheduleLoadedRanges = [
    ...normalizeScheduleLoadedRanges(state.scheduleLoadedRanges),
    range
  ];
}

async function ensureVisibleScheduleLoaded() {
  const range = getBufferedVisibleDateRange();
  if (isScheduleRangeLoaded(range)) {
    return;
  }
  const payload = await window.schedulerApi.loadScheduleEntries({
    ...range,
    members: state.members.map((member) => ({ id: member.id }))
  });
  state.schedule = cleanupScheduleEntries({
    ...state.schedule,
    ...(payload.schedule || {})
  }, state);
  rememberScheduleLoadedRange(range);
}

function getScheduleKeyForDateString(memberId, dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  return scheduleKey(memberId, date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeScheduleDateInput(value) {
  if (typeof value === "string" && toDateObject(value)) {
    return value;
  }
  return toDateString(state.year, state.month, Number(value) || 1);
}

function isMemberCurrentlyActive(member) {
  const today = new Date();
  const todayString = toDateString(today.getFullYear(), today.getMonth(), today.getDate());
  if (member.hireDate && member.hireDate > todayString) {
    return false;
  }
  return !member.leaveDate || member.leaveDate >= todayString;
}

function toDateObject(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function enumerateDateRange(startDate, endDate) {
  const start = toDateObject(startDate);
  const end = toDateObject(endDate);
  if (!start || !end || start > end) {
    return [];
  }
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateString(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isMemberActiveOnDateString(member, dateString) {
  if (!dateString) {
    return false;
  }
  if (member.hireDate && dateString < member.hireDate) {
    return false;
  }
  if (member.leaveDate && dateString > member.leaveDate) {
    return false;
  }
  return true;
}

function normalizeTimeText(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return "";
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) {
    return null;
  }
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidTimeRange(start, end) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
}

function isValidDateRange(start, end) {
  return Boolean(start && end && start < end);
}

function isValidDateTimeRange(startDate, startTime, endDate, endTime) {
  const normalizedStartTime = normalizeTimeText(startTime);
  const normalizedEndTime = normalizeTimeText(endTime);
  if (!startDate || !endDate || !normalizedStartTime || !normalizedEndTime) {
    return false;
  }
  return `${startDate}T${normalizedStartTime}` < `${endDate}T${normalizedEndTime}`;
}
;

/* ===== renderer-ui-helpers.js ===== */
/* 共用訊息、操作確認與時間輸入元件工具
 * 由 renderer.js 第二階段拆分；維持既有全域 bundle 執行方式。
 */

function reportValidationError(message) {
  setSaveStatus(message);
  if (window.schedulerApi?.showMessage) {
    window.schedulerApi.showMessage("提示", message);
    return;
  }
  window.alert(message);
}

function syncCoreActionsMenu() {
  const menu = document.getElementById("coreActionsMenu");
  const toggle = document.getElementById("coreActionsToggle");
  if (!menu || !toggle) {
    return;
  }
  menu.classList.toggle("open", coreActionsOpen);
  menu.setAttribute("aria-hidden", coreActionsOpen ? "false" : "true");
  toggle.setAttribute("aria-expanded", coreActionsOpen ? "true" : "false");
}

function toggleCoreActionsMenu(force) {
  coreActionsOpen = typeof force === "boolean" ? force : !coreActionsOpen;
  syncCoreActionsMenu();
}

function closeCoreActionsMenu() {
  if (!coreActionsOpen) {
    return;
  }
  coreActionsOpen = false;
  syncCoreActionsMenu();
}

function showInfoMessage(message) {
  if (window.schedulerApi?.showMessage) {
    window.schedulerApi.showMessage("提示", message);
    return;
  }
  window.alert(message);
}

function formatSchedulerError(error, fallback = "操作失敗") {
  const message = String(error?.message || error || "").trim();
  if (
    message.includes("Could not find the 'overtime_end_time' column of 'schedule_entries'") ||
    message.includes("Could not find the 'overtime_start_time' column of 'schedule_entries'")
  ) {
    return "加班資料庫尚未套用新版欄位，請先確認 supabase/001_current_schema.sql 與 002_current_updates.sql 已套用。";
  }
  return message || fallback;
}

async function confirmAction(message) {
  if (window.schedulerApi?.confirmAction) {
    return window.schedulerApi.confirmAction("確認", message);
  }
  return window.confirm(message);
}

function buildTimeOptions(selectedValue, values) {
  const options = ['<option value=""></option>'];
  values.forEach((value) => {
    options.push(`<option value="${value}" ${value === selectedValue ? "selected" : ""}>${value}</option>`);
  });
  return options.join("");
}

function splitTimeValue(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) {
    return ["", ""];
  }
  return normalized.split(":");
}

function timeInputMarkup(id, value, disabled = false) {
  const [hour, minute] = splitTimeValue(value);
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = ["00", "10", "20", "30", "40", "50"];
  return `
    <div class="time-picker" data-time-field="${id}">
      <select id="${id}Hour" ${disabled ? "disabled" : ""}>
        ${buildTimeOptions(hour, hours)}
      </select>
      <span class="time-picker-separator">:</span>
      <select id="${id}Minute" ${disabled ? "disabled" : ""}>
        ${buildTimeOptions(minute, minutes)}
      </select>
    </div>
  `;
}

function readTimeInputValue(id) {
  const hour = document.getElementById(`${id}Hour`)?.value || "";
  const minute = document.getElementById(`${id}Minute`)?.value || "";
  if (!hour || !minute) {
    return "";
  }
  return normalizeTimeText(`${hour}:${minute}`);
}

function setTimeInputDisabled(id, disabled) {
  const hourInput = document.getElementById(`${id}Hour`);
  const minuteInput = document.getElementById(`${id}Minute`);
  if (hourInput) {
    hourInput.disabled = disabled;
  }
  if (minuteInput) {
    minuteInput.disabled = disabled;
  }
}
;

/* ===== renderer-visibility.js ===== */
/* 人員與單位任職、營運及班表顯示區間判定
 * 由 renderer.js 第二階段拆分；維持既有全域 bundle 執行方式。
 */

function isMemberActiveOnDate(member, year, month, day) {
  const date = toDateString(year, month, day);
  if (member.hireDate && date < member.hireDate) {
    return false;
  }
  if (member.leaveDate && date > member.leaveDate) {
    return false;
  }
  return true;
}

function doesDateRangeOverlapMonth(startDate, endDate, year, month) {
  const monthStart = toDateString(year, month, 1);
  const monthEnd = toDateString(year, month, daysInMonth(year, month));
  if (startDate && startDate > monthEnd) {
    return false;
  }
  if (endDate && endDate < monthStart) {
    return false;
  }
  return true;
}

function isDepartmentActiveInMonth(department, year, month) {
  return doesDateRangeOverlapMonth(department?.startDate || "", department?.endDate || "", year, month);
}

function isMemberActiveInMonth(member, year, month) {
  return doesDateRangeOverlapMonth(member?.hireDate || "", member?.leaveDate || "", year, month);
}

function doesDateRangeOverlapRange(startDate, endDate, rangeStart, rangeEnd) {
  if (startDate && startDate > rangeEnd) {
    return false;
  }
  if (endDate && endDate < rangeStart) {
    return false;
  }
  return true;
}

function isDepartmentActiveInVisibleRange(department) {
  const { startDate, endDate } = getVisibleDateRange();
  return doesDateRangeOverlapRange(department?.startDate || "", department?.endDate || "", startDate, endDate);
}

function isDepartmentVisibleInSchedule(department) {
  return Boolean(department) && !department.hiddenFromSchedule;
}

function isDepartmentVisibleInScheduleRange(department) {
  return isDepartmentVisibleInSchedule(department) && isDepartmentActiveInVisibleRange(department);
}

function isDepartmentOperatingOnDate(department, dateString) {
  if (!department || !dateString) {
    return false;
  }
  if (department.startDate && dateString < department.startDate) {
    return false;
  }
  if (department.endDate && dateString > department.endDate) {
    return false;
  }
  return true;
}

function isMemberActiveInVisibleRange(member) {
  const { startDate, endDate } = getVisibleDateRange();
  return doesDateRangeOverlapRange(member?.hireDate || "", member?.leaveDate || "", startDate, endDate);
}
;

/* ===== renderer-state-normalization.js ===== */
/* 排班狀態清理、目錄正規化與顏色工具
 * 由 renderer.js 第二階段拆分；維持既有全域 bundle 執行方式。
 */

function textColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2b241c" : "#ffffff";
}

function autoLeaveTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000000" : "#ffffff";
}

function sanitizeDepartment(department, fallbackIndex) {
  return {
    id: department?.id || uid(`d${fallbackIndex}`),
    name: department?.name || `單位 ${fallbackIndex + 1}`,
    startDate: department?.startDate || "",
    endDate: department?.endDate || "",
    hiddenFromSchedule: Boolean(department?.hiddenFromSchedule),
    address: department?.address || "",
    latitude: department?.latitude ?? "",
    longitude: department?.longitude ?? "",
    publicIp: department?.publicIp || "",
    attendanceEnabled: Boolean(department?.attendanceEnabled)
  };
}

function sanitizePosition(position, fallbackIndex) {
  return {
    id: position?.id || uid(`p${fallbackIndex}`),
    code: position?.code || `P${String(fallbackIndex + 1).padStart(2, "0")}`,
    name: position?.name || `職位 ${fallbackIndex + 1}`
  };
}

function normalizeScheduleShiftIds(member, shifts) {
  const validShiftIds = new Set((shifts || []).map((shift) => shift.id));
  const ids = Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [];
  return ids
    .map((shiftId) => String(shiftId || ""))
    .filter((shiftId, index, list) => validShiftIds.has(shiftId) && list.indexOf(shiftId) === index);
}

function sanitizeMember(member, fallbackIndex, merged) {
  const validDeptIds = new Set(merged.departments.map((department) => department.id));
  const deptId = member?.deptId && validDeptIds.has(member.deptId)
    ? member.deptId
    : merged.departments[0]?.id || "";
  return {
    id: member?.id || uid(`m${fallbackIndex}`),
    code: member?.code || "",
    name: member?.name || `人員 ${fallbackIndex + 1}`,
    deptId,
    scheduleShiftIds: normalizeScheduleShiftIds(member, merged.shifts),
    positionId: member?.positionId && merged.positions.some((position) => position.id === member.positionId)
      ? member.positionId
      : merged.positions[0]?.id || "",
    proxyMemberId: member?.proxyMemberId || "",
    hireDate: member?.hireDate || "",
    leaveDate: member?.leaveDate || "",
    payByDay: Boolean(member?.payByDay),
    fixedRestWeekday: normalizeRestWeekday(member?.fixedRestWeekday),
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    role: normalizeRole(member?.role)
  };
}

function sanitizeShift(shift, fallbackIndex, merged) {
  const applicableDeptId = shift?.applicableDeptId && merged.departments.some((department) => department.id === shift.applicableDeptId)
    ? shift.applicableDeptId
    : merged.departments[0]?.id || "";
  const color = shift?.color || COLORS[fallbackIndex % COLORS.length].hex;
  const autoText = shift?.autoTextColor ?? !shift?.textColor;
    return {
      id: shift?.id || uid(`s${fallbackIndex}`),
      name: shift?.name || `班別 ${fallbackIndex + 1}`,
      color,
      textColor: shift?.textColor || autoLeaveTextColor(color),
      autoTextColor: Boolean(autoText),
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      hiddenFromToolbar: Boolean(shift?.hiddenFromToolbar),
      requiredStaffCount: Math.max(0, Number(shift?.requiredStaffCount) || 0),
      applicableDeptId,
      positionRequirements: Array.isArray(shift?.positionRequirements)
        ? shift.positionRequirements
        .filter((item) => item && item.positionId)
        .map((item) => ({ positionId: item.positionId, count: Math.max(0, Number(item.count) || 0) }))
      : []
  };
}

function sanitizeNamedColorItem(item, fallbackIndex, prefix, label) {
  return {
    id: item?.id || uid(`${prefix}${fallbackIndex}`),
    name: item?.name || `${label} ${fallbackIndex + 1}`,
    color: item?.color || COLORS[fallbackIndex % COLORS.length].hex
  };
}

function resolveLeaveCatalogEntry(item, fallbackIndex) {
  const requestedCode = item?.code || LEGACY_LEAVE_NAME_MAP[item?.name] || "";
  const byCode = LEAVE_CATALOG.find((entry) => entry.code === requestedCode);
  if (byCode) {
    return byCode;
  }
  const byName = LEAVE_CATALOG.find((entry) => entry.name === item?.name);
  if (byName) {
    return byName;
  }
  return LEAVE_CATALOG[fallbackIndex % LEAVE_CATALOG.length];
}

function sanitizeLeaveItem(item, fallbackIndex) {
  const catalogEntry = resolveLeaveCatalogEntry(item, fallbackIndex);
  const color = item?.color || COLORS[fallbackIndex % COLORS.length].hex;
  const autoText = item?.autoTextColor ?? !item?.textColor;
  return {
    id: item?.id || uid(`l${fallbackIndex}`),
    code: catalogEntry.code,
    name: item?.name || catalogEntry.name,
    color,
    textColor: item?.textColor || autoLeaveTextColor(color),
    autoTextColor: Boolean(autoText),
    hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),
    requiresTime: Boolean(item?.requiresTime),
    requiresReason: Boolean(item?.requiresReason)
  };
}

function sanitizeOvertimeItem(item, fallbackIndex) {
    const color = item?.color || COLORS[fallbackIndex % COLORS.length].hex;
    const autoText = item?.autoTextColor ?? !item?.textColor;
    return {
      id: item?.id || uid(`o${fallbackIndex}`),
      name: item?.name || "加班",
      color,
      textColor: item?.textColor || autoLeaveTextColor(color),
      autoTextColor: Boolean(autoText),
      hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),
      startTime: item?.startTime || "",
      endTime: item?.endTime || "",
      useRest1: Boolean(item?.useRest1),
      rest1StartTime: item?.rest1StartTime || "",
      rest1EndTime: item?.rest1EndTime || "",
      useRest2: Boolean(item?.useRest2),
      rest2StartTime: item?.rest2StartTime || "",
      rest2EndTime: item?.rest2EndTime || ""
    };
  }

function sanitizeHoliday(holiday, fallbackIndex) {
  return {
    id: holiday?.id || uid(`h${fallbackIndex}`),
    date: holiday?.date || "",
    name: holiday?.name || `國定假日 ${fallbackIndex + 1}`
  };
}

function cleanupScheduleEntries(schedule, merged) {
  const validShiftIds = new Set(merged.shifts.map((shift) => shift.id));
  const validLeaveIds = new Set(merged.leaves.map((leave) => leave.id));
  const validOvertimeIds = new Set(merged.overtime.map((item) => item.id));
  const fallbackOvertimeId = merged.overtime[0]?.id || null;
  const nextSchedule = {};

  Object.entries(schedule || {}).forEach(([key, slot]) => {
    const hasOvertimeMeta = slot?.overtimeMeta && typeof slot.overtimeMeta === "object";
    const overtimeId = validOvertimeIds.has(slot?.overtime)
      ? slot.overtime
      : hasOvertimeMeta
        ? fallbackOvertimeId
        : null;
    const nextSlot = {
      shift: validShiftIds.has(slot?.shift) ? slot.shift : null,
      leave: validLeaveIds.has(slot?.leave) ? slot.leave : null,
      overtime: overtimeId,
      leaveMeta: validLeaveIds.has(slot?.leave) && slot?.leaveMeta && typeof slot.leaveMeta === "object"
        ? {
          leaveCode: slot.leaveMeta.leaveCode || "",
          displayName: slot.leaveMeta.displayName || "",
          displayColor: slot.leaveMeta.displayColor || "",
          displayTextColor: slot.leaveMeta.displayTextColor || "",
          allDay: slot.leaveMeta.allDay !== false,
          startTime: slot.leaveMeta.allDay === false ? (slot.leaveMeta.startTime || "") : "",
          endTime: slot.leaveMeta.allDay === false ? (slot.leaveMeta.endTime || "") : "",
          reasonEnabled: Boolean(slot.leaveMeta.reasonEnabled),
          reason: slot.leaveMeta.reasonEnabled ? (slot.leaveMeta.reason || "") : ""
        }
        : null,
      overtimeMeta: overtimeId && hasOvertimeMeta
        ? {
          displayName: slot.overtimeMeta.displayName || "",
          displayColor: slot.overtimeMeta.displayColor || "",
          displayTextColor: slot.overtimeMeta.displayTextColor || "",
          startTime: slot.overtimeMeta.startTime || "",
          endTime: slot.overtimeMeta.endTime || "",
          useRest1: Boolean(slot.overtimeMeta.useRest1),
          rest1StartTime: slot.overtimeMeta.useRest1 ? (slot.overtimeMeta.rest1StartTime || "") : "",
          rest1EndTime: slot.overtimeMeta.useRest1 ? (slot.overtimeMeta.rest1EndTime || "") : "",
          useRest2: Boolean(slot.overtimeMeta.useRest2),
          rest2StartTime: slot.overtimeMeta.useRest2 ? (slot.overtimeMeta.rest2StartTime || "") : "",
          rest2EndTime: slot.overtimeMeta.useRest2 ? (slot.overtimeMeta.rest2EndTime || "") : "",
          reason: slot.overtimeMeta.reason || ""
        }
        : null
    };
    if (nextSlot.shift || nextSlot.leave || nextSlot.overtime) {
      nextSchedule[key] = nextSlot;
    }
  });

  return nextSchedule;
}

function normalizeState(payload) {
  if (!payload || typeof payload !== "object") {
    return createEmptyState();
  }

  const merged = createEmptyState();
  merged.role = "manager";
  merged.year = Number.isInteger(payload.year) ? payload.year : merged.year;
  merged.month = Number.isInteger(payload.month) ? payload.month : merged.month;
  merged.departments = Array.isArray(payload.departments)
    ? payload.departments.map((department, index) => sanitizeDepartment(department, index))
    : merged.departments;
  merged.positions = Array.isArray(payload.positions) && payload.positions.length
    ? payload.positions.map((position, index) => sanitizePosition(position, index))
    : merged.positions;
  merged.shifts = Array.isArray(payload.shifts)
    ? payload.shifts.map((shift, index) => sanitizeShift(shift, index, merged))
    : merged.shifts;
  merged.shifts = merged.shifts.filter((shift) => shift.name !== "休息");
  merged.members = Array.isArray(payload.members)
    ? payload.members.map((member, index) => sanitizeMember(member, index, merged))
    : merged.members;
  merged.leaves = Array.isArray(payload.leaves)
    ? payload.leaves.map((item, index) => sanitizeLeaveItem(item, index))
    : merged.leaves;
  merged.overtime = Array.isArray(payload.overtime)
    ? payload.overtime.map((item, index) => sanitizeOvertimeItem(item, index))
    : merged.overtime;
  merged.holidays = Array.isArray(payload.holidays)
    ? payload.holidays.map((holiday, index) => sanitizeHoliday(holiday, index)).filter((holiday) => holiday.date)
    : merged.holidays;
  merged.rules = {
    maxConsecutiveWorkDays: Math.max(1, Number(payload.rules?.maxConsecutiveWorkDays) || merged.rules.maxConsecutiveWorkDays),
    weekStart: Number.isInteger(Number(payload.rules?.weekStart)) ? Math.min(6, Math.max(0, Number(payload.rules?.weekStart))) : merged.rules.weekStart,
    monthStartDay: Number.isInteger(Number(payload.rules?.monthStartDay)) ? Math.min(31, Math.max(1, Number(payload.rules?.monthStartDay))) : merged.rules.monthStartDay,
    eightWeekStartDate: toDateObject(payload.rules?.eightWeekStartDate) ? payload.rules.eightWeekStartDate : merged.rules.eightWeekStartDate
  };
  merged.deptFilter = typeof payload.deptFilter === "string" ? payload.deptFilter : merged.deptFilter;
  merged.tableView = payload.tableView === "shift" ? "shift" : "member";
  merged.tableDeptScopeFilter = typeof payload.tableDeptScopeFilter === "string" ? payload.tableDeptScopeFilter : merged.tableDeptScopeFilter;
  merged.tableStatsVisible = payload.tableStatsVisible !== false;
  merged.scheduleStartDate = toDateObject(payload.scheduleStartDate) ? payload.scheduleStartDate : merged.scheduleStartDate;
  merged.schedule = cleanupScheduleEntries(payload.schedule && typeof payload.schedule === "object" ? payload.schedule : merged.schedule, merged);
  merged.scheduleLoadedRanges = normalizeScheduleLoadedRanges(payload.scheduleLoadedRanges);

  if (!merged.departments.some((department) => department.id === merged.deptFilter)) {
    merged.deptFilter = "all";
  }
  if (!merged.departments.some((department) => department.id === merged.tableDeptScopeFilter)) {
    merged.tableDeptScopeFilter = "all";
  }

  return merged;
}
;

/* ===== renderer-schedule-interaction.js ===== */
/* 班表儲存格選取、複製貼上、儲存與復原
 * 由 renderer.js 第三階段拆分；維持既有全域 bundle 執行方式。
 */

function getSlot(memberId, day) {
  const key = getScheduleKeyForDateString(memberId, normalizeScheduleDateInput(day));
  return key ? state.schedule[key] || null : null;
}

function getPreviewSlotByKey(key) {
  return autoSchedulePreview?.slots?.[key] || null;
}

function getDisplayedSlot(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  const key = getScheduleKeyForDateString(memberId, dateString);
  return key ? (getPreviewSlotByKey(key) || state.schedule[key] || null) : null;
}

function getScheduleCellFromEvent(event) {
  const target = event.target;
  const cell = target instanceof Element ? target.closest("#mainTable .cell") : null;
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  if (!canEditSchedule() || state.tableView !== "member" || state.selected.type || cell.dataset.readonly) {
    return null;
  }
  if (!cell.dataset.memberId || !cell.dataset.date) {
    return null;
  }
  return cell;
}

function getScheduleCellPoint(cell) {
  return {
    row: Number(cell.dataset.rowIndex),
    col: Number(cell.dataset.colIndex),
    memberId: cell.dataset.memberId || "",
    date: cell.dataset.date || ""
  };
}

function getSchedulePointByRowCol(row, col) {
  const cell = document.querySelector(`#mainTable .cell[data-row-index="${row}"][data-col-index="${col}"]`);
  return cell instanceof HTMLElement ? getScheduleCellPoint(cell) : null;
}

function getScheduleGridMaxRow() {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-row-index]"))
    .reduce((max, cell) => Math.max(max, Number(cell.dataset.rowIndex)), -1);
}

function getScheduleGridMaxCol() {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-col-index]"))
    .reduce((max, cell) => Math.max(max, Number(cell.dataset.colIndex)), -1);
}

function isValidScheduleCellPoint(point) {
  return point
    && Number.isInteger(point.row)
    && Number.isInteger(point.col)
    && point.memberId
    && toDateObject(point.date);
}

function getScheduleSelectionBounds() {
  if (!scheduleRangeSelection || !isValidScheduleCellPoint(scheduleRangeSelection.anchor) || !isValidScheduleCellPoint(scheduleRangeSelection.focus)) {
    return null;
  }
  return {
    rowMin: Math.min(scheduleRangeSelection.anchor.row, scheduleRangeSelection.focus.row),
    rowMax: Math.max(scheduleRangeSelection.anchor.row, scheduleRangeSelection.focus.row),
    colMin: Math.min(scheduleRangeSelection.anchor.col, scheduleRangeSelection.focus.col),
    colMax: Math.max(scheduleRangeSelection.anchor.col, scheduleRangeSelection.focus.col)
  };
}

function clearScheduleRangeSelection() {
  scheduleRangeSelection = null;
  document.querySelectorAll("#mainTable .cell.range-selected").forEach((cell) => {
    cell.classList.remove("range-selected", "range-anchor");
  });
}

function selectScheduleColumn(col, extend = false) {
  const maxRow = getScheduleGridMaxRow();
  if (maxRow < 0) {
    return false;
  }
  const anchorCol = extend && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)
    ? scheduleRangeSelection.anchor.col
    : col;
  const anchor = getSchedulePointByRowCol(0, anchorCol);
  const focus = getSchedulePointByRowCol(maxRow, col);
  if (!anchor || !focus) {
    return false;
  }
  setScheduleRangeSelection(anchor, focus);
  return true;
}

function selectScheduleRow(row, extend = false) {
  const maxCol = getScheduleGridMaxCol();
  if (maxCol < 0) {
    return false;
  }
  const anchorRow = extend && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)
    ? scheduleRangeSelection.anchor.row
    : row;
  const anchor = getSchedulePointByRowCol(anchorRow, 0);
  const focus = getSchedulePointByRowCol(row, maxCol);
  if (!anchor || !focus) {
    return false;
  }
  setScheduleRangeSelection(anchor, focus);
  return true;
}

function syncScheduleRangeSelectionUi() {
  const bounds = getScheduleSelectionBounds();
  document.querySelectorAll("#mainTable .cell.range-selected, #mainTable .cell.range-anchor").forEach((cell) => {
    cell.classList.remove("range-selected", "range-anchor");
  });
  if (!bounds) {
    return;
  }
  document.querySelectorAll("#mainTable .cell[data-member-id][data-date]").forEach((cell) => {
    if (!(cell instanceof HTMLElement)) {
      return;
    }
    const row = Number(cell.dataset.rowIndex);
    const col = Number(cell.dataset.colIndex);
    if (row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax) {
      cell.classList.add("range-selected");
      if (row === scheduleRangeSelection.anchor.row && col === scheduleRangeSelection.anchor.col) {
        cell.classList.add("range-anchor");
      }
    }
  });
}

function setScheduleRangeSelection(anchor, focus = anchor) {
  if (!isValidScheduleCellPoint(anchor) || !isValidScheduleCellPoint(focus)) {
    clearScheduleRangeSelection();
    return;
  }
  scheduleRangeSelection = { anchor, focus };
  syncScheduleRangeSelectionUi();
}

function getSelectedScheduleCells() {
  const bounds = getScheduleSelectionBounds();
  if (!bounds) {
    return [];
  }
  return Array.from(document.querySelectorAll("#mainTable .cell[data-member-id][data-date]"))
    .filter((cell) => {
      if (!(cell instanceof HTMLElement) || cell.classList.contains("inactive-cell")) {
        return false;
      }
      const row = Number(cell.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      return row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax;
    })
    .sort((a, b) => Number(a.dataset.rowIndex) - Number(b.dataset.rowIndex) || Number(a.dataset.colIndex) - Number(b.dataset.colIndex));
}

function cleanSlotMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return null;
  }
  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => !key.startsWith("request"))
  );
}

function serializeScheduleSlotForClipboard(slot) {
  if (!slot) {
    return { shift: null, leave: null, leaveMeta: null, overtime: null, overtimeMeta: null };
  }
  return {
    shift: slot.shift || null,
    leave: slot.leave || null,
    leaveMeta: slot.leave ? cleanSlotMeta(slot.leaveMeta) : null,
    overtime: slot.overtime || null,
    overtimeMeta: slot.overtime ? cleanSlotMeta(slot.overtimeMeta) : null
  };
}

async function applyClipboardSlotToScheduleCell(memberId, dateString, clipboardSlot) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || !isMemberActiveOnDateString(member, dateString)) {
    return false;
  }
  const slot = ensureScheduleSlot(memberId, dateString);
  if (!slot) {
    return false;
  }
  const nextShiftId = clipboardSlot?.shift || null;
  slot.shift = nextShiftId;
  slot.leave = clipboardSlot?.leave || null;
  if (clipboardSlot?.leaveMeta) {
    slot.leaveMeta = { ...clipboardSlot.leaveMeta };
  } else {
    delete slot.leaveMeta;
  }
  slot.overtime = clipboardSlot?.overtime || null;
  if (clipboardSlot?.overtimeMeta) {
    slot.overtimeMeta = { ...clipboardSlot.overtimeMeta };
  } else {
    delete slot.overtimeMeta;
  }
  return true;
}

async function clearScheduleCellEditableParts(memberId, dateString) {
  return applyClipboardSlotToScheduleCell(memberId, dateString, {
    shift: null,
    leave: null,
    leaveMeta: null,
    overtime: null,
    overtimeMeta: null
  });
}

function pushScheduleUndoSnapshot(snapshot = state.schedule || {}) {
  scheduleUndoStack.push(deepClone(snapshot));
  if (scheduleUndoStack.length > SCHEDULE_HISTORY_LIMIT) {
    scheduleUndoStack.shift();
  }
  scheduleRedoStack = [];
  syncScheduleHistoryButtons();
}

function rememberScheduleUndoSnapshot() {
  pushScheduleUndoSnapshot();
}

function discardLastScheduleUndoSnapshot() {
  scheduleUndoStack.pop();
  syncScheduleHistoryButtons();
}

let scheduleHistoryBusy = false;

function getScheduleUndoButton() {
  return document.getElementById("scheduleUndoButton");
}

function getScheduleRedoButton() {
  return document.getElementById("scheduleRedoButton");
}

function syncScheduleHistoryButtons() {
  const editable = typeof canEditSchedule === "function" && canEditSchedule();
  const undoButton = getScheduleUndoButton();
  const redoButton = getScheduleRedoButton();
  if (undoButton) {
    undoButton.disabled = scheduleHistoryBusy || !editable || scheduleUndoStack.length === 0;
    undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
  }
  if (redoButton) {
    redoButton.disabled = scheduleHistoryBusy || !editable || scheduleRedoStack.length === 0;
    redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
  }
}

function pushScheduleHistorySnapshot(stack, snapshot) {
  stack.push(deepClone(snapshot || {}));
  if (stack.length > SCHEDULE_HISTORY_LIMIT) {
    stack.shift();
  }
}

async function undoSchedule() {
  if (scheduleHistoryBusy || !canEditSchedule() || !scheduleUndoStack.length) {
    syncScheduleHistoryButtons();
    return false;
  }
  scheduleHistoryBusy = true;
  const targetSnapshot = scheduleUndoStack.pop();
  pushScheduleHistorySnapshot(scheduleRedoStack, state.schedule || {});
  syncScheduleHistoryButtons();
  try {
    await restoreScheduleSnapshot(targetSnapshot);
    return true;
  } catch (error) {
    showInfoMessage(`上一步失敗：${error.message || error}`);
    return false;
  } finally {
    scheduleHistoryBusy = false;
    syncScheduleHistoryButtons();
  }
}

async function redoSchedule() {
  if (scheduleHistoryBusy || !canEditSchedule() || !scheduleRedoStack.length) {
    syncScheduleHistoryButtons();
    return false;
  }
  scheduleHistoryBusy = true;
  const targetSnapshot = scheduleRedoStack.pop();
  pushScheduleHistorySnapshot(scheduleUndoStack, state.schedule || {});
  syncScheduleHistoryButtons();
  try {
    await restoreScheduleSnapshot(targetSnapshot);
    return true;
  } catch (error) {
    showInfoMessage(`下一步失敗：${error.message || error}`);
    return false;
  } finally {
    scheduleHistoryBusy = false;
    syncScheduleHistoryButtons();
  }
}

function bindScheduleHistoryControls() {
  getScheduleUndoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void undoSchedule();
  });
  getScheduleRedoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void redoSchedule();
  });
  window.schedulerScheduleHistory = {
    undo: undoSchedule,
    redo: redoSchedule,
    sync: syncScheduleHistoryButtons
  };
  syncScheduleHistoryButtons();
}

function parseScheduleKeyParts(key) {
  const parts = String(key || "").split("_");
  if (parts.length < 4) {
    return null;
  }
  const day = Number(parts.pop());
  const month = Number(parts.pop());
  const year = Number(parts.pop());
  const memberId = parts.join("_");
  if (!memberId || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return { memberId, dateString: toDateString(year, month, day) };
}

function getChangedScheduleCells(previousSchedule, nextSchedule) {
  const keys = new Set([
    ...Object.keys(previousSchedule || {}),
    ...Object.keys(nextSchedule || {})
  ]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(previousSchedule?.[key] || null) !== JSON.stringify(nextSchedule?.[key] || null))
    .map(parseScheduleKeyParts)
    .filter(Boolean);
}

function getScheduleCellElement(memberId, dateString) {
  return Array.from(document.querySelectorAll("#mainTable .cell[data-member-id][data-date]"))
    .find((cell) => cell instanceof HTMLElement && cell.dataset.memberId === memberId && cell.dataset.date === dateString) || null;
}

function renderScheduleCell(memberId, dateString) {
  const cell = getScheduleCellElement(memberId, dateString);
  if (!(cell instanceof HTMLElement)) {
    return;
  }
  const key = getScheduleKeyForDateString(memberId, dateString);
  cell.innerHTML = renderCellInner(key, memberId, dateString, state.schedule[key] || null, false);
  if (state.tableView === "member" && state.tableStatsVisible) {
    const member = state.members.find((item) => item.id === memberId);
    const statsCell = cell.closest("tr")?.querySelector(".stats-col");
    if (member && statsCell) {
      statsCell.innerHTML = renderMemberStats(member);
    }
  }
}

async function persistScheduleCell(memberId, dateString) {
  await persistScheduleCells([{ memberId, dateString }]);
}

async function persistScheduleCells(cells) {
  const payloads = [];
  (Array.isArray(cells) ? cells : []).forEach(({ memberId, dateString }) => {
    const member = state.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    const key = getScheduleKeyForDateString(memberId, dateString);
    payloads.push({
      memberId,
      memberCode: member.code || "",
      dateString,
      slot: key ? state.schedule[key] || null : null
    });
  });
  if (payloads.length) {
    await window.schedulerApi.saveScheduleCells(payloads);
  }
}

async function applySchedulePreviewSlots(previewSlots) {
  const changedCells = Object.keys(previewSlots || {}).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    return 0;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
  return changedCells.length;
}

async function finishScheduleCellMutation(memberId, dateString) {
  pruneEmptySchedule();
  renderScheduleCell(memberId, dateString);
  syncScheduleRangeSelectionUi();
  await persistScheduleCell(memberId, dateString);
}

async function finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule) {
  const nextSchedule = state.schedule || {};
  if (!getChangedScheduleCells(previousSchedule, nextSchedule).length) {
    return false;
  }
  pushScheduleUndoSnapshot(previousSchedule);
  await finishScheduleCellMutation(memberId, dateString);
  return true;
}

function copyScheduleRangeToClipboard() {
  const cells = getSelectedScheduleCells();
  const bounds = getScheduleSelectionBounds();
  if (!cells.length || !bounds) {
    return false;
  }
  const rows = bounds.rowMax - bounds.rowMin + 1;
  const cols = bounds.colMax - bounds.colMin + 1;
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => serializeScheduleSlotForClipboard(null)));
  cells.forEach((cell) => {
    const row = Number(cell.dataset.rowIndex) - bounds.rowMin;
    const col = Number(cell.dataset.colIndex) - bounds.colMin;
    matrix[row][col] = serializeScheduleSlotForClipboard(getSlot(cell.dataset.memberId || "", cell.dataset.date || ""));
  });
  scheduleClipboard = { rows, cols, matrix };
  return true;
}

async function clearSelectedScheduleCells() {
  const cells = getSelectedScheduleCells();
  if (!cells.length) {
    return false;
  }
  let changed = false;
  const changedCells = [];
  for (const cell of cells) {
    const memberId = cell.dataset.memberId || "";
    const dateString = cell.dataset.date || "";
    const cellChanged = await clearScheduleCellEditableParts(memberId, dateString);
    if (cellChanged) {
      changedCells.push({ memberId, dateString });
      changed = true;
    }
  }
  if (changed) {
    pruneEmptySchedule();
    changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
    syncScheduleRangeSelectionUi();
    await persistScheduleCells(changedCells);
  }
  return changed;
}

async function pasteScheduleClipboard() {
  if (!scheduleClipboard || !scheduleRangeSelection) {
    return false;
  }
  if (scheduleClipboard.rows === 1 && scheduleClipboard.cols === 1) {
    const [clipboardSlot] = scheduleClipboard.matrix[0] || [];
    let changed = false;
    const changedCells = [];
    for (const cell of getSelectedScheduleCells()) {
      const memberId = cell.dataset.memberId || "";
      const dateString = cell.dataset.date || "";
      const cellChanged = await applyClipboardSlotToScheduleCell(memberId, dateString, clipboardSlot);
      if (cellChanged) {
        changedCells.push({ memberId, dateString });
        changed = true;
      }
    }
    if (changed) {
      pruneEmptySchedule();
      changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
      syncScheduleRangeSelectionUi();
      await persistScheduleCells(changedCells);
    }
    return changed;
  }
  let changed = false;
  const changedCells = [];
  for (let rowOffset = 0; rowOffset < scheduleClipboard.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < scheduleClipboard.cols; colOffset += 1) {
      const row = scheduleRangeSelection.anchor.row + rowOffset;
      const col = scheduleRangeSelection.anchor.col + colOffset;
      const cell = document.querySelector(`#mainTable .cell[data-row-index="${row}"][data-col-index="${col}"]`);
      if (!(cell instanceof HTMLElement) || cell.classList.contains("inactive-cell") || !cell.dataset.memberId || !cell.dataset.date) {
        continue;
      }
      const cellChanged = await applyClipboardSlotToScheduleCell(cell.dataset.memberId, cell.dataset.date, scheduleClipboard.matrix[rowOffset][colOffset]);
      if (cellChanged) {
        changedCells.push({ memberId: cell.dataset.memberId, dateString: cell.dataset.date });
        changed = true;
      }
    }
  }
  if (changed) {
    pruneEmptySchedule();
    changedCells.forEach(({ memberId, dateString }) => renderScheduleCell(memberId, dateString));
    syncScheduleRangeSelectionUi();
    await persistScheduleCells(changedCells);
  }
  return changed;
}

async function restoreScheduleSnapshot(snapshot) {
  if (!snapshot) {
    return false;
  }
  const previousSchedule = state.schedule || {};
  state.schedule = deepClone(snapshot);
  pruneEmptySchedule();
  const changedCells = getChangedScheduleCells(previousSchedule, state.schedule);
  renderTable();
  syncScheduleRangeSelectionUi();
  await persistScheduleCells(changedCells);
  return true;
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || Boolean(target instanceof HTMLElement && target.isContentEditable);
}
;

/* ===== renderer-auto-schedule-compliance.js ===== */
function getLeaveByCode(code) {
  return state.leaves.find((leave) => leave.code === code) || null;
}

function isRestLeaveId(leaveId) {
  return getItem("leave", leaveId)?.code === "0047";
}

function isRegularRestLeaveId(leaveId) {
  return getItem("leave", leaveId)?.code === "0036";
}

function getWeekBucketIndex(dateString, rangeStartDate) {
  return Math.floor(diffDays(rangeStartDate, dateString) / 7);
}

function getMemberAutoRestTarget(member, scheduleMap, dates) {
  const activeDays = countMemberActiveDays(member, dates);
  if (!activeDays) {
    return { activeDays: 0, fixedRegularCount: 0, totalHolidayTarget: 0, restTarget: 0 };
  }
  const fixedRegularCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRegularRestLeaveId);
  const totalHolidayTarget = Math.round((activeDays / 56) * 16);
  return {
    activeDays,
    fixedRegularCount,
    totalHolidayTarget,
    restTarget: Math.max(0, totalHolidayTarget - fixedRegularCount)
  };
}

function countMemberActiveDays(member, dates) {
  return dates.filter((dateString) => isMemberActiveOnDateString(member, dateString)).length;
}

function countMemberLeaveByPredicate(scheduleMap, memberId, dates, predicate) {
  return dates.filter((dateString) => predicate(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)).length;
}

function memberHasRestInWeek(scheduleMap, memberId, dates, weekIndex, rangeStartDate) {
  return dates.some((dateString) => (
    getWeekBucketIndex(dateString, rangeStartDate) === weekIndex
    && isRestLeaveId(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)
  ));
}

function countMemberRestInWeek(scheduleMap, memberId, dates, weekIndex, rangeStartDate) {
  return dates.filter((dateString) => (
    getWeekBucketIndex(dateString, rangeStartDate) === weekIndex
    && isRestLeaveId(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)
  )).length;
}

function canAutoPlaceDailyRest(scheduleMap, member, dateString, dates, rangeStartDate) {
  if (!isMemberActiveOnDateString(member, dateString)) {
    return false;
  }
  const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (slot?.shift || slot?.leave) {
    return false;
  }
  const target = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  if (countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId) >= target) {
    return false;
  }
  const weekIndex = getWeekBucketIndex(dateString, rangeStartDate);
  return countMemberRestInWeek(scheduleMap, member.id, dates, weekIndex, rangeStartDate) === 0;
}

function placeDailySurplusRestDays(scheduleMap, dateString, dates, rangeStartDate, restLeave, preview) {
  const candidates = getActiveMembersForDate(dateString)
    .filter((member) => canAutoPlaceDailyRest(scheduleMap, member, dateString, dates, rangeStartDate))
    .sort((a, b) => {
      if (a.payByDay !== b.payByDay) {
        return a.payByDay ? -1 : 1;
      }
      const restDiff = countMemberLeaveByPredicate(scheduleMap, a.id, dates, isRestLeaveId)
        - countMemberLeaveByPredicate(scheduleMap, b.id, dates, isRestLeaveId);
      return restDiff || a.name.localeCompare(b.name);
    });
  candidates.forEach((member) => {
    markAutoLeave(scheduleMap, member, dateString, restLeave, preview, "多餘人力預排休息日");
  });
}
;

/* ===== renderer-auto-schedule-demand.js ===== */
function getWorkScheduleSlot(scheduleMap, memberId, dateString) {
  const key = getScheduleKeyForDateString(memberId, dateString);
  return key ? scheduleMap[key] || null : null;
}

function countAssignedShiftMembers(scheduleMap, shiftId, dateString, excludeMemberId = "") {
  if (!shiftId || !dateString) {
    return 0;
  }
  return state.members.filter((member) => {
    if (member.id === excludeMemberId || !isMemberActiveOnDateString(member, dateString)) {
      return false;
    }
    return getWorkScheduleSlot(scheduleMap, member.id, dateString)?.shift === shiftId;
  }).length;
}

function ensureWorkScheduleSlot(scheduleMap, memberId, dateString) {
  const key = getScheduleKeyForDateString(memberId, dateString);
  if (!key) {
    return null;
  }
  if (!scheduleMap[key]) {
    scheduleMap[key] = { shift: null, leave: null, overtime: null };
  }
  return scheduleMap[key];
}

function hasAnyLeaveOnDate(scheduleMap, memberId, dateString) {
  return Boolean(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave);
}

function hasAnyShiftOnDate(scheduleMap, memberId, dateString) {
  return Boolean(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.shift);
}

function getVisibleAutoScheduleShifts(dateString = "") {
  return state.shifts.filter((shift) => (
    !shift.hiddenFromToolbar
    && Math.max(0, Number(shift.requiredStaffCount) || 0) > 0
    && (!dateString || isShiftOperatingOnDate(shift, dateString))
  ));
}

function getActiveMembersForDate(dateString) {
  return state.members.filter((member) => isMemberActiveOnDateString(member, dateString));
}

function markAutoLeave(scheduleMap, member, dateString, leave, preview, reason) {
  const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (!slot || !leave) {
    return false;
  }
  slot.leave = leave.id;
  slot.leaveMeta = {
    leaveCode: leave.code || "",
    displayName: leave.name,
    displayColor: leave.color || "",
    displayTextColor: getItemTextColor(leave, leave.color),
    allDay: true,
    startTime: "",
    endTime: "",
    reasonEnabled: false,
    reason: ""
  };
  return true;
}

function getDailyShiftNeedOptions(scheduleMap, dateString) {
  const shifts = getVisibleAutoScheduleShifts(dateString);
  const activeMembers = getActiveMembersForDate(dateString);
  const availableMembers = [];
  activeMembers.forEach((member) => {
    const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
    if (!slot?.shift && !slot?.leave) {
      availableMembers.push(member);
    }
  });
  return shifts
    .map((shift) => {
      const assignedCount = countAssignedShiftMembers(scheduleMap, shift.id, dateString);
      const remaining = Math.max(0, getShiftDemandForDate(shift, dateString) - assignedCount);
      const candidates = remaining > 0
        ? availableMembers.filter((member) => memberCanScheduleShift(member, shift.id))
        : [];
      return { shift, assignedCount, remaining, candidates };
    })
    .filter((item) => item.remaining > 0);
}

function getShiftDepartmentIds(shift) {
  return shift?.applicableDeptId ? [shift.applicableDeptId] : [];
}

function getShiftDemandForDate(shift, dateString) {
  if (!shift || !isShiftOperatingOnDate(shift, dateString)) {
    return 0;
  }
  return Math.max(0, Number(shift.requiredStaffCount) || 0);
}

function getOperatingShiftDepartmentIds(shift, dateString) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return shiftDeptIds.filter((deptId) => {
    const department = state.departments.find((item) => item.id === deptId);
    return isDepartmentVisibleInSchedule(department) && isDepartmentOperatingOnDate(department, dateString);
  });
}

function isShiftOperatingOnDate(shift, dateString) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || getOperatingShiftDepartmentIds(shift, dateString).length > 0;
}

function shiftHasVisibleDepartment(shift) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || shiftDeptIds.some((deptId) => (
    isDepartmentVisibleInScheduleRange(state.departments.find((department) => department.id === deptId))
  ));
}

function getRemainingDailyShiftDemand(scheduleMap, dateString) {
  return getRemainingDailyShiftDemandDetails(scheduleMap, dateString)
    .reduce((sum, item) => sum + item.missing, 0);
}

function getRemainingDailyShiftDemandDetails(scheduleMap, dateString) {
  return getVisibleAutoScheduleShifts(dateString)
    .map((shift) => {
      return {
        shift,
        missing: Math.max(0, getShiftDemandForDate(shift, dateString) - countAssignedShiftMembers(scheduleMap, shift.id, dateString))
      };
    })
    .filter((item) => item.missing > 0);
}
;

/* ===== renderer-auto-schedule-assignment.js ===== */
function getDailyAssignmentCost(scheduleMap, option, member, dateString, dates) {
  const weekIndex = getWeekBucketIndex(dateString, dates[0] || dateString);
  const restTarget = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  const restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
  const hasRestThisWeek = memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, dates[0] || dateString);
  const shiftPriority = getMemberShiftPriority(member, option.shift.id);
  const mustWork = !member.payByDay && (restCount >= restTarget || hasRestThisWeek);
  if (mustWork) {
    return shiftPriority;
  }
  if (!member.payByDay) {
    return 1000 + shiftPriority;
  }
  return 2000 + shiftPriority;
}

function findMinimumCostFlowAssignments(scheduleMap, options, dateString, dates) {
  const FIRST_COVERAGE_COST = 0;
  const EXTRA_COVERAGE_COST = 1000000;
  const members = [];
  const memberIndexById = new Map();
  options.forEach((option) => {
    option.candidates.forEach((member) => {
      if (!memberIndexById.has(member.id)) {
        memberIndexById.set(member.id, members.length);
        members.push(member);
      }
    });
  });
  const shiftSlots = [];
  options.forEach((option) => {
    for (let index = 0; index < option.remaining; index += 1) {
      shiftSlots.push({
        ...option,
        slotCost: option.assignedCount === 0 && index === 0 ? FIRST_COVERAGE_COST : EXTRA_COVERAGE_COST
      });
    }
  });
  const source = 0;
  const shiftStart = 1;
  const memberStart = shiftStart + shiftSlots.length;
  const sink = memberStart + members.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const assignmentEdges = [];
  const addEdge = (from, to, capacity, cost = 0) => {
    const forward = { to, rev: graph[to].length, capacity, cost };
    const backward = { to: from, rev: graph[from].length, capacity: 0, cost: -cost };
    graph[from].push(forward);
    graph[to].push(backward);
    return forward;
  };
  shiftSlots.forEach((option, optionIndex) => {
    const shiftNode = shiftStart + optionIndex;
    addEdge(source, shiftNode, 1, option.slotCost);
    option.candidates.forEach((member) => {
      const memberNode = memberStart + memberIndexById.get(member.id);
      const edge = addEdge(
        shiftNode,
        memberNode,
        1,
        getDailyAssignmentCost(scheduleMap, option, member, dateString, dates)
      );
      assignmentEdges.push({ edge, shift: option.shift, member });
    });
  });
  members.forEach((member, memberIndex) => {
    addEdge(memberStart + memberIndex, sink, 1);
  });
  const findShortestPath = () => {
    const distances = Array(graph.length).fill(Infinity);
    const inQueue = Array(graph.length).fill(false);
    const previous = Array(graph.length).fill(null);
    distances[source] = 0;
    const queue = [source];
    inQueue[source] = true;
    while (queue.length) {
      const node = queue.shift();
      inQueue[node] = false;
      graph[node].forEach((edge, edgeIndex) => {
        const nextCost = distances[node] + edge.cost;
        if (edge.capacity > 0 && nextCost < distances[edge.to]) {
          distances[edge.to] = nextCost;
          previous[edge.to] = { node, edgeIndex };
          if (!inQueue[edge.to]) {
            inQueue[edge.to] = true;
            queue.push(edge.to);
          }
        }
      });
    }
    return distances[sink] < Infinity ? previous : null;
  };
  // ponytail: daily graph is tiny; min-cost max-flow keeps full coverage while honoring priority costs.
  while (true) {
    const previous = findShortestPath();
    if (!previous) {
      break;
    }
    let cursor = sink;
    while (cursor !== source) {
      const step = previous[cursor];
      const edge = graph[step.node][step.edgeIndex];
      edge.capacity -= 1;
      graph[edge.to][edge.rev].capacity += 1;
      cursor = step.node;
    }
  }
  return assignmentEdges
    .filter(({ edge }) => edge.capacity === 0)
    .map(({ shift, member }) => ({ shift, member }));
}

function findBestDailyShiftAssignments(scheduleMap, dateString, preview) {
  const options = getDailyShiftNeedOptions(scheduleMap, dateString)
    .sort((a, b) => (
      a.candidates.length - b.candidates.length
      || b.remaining - a.remaining
      || a.shift.name.localeCompare(b.shift.name)
    ));
  const assignments = findMinimumCostFlowAssignments(scheduleMap, options, dateString, preview.dates || [dateString]);
  assignments.forEach(({ shift, member }) => {
    const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
    if (slot) {
      slot.shift = shift.id;
    }
  });
  const missingDetails = getRemainingDailyShiftDemandDetails(scheduleMap, dateString);
  if (missingDetails.length) {
    const missing = missingDetails.reduce((sum, item) => sum + item.missing, 0);
    const detailText = missingDetails
      .map(({ shift, missing: missingCount }) => `${shift.name}缺${missingCount}`)
      .join("、");
    preview.warnings.push(`${dateString} 仍缺 ${missing} 個班別人力${detailText ? `（${detailText}）` : ""}`);
  }
  return assignments;
}
;

/* ===== renderer-auto-fill-schedule.js ===== */
const AUTO_FILL_PREVIEW_TYPE = "auto-fill-schedule";

function isAutoFillSchedulePreview() {
  return autoSchedulePreview?.previewType === AUTO_FILL_PREVIEW_TYPE;
}

function isBlankScheduleSlot(slot) {
  return !slot?.shift && !slot?.leave && !slot?.overtime;
}

function getFirstConfiguredShiftId(member) {
  const configuredIds = Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [];
  return configuredIds
    .map((shiftId) => String(shiftId || ""))
    .find((shiftId) => state.shifts.some((shift) => shift.id === shiftId)) || "";
}

function getAutoFillEligibleDates(member, dates) {
  const department = state.departments.find((item) => item.id === getMemberHomeDeptId(member)) || null;
  if (!department || department.hiddenFromSchedule) {
    return [];
  }
  return dates.filter((dateString) => (
    isMemberActiveOnDateString(member, dateString)
    && (typeof isDepartmentOperatingOnDate !== "function" || isDepartmentOperatingOnDate(department, dateString))
  ));
}

async function ensureAutoFillScheduleRangeLoaded(startDate, endDate) {
  const range = { startDate, endDate };
  if (typeof isScheduleRangeLoaded === "function" && isScheduleRangeLoaded(range)) {
    return;
  }
  const payload = await window.schedulerApi.loadScheduleEntries({
    ...range,
    members: state.members.map((member) => ({ id: member.id }))
  });
  state.schedule = cleanupScheduleEntries({
    ...state.schedule,
    ...(payload.schedule || {})
  }, state);
  if (typeof rememberScheduleLoadedRange === "function") {
    rememberScheduleLoadedRange(range);
  }
}

function buildAutoFillSchedulePreview(dates) {
  const preview = {
    previewType: AUTO_FILL_PREVIEW_TYPE,
    startDate: dates[0] || "",
    endDate: dates[dates.length - 1] || "",
    dates,
    slots: {},
    warnings: []
  };
  const missingShiftMembers = [];

  state.members.forEach((member) => {
    if (member.payByDay) {
      return;
    }
    const eligibleDates = getAutoFillEligibleDates(member, dates);
    if (!eligibleDates.length) {
      return;
    }
    const firstShiftId = getFirstConfiguredShiftId(member);
    if (!firstShiftId) {
      missingShiftMembers.push(member.name || member.code || member.id);
      return;
    }
    eligibleDates.forEach((dateString) => {
      const key = getScheduleKeyForDateString(member.id, dateString);
      if (!key || !isBlankScheduleSlot(state.schedule[key] || null)) {
        return;
      }
      preview.slots[key] = {
        shift: firstShiftId,
        leave: null,
        overtime: null
      };
    });
  });

  if (missingShiftMembers.length) {
    preview.warnings.push(`以下月薪人員未設定排班班別，未自動補班：${missingShiftMembers.join("、")}`);
  }
  return preview;
}

function openAutoFillSchedulePeriodModal() {
  if (!promptManagerAccess("自動補班需先登入主管帳號")) {
    return;
  }
  closeCoreActionsMenu();
  const { startDate, endDate } = getVisibleDateRange();
  modalContext = { category: "auto-fill-schedule-period" };
  openEntityListModal({
    title: "自動補班期間",
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="autoFillScheduleStartDate">開始日期</label>
          <input id="autoFillScheduleStartDate" type="date" value="${escapeHtml(startDate)}">
        </div>
        <div class="form-row">
          <label for="autoFillScheduleEndDate">結束日期</label>
          <input id="autoFillScheduleEndDate" type="date" value="${escapeHtml(endDate)}">
        </div>
      </div>
      <p class="modal-description">只補月薪人員完全空白的班表格，班別使用人員設定中的第一個排班班別；日薪人員及已有班別、假別或加班的格子不變。</p>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-generate-auto-fill-schedule="true">產生預覽</button>'
  });
}

async function generateAutoFillSchedulePreviewFromModal(button) {
  const startDate = document.getElementById("autoFillScheduleStartDate")?.value || "";
  const endDate = document.getElementById("autoFillScheduleEndDate")?.value || "";
  if (!startDate || !endDate || (!isValidDateRange(startDate, endDate) && startDate !== endDate)) {
    reportValidationError("請確認自動補班期間");
    return;
  }
  const dates = enumerateDateRange(startDate, endDate);
  if (!dates.length) {
    reportValidationError("請確認自動補班期間");
    return;
  }

  if (button) {
    button.disabled = true;
  }
  try {
    await ensureAutoFillScheduleRangeLoaded(startDate, endDate);
    closeModal();
    autoSchedulePreview = buildAutoFillSchedulePreview(dates);
    renderAll();
    const changeCount = Object.keys(autoSchedulePreview.slots || {}).length;
    const warningCount = autoSchedulePreview.warnings.length;
    showInfoMessage(
      changeCount
        ? `已產生自動補班預覽：${startDate} ～ ${endDate}，共 ${changeCount} 格${warningCount ? `，${warningCount} 則提醒` : ""}`
        : `自動補班預覽沒有可補的空格${warningCount ? `，${warningCount} 則提醒` : ""}`
    );
  } catch (error) {
    reportValidationError(`讀取班表失敗：${error.message || "未知錯誤"}`);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
    }
  }
}

async function applyAutoFillSchedulePreview() {
  if (!promptManagerAccess("套用自動補班需先登入主管帳號")) {
    return;
  }
  if (!await confirmAction("確定要套用目前綠色自動補班預覽嗎？套用後才會正式寫入班表。")) {
    return;
  }
  const changedCount = await applySchedulePreviewSlots(autoSchedulePreview?.slots || {});
  if (!changedCount) {
    showInfoMessage("自動補班預覽沒有需要套用的變更");
    return;
  }
  showInfoMessage(`已套用自動補班預覽，共寫入 ${changedCount} 格`);
}

function cancelAutoFillSchedulePreview() {
  autoSchedulePreview = null;
  renderAll();
  showInfoMessage("已取消自動補班預覽");
}

function bindAutoFillScheduleControls() {
  document.getElementById("autoFillSchedulePreviewButton")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openAutoFillSchedulePeriodModal();
  });

  document.body.addEventListener("click", async (event) => {
    const button = event.target instanceof Element
      ? event.target.closest("[data-generate-auto-fill-schedule]")
      : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    event.preventDefault();
    await generateAutoFillSchedulePreviewFromModal(button);
  });
}
;

/* ===== renderer-auto-schedule.js ===== */
function buildAutoSchedulePreview(dates = getVisibleDates()) {
  const startDate = dates[0] || getTodayDateString();
  const regularLeave = getLeaveByCode("0036");
  const restLeave = getLeaveByCode("0047");
  const preview = {
    startDate,
    dates,
    slots: {},
    warnings: [],
    cancelLeaveRequestIds: new Set(),
    memberTargets: {}
  };
  const scheduleMap = deepClone(state.schedule || {});
  if (!regularLeave || !restLeave) {
    preview.warnings.push("找不到例假 0036 或休息日 0047，無法完整自動排班");
    return preview;
  }

  state.members.forEach((member) => {
    const activeDays = countMemberActiveDays(member, dates);
    if (!activeDays) {
      return;
    }
    dates.forEach((dateString) => {
      if (!isMemberActiveOnDateString(member, dateString)) {
        return;
      }
      if (toDateObject(dateString)?.getDay() === normalizeRestWeekday(member.fixedRestWeekday)) {
        const hadShift = hasAnyShiftOnDate(scheduleMap, member.id, dateString);
        markAutoLeave(scheduleMap, member, dateString, regularLeave, preview, hadShift ? "例假加班" : "固定例假");
        if (hadShift) {
          preview.warnings.push(`${member.name} ${dateString} 已有班別，預排為例假加班`);
        }
      }
    });
  });

  state.members.forEach((member) => {
    const target = getMemberAutoRestTarget(member, scheduleMap, dates);
    if (!target.activeDays) {
      return;
    }
    preview.memberTargets[member.id] = target;
  });

  dates.forEach((dateString) => {
    findBestDailyShiftAssignments(scheduleMap, dateString, preview);
    placeDailySurplusRestDays(scheduleMap, dateString, dates, startDate, restLeave, preview);
  });

  state.members.forEach((member) => {
    const target = preview.memberTargets[member.id]?.restTarget ?? 0;
    let restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
    while (restCount < target) {
      const weekCount = Math.max(1, Math.ceil(dates.length / 7));
      const weekIndexes = Array.from({ length: weekCount }, (_, index) => index);
      const targetWeek = weekIndexes.find((weekIndex) => !memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, startDate));
      const candidateDate = dates.find((dateString) => (
        getWeekBucketIndex(dateString, startDate) === targetWeek
        && isMemberActiveOnDateString(member, dateString)
        && !hasAnyLeaveOnDate(scheduleMap, member.id, dateString)
      ));
      if (!candidateDate) {
        preview.warnings.push(`${member.name} 休息日不足 ${target - restCount} 天`);
        break;
      }
      markAutoLeave(scheduleMap, member, candidateDate, restLeave, preview, hasAnyShiftOnDate(scheduleMap, member.id, candidateDate) ? "休息日加班" : "補足休息日");
      if (hasAnyShiftOnDate(scheduleMap, member.id, candidateDate)) {
        preview.warnings.push(`${member.name} ${candidateDate} 預排為休息日加班`);
      }
      restCount += 1;
    }
  });

  Object.entries(scheduleMap).forEach(([key, slot]) => {
    const original = state.schedule[key] || null;
    if (JSON.stringify(original || null) !== JSON.stringify(slot || null)) {
      preview.slots[key] = slot;
    }
  });
  preview.cancelLeaveRequestIds = Array.from(preview.cancelLeaveRequestIds);
  return preview;
}

function getMissingAutoScheduleLeaveLabels() {
  return [
    { code: "0036", name: "例假" },
    { code: "0047", name: "休息日" }
  ]
    .filter((leave) => !getLeaveByCode(leave.code))
    .map((leave) => `${leave.name} ${leave.code}`);
}

async function previewAutoSchedule() {
  if (!promptManagerAccess("自動排班需先登入主管帳號")) {
    return;
  }
  const { startDate, endDate } = getVisibleDateRange();
  modalContext = { category: "auto-schedule-period" };
  openEntityListModal({
    title: "自動排班期間",
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="autoScheduleStartDate">開始日期</label>
          <input id="autoScheduleStartDate" type="date" value="${escapeHtml(startDate)}">
        </div>
        <div class="form-row">
          <label for="autoScheduleEndDate">結束日期</label>
          <input id="autoScheduleEndDate" type="date" value="${escapeHtml(endDate)}">
        </div>
      </div>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-generate-auto-schedule="true">產生預覽</button>'
  });
}

async function generateAutoSchedulePreviewFromModal() {
  const startDate = document.getElementById("autoScheduleStartDate")?.value || "";
  const endDate = document.getElementById("autoScheduleEndDate")?.value || "";
  if (!startDate || !endDate || (!isValidDateRange(startDate, endDate) && startDate !== endDate)) {
    reportValidationError("請確認自動排班期間");
    return;
  }
  const dates = enumerateDateRange(startDate, endDate);
  if (!dates.length) {
    reportValidationError("請確認自動排班期間");
    return;
  }
  const missingLeaveLabels = getMissingAutoScheduleLeaveLabels();
  if (missingLeaveLabels.length) {
    reportValidationError(`自動排班需要先在假別設定新增：${missingLeaveLabels.join("、")}`);
    return;
  }
  closeModal();
  autoSchedulePreview = buildAutoSchedulePreview(dates);
  renderAll();
  const changeCount = Object.keys(autoSchedulePreview.slots || {}).length;
  const warningCount = autoSchedulePreview.warnings.length;
  showInfoMessage(`已產生自動排班預覽：${startDate} ～ ${endDate}，${changeCount} 格預排${warningCount ? `，${warningCount} 則提醒` : ""}`);
}

async function applyAutoSchedulePreview() {
  if (isAutoFillSchedulePreview()) {
    await applyAutoFillSchedulePreview();
    return;
  }
  if (!promptManagerAccess("套用自動排班需先登入主管帳號")) {
    return;
  }
  if (!autoSchedulePreview) {
    showInfoMessage("目前沒有自動排班預覽");
    return;
  }
  if (!await confirmAction("確定要套用目前綠色預排結果嗎？套用後會寫入班表。")) {
    return;
  }
  const changedCount = await applySchedulePreviewSlots(autoSchedulePreview.slots || {});
  if (!changedCount) {
    showInfoMessage("自動排班預覽沒有需要套用的變更");
    return;
  }
  showInfoMessage("已套用自動排班預覽");
}

function cancelAutoSchedulePreview() {
  if (isAutoFillSchedulePreview()) {
    cancelAutoFillSchedulePreview();
    return;
  }
  if (!autoSchedulePreview) {
    return;
  }
  autoSchedulePreview = null;
  renderAll();
  showInfoMessage("已取消自動排班預覽");
}
;

/* ===== renderer-schedule-toolbar.js ===== */
function renderDeptFilter() {
  const select = document.getElementById("deptFilter");
  const departments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
  if (state.deptFilter !== "all" && !departments.some((department) => department.id === state.deptFilter)) {
    state.deptFilter = "all";
  }
  select.innerHTML = `
    <option value="all">全部單位</option>
    ${departments.map((department) => (
      `<option value="${department.id}" ${state.deptFilter === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`
    )).join("")}
  `;
}

function renderTableDeptScopeFilter() {
  const select = document.getElementById("tableDeptScopeFilter");
  if (!select) {
    return;
  }
  const departments = state.departments.filter((department) => isDepartmentVisibleInScheduleRange(department));
  if (state.tableDeptScopeFilter !== "all" && !departments.some((department) => department.id === state.tableDeptScopeFilter)) {
    state.tableDeptScopeFilter = "all";
  }
  select.innerHTML = `
    <option value="all">全部顯示</option>
    ${departments.map((department) => (
      `<option value="${department.id}" ${state.tableDeptScopeFilter === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`
    )).join("")}
  `;
}

function renderTableViewSelect() {
  const select = document.getElementById("tableViewSelect");
  if (!select) {
    return;
  }
  select.value = state.tableView === "shift" ? "shift" : state.tableStatsVisible ? "member-stats" : "member";
}

function renderChips(containerId, category, items) {
  const container = document.getElementById(containerId);
  const chips = items.map((item) => {
    const active = state.selected.type === category && state.selected.id === item.id;
    const foreground = getItemTextColor(item, item.color);
    const style = `color:${foreground};background:${item.color};border-color:${item.color};`;
    return `<button class="chip ${active ? "active" : ""}" style="${style}" type="button" data-chip-type="${category}" data-chip-id="${item.id}">${escapeHtml(item.name)}</button>`;
  });
  const cancelType = `cancel-${category}`;
  const cancelActive = state.selected.type === cancelType;
  chips.push(`<button class="chip cancel ${cancelActive ? "active" : ""}" type="button" data-chip-type="${cancelType}" data-chip-id="">取消</button>`);
  container.innerHTML = chips.join("");
}

function renderToolbar() {
  renderDeptFilter();
  renderTableViewSelect();
  renderTableDeptScopeFilter();
  const visibleShifts = state.deptFilter === "all"
    ? state.shifts
    : state.shifts.filter((shift) => shiftAllowsDepartment(shift, state.deptFilter));
  renderChips("shiftChips", "shift", visibleShifts.filter((item) => !item.hiddenFromToolbar));
  renderChips("leaveChips", "leave", state.leaves.filter((item) => !item.hiddenFromToolbar));
  renderChips("overtimeChips", "overtime", state.overtime.filter((item) => !item.hiddenFromToolbar));
  syncRoleUi();
}

function memberMatchesSelectedShift(member) {
  if (state.selected.type !== "shift" || !state.selected.id) {
    return false;
  }
  const shift = getItem("shift", state.selected.id);
  if (!shift) {
    return false;
  }
  return memberCanScheduleShift(member, shift.id);
}

function memberLabel(member) {
  const selectedShiftClass = memberMatchesSelectedShift(member) ? "shift-eligible-member-name" : "";
  const payTypeLabel = member.payByDay ? '<span class="member-pay-type">PT</span>' : "";
  return `<span class="member-main ${selectedShiftClass}">${escapeHtml(member.name)}${payTypeLabel}</span>`;
}
;

/* ===== renderer-schedule-groups.js ===== */
function getMemberEightWeekStats(member) {
  return getVisibleDates().reduce((stats, dateString) => {
    if (!isMemberActiveOnDateString(member, dateString)) {
      return stats;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    const leave = getItem("leave", slot?.leave);
    const hasShift = Boolean(slot?.shift);
    if (leave?.code === "0036") {
      stats.regular += 1;
    }
    if (leave?.code === "0047") {
      if (hasShift) {
        stats.restWork += 1;
      } else {
        stats.rest += 1;
      }
    }
    if (!slot?.shift && !slot?.leave) {
      stats.unassigned += 1;
    }
    return stats;
  }, { regular: 0, rest: 0, restWork: 0, unassigned: 0 });
}

function renderMemberStats(member) {
  const stats = getMemberEightWeekStats(member);
  return `
    <div class="member-stats">
      <span>休:${stats.rest}</span>
      <span>灰休:${stats.restWork}</span>
      <span>例:${stats.regular}</span>
      <span>未排:${stats.unassigned}</span>
    </div>
  `;
}

function memberHasScheduledShiftInDepartment(member, departmentId) {
  if (getMemberHomeDeptId(member) === departmentId) {
    return true;
  }
  for (const dateString of getVisibleDates()) {
    if (!isMemberActiveOnDateString(member, dateString)) {
      continue;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    const shift = getItem("shift", slot?.shift);
    if (shift && shiftAllowsDepartment(shift, departmentId)) {
      return true;
    }
  }
  return false;
}

function getVisibleTableGroups() {
  return state.departments
    .filter((department) => isDepartmentVisibleInScheduleRange(department))
    .map((department) => ({
      department,
      members: state.members.filter((member) => {
        if (getMemberHomeDeptId(member) !== department.id) {
          return false;
        }
        if (!isMemberActiveInVisibleRange(member)) {
          return false;
        }
        if (state.tableDeptScopeFilter === "all") {
          return true;
        }
        return memberHasScheduledShiftInDepartment(member, state.tableDeptScopeFilter);
      })
    }))
    .filter(({ members }) => members.length);
}
;

/* ===== renderer-schedule-cells.js ===== */
function getVisibleShiftRows() {
  return state.shifts.filter((shift) => (
    shiftHasVisibleDepartment(shift)
    && (state.tableDeptScopeFilter === "all" || shiftAllowsDepartment(shift, state.tableDeptScopeFilter))
  ));
}

function getShiftViewMembersForDay(shiftId, dateString) {
  return state.members.filter((member) => {
    if (!isMemberActiveOnDateString(member, dateString)) {
      return false;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    return slot?.shift === shiftId;
  });
}

function getShiftViewCellState(shift, dateString) {
  const members = getShiftViewMembersForDay(shift.id, dateString);
  const isOperating = isShiftOperatingOnDate(shift, dateString);
  const requiredStaffCount = getShiftDemandForDate(shift, dateString);
  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount
  };
}

function renderShiftViewCell(members) {
  if (!members.length) {
    return '<div class="shift-view-members"></div>';
  }
  return `
    <div class="shift-view-members">
      ${members.map((member) => `<div class="shift-view-member">${escapeHtml(member.name)}</div>`).join("")}
    </div>
  `;
}

function getScheduleSegmentTextLength(text) {
  return Array.from(String(text || "").trim()).length;
}

function getScheduleSegmentSizeClass(segment, segmentCount) {
  const textLength = getScheduleSegmentTextLength(segment.name);
  if (segmentCount === 1 && textLength > 0 && textLength < 2) {
    return "seg-label-xlarge";
  }
  if (segmentCount < 3 && textLength > 0 && textLength < 3) {
    return "seg-label-large";
  }
  if (segmentCount < 3 && textLength === 3) {
    return "seg-label-medium";
  }
  return "";
}

function renderCellInner(key, memberId = "", day = 0, slotOverride = null, isPreview = false) {
  const cellState = slotOverride || state.schedule[key];
  if (!cellState) {
    return '<div class="cell-inner"></div>';
  }
  const segments = [];
  if (cellState.shift) {
    const shift = getItem("shift", cellState.shift);
    if (shift) {
      segments.push({
        category: "shift",
        name: shift.name,
        color: shift.color,
        textColor: getItemTextColor(shift, shift.color)
      });
    }
  }
  if (cellState.leave) {
    const leave = getItem("leave", cellState.leave);
    if (leave) {
      segments.push({
        category: "leave",
        name: cellState.leaveMeta?.displayName || leave.name,
        color: leave.color,
        textColor: leave.code === "0047" && cellState.shift ? "rgb(112, 112, 112)" : getItemTextColor(leave, leave.color)
      });
    }
  }
  if (cellState.overtime) {
    const overtime = getItem("overtime", cellState.overtime);
    const color = overtime?.color || "#D85A30";
    segments.push({
      category: "overtime",
      name: overtime?.name || cellState.overtimeMeta?.displayName || "加班",
      color,
      textColor: getItemTextColor(overtime, color)
    });
  }
  if (!segments.length) {
    return '<div class="cell-inner"></div>';
  }
  const visibleSegments = segments.slice(0, 3);
  return `<div class="cell-inner">${visibleSegments.map((segment) => (
    `<div class="seg" style="background-color:${segment.color};color:${segment.textColor || textColor(segment.color)}" ${
      segment.category === "leave" && !isPreview && shouldPromptLeaveDetail(getItem("leave", cellState.leave), cellState.leaveMeta)
        ? `data-hover-schedule-detail="${memberId}:${day}:leave"`
        : segment.category === "overtime" && !isPreview && cellState.overtimeMeta
          ? `data-hover-schedule-detail="${memberId}:${day}:overtime"`
          : ""
    }><span class="seg-label ${getScheduleSegmentSizeClass(segment, visibleSegments.length)}">${escapeHtml(segment.name)}</span></div>`
  )).join("")}</div>`;
}
;

/* ===== renderer-schedule-table.js ===== */
function renderTable() {
  hideLeaveTooltip();
  const table = document.getElementById("mainTable");
  const visibleDates = getVisibleDates();
  const days = visibleDates.length;
  const today = getTodayDateString();

  let html = '<colgroup><col class="col-dept"><col class="col-person">';
  if (state.tableView === "member" && state.tableStatsVisible) {
    html += '<col class="col-stats">';
  }
  visibleDates.forEach(() => {
    html += '<col class="col-day">';
  });
  html += "</colgroup><tbody>";

  if (state.tableView === "shift") {
    const shifts = getVisibleShiftRows();
    if (!shifts.length) {
      html += `<tr><td class="empty-table" colspan="${days + 2}">目前沒有符合範圍的班別</td></tr>`;
    } else {
      shifts.forEach((shift) => {
        html += "<tr>";
        html += `<td class="dept-col">${escapeHtml(shift.name)}</td>`;
        html += `<td class="person-col demand-col">${escapeHtml(String(shift.requiredStaffCount ?? 0))}</td>`;
        visibleDates.forEach((dateString, index) => {
          const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, index, days);
          const shiftViewCellState = getShiftViewCellState(shift, dateString);
          const inactiveClass = shiftViewCellState.isOperating ? "" : "inactive-cell";
          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members)}</td>`;
        });
        html += "</tr>";
      });
    }
  } else {
    const groups = getVisibleTableGroups();
    const canEditScheduleOrder = canEditSchedule();
    const orderDragClass = canEditScheduleOrder ? " schedule-order-drag" : "";
    const draggableAttr = canEditScheduleOrder ? ' draggable="true"' : "";
    let rowIndex = 0;
    if (!groups.length) {
      html += `<tr><td class="empty-table" colspan="${days + 2 + (state.tableStatsVisible ? 1 : 0)}">${state.tableDeptScopeFilter === "all" ? "目前還沒有人員" : "目前週期沒有排到此單位班別的人員"}</td></tr>`;
    } else {
      groups.forEach(({ department, members }) => {
        members.forEach((member, index) => {
          html += `<tr class="${member.payByDay ? "pay-daily-row" : ""}">`;
          if (index === 0) {
            const departmentEditAttrs = canEditScheduleOrder ? ` data-table-department-id="${escapeHtml(department.id)}"` : "";
            html += `<td class="dept-col${orderDragClass}"${draggableAttr} rowspan="${members.length}"${departmentEditAttrs}>${escapeHtml(department.name)}</td>`;
          }
          const memberEditAttrs = canEditScheduleOrder
            ? ` data-table-member-id="${escapeHtml(member.id)}" data-table-member-department-id="${escapeHtml(getMemberHomeDeptId(member))}"`
            : "";
          const shiftEligibleClass = memberMatchesSelectedShift(member) ? " shift-eligible-person-col" : "";
          html += `<td class="person-col${orderDragClass}${shiftEligibleClass}"${draggableAttr}${memberEditAttrs} data-row-index="${rowIndex}"><div class="member-label">${memberLabel(member)}</div></td>`;
          if (state.tableStatsVisible) {
            html += `<td class="stats-col">${renderMemberStats(member)}</td>`;
          }
          visibleDates.forEach((dateString, dateIndex) => {
            const active = isMemberActiveOnDateString(member, dateString);
            const weekBoundaryClass = getWeekBoundaryClassForDate(dateString, dateIndex, days);
            if (!active) {
              html += `<td class="cell inactive-cell ${weekBoundaryClass}" data-disabled="true" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}"><div class="cell-inner"></div></td>`;
              return;
            }
            const key = getScheduleKeyForDateString(member.id, dateString);
            const previewSlot = getPreviewSlotByKey(key);
            const displayedSlot = previewSlot || state.schedule[key] || null;
            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            html += `<td class="cell ${previewClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;
          });
          html += "</tr>";
          rowIndex += 1;
        });
      });
    }
  }

  html += "</tbody>";
  table.innerHTML = html;
  syncScheduleColumnWidths();
  renderStickyTableHeader(visibleDates);
  syncScheduleRangeSelectionUi();
}

function renderHeader() {
  const { startDate, endDate } = getVisibleDateRange();
  document.getElementById("monthTitle").textContent = `${startDate} ～ ${endDate}`;
  renderAuthBar();
}
;

/* ===== renderer-settings-catalog.js ===== */
function openListSettings(category) {
  modalContext = { category: "list-settings", listCategory: category };
  const titleMap = {
    shift: "班別設定",
    leave: "假別設定",
    overtime: "加班設定"
  };
  const list = getItemList(category);
  const renderShiftMemberNames = (shift) => {
    const members = getMembersForScheduleShift(shift.id);
    if (!members.length) {
      return "-";
    }
    return members.map((member) => (
      `<span class="settings-member-chip" data-shift-schedule-member="${escapeHtml(member.id)}" title="雙擊修改人員">${escapeHtml(member.name)}</span>`
    )).join("");
  };
  const body = list.length
      ? `
        <div class="settings-table-wrap">
          <div class="settings-table-scroll">
            <div class="settings-table">
              <div class="settings-table-row settings-table-head settings-table-row-${category}">
                 ${renderSettingsOrderDragColumn(true)}
                 <div>預覽</div>
                ${category === "leave" ? "<div>假別代碼</div>" : ""}
                ${category === "shift" ? "" : `<div>${category === "leave" ? "假別" : "加班"}</div>`}
                <div>${category === "shift" ? "適用單位" : category === "leave" ? "需填時間" : "時段"}</div>
                ${category === "shift" ? "<div>需求人數</div>" : ""}
                ${category === "shift" ? "<div>排班人員</div>" : ""}
                ${category === "overtime" ? "<div>休息1</div><div>休息2</div>" : ""}
                ${category === "shift" ? "<div>時段</div>" : ""}
                ${category === "leave" ? "<div>需填原因</div>" : ""}
                <div>不顯示</div>
                <div class="settings-table-actions-head">操作</div>
              </div>
              ${list.map((item) => `
                <div class="settings-table-row settings-table-row-${category} sortable-settings-item" data-sort-category="${category}" data-sort-item="${item.id}">
                   ${renderSettingsOrderDragColumn()}
                   <div class="settings-table-color">
                    <div class="settings-table-preview" style="background:${escapeHtml(item.color)};color:${escapeHtml(getItemTextColor(item, item.color))}">${escapeHtml(item.name || item.code || "名稱")}</div>
                  </div>
                  ${category === "leave" ? `<div class="settings-table-code">${escapeHtml(item.code || "")}</div>` : ""}
                  ${category === "shift" ? "" : `<div class="settings-table-name">${escapeHtml(category === "leave" ? getLeaveCatalogDisplayName(item) : item.name)}</div>`}
                  <div class="settings-table-meta">${category === "shift"
                    ? escapeHtml(getDepartmentSummary(item.applicableDeptId))
                    : category === "leave"
                      ? (item.requiresTime ? "是" : "否")
                      : escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)
                  }</div>
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(String(item.requiredStaffCount ?? 0))}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta settings-member-list">${renderShiftMemberNames(item)}</div>`
                    : ""}
                  ${category === "overtime"
                    ? `<div class="settings-table-meta">${item.useRest1 ? escapeHtml(`${item.rest1StartTime || "--:--"} - ${item.rest1EndTime || "--:--"}`) : "-"}</div>
                       <div class="settings-table-meta">${item.useRest2 ? escapeHtml(`${item.rest2StartTime || "--:--"} - ${item.rest2EndTime || "--:--"}`) : "-"}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)}</div>`
                    : ""}
                  ${category === "leave"
                    ? `<div class="settings-table-meta">${item.requiresReason ? "是" : "否"}</div>`
                    : ""}
                  <div class="settings-table-meta">${item.hiddenFromToolbar ? "是" : "否"}</div>
                  <div class="settings-table-actions">
                    ${renderActionIconButton("edit", `data-edit-item="${category}" data-edit-id="${item.id}"`)}
                    ${renderActionIconButton("delete", `data-delete-category="${category}" data-delete-id="${item.id}"`)}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `
      : '<div class="empty-state">目前還沒有資料</div>';

  openEntityListModal({
    title: titleMap[category],
    modalClass: category === "shift" || category === "leave" || category === "overtime"
      ? "modal modal-wide catalog-settings-modal settings-list-modal"
      : undefined,
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-settings="${category}">匯出</button>
      <button class="ghost-btn" type="button" data-import-settings="${category}">匯入</button>
      <button class="btn-primary" type="button" data-open-add="${category}">新增</button>
    `,
    hideFooterClose: true
  });
}

function readApplicableDepartmentInput() {
  return document.getElementById("shiftApplicableDept")?.value || "";
}

function renderColorPreviewFields(category, previewText) {
  return `
    <div class="form-row form-row-compact leave-preview-row">
      <label>預覽</label>
      <div class="leave-preview-wrap">
        <div class="leave-preview" data-color-preview="${category}" style="background:${escapeHtml(modalColor)};color:${escapeHtml(modalTextColor)}">
          <span data-color-preview-text="${category}">${escapeHtml(previewText)}</span>
        </div>
        <div class="leave-color-actions">
          <button class="ghost-btn leave-color-btn" type="button" data-open-item-color="bg">底色</button>
          <input class="hidden-color-input leave-color-input" type="color" value="${escapeHtml(modalColor)}" data-item-color-input="bg">
          <button class="ghost-btn leave-color-btn" type="button" data-open-item-color="text">字色</button>
          <input class="hidden-color-input leave-color-input" type="color" value="${escapeHtml(modalTextColor)}" data-item-color-input="text">
          <button class="ghost-btn leave-color-btn" type="button" data-set-auto-item-text="true">自動字色</button>
        </div>
      </div>
    </div>
  `;
}

function renderActionIconButton(kind, attrs, extraClass = "") {
  const title = kind === "delete" ? "刪除" : "修改";
  const dangerClass = kind === "delete" ? " settings-icon-btn-danger" : "";
  const icon = kind === "delete"
    ? `
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 13h8l1-13"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    `
    : `
      <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path>
      <path d="M13.5 6.5l4 4"></path>
    `;
  return `
    <button class="settings-icon-btn${dangerClass}${extraClass ? ` ${extraClass}` : ""}" type="button" ${attrs} aria-label="${title}" title="${title}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        ${icon}
      </svg>
    </button>
  `;
}

function syncNamedColorUi() {
  const preview = document.querySelector("[data-color-preview]");
  const previewText = document.querySelector("[data-color-preview-text]");
  const bgInput = document.querySelector('[data-item-color-input="bg"]');
  const textInput = document.querySelector('[data-item-color-input="text"]');
  if (modalTextColorAuto) {
    modalTextColor = autoLeaveTextColor(modalColor);
  }
  const fallbackName = modalContext.category === "shift"
    ? "班別"
    : modalContext.category === "overtime"
      ? "加班"
      : "名稱";
  const displayName = modalContext.category === "leave"
    ? (document.getElementById("leaveCatalogName")?.value.trim() || "名稱")
    : modalContext.category === "shift"
      ? (document.getElementById("shiftName")?.value.trim() || fallbackName)
      : (document.getElementById("namedItemName")?.value.trim() || fallbackName);
  if (preview) {
    preview.style.background = modalColor;
    preview.style.color = modalTextColor;
  }
  if (previewText) {
    previewText.textContent = displayName;
  }
  if (bgInput) {
    bgInput.value = modalColor;
  }
  if (textInput) {
    textInput.value = modalTextColor;
  }
}

function openShiftFormModal(mode, shiftId = "") {
  const returnTo = modalContext?.category === "list-settings"
    ? captureSettingsReturnContext({ category: "list-settings", listCategory: "shift" })
    : null;
  const shift = mode === "edit"
    ? state.shifts.find((item) => item.id === shiftId)
    : {
      id: "",
      name: "",
      color: COLORS[0].hex,
      startTime: "",
      endTime: "",
      hiddenFromToolbar: false,
      requiredStaffCount: 1,
      applicableDeptId: state.deptFilter !== "all" ? state.deptFilter : (state.departments[0]?.id || ""),
      positionRequirements: []
    };
  if (!shift) {
    return;
  }
  modalColor = shift.color;
  modalTextColorAuto = shift.autoTextColor ?? !shift.textColor;
  modalTextColor = shift.textColor || autoLeaveTextColor(shift.color);
  modalContext = { mode, category: "shift", targetId: shiftId, returnTo };

  openEntityListModal({
    title: mode === "edit" ? "修改班別" : "新增班別",
    modalClass: "modal modal-wide modal-form-compact settings-edit-form",
    body: `
      ${renderColorPreviewFields("shift", shift.name || "班別")}
      <div class="form-row">
        <label for="shiftApplicableDept">適用單位</label>
        <select id="shiftApplicableDept">${buildSelectOptions(state.departments, "id", (item) => item.name, shift.applicableDeptId || "")}</select>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="shiftName">名稱</label>
          <textarea id="shiftName" class="single-line-textarea" rows="1" maxlength="12" lang="zh-Hant" spellcheck="false" placeholder="請輸入班別">${escapeHtml(shift.name)}</textarea>
        </div>
        <div class="form-row">
          <label for="shiftRequiredStaffCount">需求人數</label>
          <input id="shiftRequiredStaffCount" type="number" min="0" max="99" step="1" value="${escapeHtml(String(shift.requiredStaffCount ?? 1))}">
        </div>
      </div>
      <div class="form-section">
      <div class="form-grid">
        <div class="form-row">
          <label for="shiftStartTime">上班時間</label>
          ${timeInputMarkup("shiftStartTime", shift.startTime || "")}
        </div>
        <div class="form-row">
          <label for="shiftEndTime">下班時間</label>
          ${timeInputMarkup("shiftEndTime", shift.endTime || "")}
        </div>
      </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="shiftHiddenFromToolbar" type="checkbox" ${shift.hiddenFromToolbar ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-shift="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
  syncNamedColorUi();
}

async function saveShiftFromModal(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("shiftName")?.value.trim();
  if (!name) {
    document.getElementById("shiftName")?.focus();
    return;
  }
  const startTime = readTimeInputValue("shiftStartTime");
  const endTime = readTimeInputValue("shiftEndTime");
  if (!isValidTimeRange(startTime, endTime)) {
    reportValidationError("上班時間必須早於下班時間");
    return;
  }
  const applicableDeptId = readApplicableDepartmentInput();
  if (!state.departments.some((department) => department.id === applicableDeptId)) {
    reportValidationError("請選擇適用單位");
    return;
  }
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("s"),
    name,
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    startTime,
    endTime,
    hiddenFromToolbar: Boolean(document.getElementById("shiftHiddenFromToolbar")?.checked),
    requiredStaffCount: Math.max(0, Number(document.getElementById("shiftRequiredStaffCount")?.value || 0)),
    applicableDeptId,
    positionRequirements: []
  };

  const sortOrder = mode === "edit"
    ? state.shifts.findIndex((shift) => shift.id === payload.id)
    : state.shifts.length;
  try {
    await window.schedulerApi.saveShiftItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`班別儲存失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.shifts = state.shifts.map((shift) => shift.id === payload.id ? payload : shift);
  } else {
    state.shifts.push(payload);
  }
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: "shift", scrollTop: 0 });
}

function openNamedColorFormModal(category, mode, targetId = "") {
  const returnTo = modalContext?.category === "list-settings"
    ? captureSettingsReturnContext({ category: "list-settings", listCategory: category })
    : null;
  const list = getItemList(category);
  const item = mode === "edit"
    ? list.find((entry) => entry.id === targetId)
    : {
      id: "",
      code: category === "leave" ? LEAVE_CATALOG[0].code : "",
      name: category === "overtime" ? "加班" : LEAVE_CATALOG[0].name,
      color: COLORS[0].hex,
      requiresTime: false,
      requiresReason: false,
      hiddenFromToolbar: false,
      startTime: "",
      endTime: "",
      useRest1: false,
      rest1StartTime: "",
      rest1EndTime: "",
      useRest2: false,
      rest2StartTime: "",
      rest2EndTime: ""
    };
  if (!item) {
    return;
  }
  modalColor = item.color;
  modalTextColorAuto = item.autoTextColor ?? !item.textColor;
  modalTextColor = item.textColor || autoLeaveTextColor(item.color);
  modalContext = { category, mode, targetId, returnTo };
  const titleMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  openEntityListModal({
      title: `${mode === "edit" ? "修改" : "新增"}${titleMap[category]}`,
    modalClass: category === "leave" || category === "overtime"
        ? "modal modal-wide modal-form-compact settings-edit-form"
        : "modal modal-wide",
      body: `
      ${renderColorPreviewFields(category, item.name || (category === "overtime" ? "加班" : "名稱"))}
      <div class="form-row">
        <label for="${category === "leave" ? "leaveCatalogCode" : "namedItemName"}">${category === "leave" ? "假別" : "名稱"}</label>
        ${category === "leave"
          ? `<select id="leaveCatalogCode">${buildSelectOptions(LEAVE_CATALOG, "code", (entry) => `${entry.code} ${entry.name}`, item.code || "")}</select>`
          : `<textarea id="namedItemName" class="single-line-textarea" rows="1" maxlength="12" lang="zh-Hant" spellcheck="false" placeholder="請輸入名稱">${escapeHtml(item.name)}</textarea>`
        }
      </div>
      ${category === "leave" ? `
        <div class="form-row">
          <label for="leaveCatalogName">名稱</label>
          <input id="leaveCatalogName" type="text" maxlength="20" placeholder="請輸入名稱" value="${escapeHtml(item.name || LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || "")}">
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveRequiresTime" type="checkbox" ${item.requiresTime ? "checked" : ""}>
              需填時間
            </label>
          </div>
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveRequiresReason" type="checkbox" ${item.requiresReason ? "checked" : ""}>
              需填原因
            </label>
          </div>
        </div>
      ` : ""}
      ${category === "overtime" ? `
        <div class="form-section">
          <div class="form-grid">
            <div class="form-row">
              <label for="overtimeStartTime">上班時間</label>
              ${timeInputMarkup("overtimeStartTime", item.startTime || "")}
            </div>
            <div class="form-row">
              <label for="overtimeEndTime">下班時間</label>
              ${timeInputMarkup("overtimeEndTime", item.endTime || "")}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row">
            <label class="overtime-use-label">
              <input id="overtimeUseRest1" type="checkbox" ${item.useRest1 ? "checked" : ""}>
              使用休息1
            </label>
          </div>
          <div class="form-grid" id="overtimeRest1Fields" style="${item.useRest1 ? "" : "display:none;"}">
            <div class="form-row">
              <label for="overtimeRest1StartTime">休息1開始</label>
              ${timeInputMarkup("overtimeRest1StartTime", item.rest1StartTime || "", !item.useRest1)}
            </div>
            <div class="form-row">
              <label for="overtimeRest1EndTime">休息1結束</label>
              ${timeInputMarkup("overtimeRest1EndTime", item.rest1EndTime || "", !item.useRest1)}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row">
            <label class="overtime-use-label">
              <input id="overtimeUseRest2" type="checkbox" ${item.useRest1 && item.useRest2 ? "checked" : ""} ${item.useRest1 ? "" : "disabled"}>
              使用休息2
            </label>
          </div>
          <div class="form-grid" id="overtimeRest2Fields" style="${item.useRest1 && item.useRest2 ? "" : "display:none;"}">
            <div class="form-row">
              <label for="overtimeRest2StartTime">休息2開始</label>
              ${timeInputMarkup("overtimeRest2StartTime", item.rest2StartTime || "", !(item.useRest1 && item.useRest2))}
            </div>
            <div class="form-row">
              <label for="overtimeRest2EndTime">休息2結束</label>
              ${timeInputMarkup("overtimeRest2EndTime", item.rest2EndTime || "", !(item.useRest1 && item.useRest2))}
            </div>
          </div>
        </div>
      ` : ""}
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="${category}HiddenFromToolbar" type="checkbox" ${item.hiddenFromToolbar ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-named-item="${category}:${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
  if (category === "overtime") {
    syncOvertimeFormUi();
  }
  syncNamedColorUi();
}

async function saveNamedColorItem(category, mode) {
  const returnTo = modalContext.returnTo || null;
  if (category === "shift") {
    void saveShiftFromModal(mode);
    return;
  }
  const selectedLeave = category === "leave"
    ? LEAVE_CATALOG.find((entry) => entry.code === (document.getElementById("leaveCatalogCode")?.value || ""))
    : null;
  const name = category === "leave"
    ? (document.getElementById("leaveCatalogName")?.value.trim() || "")
    : (document.getElementById("namedItemName")?.value.trim() || "");
  if (!name) {
    document.getElementById(category === "leave" ? "leaveCatalogName" : "namedItemName")?.focus();
    return;
  }
  if (category === "overtime") {
    const startTime = readTimeInputValue("overtimeStartTime");
    const endTime = readTimeInputValue("overtimeEndTime");
    if (!isValidTimeRange(startTime, endTime)) {
      reportValidationError("上班時間必須早於下班時間");
      return;
    }
    const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
    const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked) && useRest1;
    if (useRest1) {
      const rest1Start = readTimeInputValue("overtimeRest1StartTime");
      const rest1End = readTimeInputValue("overtimeRest1EndTime");
      if (!isValidTimeRange(rest1Start, rest1End)) {
        reportValidationError("休息1開始時間必須早於結束時間");
        return;
      }
      if (useRest2) {
        const rest2Start = readTimeInputValue("overtimeRest2StartTime");
        const rest2End = readTimeInputValue("overtimeRest2EndTime");
        if (!isValidTimeRange(rest2Start, rest2End)) {
          reportValidationError("休息2開始時間必須早於結束時間");
          return;
        }
      }
    }
  }
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid(category[0]),
    code: category === "leave" ? selectedLeave?.code : undefined,
    name,
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    requiresTime: category === "leave" ? document.getElementById("leaveRequiresTime")?.checked : undefined,
    requiresReason: category === "leave" ? document.getElementById("leaveRequiresReason")?.checked : undefined,
    hiddenFromToolbar: Boolean(document.getElementById(`${category}HiddenFromToolbar`)?.checked),
    startTime: category === "overtime" ? readTimeInputValue("overtimeStartTime") : undefined,
    endTime: category === "overtime" ? readTimeInputValue("overtimeEndTime") : undefined,
    useRest1: category === "overtime" ? Boolean(document.getElementById("overtimeUseRest1")?.checked) : undefined,
    rest1StartTime: category === "overtime" ? readTimeInputValue("overtimeRest1StartTime") : undefined,
    rest1EndTime: category === "overtime" ? readTimeInputValue("overtimeRest1EndTime") : undefined,
    useRest2: category === "overtime" ? Boolean(document.getElementById("overtimeUseRest2")?.checked) : undefined,
    rest2StartTime: category === "overtime" ? readTimeInputValue("overtimeRest2StartTime") : undefined,
    rest2EndTime: category === "overtime" ? readTimeInputValue("overtimeRest2EndTime") : undefined
  };
  if (category === "overtime" && payload.useRest1 === false) {
    payload.useRest2 = false;
    payload.rest1StartTime = "";
    payload.rest1EndTime = "";
    payload.rest2StartTime = "";
    payload.rest2EndTime = "";
  } else if (category === "overtime" && payload.useRest2 === false) {
    payload.rest2StartTime = "";
    payload.rest2EndTime = "";
  }
  const currentList = getItemList(category);
  const nextList = mode === "edit"
    ? currentList.map((item) => item.id === payload.id ? payload : item)
    : [...currentList, payload];
  const sortOrder = mode === "edit"
    ? currentList.findIndex((item) => item.id === payload.id)
    : currentList.length;
  try {
    await window.schedulerApi.saveCatalogItem(category, payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`${category === "leave" ? "假別" : "加班"}儲存失敗：${error.message}`);
    return;
  }
  if (category === "leave") state.leaves = nextList;
  if (category === "overtime") state.overtime = nextList;
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: category, scrollTop: 0 });
}

async function deleteListItem(category, id) {
  const labelMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  const returnTo = captureSettingsReturnContext({
    category: "list-settings",
    listCategory: category
  });
  const confirmed = await confirmAction(`確定要刪除這個${labelMap[category] || "項目"}嗎？`);
  if (!confirmed) {
    return;
  }

  try {
    await window.schedulerApi.deleteCatalogItem(category, id);
  } catch (error) {
    setSaveStatus(`${labelMap[category] || "項目"}刪除失敗：${error.message || error}`);
    return;
  }

  if (category === "shift") {
    state.shifts = state.shifts.filter((item) => item.id !== id);
    state.members = state.members.map((member) => ({
      ...member,
      scheduleShiftIds: getMemberScheduleShiftIds(member).filter((shiftId) => shiftId !== id)
    }));
  }
  if (category === "leave") state.leaves = state.leaves.filter((item) => item.id !== id);
  if (category === "overtime") state.overtime = state.overtime.filter((item) => item.id !== id);
  removeAssignmentsByItem(category, id);
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
}
;

/* ===== renderer-settings-department.js ===== */
async function openDepartmentSettings() {
  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {
    showInfoMessage(`讀取管理資料失敗：${error.message || error}`);
    return;
  }
  departmentSettingsView = "department";
  modalContext = { category: "department-settings", view: "department" };
  const activeMembers = state.members.filter(isMemberCurrentlyActive);
  const departmentRows = state.departments.map((department) => {
    const homeMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) === department.id);
    const startDate = department.startDate || "-";
    const endDate = department.endDate || "-";
    return `
      <div class="department-settings-row sortable-settings-item" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">
         ${renderSettingsOrderDragColumn()}
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
             ${renderSettingsOrderDragColumn(true)}
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
}

function renderDepartmentAttendanceFields(department, disabledAttr) {
  return `
      <div class="settings-form-divider"></div>
      <div class="form-row">
        <label for="departmentAddress">地址</label>
        <input id="departmentAddress" type="text" value="${escapeHtml(department.address || "")}" placeholder="打卡地點地址" ${disabledAttr}>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentLatitude">緯度</label>
          <input id="departmentLatitude" type="number" step="0.000001" min="-90" max="90" value="${escapeHtml(String(department.latitude ?? ""))}" placeholder="例如 25.033964" ${disabledAttr}>
        </div>
        <div class="form-row">
          <label for="departmentLongitude">經度</label>
          <input id="departmentLongitude" type="number" step="0.000001" min="-180" max="180" value="${escapeHtml(String(department.longitude ?? ""))}" placeholder="例如 121.564468" ${disabledAttr}>
        </div>
      </div>
      <div class="form-row">
        <label for="departmentPublicIp">固定對外 IP</label>
        <input id="departmentPublicIp" type="text" value="${escapeHtml(department.publicIp || "")}" placeholder="可用逗號或空白分隔多組 IP" ${disabledAttr}>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentAttendanceEnabled" type="checkbox" ${department.attendanceEnabled ? "checked" : ""} ${disabledAttr}>
          是否啟用打卡
        </label>
      </div>
      ${isAdmin() ? "" : '<p class="modal-description">打卡地址、座標、固定 IP 與是否啟用打卡只有管理員可以修改。</p>'}
  `;
}

function renderDepartmentFormBody(department, attendanceFieldsDisabled) {
  return `
      <div class="form-row">
        <label for="departmentName">單位名稱</label>
        <input id="departmentName" type="text" maxlength="12" value="${escapeHtml(department.name)}" placeholder="請輸入單位名稱">
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentStartDate">開始日期</label>
          <input id="departmentStartDate" type="date" value="${escapeHtml(department.startDate || "")}">
        </div>
        <div class="form-row">
          <label for="departmentEndDate">結束日期</label>
          <input id="departmentEndDate" type="date" value="${escapeHtml(department.endDate || "")}">
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentHiddenFromSchedule" type="checkbox" ${department.hiddenFromSchedule ? "checked" : ""}>
          不顯示於班表
        </label>
      </div>
      ${renderDepartmentAttendanceFields(department, attendanceFieldsDisabled)}
  `;
}

function openDepartmentForm(mode, departmentId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView })
    : null;
  const department = mode === "edit"
    ? state.departments.find((item) => item.id === departmentId)
    : { id: "", name: "", startDate: "", endDate: "", hiddenFromSchedule: false, address: "", latitude: "", longitude: "", publicIp: "", attendanceEnabled: false };
  if (!department) {
    return;
  }
  const attendanceFieldsDisabled = isAdmin() ? "" : "disabled";
  modalContext = { mode, category: "department", targetId: departmentId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}單位`,
    modalClass: "modal modal-form-compact settings-edit-form",
    body: `
      <div class="form-row">
        <label for="departmentName">單位名稱</label>
        <input id="departmentName" type="text" maxlength="12" value="${escapeHtml(department.name)}" placeholder="請輸入單位名稱">
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentStartDate">開始日期</label>
          <input id="departmentStartDate" type="date" value="${escapeHtml(department.startDate || "")}">
        </div>
        <div class="form-row">
          <label for="departmentEndDate">結束日期</label>
          <input id="departmentEndDate" type="date" value="${escapeHtml(department.endDate || "")}">
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentHiddenFromSchedule" type="checkbox" ${department.hiddenFromSchedule ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-department="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    body: renderDepartmentFormBody(department, attendanceFieldsDisabled),
    hideFooterClose: true
  });
}

async function saveDepartment(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("departmentName")?.value.trim();
  const startDate = document.getElementById("departmentStartDate")?.value || "";
  const endDate = document.getElementById("departmentEndDate")?.value || "";
  const hiddenFromSchedule = Boolean(document.getElementById("departmentHiddenFromSchedule")?.checked);
  const previousDepartment = mode === "edit"
    ? state.departments.find((department) => department.id === modalContext.targetId) || null
    : null;
  const latitudeInput = document.getElementById("departmentLatitude")?.value.trim() || "";
  const longitudeInput = document.getElementById("departmentLongitude")?.value.trim() || "";
  const latitude = latitudeInput === "" ? "" : Number(latitudeInput);
  const longitude = longitudeInput === "" ? "" : Number(longitudeInput);
  if (!name) {
    document.getElementById("departmentName")?.focus();
    return;
  }
  if (startDate && endDate && !isValidDateRange(startDate, endDate)) {
    reportValidationError("開始日期必須早於結束日期");
    return;
  }
  if (isAdmin() && latitude !== "" && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    reportValidationError("緯度必須介於 -90 到 90");
    return;
  }
  if (isAdmin() && longitude !== "" && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    reportValidationError("經度必須介於 -180 到 180");
    return;
  }
  const attendancePayload = isAdmin()
    ? {
      address: document.getElementById("departmentAddress")?.value.trim() || "",
      latitude,
      longitude,
      publicIp: document.getElementById("departmentPublicIp")?.value.trim() || "",
      attendanceEnabled: Boolean(document.getElementById("departmentAttendanceEnabled")?.checked)
    }
    : {
      address: previousDepartment?.address || "",
      latitude: previousDepartment?.latitude ?? "",
      longitude: previousDepartment?.longitude ?? "",
      publicIp: previousDepartment?.publicIp || "",
      attendanceEnabled: Boolean(previousDepartment?.attendanceEnabled)
    };
  const payload = { id: mode === "edit" ? modalContext.targetId : uid("d"), name, startDate, endDate, hiddenFromSchedule, ...attendancePayload };
  const sortOrder = mode === "edit"
    ? state.departments.findIndex((department) => department.id === payload.id)
    : state.departments.length;
  try {
    await window.schedulerApi.saveDepartmentItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    const message = formatSchedulerError(error, "單位儲存失敗");
    setSaveStatus(`單位儲存失敗：${message}`);
    showInfoMessage(`單位儲存失敗：${message}`);
    return;
  }
  if (mode === "edit") {
    state.departments = state.departments.map((department) => department.id === modalContext.targetId ? payload : department);
  } else {
    state.departments.push(payload);
  }
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "department-settings", view: departmentSettingsView, scrollTop: 0 });
}

function removeScheduleByMember(memberId) {
  Object.keys(state.schedule).forEach((key) => {
    if (key.startsWith(`${memberId}_`)) {
      delete state.schedule[key];
    }
  });
}

async function deleteDepartment(departmentId) {
  const memberIds = state.members.filter((member) => getMemberHomeDeptId(member) === departmentId).map((member) => member.id);
  if (memberIds.length) {
    showInfoMessage("這個單位還有人員，請先將人員移轉到其他單位後再刪除。");
    return;
  }
  const usedShifts = state.shifts.filter((shift) => shift.applicableDeptId === departmentId);
  if (usedShifts.length) {
    showInfoMessage(`這個單位仍有班別使用，請先修改有使用的班別：${usedShifts.map((shift) => shift.name).join("、")}`);
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  const confirmed = await confirmAction("確定要刪除這個單位嗎？");
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.deleteDepartmentItem(departmentId);
  } catch (error) {
    showInfoMessage(formatSchedulerError(error, "單位刪除失敗"));
    return;
  }
  state.departments = state.departments.filter((department) => department.id !== departmentId);
  memberIds.forEach(removeScheduleByMember);
  if (state.deptFilter === departmentId) {
    state.deptFilter = "all";
  }
  if (state.tableDeptScopeFilter === departmentId) {
    state.tableDeptScopeFilter = "all";
  }
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
  queueSave();
}

async function moveMemberToDepartment(memberId, departmentId, targetMemberId = "") {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || targetMemberId === memberId) {
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  const remaining = state.members.filter((item) => item.id !== memberId);
  const targetDeptId = targetMemberId
    ? (getMemberHomeDeptId(remaining.find((item) => item.id === targetMemberId)) || departmentId)
    : departmentId;
  const grouped = new Map(state.departments.map((department) => [department.id, []]));
  remaining.forEach((item) => {
    const homeDeptId = getMemberHomeDeptId(item);
    if (grouped.has(homeDeptId)) {
      grouped.get(homeDeptId).push(item);
    }
  });
  if (!grouped.has(targetDeptId)) {
    return;
  }
  const movedMember = { ...member, deptId: targetDeptId };
  const targetList = grouped.get(targetDeptId);
  const targetIndex = targetMemberId ? targetList.findIndex((item) => item.id === targetMemberId) : -1;
  if (targetIndex >= 0) {
    targetList.splice(targetIndex, 0, movedMember);
  } else {
    targetList.push(movedMember);
  }
  state.members = state.departments.flatMap((department) => grouped.get(department.id) || []);
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
  queueSave();
}

function moveDragPreviewElement(draggedElement, targetElement, clientY) {
  if (!(draggedElement instanceof HTMLElement) || !(targetElement instanceof HTMLElement) || draggedElement === targetElement) {
    return false;
  }
  const parent = targetElement.parentElement;
  if (!parent || draggedElement.parentElement !== parent) {
    return false;
  }
  const targetRect = targetElement.getBoundingClientRect();
  const insertAfter = clientY > targetRect.top + targetRect.height / 2;
  const referenceNode = insertAfter ? targetElement.nextElementSibling : targetElement;
  if (referenceNode === draggedElement || draggedElement.nextElementSibling === referenceNode) {
    return true;
  }
  parent.insertBefore(draggedElement, referenceNode);
  dragPreviewElement = draggedElement;
  return true;
}

function cssEscapeValue(value) {
  return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
}

function clearDragPreviewState() {
  if (dragPreviewElement instanceof HTMLElement) {
    dragPreviewElement.classList.remove("drag-preview-active");
    dragPreviewElement.classList.remove("schedule-order-insert-before");
    dragPreviewElement.classList.remove("schedule-order-insert-after");
  }
  document.querySelectorAll(".drag-preview-active, .schedule-order-insert-before, .schedule-order-insert-after").forEach((element) => {
    element.classList.remove("drag-preview-active");
    element.classList.remove("schedule-order-insert-before");
    element.classList.remove("schedule-order-insert-after");
  });
  dragPreviewElement = null;
}

function markDragPreviewTarget(element, insertAfter = null) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if (dragPreviewElement !== element) {
    clearDragPreviewState();
    dragPreviewElement = element;
  }
  element.classList.add("drag-preview-active");
  if (insertAfter !== null) {
    element.classList.toggle("schedule-order-insert-before", !insertAfter);
    element.classList.toggle("schedule-order-insert-after", insertAfter);
  }
}

function markScheduleTableOrderTarget(element, clientY) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const insertAfter = clientY > rect.top + rect.height / 2;
  markDragPreviewTarget(element, insertAfter);
  return insertAfter;
}

function getScheduleTableOrderInsertAfter(element, clientY) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.classList.contains("schedule-order-insert-after")) {
    return true;
  }
  if (element.classList.contains("schedule-order-insert-before")) {
    return false;
  }
  return markScheduleTableOrderTarget(element, clientY);
}

function previewSortableSettingsItem(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-sort-item="${cssEscapeValue(dragSortItemId)}"][data-sort-category="${cssEscapeValue(dragSortCategory)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  return moveDragPreviewElement(draggedElement, targetElement, clientY);
}

function previewScheduleShiftOption(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-schedule-shift-option="${cssEscapeValue(dragScheduleShiftId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  if (!moveDragPreviewElement(draggedElement, targetElement, clientY)) {
    return false;
  }
  syncScheduleShiftSelectorRanks();
  syncScheduleShiftSummary();
  return true;
}

function previewDepartmentMember(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-member-card="${cssEscapeValue(dragMemberId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  return moveDragPreviewElement(draggedElement, targetElement, clientY);
}
;

/* ===== renderer-settings-ordering.js ===== */
function renderSettingsOrderDragColumn(isHeader = false) {
  return `<div class="settings-order-drag-col">${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span>'}</div>`;
}

function getOrderedIdsFromDom(selector, attributeName) {
  return Array.from(document.querySelectorAll(selector))
    .map((element) => element instanceof HTMLElement ? element.dataset[attributeName] || "" : "")
    .filter(Boolean);
}

function applyOrderedIds(list, orderedIds) {
  const byId = new Map(list.map((item) => [item.id, item]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const missing = list.filter((item) => !orderedIds.includes(item.id));
  return [...ordered, ...missing];
}

function getSortableSettingsList(category) {
  if (category === "department") return state.departments;
  if (category === "member") return state.members;
  if (["shift", "leave", "overtime"].includes(category)) return getItemList(category);
  return null;
}

function captureSortableSettingsReturnContext(category) {
  if (category === "department") {
    return captureSettingsReturnContext({
      category: "department-settings",
      view: departmentSettingsView
    });
  }
  if (category === "member") {
    return captureSettingsReturnContext({ category: "member-settings" });
  }
  return captureSettingsReturnContext({
    category: "list-settings",
    listCategory: category
  });
}

function reopenSortedSettings(_category, returnTo) {
  void reopenSettingsModalPreservingScroll(returnTo);
}

function commitSortedListFromDom(category) {
  const currentList = getSortableSettingsList(category);
  if (!currentList) {
    return false;
  }
  const orderedIds = getOrderedIdsFromDom(`[data-sort-category="${cssEscapeValue(category)}"][data-sort-item]`, "sortItem");
  if (!orderedIds.length || orderedIds.join("|") === currentList.map((item) => item.id).join("|")) {
    return false;
  }
  const returnTo = captureSortableSettingsReturnContext(category);
  const nextList = applyOrderedIds(currentList, orderedIds);
  if (category === "department") {
    state.departments = nextList;
  }
  if (category === "member") {
    state.members = nextList;
  }
  if (category === "shift") {
    state.shifts = nextList;
  }
  if (category === "leave") {
    state.leaves = nextList;
  }
  if (category === "overtime") {
    state.overtime = nextList;
  }
  renderAll();
  reopenSortedSettings(category, returnTo);
  queueSave();
  return true;
}

function commitDepartmentMemberOrderFromDom() {
  const visibleIds = getOrderedIdsFromDom("[data-member-card]", "memberCard");
  if (!visibleIds.length) {
    return false;
  }
  const visibleIdSet = new Set(visibleIds);
  const visibleById = new Map(state.members.filter((member) => visibleIdSet.has(member.id)).map((member) => [member.id, member]));
  const groupedVisibleIds = new Map(state.departments.map((department) => [department.id, []]));
  document.querySelectorAll(".department-settings-row[data-drop-department]").forEach((container) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const departmentId = container.dataset.dropDepartment || "";
    if (!groupedVisibleIds.has(departmentId)) {
      return;
    }
    container.querySelectorAll("[data-member-card]").forEach((element) => {
      if (element instanceof HTMLElement && element.dataset.memberCard) {
        groupedVisibleIds.get(departmentId).push(element.dataset.memberCard);
      }
    });
  });
  const nextMembers = [];
  state.departments.forEach((department) => {
    const visibleMembers = (groupedVisibleIds.get(department.id) || [])
      .map((memberId) => visibleById.get(memberId))
      .filter(Boolean);
    const hiddenMembers = state.members.filter((member) => getMemberHomeDeptId(member) === department.id && !visibleIdSet.has(member.id));
    nextMembers.push(...visibleMembers, ...hiddenMembers);
  });
  const includedIds = new Set(nextMembers.map((member) => member.id));
  nextMembers.push(...state.members.filter((member) => !includedIds.has(member.id)));
  if (nextMembers.map((member) => member.id).join("|") === state.members.map((member) => member.id).join("|")) {
    return false;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  state.members = nextMembers;
  renderAll();
  void reopenSettingsModalPreservingScroll(returnTo);
  queueSave();
  return true;
}
;

/* ===== renderer-settings-member.js ===== */
function buildSelectOptions(items, valueField, labelBuilder, selectedValue, includeEmpty = false, emptyLabel = "未指定") {
  const entries = [];
  if (includeEmpty) {
    entries.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  }
  entries.push(...items.map((item) => `<option value="${escapeHtml(item[valueField])}" ${item[valueField] === selectedValue ? "selected" : ""}>${escapeHtml(labelBuilder(item))}</option>`));
  return entries.join("");
}

function renderScheduleShiftSelector(member) {
  const selectedIds = getMemberScheduleShiftIds(member);
  const visibleShifts = state.shifts.filter((shift) => !shift.hiddenFromToolbar);
  const orderedShifts = [
    ...selectedIds.map((shiftId) => visibleShifts.find((shift) => shift.id === shiftId)).filter(Boolean),
    ...visibleShifts.filter((shift) => !selectedIds.includes(shift.id))
  ];
  return `
    <div class="schedule-dept-list" id="memberScheduleShiftList" hidden>
      ${orderedShifts.map((shift, index) => {
        const checked = selectedIds.includes(shift.id);
        return `
          <label class="schedule-dept-option" draggable="true" data-schedule-shift-option="${escapeHtml(shift.id)}">
            <input type="checkbox" value="${escapeHtml(shift.id)}" ${checked ? "checked" : ""}>
            <span class="schedule-dept-rank">${checked ? index + 1 : "-"}</span>
            <span>${escapeHtml(shift.name)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function readMemberScheduleShiftIds() {
  return Array.from(document.querySelectorAll("#memberScheduleShiftList [data-schedule-shift-option]"))
    .filter((row) => row.querySelector("input")?.checked)
    .map((row) => row.dataset.scheduleShiftOption || "")
    .filter(Boolean);
}

function syncScheduleShiftSummary() {
  const summary = document.querySelector(".schedule-shift-summary");
  if (!summary) {
    return;
  }
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = readMemberScheduleShiftIds()
    .map((shiftId) => shiftMap.get(shiftId))
    .filter(Boolean);
  summary.textContent = names.length ? names.join("、") : "未指定";
}

function syncScheduleShiftSelectorRanks() {
  let rank = 1;
  document.querySelectorAll("#memberScheduleShiftList [data-schedule-shift-option]").forEach((row) => {
    const rankElement = row.querySelector(".schedule-dept-rank");
    const checked = Boolean(row.querySelector("input")?.checked);
    if (rankElement) {
      rankElement.textContent = checked ? String(rank) : "-";
    }
    if (checked) {
      rank += 1;
    }
  });
}

function getFilteredMemberSettingsMembers() {
  const normalizedName = memberSettingsFilters.name.trim().toLowerCase();
  const sourceMembers = state.members;
  const filteredMembers = sourceMembers.filter((member) => {
    const matchesName = !normalizedName || member.name.toLowerCase().includes(normalizedName);
    const matchesDepartment = memberSettingsFilters.department === "all"
      ? true
      : memberSettingsFilters.department === "__none__"
        ? !getMemberHomeDeptId(member)
        : getMemberHomeDeptId(member) === memberSettingsFilters.department;
    const matchesRole = memberSettingsFilters.role === "all"
      ? true
      : normalizeRole(member.role) === memberSettingsFilters.role;
    const active = isMemberCurrentlyActive(member);
    const matchesEmployment = memberSettingsFilters.employment === "all"
      ? true
      : memberSettingsFilters.employment === "inactive"
        ? !active
        : active;
    const matchesSalaryType = memberSettingsFilters.salaryType === "all"
      ? true
      : memberSettingsFilters.salaryType === "daily"
        ? Boolean(member.payByDay)
        : !member.payByDay;
    return matchesName && matchesDepartment && matchesRole && matchesEmployment && matchesSalaryType;
  });
  return { sourceMembers, filteredMembers };
}

function renderMemberSettingsList() {
  const { sourceMembers, filteredMembers } = getFilteredMemberSettingsMembers();
  return `
      ${sourceMembers.length
        ? `
      <div class="member-table-wrap">
        <div class="member-table-scroll">
          <div class="member-table">
            <div class="member-table-row member-table-head">
              ${renderSettingsOrderDragColumn(true)}
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
              <div class="member-table-row sortable-settings-item" data-sort-category="member" data-sort-item="${escapeHtml(member.id)}" data-member-settings-row="${escapeHtml(member.id)}">
                 ${renderSettingsOrderDragColumn()}
                 <div class="member-table-code">${escapeHtml(member.code)}</div>
                <div class="member-table-name">${escapeHtml(member.name)}</div>
                <div class="member-shift-pill-list">${renderMemberScheduleShiftPills(member)}</div>
                <div>${getRoleLabel(member.role)}</div>
                <div class="member-date-stack"><span>${escapeHtml(member.hireDate || "-")}</span><span>${escapeHtml(member.leaveDate || "-")}</span></div>
                <div>${getSalaryTypeLabel(member)}</div>
                <div>${getRestWeekdayLabel(member.fixedRestWeekday)}</div>
                <div class="member-table-actions">
                  ${canEditAccount ? renderActionIconButton("edit", `data-edit-member="${escapeHtml(member.id)}"`) : ""}
                  ${canEditAccount ? renderActionIconButton("delete", `data-delete-member="${escapeHtml(member.id)}"`) : ""}
                </div>
              </div>
            `;
            }).join("")}
          </div>
        </div>
      </div>
        `
        : '<div class="empty-state">目前還沒有人員</div>'
      }
      ${sourceMembers.length && !filteredMembers.length ? '<div class="empty-state">沒有符合篩選條件的人員</div>' : ""}
    `;
}

function refreshMemberSettingsList() {
  const list = document.getElementById("memberSettingsList");
  if (!list) return;

  const scroll = list.querySelector(".member-table-scroll");
  const scrollTop = scroll?.scrollTop || 0;
  const active = document.activeElement;
  const field = active?.matches?.("[data-member-settings-filter-field]")
    ? active.dataset.memberSettingsFilterField
    : "";
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;

  list.innerHTML = renderMemberSettingsList();

  const nextScroll = list.querySelector(".member-table-scroll");
  if (nextScroll) nextScroll.scrollTop = scrollTop;
  if (field) {
    const next = list.querySelector(`[data-member-settings-filter-field="${field}"]`);
    next?.focus();
    if (typeof next?.setSelectionRange === "function" && Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
      next.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

async function openMemberSettings() {
  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {
    showInfoMessage(`讀取管理資料失敗：${error.message || error}`);
    return;
  }
  modalContext = { category: "member-settings" };
  const body = `
      <div class="member-settings-filters">
        <div class="form-row">
          <label for="memberSettingsNameFilter">姓名</label>
          <input id="memberSettingsNameFilter" type="text" value="${escapeHtml(memberSettingsFilters.name)}" placeholder="輸入姓名" data-member-settings-filter-field="name">
        </div>
        <div class="form-row">
          <label for="memberSettingsDepartmentFilter">單位</label>
          <select id="memberSettingsDepartmentFilter" data-member-settings-filter-field="department">
            <option value="all" ${memberSettingsFilters.department === "all" ? "selected" : ""}>全部</option>
            ${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${memberSettingsFilters.department === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}
            <option value="__none__" ${memberSettingsFilters.department === "__none__" ? "selected" : ""}>未指定</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsRoleFilter">權限</label>
          <select id="memberSettingsRoleFilter" data-member-settings-filter-field="role">
            <option value="all" ${memberSettingsFilters.role === "all" ? "selected" : ""}>全部</option>
            <option value="admin" ${memberSettingsFilters.role === "admin" ? "selected" : ""}>管理員</option>
            <option value="manager" ${memberSettingsFilters.role === "manager" ? "selected" : ""}>主管</option>
            <option value="employee" ${memberSettingsFilters.role === "employee" ? "selected" : ""}>員工</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsEmploymentFilter">狀態</label>
          <select id="memberSettingsEmploymentFilter" data-member-settings-filter-field="employment">
            <option value="active" ${memberSettingsFilters.employment === "active" ? "selected" : ""}>在職</option>
            <option value="inactive" ${memberSettingsFilters.employment === "inactive" ? "selected" : ""}>離職</option>
            <option value="all" ${memberSettingsFilters.employment === "all" ? "selected" : ""}>全部</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberSettingsSalaryTypeFilter">計薪方式</label>
          <select id="memberSettingsSalaryTypeFilter" data-member-settings-filter-field="salaryType">
            <option value="all" ${memberSettingsFilters.salaryType === "all" ? "selected" : ""}>全部</option>
            <option value="monthly" ${memberSettingsFilters.salaryType === "monthly" ? "selected" : ""}>月薪</option>
            <option value="daily" ${memberSettingsFilters.salaryType === "daily" ? "selected" : ""}>日薪</option>
          </select>
        </div>
      </div>
      <div class="member-settings-list" id="memberSettingsList">${renderMemberSettingsList()}</div>
    `;
  openEntityListModal({
    title: "人員設定",
    modalClass: "modal modal-wide member-settings-modal settings-list-modal",
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-members="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-members="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-member="true">新增</button>
    `,
    hideFooterClose: true
  });
}

function renderMemberRoleOptions(member) {
  const currentRole = normalizeRole(member?.role);
  const options = isAdmin()
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value === currentRole);
  return options.map((option) => (
    `<option value="${option.value}" ${currentRole === option.value ? "selected" : ""}>${option.label}</option>`
  )).join("");
}

function openMemberForm(mode, memberId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: modalContext.view || departmentSettingsView })
    : modalContext?.category === "member-settings"
      ? captureSettingsReturnContext({ category: "member-settings" })
      : null;
  const member = mode === "edit"
    ? state.members.find((item) => item.id === memberId)
    : {
      id: "",
      code: "",
      name: "",
      deptId: state.departments[0]?.id || "",
      positionId: "",
      proxyMemberId: "",
      hireDate: "",
      leaveDate: "",
      payByDay: false,
      fixedRestWeekday: 0,
      scheduleShiftIds: [],
      role: "employee"
    };
  if (!member) {
    return;
  }
  if (!canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以修改管理員帳號");
    return;
  }
  modalContext = { mode, category: "member", targetId: memberId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}人員`,
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid two-col">
        <div class="form-row">
          <label for="memberCode">工號</label>
          <input id="memberCode" type="text" maxlength="12" value="${escapeHtml(member.code)}" placeholder="請輸入員工編號">
        </div>
        <div class="form-row">
          <label for="memberName">姓名</label>
          <input id="memberName" type="text" maxlength="12" value="${escapeHtml(member.name)}" placeholder="請輸入姓名">
        </div>
        <div class="form-row">
          <label for="memberRole">權限</label>
          <select id="memberRole" ${isAdmin() ? "" : "disabled"}>
            ${renderMemberRoleOptions(member)}
          </select>
        </div>
        <div class="form-row">
          <label for="memberSalaryType">計薪方式</label>
          <select id="memberSalaryType">
            <option value="monthly" ${member.payByDay ? "" : "selected"}>月薪</option>
            <option value="daily" ${member.payByDay ? "selected" : ""}>日薪</option>
          </select>
        </div>
        <div class="form-row">
          <label for="memberHireDate">到職日</label>
          <input id="memberHireDate" type="date" value="${escapeHtml(member.hireDate)}">
        </div>
        <div class="form-row">
          <label for="memberLeaveDate">離職日</label>
          <input id="memberLeaveDate" type="date" value="${escapeHtml(member.leaveDate)}">
        </div>
        <div class="form-row">
          <label for="memberFixedRestWeekday">例假星期</label>
          <select id="memberFixedRestWeekday">
            ${REST_WEEKDAY_OPTIONS.map((option) => (
              `<option value="${option.value}" ${normalizeRestWeekday(member.fixedRestWeekday) === option.value ? "selected" : ""}>${option.label}</option>`
            )).join("")}
          </select>
        </div>
        <div class="form-row">
          <label for="memberDept">所屬單位</label>
          <select id="memberDept">
            ${buildSelectOptions(state.departments, "id", (department) => department.name, member.deptId || "")}
          </select>
        </div>
        ${mode === "edit" ? `
          <div class="form-row">
            <button class="ghost-btn" type="button" data-reset-member-password="${escapeHtml(member.code)}">重設密碼為 0000</button>
          </div>
        ` : ""}
        <div class="form-row form-row-wide">
          <label>排班班別</label>
          <div class="schedule-dept-summary-row">
            <div class="readonly-pill schedule-shift-summary">${escapeHtml(getMemberScheduleShiftNames(member))}</div>
            <button class="ghost-btn compact-btn" type="button" data-toggle-schedule-shifts="true">設定</button>
          </div>
          ${renderScheduleShiftSelector(member)}
        </div>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-member="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveMember(mode) {
  const returnTo = modalContext.returnTo || null;
  const hireDate = document.getElementById("memberHireDate")?.value || "";
  const leaveDate = document.getElementById("memberLeaveDate")?.value || "";
  if (hireDate && leaveDate && !isValidDateRange(hireDate, leaveDate)) {
    reportValidationError("到職日必須早於離職日");
    return;
  }
  const previousMember = mode === "edit"
    ? state.members.find((member) => member.id === modalContext.targetId) || null
    : null;
  const selectedHomeDeptId = document.getElementById("memberDept")?.value || "";
  const scheduleShiftIds = readMemberScheduleShiftIds();
  const homeDeptId = selectedHomeDeptId || previousMember?.deptId || "";
  const monthlyRestDays = Math.max(0, Number(previousMember?.monthlyRestDays) || 0);
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("m"),
    code: document.getElementById("memberCode")?.value.trim(),
    name: document.getElementById("memberName")?.value.trim(),
    deptId: homeDeptId,
    scheduleShiftIds,
    positionId: mode === "edit" ? (state.members.find((member) => member.id === modalContext.targetId)?.positionId || "") : "",
    proxyMemberId: "",
    hireDate,
    leaveDate,
    payByDay: document.getElementById("memberSalaryType")?.value === "daily",
    fixedRestWeekday: normalizeRestWeekday(document.getElementById("memberFixedRestWeekday")?.value),
    monthlyRestDays,
    role: isAdmin() ? normalizeRole(document.getElementById("memberRole")?.value) : normalizeRole(previousMember?.role)
  };
  if (!payload.code || !payload.name) {
    reportValidationError("請填寫人員編號與姓名");
    return;
  }
  if (!payload.deptId) {
    reportValidationError("請選擇所屬單位");
    return;
  }
  try {
    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");
  } catch (error) {
    reportValidationError(`同步人員資料失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.members = state.members.map((member) => member.id === payload.id ? payload : member);
  } else {
    state.members.push(payload);
  }
  if (currentProfile && currentProfile.employee_code === (previousMember?.code || payload.code)) {
    currentProfile = {
      ...currentProfile,
      employee_code: payload.code,
      full_name: payload.name,
      role: payload.role
    };
  }
  currentMember = resolveCurrentMember();
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "member-settings", scrollTop: 0 });
}

async function exportMembersFromSettings() {
  try {
    await window.schedulerApi.exportMembers({
      state,
      year: state.year,
      month: state.month
    });
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function importMembersFromSettings() {
  const returnTo = captureSettingsReturnContext({ category: "member-settings" });
  try {
    const result = await window.schedulerApi.importMembers();
    if (result.canceled) {
      return;
    }
    const departmentMap = new Map(state.departments.map((department) => [department.name.trim(), department.id]));
    const shiftMap = new Map(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id]));
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let syncFailed = 0;
    let firstSyncError = "";

    for (const row of result.rows || []) {
      const code = String(row.code || "").trim();
      const name = String(row.name || "").trim();
      const departmentName = String(row.departmentName || "").trim();
      const deptId = departmentMap.get(departmentName);
      const scheduleShiftNames = String(row.scheduleShiftNames || "")
        .split(/[、,，]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const hasUnknownScheduleShift = scheduleShiftNames.some((value) => !shiftMap.has(value));
      const scheduleShiftIds = scheduleShiftNames
        .map((value) => shiftMap.get(value))
        .filter((shiftIdValue, index, list) => shiftIdValue && list.indexOf(shiftIdValue) === index);
      if (!code || !name || !deptId || hasUnknownScheduleShift) {
        skipped += 1;
        continue;
      }
      if (row.hireDate && row.leaveDate && !isValidDateRange(row.hireDate, row.leaveDate)) {
        skipped += 1;
        continue;
      }
      const existing = state.members.find((member) => member.code === code) || null;
      const payload = {
        id: existing?.id || uid("m"),
        code,
        name,
        deptId,
        scheduleShiftIds,
        positionId: existing?.positionId || "",
        proxyMemberId: existing?.proxyMemberId || "",
        hireDate: row.hireDate || "",
        leaveDate: row.leaveDate || "",
        payByDay: Boolean(row.payByDay),
        fixedRestWeekday: normalizeRestWeekday(row.fixedRestWeekday),
        monthlyRestDays: Math.max(0, Number(row.monthlyRestDays) || 0),
        role: isAdmin() ? normalizeRole(row.role) : normalizeRole(existing?.role)
      };
      if (!existing) {
        try {
          await window.schedulerApi.syncMemberProfile(payload, "");
        } catch (error) {
          syncFailed += 1;
          if (!firstSyncError) {
            firstSyncError = `${code || "(空白工號)"}：${error.message || "同步失敗"}`;
          }
          continue;
        }
      }
      if (existing) {
        state.members = state.members.map((member) => member.id === existing.id ? payload : member);
        updated += 1;
      } else {
        state.members.push(payload);
        imported += 1;
      }
    }

    currentMember = resolveCurrentMember();
    renderAll();
    await reopenSettingsModalPreservingScroll(returnTo);
    queueSave();
    const summary = `匯入完成：新增 ${imported} 筆，更新 ${updated} 筆，略過 ${skipped} 筆，同步失敗 ${syncFailed} 筆`;
    if (syncFailed > 0) {
      showInfoMessage(`${summary}\n第一筆同步失敗：${firstSyncError}`);
      setSaveStatus(`匯入同步失敗：${firstSyncError}`);
      return;
    }
    showInfoMessage(summary);
  } catch (error) {
    setSaveStatus(`匯入失敗：${error.message}`);
  }
}

async function deleteMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  if (!canEditMemberAccount(member)) {
    showInfoMessage("沒有權限刪除此帳號");
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "member-settings" });
  const selfDelete = member.code === currentProfile?.employee_code;
  const confirmed = await confirmAction(selfDelete
    ? "確定要刪除自己的帳號嗎？刪除後會立即登出。"
    : "確定要刪除這位人員嗎？");
  if (!confirmed) return;
  let currentPassword = "";
  if (selfDelete) {
    currentPassword = window.prompt("請輸入目前密碼以確認刪除帳號：") || "";
    if (!currentPassword) {
      showInfoMessage("未輸入目前密碼，已取消刪除");
      return;
    }
  }
  let result;
  try {
    result = await window.schedulerApi.deleteMemberProfile(member.code, currentPassword);
    if (!result?.deleted) throw new Error("找不到這位人員，請重新整理後再試");
  } catch (error) {
    showInfoMessage(`刪除人員失敗：${error.message || error}`);
    return;
  }
  if (selfDelete) {
    await window.schedulerApi.signOut();
    window.location.reload();
    return;
  }
  state.members = state.members.filter((item) => item.id !== memberId);
  state.members = state.members.map((item) => ({
    ...item,
    proxyMemberId: item.proxyMemberId === memberId ? "" : item.proxyMemberId
  }));
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
  showInfoMessage(result?.softDeleted ? "人員已停用，歷史紀錄已保留" : "人員已刪除");
}

async function resetMemberPasswordFromModal(employeeCode) {
  const code = String(employeeCode || "").trim();
  if (!code) {
    return;
  }
  const member = state.members.find((item) => item.code === code);
  if (member && !canEditMemberAccount(member)) {
    showInfoMessage("只有管理員可以重設管理員密碼");
    return;
  }
  const confirmed = await confirmAction(`確定要將 ${code} 的密碼重設為 0000 嗎？`);
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.resetMemberPassword(code);
    showInfoMessage(`${code} 的密碼已重設為 0000`);
  } catch (error) {
    setSaveStatus(`重設密碼失敗：${error.message}`);
  }
}
;

/* ===== renderer-overtime-employee.js ===== */
function getSelectedOvertimeDate() {
  return attendanceOvertimeState.selectedWorkDate || getTodayDateString();
}

function formatOvertimeShiftTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : "--:--";
}

function formatOvertimeAttendanceTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function formatOvertimeHours(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? String(number) : "0";
}

function renderOvertimeEstimate(stateValue, eligibility) {
  const shiftName = stateValue?.shift?.name || "未排班";
  const shiftStart = formatOvertimeShiftTime(stateValue?.shift?.start_time);
  const shiftEnd = formatOvertimeShiftTime(stateValue?.shift?.end_time);
  const clockIn = formatOvertimeAttendanceTime(stateValue?.attendance?.clock_in_at);
  const clockOut = formatOvertimeAttendanceTime(stateValue?.attendance?.clock_out_at);
  const earlyHours = formatOvertimeHours(eligibility?.earlyHours);
  const lateHours = formatOvertimeHours(eligibility?.lateHours);
  const totalHours = formatOvertimeHours(eligibility?.totalHours);
  return `${escapeHtml(shiftName)}：${escapeHtml(shiftStart)} ~ ${escapeHtml(shiftEnd)}　打卡：${escapeHtml(clockIn)} ~ ${escapeHtml(clockOut)}<br>提早 ${escapeHtml(earlyHours)} 小時 + 延後 ${escapeHtml(lateHours)} 小時 = 估算 ${escapeHtml(totalHours)} 小時`;
}

function formatClockButtonStatus(record, kind) {
  const at = kind === "in" ? record.clock_in_at : record.clock_out_at;
  if (!at) return "尚未打卡";
  const departmentName = kind === "in"
    ? record.clock_in_department_name_snapshot
    : record.clock_out_department_name_snapshot;
  const source = kind === "in" ? record.clock_in_source : record.clock_out_source;
  return `${formatClockTime(at)} 在【${departmentName || "未設定"}】打卡${source ? ` (${source})` : ""}`;
}

async function loadTodayAttendanceOvertime(shouldRender = true) {
  if (!isLoggedIn()) return null;
  const workDate = getSelectedOvertimeDate();
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
}

async function submitTodayOvertimeRequest() {
  if (attendanceOvertimeState.loading) return;
  const workDate = getSelectedOvertimeDate();
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
}

async function deleteTodayOvertimeRequest() {
  const workDate = getSelectedOvertimeDate();
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
}

function renderTodayOvertimePanel() {
  const checked = Boolean(attendanceOvertimeState.expanded);
  const toggle = `<label class="overtime-use-label"><input type="checkbox" data-toggle-overtime-panel="true" ${checked ? "checked" : ""}> 加班申請</label>`;
  if (!checked) {
    return `<section class="overtime-request-panel overtime-request-toggle-only">${toggle}</section>`;
  }

  const stateValue = attendanceOvertimeState.status;
  const eligibility = stateValue?.eligibility || null;
  const request = stateValue?.request || null;
  const workDate = getSelectedOvertimeDate();
  const dateRows = attendanceOvertimeState.dates || [];
  const dateValues = [...new Set([workDate, ...dateRows.map((row) => row.workDate).filter(Boolean)])]
    .sort((left, right) => String(right).localeCompare(String(left)));
  const selector = `<div class="form-row overtime-date-row"><label for="overtimeWorkDate">申請日期</label><select id="overtimeWorkDate">${dateValues.map((date) => `<option value="${escapeHtml(date)}" ${date === workDate ? "selected" : ""}>${escapeHtml(date)}</option>`).join("")}</select></div>`;

  if (attendanceOvertimeState.loading) {
    return `<section class="overtime-request-panel">${toggle}${selector}<p class="clock-loading">讀取加班狀態...</p></section>`;
  }
  if (attendanceOvertimeState.error) {
    return `<section class="overtime-request-panel">${toggle}${selector}<div class="auth-error">${escapeHtml(attendanceOvertimeState.error)}</div></section>`;
  }
  if (!stateValue) {
    return `<section class="overtime-request-panel">${toggle}${selector}</section>`;
  }

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
    return `<section class="overtime-request-panel">${toggle}${selector}<p class="home-subtitle">${escapeHtml(eligibility?.reasons?.[0] || "目前不可申請加班")}</p></section>`;
  }

  return `<section class="overtime-request-panel">
    ${toggle}
    ${selector}
    <p class="home-subtitle overtime-estimate-text">${renderOvertimeEstimate(stateValue, eligibility)}</p>
    <div class="form-grid two-col overtime-hours-grid">
      <div class="form-row"><label for="overtimeEarlyHours">提早上班時數</label><input id="overtimeEarlyHours" type="number" min="0" step="0.5" value="${Number(eligibility.earlyHours || 0)}"></div>
      <div class="form-row"><label for="overtimeLateHours">延後下班時數</label><input id="overtimeLateHours" type="number" min="0" step="0.5" value="${Number(eligibility.lateHours || 0)}"></div>
      <div class="form-row form-row-wide"><label for="overtimeEmployeeNote">加班備註</label><input id="overtimeEmployeeNote" type="text" placeholder="可填寫加班原因或補充說明"></div>
    </div>
    <button class="btn-primary overtime-submit-btn" type="button" data-submit-today-overtime="true">送出加班申請</button>
  </section>`;
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "overtimeWorkDate") {
    attendanceOvertimeState = { ...attendanceOvertimeState, selectedWorkDate: target.value };
    void loadTodayAttendanceOvertime();
  }
});
;

/* ===== renderer-request-helpers.js ===== */
/* 請假、加班申請與目前人員的共用判定工具。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function resolveCurrentMember() {
  if (currentProfile?.id) {
    const byId = state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
  return state.members.find((member) => member.code === currentProfile.employee_code) || null;
}

function requestMatchesMember(record, memberId = "", memberCode = "") {
  if (!record) {
    return false;
  }
  return Boolean(
    (memberId && record.memberId === memberId)
    || (memberCode && record.memberCode === memberCode)
  );
}

function hasDateRangeOverlap(startDate, endDate, otherStartDate, otherEndDate) {
  if (!startDate || !endDate || !otherStartDate || !otherEndDate) {
    return false;
  }
  return otherStartDate <= endDate && otherEndDate >= startDate;
}

function findDirectLeaveScheduleConflict(scheduleMemberId, startDate, endDate) {
  if (!scheduleMemberId || !startDate || !endDate) {
    return "";
  }
  return enumerateDateRange(startDate, endDate).find((dateString) => {
    const slot = getScheduleSlotByDateString(scheduleMemberId, dateString);
    return Boolean(slot?.leave);
  }) || "";
}

function hasDirectOvertimeScheduleConflict(scheduleMemberId, workDate) {
  if (!scheduleMemberId || !workDate) {
    return false;
  }
  const slot = getScheduleSlotByDateString(scheduleMemberId, workDate);
  return Boolean(slot?.overtime);
}

function formatRequestDateText(startDate, endDate) {
  if (!startDate) {
    return "";
  }
  return startDate === endDate || !endDate ? startDate : `${startDate} ~ ${endDate}`;
}

function formatOvertimeTimeText(record) {
  return `${record.startTime || "--:--"} - ${record.endTime || "--:--"}`;
}

function formatOvertimeRestLines(record) {
  const lines = [];
  if (record.useRest1) {
    lines.push(`休息1：${record.rest1StartTime || "--:--"} - ${record.rest1EndTime || "--:--"}`);
  }
  if (record.useRest2) {
    lines.push(`休息2：${record.rest2StartTime || "--:--"} - ${record.rest2EndTime || "--:--"}`);
  }
  return lines;
}

function leaveRequiresTime(leave) {
  return Boolean(leave?.requiresTime);
}

function defaultLeaveIsAllDay(leave) {
  return !leaveRequiresTime(leave);
}

function getLeaveStyleForRecord(record) {
  const leaveItemId = String(record?.leaveItemId || "").trim();
  return leaveItemId ? state.leaves.find((item) => item.id === leaveItemId) || null : null;
}

function getLeaveStyleForSlot(slot) {
  return getItem("leave", slot?.leave);
}

function getLeaveCatalogDisplayName(item) {
  if (!item) {
    return "";
  }
  return LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || item.name || "";
}
;

/* ===== renderer-auth-context.js ===== */
/* 登入狀態、權限判斷、工具列外殼與密碼修改。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function isLoggedIn() {
  return Boolean(currentSession?.user);
}

function normalizeRole(role) {
  return role === "admin" || role === "manager" ? role : "employee";
}

function isAdmin() {
  return normalizeRole(currentProfile?.role) === "admin";
}

function isManager() {
  const role = normalizeRole(currentProfile?.role);
  return role === "admin" || role === "manager";
}

function canEditSchedule() {
  return isManager();
}

async function ensureManagerDirectoryLoaded() {
  if (!isManager() || managerDirectoryLoaded) {
    return;
  }
  if (!managerDirectoryLoading) {
    managerDirectoryLoading = window.schedulerApi.loadEmployeeAdminDirectory()
      .then((adminMembers) => {
        const adminById = new Map((adminMembers || []).map((member) => [member.id, member]));
        state.members = state.members.map((member) => {
          const adminMember = adminById.get(member.id);
          return adminMember ? { ...member, ...adminMember, id: member.id } : member;
        });
        managerDirectoryLoaded = true;
        currentMember = resolveCurrentMember();
      })
      .finally(() => {
        managerDirectoryLoading = null;
      });
  }
  await managerDirectoryLoading;
}

function getCurrentProfileName() {
  return currentProfile?.full_name || currentSession?.user?.email || "";
}

function getRequestActor() {
  if (currentMember) {
    return {
      code: currentMember.code || currentProfile?.employee_code || "",
      name: currentMember.name || getCurrentProfileName()
    };
  }
  if (currentProfile) {
    return {
      code: currentProfile.employee_code || "",
      name: currentProfile.full_name || getCurrentProfileName()
    };
  }
  return null;
}

function getCurrentRoleLabel() {
  return getRoleLabel(currentProfile?.role);
}

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === normalizeRole(role))?.label || "員工";
}

function canEditMemberAccount(member) {
  return isAdmin() || normalizeRole(member?.role) !== "admin";
}

function openSignInDialog(message = "") {
  authPromptMessage = message;
  authErrorMessage = "";
  authModalOpen = true;
  renderAuthGate();
}

function closeSignInDialog() {
  authPromptMessage = "";
  authErrorMessage = "";
  authModalOpen = false;
  renderAuthGate();
}

function promptManagerAccess(message) {
  if (!isLoggedIn()) {
    openSignInDialog(message || "此功能需先登入主管帳號");
    return false;
  }
  if (!isManager()) {
    showInfoMessage("此功能限主管使用");
    return false;
  }
  return true;
}

function shouldDefaultCollapseToolbar() {
  return window.innerWidth <= 960;
}

function syncToolbarCollapseUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  const toggle = document.getElementById("toolbarCollapseToggle");
  if (!toolbarCard || !toggle) {
    return;
  }
  toolbarCard.classList.toggle("toolbar-floating-card-collapsed", toolbarCollapsed);
  toggle.setAttribute("aria-expanded", toolbarCollapsed ? "false" : "true");
  toggle.setAttribute("aria-label", toolbarCollapsed ? "展開工具列" : "收合工具列");
  toggle.setAttribute("title", toolbarCollapsed ? "展開工具列" : "收合工具列");
  toggle.innerHTML = toolbarCollapsed
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 15l6-6 6 6"></path>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6"></path>
      </svg>
    `;
}

function initializeToolbarCollapse() {
  if (toolbarCollapseInitialized) {
    return;
  }
  toolbarCollapsed = shouldDefaultCollapseToolbar();
  toolbarCollapseInitialized = true;
}

function toggleToolbarCollapse() {
  toolbarCollapsed = !toolbarCollapsed;
  syncToolbarCollapseUi();
}

function syncRoleUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  initializeToolbarCollapse();
  const toolbarGrid = document.getElementById("toolbarGrid");
  if (toolbarGrid) {
    toolbarGrid.style.display = isManager() ? "grid" : "none";
  }
  if (toolbarCard) {
    toolbarCard.classList.toggle("toolbar-floating-card-compact", !isManager());
  }
  syncToolbarCollapseUi();
  const coreActionsShell = document.getElementById("coreActionsShell");
  if (coreActionsShell) {
    coreActionsShell.style.display = isManager() ? "" : "none";
  }
  document.querySelectorAll(".manager-action").forEach((element) => {
    element.style.display = isManager() ? "" : "none";
    element.disabled = !isManager();
  });
  const managerOnlyIds = [
    "deptSettingsButton",
    "shiftSettingsButton",
    "restComplianceButton",
    "leaveSettingsButton",
    "overtimeSettingsButton",
    "weekStartSettingsButton"
  ];
  managerOnlyIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.style.display = isManager() ? "" : "none";
    element.disabled = !isManager();
  });

  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.classList.toggle("chips-readonly", !canEditSchedule());
  });

}

function renderAuthBar() {
  const toggle = document.getElementById("coreActionsToggle");
  const menu = document.getElementById("coreActionsMenu");
  const homeButton = document.getElementById("coreHomeButton");
  if (!toggle || !menu) {
    return;
  }
  const loggedIn = isLoggedIn();
  const manager = loggedIn && isManager();
  const hasProfile = Boolean(currentProfile);
  toggle.textContent = "功能";
  toggle.title = "開啟功能";
  toggle.style.display = manager ? "" : "none";
  if (homeButton) {
    homeButton.style.display = loggedIn ? "" : "none";
  }
  menu.querySelectorAll(".user-menu-login").forEach((element) => {
    element.style.display = loggedIn ? "none" : "";
  });
  menu.querySelectorAll(".user-menu-auth").forEach((element) => {
    element.style.display = loggedIn ? "" : "none";
  });
  const changePasswordButton = menu.querySelector("[data-open-change-password]");
  if (changePasswordButton) {
    changePasswordButton.style.display = loggedIn && hasProfile ? "" : "none";
  }
  menu.querySelectorAll(".manager-action").forEach((element) => {
    element.style.display = manager ? "" : "none";
    element.disabled = !manager;
  });
  if (!loggedIn) {
    closeCoreActionsMenu();
  } else if (!manager) {
    closeCoreActionsMenu();
  }
}

function renderAuthGate() {
  const root = document.getElementById("authRoot");
  if (!root) {
    return;
  }
  if (!authModalOpen) {
    root.innerHTML = "";
    return;
  }
  if (!isLoggedIn()) {
    root.innerHTML = `
      <div class="auth-overlay">
        <div class="auth-card">
          <h3>登入</h3>
          ${authPromptMessage ? `<p class="modal-description">${escapeHtml(authPromptMessage)}</p>` : ""}
          <div class="form-row">
            <label for="loginAccount">工號</label>
            <input id="loginAccount" type="text" autocomplete="username" placeholder="請輸入工號">
          </div>
          <div class="form-row">
            <label for="loginPassword">密碼</label>
            <input id="loginPassword" type="password" autocomplete="current-password" placeholder="請輸入密碼">
          </div>
          ${authErrorMessage ? `<div class="auth-error">${escapeHtml(authErrorMessage)}</div>` : ""}
          <div class="modal-footer auth-footer">
            <button class="btn-primary" type="button" data-auth-sign-in="true">登入</button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  root.innerHTML = "";
}

function openChangePasswordModal() {
  if (!isLoggedIn()) {
    openSignInDialog("修改密碼前請先登入");
    return;
  }
  openEntityListModal({
    title: "修改密碼",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label for="changePasswordValue">新密碼</label>
        <input id="changePasswordValue" type="password" maxlength="64" placeholder="請輸入新密碼">
      </div>
      <div class="form-row">
        <label for="changePasswordConfirm">確認新密碼</label>
        <input id="changePasswordConfirm" type="password" maxlength="64" placeholder="請再次輸入新密碼">
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-change-password="true">儲存修改</button>',
    hideFooterClose: true
  });
}

async function saveChangedPassword() {
  const password = document.getElementById("changePasswordValue")?.value || "";
  const confirmPassword = document.getElementById("changePasswordConfirm")?.value || "";
  if (password.length < 4) {
    reportValidationError("密碼至少需要 4 碼");
    return;
  }
  if (password !== confirmPassword) {
    reportValidationError("兩次輸入的密碼不一致");
    return;
  }
  try {
    await window.schedulerApi.changePassword(password);
    closeModal();
    showInfoMessage("密碼已修改");
  } catch (error) {
    setSaveStatus(`修改密碼失敗：${error.message}`);
  }
}
;

/* ===== renderer-schedule-tooltip.js ===== */
/* 請假與加班明細提示框。
 * 由 renderer.js 拆分；不變更提示內容或互動規則。
 */

function shouldPromptLeaveDetail(leave, leaveMeta = null) {
  return Boolean(leave && (leaveRequiresTime(leave) || leave.requiresReason));
}

function formatLeaveDetailSummary(leave, leaveMeta) {
  const lines = [];
  if (leave && leaveRequiresTime(leave)) {
    if (leaveMeta?.allDay !== false) {
      lines.push("時間：整天");
    } else {
      lines.push(`時間：${leaveMeta?.startTime || "--:--"} - ${leaveMeta?.endTime || "--:--"}`);
    }
  }
  if (leave?.requiresReason) {
    lines.push(`原因：${leaveMeta?.reason || "未填寫"}`);
  }
  return lines;
}

function hideLeaveTooltip() {
  if (leaveTooltipTimer) {
    clearTimeout(leaveTooltipTimer);
    leaveTooltipTimer = null;
  }
  document.getElementById("leaveTooltipRoot")?.remove();
}

function scheduleHideLeaveTooltip() {
  if (leaveTooltipTimer) {
    clearTimeout(leaveTooltipTimer);
  }
  leaveTooltipTimer = setTimeout(() => {
    hideLeaveTooltip();
  }, 120);
}

function formatOvertimeDetailSummary(overtimeMeta) {
  const lines = [];
  lines.push(`時間：${overtimeMeta?.startTime || "--:--"} - ${overtimeMeta?.endTime || "--:--"}`);
  if (overtimeMeta?.useRest1) {
    lines.push(`休息1：${overtimeMeta.rest1StartTime || "--:--"} - ${overtimeMeta.rest1EndTime || "--:--"}`);
  }
  if (overtimeMeta?.useRest2) {
    lines.push(`休息2：${overtimeMeta.rest2StartTime || "--:--"} - ${overtimeMeta.rest2EndTime || "--:--"}`);
  }
  if (overtimeMeta?.reason) {
    lines.push(`原因：${overtimeMeta.reason}`);
  }
  return lines;
}

function showScheduleTooltip(memberId, day, category, anchorRect) {
  const slot = getSlot(memberId, day);
  const isLeave = category === "leave";
  const item = isLeave
    ? getItem(category, slot?.[category])
    : getItem(category, slot?.[category]);
  const meta = isLeave ? slot?.leaveMeta : slot?.overtimeMeta;
  const shouldShow = isLeave
    ? item && shouldPromptLeaveDetail(item, meta)
    : item && meta;
  if (!shouldShow) {
    hideLeaveTooltip();
    return;
  }

  const lines = isLeave
    ? formatLeaveDetailSummary(item, meta)
    : formatOvertimeDetailSummary(meta);
  if (!lines.length) {
    hideLeaveTooltip();
    return;
  }

  hideLeaveTooltip();
  const root = document.createElement("div");
  root.id = "leaveTooltipRoot";
  root.className = "leave-tooltip";
  root.style.left = `${Math.min(window.innerWidth - 250, anchorRect.left + 10) + window.scrollX}px`;
  root.style.top = `${anchorRect.bottom + window.scrollY + 8}px`;
  root.innerHTML = `
    <div class="leave-tooltip-head">
      <div class="leave-tooltip-title">${escapeHtml(
        isLeave
          ? `${item?.code || ""} ${meta?.displayName || item?.name || ""}`.trim()
          : (meta?.displayName || item?.name || "加班")
      )}</div>
      ${isManager()
        ? (isLeave
          ? renderActionIconButton("edit", `data-edit-leave-assignment="${memberId}:${day}"`, "leave-tooltip-btn")
          : renderActionIconButton("edit", `data-edit-overtime-assignment="${memberId}:${day}"`, "leave-tooltip-btn"))
        : ""}
    </div>
    ${lines.map((line) => `<div class="leave-tooltip-line">${escapeHtml(line)}</div>`).join("")}
  `;
  root.addEventListener("mouseenter", () => {
    if (leaveTooltipTimer) {
      clearTimeout(leaveTooltipTimer);
      leaveTooltipTimer = null;
    }
  });
  root.addEventListener("mouseleave", scheduleHideLeaveTooltip);
  document.body.appendChild(root);
}
;

/* ===== renderer-main-pages.js ===== */
/* 首頁、打卡頁與今日訂餐頁渲染。
 * 由 renderer.js 拆分；不變更畫面內容或操作規則。
 */

function renderHomeDashboard() {
  const homeCard = document.getElementById("homeCard");
  if (!homeCard) {
    return;
  }
  if (!isLoggedIn()) {
    homeCard.innerHTML = "";
    return;
  }
  homeCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">福圓號</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      <div class="home-header-actions">
        <button class="ghost-btn home-password-btn" type="button" data-open-change-password="true">修改密碼</button>
        <button class="ghost-btn home-signout-btn" type="button" id="homeSignOutButton">登出</button>
      </div>
    </div>
    <div class="home-action-grid">
      <button class="home-action-card home-action-card-primary" type="button" data-home-action="clock">
        <span class="home-action-title">打卡</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="schedule">
        <span class="home-action-title">班表</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="meal">
        <span class="home-action-title">訂餐</span>
      </button>
      <button class="home-action-card" type="button" data-home-action="records">
        <span class="home-action-title">記錄</span>
      </button>
    </div>
  `;
}

function renderClockPage() {
  const clockCard = document.getElementById("clockCard");
  if (!clockCard) {
    return;
  }
  if (!isLoggedIn()) {
    clockCard.innerHTML = "";
    return;
  }
  const record = attendanceState.record || {};
  const clockInDone = Boolean(record.clock_in_at);
  const clockOutDone = Boolean(record.clock_out_at);
  const disableClockIn = attendanceState.saving || clockInDone || clockOutDone;
  const disableClockOut = attendanceState.saving || clockOutDone;
  clockCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">打卡</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
        <p class="home-subtitle clock-today-line"><span>今日日期：${escapeHtml(attendanceState.serverDate || getTodayDateString())}</span><span>${escapeHtml(getTodayShiftSummary())}</span></p>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${attendanceState.error ? `<div class="auth-error clock-error">${escapeHtml(attendanceState.error)}</div>` : ""}
    <div class="clock-action-grid">
      <button class="clock-action-btn clock-in-btn" type="button" data-clock-action="clock_in" ${disableClockIn ? "disabled" : ""}>
        <span>上班打卡</span>
        <strong>${formatClockButtonStatus(record, "in")}</strong>
      </button>
      <button class="clock-action-btn clock-out-btn" type="button" data-clock-action="clock_out" ${disableClockOut ? "disabled" : ""}>
        <span>下班打卡</span>
        <strong>${formatClockButtonStatus(record, "out")}</strong>
      </button>
    </div>
    ${renderTodayOvertimePanel()}
    ${attendanceState.loading && !attendanceState.saving ? '<p class="clock-loading">讀取資料中...</p>' : ""}
  `;
}

function getOvertimeStatusLabel(status) {
  if (!status) return "-";
  if (status === "approved") return "已核准";
  if (status === "returned") return "退回";
  return "待審";
}

function renderMealPage() {
  const mealCard = document.getElementById("mealCard");
  if (!mealCard) {
    return;
  }
  if (!isLoggedIn()) {
    mealCard.innerHTML = "";
    return;
  }
  const status = mealOrderState.status;
  const products = status?.products || [];
  const showEmptyProducts = Boolean(status) && !mealOrderState.loading && products.length === 0;
  const orders = status?.orders || [];
  const pendingItems = Array.isArray(mealOrderState.pendingItems) ? mealOrderState.pendingItems : null;
  const orderQuantityMap = pendingItems
    ? new Map(pendingItems.map((item) => [item.productId, Number(item.quantity || 0)]))
    : new Map(orders.map((item) => [item.product_id, Number(item.quantity || 0)]));
  const orderNoteMap = pendingItems
    ? new Map(pendingItems.map((item) => [item.productId, item.note || ""]))
    : new Map(orders.map((item) => [item.product_id, item.note || ""]));
  const disabled = mealOrderState.loading || !status?.orderingOpen || !status?.attendance?.clock_in_at;
  const unavailableReason = !status
    ? ""
    : !status.attendance?.clock_in_at
      ? "今日需先完成上班打卡才能訂餐"
      : !status.orderingOpen
        ? `今日訂餐已於 ${status.cutoffTime} 截止`
        : "";
  mealCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">訂餐</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
        <p class="home-subtitle">訂餐日期：${escapeHtml(status?.orderDate || getTodayDateString())}，截止時間：${escapeHtml(status?.cutoffTime || "--:--")}</p>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${isManager() ? `
      <div class="meal-tabs" role="tablist" aria-label="訂餐頁分頁">
        <button class="ghost-btn page-tab-btn ${mealPageTab === "order" ? "active" : ""}" type="button" role="tab" aria-selected="${mealPageTab === "order" ? "true" : "false"}" data-meal-tab="order">今日訂餐</button>
        <button class="ghost-btn page-tab-btn ${mealPageTab === "stats" ? "active" : ""}" type="button" role="tab" aria-selected="${mealPageTab === "stats" ? "true" : "false"}" data-meal-tab="stats">訂餐統計</button>
        <button class="ghost-btn page-tab-btn ${mealPageTab === "settings" ? "active" : ""}" type="button" role="tab" aria-selected="${mealPageTab === "settings" ? "true" : "false"}" data-meal-tab="settings">訂餐設定</button>
      </div>
    ` : ""}
    ${isManager() && mealPageTab === "settings" ? renderMealSettingsSection() : isManager() && mealPageTab === "stats" ? renderMealReportSection() : `
    <section class="records-section meal-order-section">
      ${mealOrderState.error ? `<div class="auth-error clock-error">${escapeHtml(mealOrderState.error)}</div>` : ""}
    ${unavailableReason ? `<div class="auth-error clock-error">${escapeHtml(unavailableReason)}</div>` : ""}
    ${products.length ? `
      <div class="records-table-wrap meal-order-table-wrap">
        <table class="meal-order-table">
          <thead><tr><th>商品</th><th class="meal-price-col">價格</th><th class="meal-quantity-col">數量</th><th>備註</th></tr></thead>
          <tbody>
        ${products.map((product) => `
          <tr>
            <td>${escapeHtml(product.name || "")}${product.is_active === false ? "（已停用）" : ""}</td>
            <td><span class="meal-product-price">$${Number(product.price || 0).toFixed(0)}</span></td>
            <td><input type="number" min="0" step="1" value="${orderQuantityMap.get(product.id) || 0}" data-meal-product-id="${escapeHtml(product.id)}" data-meal-product-price="${Number(product.price || 0)}" ${disabled ? "disabled" : ""}></td>
            <td><input type="text" placeholder="此品項備註" value="${escapeHtml(orderNoteMap.get(product.id) || "")}" data-meal-note-product-id="${escapeHtml(product.id)}" ${disabled ? "disabled" : ""}></td>
          </tr>
        `).join("")}
          </tbody>
        </table>
      </div>
      <div class="meal-summary-row">
        <span data-meal-live-summary>目前合計 ${Number(status?.summary?.totalQuantity || 0)} 份，$${Number(status?.summary?.totalAmount || 0).toFixed(0)}</span>
        <button class="btn-primary" type="button" data-save-today-meal="true" ${disabled ? "disabled" : ""}>儲存訂餐</button>
      </div>
    ` : showEmptyProducts ? '<div class="empty-state">目前沒有可訂購的商品</div>' : ""}
    </section>
    `}
  `;
  applyMealInputLimits();
}
;

/* ===== renderer-records-views.js ===== */
/* 個人記錄、訂餐統計、加班審核、打卡管理與訂餐設定畫面。
 * 每種畫面只保留一份正式實作。
 */

function formatRecordDateTime(value) {
  return value ? formatClockTime(value) : "-";
}

function renderHomeIconButton() {
  return `<button class="settings-icon-btn page-home-btn" type="button" data-home-action="home" aria-label="返回首頁" title="返回首頁"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>`;
}

function renderRecordsTabs() {
    const tabs = [
      ["personal", "個人記錄", true],
      ["overtime", "加班審核", isAdmin()],
      ["attendance", "打卡管理", isAdmin()]
    ].filter((tab) => tab[2]);
    if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
    return `<div class="record-tabs" role="tablist" aria-label="記錄頁分頁">${tabs.map(([id, label]) => `<button class="ghost-btn page-tab-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" role="tab" aria-selected="${recordsState.activeTab === id ? "true" : "false"}" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
  }

function memberOptions(selectedValue, members = state.members) {
  return `<option value="">全部人員</option>${(members || []).map((member) => `<option value="${escapeHtml(member.id)}" ${selectedValue === member.id ? "selected" : ""}>${escapeHtml(member.full_name || member.name || member.employee_code || member.code || "")}</option>`).join("")}`;
}

function departmentOptions(selectedValue) {
  return `<option value="">全部單位</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${selectedValue === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}`;
}

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

function renderPersonalRecordsSection() {
    ensureRecordsState();
    const filters = recordsState.personalFilters;
    const page = Number(recordsState.personalPage || 1);
    const pageSize = Number(recordsState.personalPageSize || 50);
    const total = Number(recordsState.personalTotal || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return `<section class="records-section">
      <div class="records-admin-toolbar personal-record-toolbar">
        <div class="records-admin-filters personal-record-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-personal-record-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-personal-record-filter="toDate"></label>
        </div>
      </div>
      <div class="records-table-wrap"><table class="records-table personal-record-table">
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
      <div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-personal-record-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-personal-record-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>
    </section>`;
  }

function renderMealReportSection() {
    ensureRecordsState();
    const report = recordsState.mealStats || {};
    const filters = recordsState.mealFilters;
    const view = recordsState.mealReportView || "detail";
    const page = Number(report.page || recordsState.mealPage || 1);
    const pageSize = Number(report.pageSize || 50);
    const total = Number(report.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const allDetails = Array.isArray(report.exportDetails) ? report.exportDetails : (report.details || []);
    const details = report.details || [];
    const companySubsidy = Number(report.companySubsidy || 55);
    const withWarningNote = (row) => [row.note || "", row.clockDeletedWarning ? "上班打卡已刪除" : ""].filter(Boolean).join("；");
    const itemRows = Array.from(allDetails.reduce((map, row) => {
      const key = `${row.productName || ""}:${Number(row.unitPrice || 0)}`;
      const current = map.get(key) || { productName: row.productName || "", quantity: 0, unitPrice: Number(row.unitPrice || 0), amount: 0 };
      current.quantity += Number(row.quantity || 0);
      current.amount += Number(row.amount || 0);
      map.set(key, current);
      return map;
    }, new Map()).values()).sort((a, b) => String(a.productName).localeCompare(String(b.productName)));
    const fallbackMemberRows = Array.from(allDetails.reduce((map, row) => {
      const key = row.employeeId || row.employeeName || "";
      const current = map.get(key) || { employeeName: row.employeeName || "", dates: new Set(), amount: 0 };
      if (Number(row.quantity || 0) > 0 && row.date) current.dates.add(row.date);
      current.amount += Number(row.amount || 0);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((row) => {
      const days = row.dates.size;
      return { employeeName: row.employeeName, days, amount: row.amount, selfPay: row.amount - days * companySubsidy };
    });
    const memberRows = (Array.isArray(report.memberSummary) && report.memberSummary.length
      ? report.memberSummary
      : fallbackMemberRows
    ).slice().sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)));
    const table = view === "item"
      ? `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>品項</th><th>數量</th><th>單價</th><th>小計</th></tr></thead><tbody>${itemRows.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.unitPrice || 0).toFixed(0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td></tr>`).join("") || '<tr><td colspan="4">沒有訂餐資料</td></tr>'}</tbody></table></div>`
      : view === "member"
        ? `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>姓名</th><th>訂餐日數</th><th>金額</th><th>自付額</th></tr></thead><tbody>${memberRows.map((row) => `<tr><td>${escapeHtml(row.employeeName)}</td><td>${Number(row.days || 0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>$${Number(row.selfPay || 0).toFixed(0)}</td></tr>`).join("") || '<tr><td colspan="4">沒有訂餐資料</td></tr>'}</tbody></table></div>`
        : `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>單位</th><th>員工</th><th>品項</th><th>數量</th><th>單價</th><th>小計</th><th>備註</th></tr></thead><tbody>${details.map((row) => `<tr><td>${escapeHtml(row.date || "")}</td><td>${escapeHtml(row.departmentName || "")}</td><td>${escapeHtml(row.employeeName || "")}</td><td>${escapeHtml(row.productName || "")}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.unitPrice || 0).toFixed(0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>${escapeHtml(withWarningNote(row))}</td></tr>`).join("") || '<tr><td colspan="8">沒有訂餐資料</td></tr>'}</tbody></table></div>`;
    return `<section class="records-section">
      <div class="meal-admin-toolbar meal-report-toolbar">
        <div class="meal-toolbar-fields meal-report-fields">
          <label class="meal-toolbar-field meal-field-from">
            <span>開始日期</span>
            <input type="date" value="${escapeHtml(filters.fromDate)}" data-meal-report-filter="fromDate">
          </label>
          <label class="meal-toolbar-field meal-field-to">
            <span>結束日期</span>
            <input type="date" value="${escapeHtml(filters.toDate)}" data-meal-report-filter="toDate">
          </label>
          <label class="meal-toolbar-field meal-field-department">
            <span>單位</span>
            <select data-meal-report-filter="departmentId">${departmentOptions(filters.departmentId)}</select>
          </label>
          <label class="meal-toolbar-field meal-field-member">
            <span>人員</span>
            <select data-meal-report-filter="memberId">${memberOptions(filters.memberId)}</select>
          </label>
          <label class="meal-toolbar-field meal-field-view">
            <span>報表內容</span>
            <select data-meal-report-view>
              <option value="detail" ${view === "detail" ? "selected" : ""}>明細</option>
              <option value="item" ${view === "item" ? "selected" : ""}>品項</option>
              <option value="member" ${view === "member" ? "selected" : ""}>人員</option>
            </select>
          </label>
          <div class="meal-toolbar-field meal-field-export">
            <span aria-hidden="true">操作</span>
            <button class="ghost-btn" type="button" data-export-meal-report="true">匯出 Excel</button>
          </div>
        </div>
      </div>
      ${report.error ? `<div class="auth-error">${escapeHtml(report.error)}</div>` : ""}
      <div class="meal-stats-grid"><div><span>總數量</span><strong>${Number(report.totals?.quantity || 0)}</strong></div><div><span>總金額</span><strong>$ ${Number(report.totals?.amount || 0).toFixed(0)}</strong></div></div>
      ${table}
      ${view === "detail" ? `<div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" type="button" data-meal-report-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button><span>共 ${total} 筆，第 ${page} / ${pages} 頁</span><button class="ghost-btn compact-btn" type="button" data-meal-report-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button></div>` : ""}
    </section>`;
  }

function formatHours(value) {
    const hours = Number(value || 0);
    return Number.isFinite(hours) ? String(hours) : "0";
  }

function formatPunchTime(value) {
    return value ? formatClockTime(value) : "-";
  }

function renderOvertimeReviewPagination(review) {
    const page = Number(review.page || 1);
    const pageSize = Number(review.pageSize || 20);
    const total = Number(review.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<div class="records-filter-row records-pagination">
      <button class="ghost-btn compact-btn" type="button" data-overtime-review-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
      <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
      <button class="ghost-btn compact-btn" type="button" data-overtime-review-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
    </div>`;
  }

function renderOvertimeReviewSection() {
    const review = ensureOvertimeReviewState();
    const filters = review.filters;
    const rows = review.requests || [];
    return `<section class="records-section">
      <div class="records-admin-toolbar overtime-review-toolbar">
        <div class="records-admin-filters overtime-review-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-overtime-review-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-overtime-review-filter="toDate"></label>
          <label class="records-admin-field"><span>人員</span><select data-overtime-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select></label>
          <label class="records-admin-field"><span>狀態</span><select data-overtime-review-filter="status">
            <option value="pending" ${filters.status === "pending" ? "selected" : ""}>待審</option>
            <option value="approved" ${filters.status === "approved" ? "selected" : ""}>核准</option>
            <option value="returned" ${filters.status === "returned" ? "selected" : ""}>退回</option>
            <option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option>
          </select></label>
        </div>
        <div class="records-admin-actions overtime-review-actions">
          <button class="ghost-btn compact-btn" type="button" data-open-admin-overtime-create="true">代為申請</button>
          <button class="ghost-btn compact-btn" type="button" data-export-approved-overtime="true">匯出加班</button>
          <button class="primary-btn compact-btn" type="button" data-overtime-review-batch="approved">批次核准</button>
          <button class="ghost-btn compact-btn" type="button" data-overtime-review-batch="returned">批次退回</button>
        </div>
      </div>
      ${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}
      <div class="records-table-wrap">
        <table class="records-table overtime-review-table">
          <thead><tr><th class="overtime-review-check-col"><input type="checkbox" data-overtime-review-check-all></th><th class="overtime-review-date-col">日期</th><th>員工</th><th>班別</th><th>打卡時間</th><th>加班時數</th><th>備註</th><th class="overtime-review-status-col">狀態</th><th class="overtime-review-action-col">操作</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td class="overtime-review-check-col"><input type="checkbox" data-overtime-review-check="${escapeHtml(row.id)}"></td>
            <td class="overtime-review-date-col">${escapeHtml(row.work_date || "")}${row.attendance_changed_warning ? '<br><span class="auth-error-inline">打卡時間已異動</span>' : ""}</td>
            <td>${escapeHtml(row.employee?.full_name || "")}</td>
            <td>${escapeHtml(row.shift?.name || "-")}<br><span>${escapeHtml(`${String(row.shift?.start_time || "").slice(0, 5)}-${String(row.shift?.end_time || "").slice(0, 5)}`)}</span></td>
            <td>上班 ${formatPunchTime(row.attendance?.clock_in_at)}<br>下班 ${formatPunchTime(row.attendance?.clock_out_at)}</td>
            <td>${formatHours(row.early_overtime_hours)}＋${formatHours(row.late_overtime_hours)}=${formatHours(row.total_overtime_hours)}</td>
            <td>${escapeHtml(row.employee_note || "")}</td>
            <td class="overtime-review-status-col">${escapeHtml(getOvertimeStatusLabel(row.status || ""))}</td>
            <td class="overtime-review-action-col"><div class="overtime-review-action-buttons">
              <button class="settings-icon-btn" type="button" data-open-overtime-review="${escapeHtml(row.id)}" aria-label="調整" title="調整"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>
              <button class="settings-icon-btn overtime-review-approve-btn" type="button" data-approve-overtime="${escapeHtml(row.id)}" aria-label="核准" title="核准"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v5h4"></path><path d="M9 14l2 2 4-4"></path></svg></button>
              <button class="settings-icon-btn overtime-review-return-btn" type="button" data-return-overtime="${escapeHtml(row.id)}" aria-label="退回" title="退回"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v5h4"></path><path d="M10 12l4 4"></path><path d="M14 12l-4 4"></path></svg></button>
            </div></td>
          </tr>`).join("") || '<tr><td colspan="9">沒有資料</td></tr>'}</tbody>
        </table>
      </div>
      ${renderOvertimeReviewPagination(review)}
    </section>`;
  }

function renderAttendanceAdminSection() {
    const admin = recordsState.attendanceAdmin;
    const filters = admin.filters;
    const page = Number(admin.page || 1);
    const pageSize = Number(admin.pageSize || 50);
    const total = Number(admin.total || 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return `<section class="records-section">
      <div class="records-admin-toolbar attendance-admin-toolbar">
        <div class="records-admin-filters attendance-admin-filters">
          <label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate)}" data-attendance-filter="fromDate"></label>
          <label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate)}" data-attendance-filter="toDate"></label>
          <label class="records-admin-field"><span>人員</span><select data-attendance-filter="memberId">${memberOptions(filters.memberId, admin.members)}</select></label>
          <label class="records-admin-field"><span>顯示項目</span><select data-attendance-filter="issueType"><option value="__all__" ${filters.abnormalOnly ? "" : "selected"}>全部顯示</option><option value="" ${filters.abnormalOnly && !filters.issueType ? "selected" : ""}>全部異常</option>${admin.issueTypes.map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
        </div>
      </div>
      ${admin.error ? `<div class="auth-error">${escapeHtml(admin.error)}</div>` : ""}
      <div class="records-table-wrap"><table class="records-table attendance-admin-table">
        <thead><tr><th>日期</th><th>員工</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th class="attendance-admin-action-col">操作</th></tr></thead>
        <tbody>${admin.rows.map((row) => `<tr>
          <td>${escapeHtml(row.work_date || "")}</td>
          <td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td>
          <td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td>
          <td>${formatRecordDateTime(row.clock_in_at)}<br><span>${escapeHtml(row.clock_in_department_name_snapshot || "")}</span></td>
          <td>${formatRecordDateTime(row.clock_out_at)}<br><span>${escapeHtml(row.clock_out_department_name_snapshot || "")}</span></td>
          <td>${escapeHtml((row.issues || []).join("、") || "正常")}</td>
          <td>${escapeHtml(row.attendance_note || "")}</td>
          <td class="attendance-admin-action-col"><div class="attendance-admin-actions">
            <button class="settings-icon-btn" type="button" data-edit-attendance="${escapeHtml(row.user_id)}:${escapeHtml(row.work_date)}:${escapeHtml(row.id || "")}" aria-label="編輯" title="編輯"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>
            ${row.id ? `<button class="settings-icon-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}" aria-label="歷程" title="歷程"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg></button>` : ""}
          </div></td>
        </tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody>
      </table></div>
      <div class="records-filter-row records-pagination">
        <button class="ghost-btn compact-btn" type="button" data-attendance-admin-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>
        <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>
        <button class="ghost-btn compact-btn" type="button" data-attendance-admin-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>
      </div>
    </section>`;
  }

function renderMealSettingsSection() {
    const mealAdmin = recordsState.mealAdmin;
    const subsidy = Number(mealAdmin.settings?.company_subsidy || 55);
    return `<section class="records-section">
      <div class="meal-admin-toolbar meal-settings-toolbar">
        <div class="meal-toolbar-fields meal-settings-fields">
          <label class="meal-toolbar-field meal-settings-toolbar-label">
            <span>截止時間</span>
            <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time>
          </label>
          <label class="meal-toolbar-field meal-settings-toolbar-label">
            <span>公司補助（元）</span>
            <input type="number" min="1" step="1" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeHtml(String(subsidy))}" data-meal-company-subsidy data-last-valid-company-subsidy="${escapeHtml(String(subsidy))}">
          </label>
        </div>
        <div class="meal-toolbar-actions">
          <button class="ghost-btn" type="button" data-add-meal-product="true">新增商品</button>
          <button class="primary-btn" type="button" data-save-meal-settings="true">儲存設定</button>
        </div>
      </div>
      ${mealAdmin.error ? `<div class="auth-error">${escapeHtml(mealAdmin.error)}</div>` : ""}
      <div class="meal-settings-table-wrap">
        <table class="meal-settings-table">
          <thead><tr><th class="meal-settings-drag-col"></th><th class="meal-settings-name-col">品項</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th><th class="meal-settings-operation-col">操作</th></tr></thead>
          <tbody>${mealAdmin.products.map((product, index) => `<tr data-meal-product-row="${index}">
            <td class="meal-settings-drag-col"><span class="meal-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span></td>
            <td class="meal-settings-name-col"><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td>
            <td class="meal-settings-price-col"><input type="number" min="0" step="1" value="${escapeHtml(String(product.price || 0))}" data-meal-product-field="price"></td>
            <td class="meal-settings-active-col"><input type="checkbox" ${product.is_active !== false ? "checked" : ""} data-meal-product-field="isActive"><input type="hidden" value="${escapeHtml(product.id || "")}" data-meal-product-field="id"></td>
            <td class="meal-settings-operation-col"><button class="ghost-btn compact-btn" type="button" data-delete-meal-product="${escapeHtml(String(index))}">刪除</button></td>
          </tr>`).join("") || '<tr><td colspan="5">尚無商品</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  }
;

/* ===== renderer-modal-navigation.js ===== */
/* 彈窗、返回鍵與設定頁重新開啟控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function closeModal() {
  modalContext = {};
  document.getElementById("modalRoot").innerHTML = "";
  hideLeaveTooltip();
}

function hasClosableModal() {
  return Boolean(document.querySelector("#modalRoot .modal-overlay"));
}

function pushAppBackHistoryGuard() {
  if (!window.history?.pushState) {
    return;
  }
  if (!window.history.state || window.history.state.schedulerBackGuard !== true) {
    window.history.replaceState(APP_BACK_HISTORY_STATE, "", window.location.href);
  }
  window.history.pushState(APP_BACK_HISTORY_STATE, "", window.location.href);
}

function handleAppBackNavigation() {
  if (hasClosableModal()) {
    closeModal();
  } else {
    appView = "home";
    renderAll();
  }
  pushAppBackHistoryGuard();
}

function reopenModalFromContext(context) {
  if (!context || typeof context !== "object") {
    return;
  }
  if (context.category === "department-settings") {
    departmentSettingsView = "department";
    openDepartmentSettings();
    restoreSettingsScroll(context);
    return;
  }
  if (context.category === "member-settings") {
    openMemberSettings();
    restoreSettingsScroll(context);
    return;
  }
  if (context.category === "list-settings") {
    openListSettings(context.listCategory);
    restoreSettingsScroll(context);
  }
}

function setModal(content) {
  document.getElementById("modalRoot").innerHTML = content;
}
;

/* ===== renderer-schedule-ordering.js ===== */
/* 班表單位與人員拖曳排序、捲動位置保存。
 * 由 renderer.js 拆分；不變更排序或儲存規則。
 */

function getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter) {
  if (!draggedId || !targetId || draggedId === targetId || !visibleIds.includes(draggedId) || !visibleIds.includes(targetId)) {
    return visibleIds;
  }
  const reorderedIds = visibleIds.filter((id) => id !== draggedId);
  const targetIndex = reorderedIds.indexOf(targetId);
  if (targetIndex < 0) {
    return visibleIds;
  }
  reorderedIds.splice(targetIndex + (insertAfter ? 1 : 0), 0, draggedId);
  return reorderedIds;
}

function applyVisibleOrderById(items, visibleIds) {
  const orderedQueue = visibleIds.slice();
  const orderedById = new Map(items.map((item) => [item.id, item]));
  const visibleIdSet = new Set(visibleIds);
  return items.map((item) => {
    if (!visibleIdSet.has(item.id)) {
      return item;
    }
    const nextId = orderedQueue.shift();
    return orderedById.get(nextId) || item;
  });
}

function captureScheduleViewport() {
  return { scrollX: window.scrollX || 0, scrollY: window.scrollY || 0 };
}

function restoreScheduleViewport(viewport) {
  requestAnimationFrame(() => {
    window.scrollTo(viewport?.scrollX || 0, viewport?.scrollY || 0);
    syncStickyHeaderScroll();
  });
}

async function finishScheduleTableOrderChange(viewport) {
  renderAll();
  restoreScheduleViewport(viewport);
  await forceSave();
}

async function reorderScheduleTableDepartment(draggedId, targetId, insertAfter = false) {
  const visibleIds = getVisibleTableGroups().map(({ department }) => department.id);
  const nextVisibleIds = getReorderedVisibleIds(visibleIds, draggedId, targetId, insertAfter);
  if (nextVisibleIds.join("|") === visibleIds.join("|")) {
    return false;
  }
  const viewport = captureScheduleViewport();
  state.departments = applyVisibleOrderById(state.departments, nextVisibleIds);
  await finishScheduleTableOrderChange(viewport);
  return true;
}

async function reorderScheduleTableMember(draggedMemberId, targetMemberId, insertAfter = false) {
  const draggedMember = state.members.find((member) => member.id === draggedMemberId);
  const targetMember = state.members.find((member) => member.id === targetMemberId);
  if (!draggedMember || !targetMember || draggedMemberId === targetMemberId) {
    return false;
  }

  const targetDepartmentId = getMemberHomeDeptId(targetMember);
  if (!targetDepartmentId) {
    return false;
  }

  const remainingMembers = state.members.filter((member) => member.id !== draggedMemberId);
  const targetIndex = remainingMembers.findIndex((member) => member.id === targetMemberId);
  if (targetIndex < 0) {
    return false;
  }

  const movedMember = {
    ...draggedMember,
    deptId: targetDepartmentId
  };
  remainingMembers.splice(targetIndex + (insertAfter ? 1 : 0), 0, movedMember);
  state.members = remainingMembers;
  currentMember = resolveCurrentMember();
  clearScheduleRangeSelection();
  renderAll();
  await forceSave();
  return true;
}
;

/* ===== renderer-schedule-keyboard.js ===== */
/* 班表欄列、範圍選取與鍵盤剪貼簿控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function beginScheduleHeaderColumnSelection(event) {
  if (event.button !== 0) {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-schedule-column]") : null;
  if (!(target instanceof HTMLElement) || !canEditSchedule() || state.tableView !== "member" || state.selected.type) {
    return;
  }
  const col = Number(target.dataset.scheduleColumn);
  if (!Number.isInteger(col)) {
    return;
  }
  selectScheduleColumn(col, event.shiftKey);
  scheduleHeaderDragSelection = { type: "column" };
  event.preventDefault();
}

function updateScheduleHeaderColumnSelection(event) {
  if (scheduleHeaderDragSelection?.type !== "column") {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-schedule-column]") : null;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const col = Number(target.dataset.scheduleColumn);
  if (Number.isInteger(col)) {
    selectScheduleColumn(col, true);
  }
}

function selectScheduleRowFromMemberCell(cell, extend = false) {
  const row = Number(cell?.dataset?.rowIndex);
  return Number.isInteger(row) && selectScheduleRow(row, extend);
}

function beginScheduleRangeSelection(event) {
  if (event.button !== 0) {
    return;
  }
  const cell = getScheduleCellFromEvent(event);
  if (!cell) {
    return;
  }
  const point = getScheduleCellPoint(cell);
  if (event.shiftKey && isValidScheduleCellPoint(scheduleRangeSelection?.anchor)) {
    setScheduleRangeSelection(scheduleRangeSelection.anchor, point);
  } else {
    setScheduleRangeSelection(point);
  }
  scheduleDragSelecting = true;
  scheduleSuppressNextCellClick = true;
  event.preventDefault();
}

function updateScheduleRangeSelection(event) {
  if (!scheduleDragSelecting || !scheduleRangeSelection) {
    return;
  }
  const cell = getScheduleCellFromEvent(event);
  if (!cell) {
    return;
  }
  setScheduleRangeSelection(scheduleRangeSelection.anchor, getScheduleCellPoint(cell));
}

function endScheduleRangeSelection() {
  scheduleDragSelecting = false;
  scheduleHeaderDragSelection = null;
}

function clearSelectedChip() {
  if (!state.selected.type) {
    return false;
  }
  state.selected = { type: null, id: null };
  clearScheduleRangeSelection();
  renderToolbar();
  renderTable();
  return true;
}

async function handleScheduleGridKeydown(event) {
  if (event.key === "Escape"
    && !document.querySelector("#modalRoot .modal-overlay")
    && !isTypingTarget(event.target)
    && canEditSchedule()
    && clearSelectedChip()) {
    event.preventDefault();
    return;
  }
  if (document.querySelector("#modalRoot .modal-overlay")
    || isTypingTarget(event.target)
    || !canEditSchedule()) {
    return;
  }
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
    event.preventDefault();
    const redoRequested = key === "y" || event.shiftKey;
    await (redoRequested ? redoSchedule() : undoSchedule());
    return;
  }
  if (state.tableView !== "member" || !scheduleRangeSelection) {
    return;
  }
  if (key === "delete" || key === "backspace") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }
  if (key === "c") {
    event.preventDefault();
    copyScheduleRangeToClipboard();
    return;
  }
  if (key === "x") {
    event.preventDefault();
    if (!copyScheduleRangeToClipboard()) {
      return;
    }
    rememberScheduleUndoSnapshot();
    if (!await clearSelectedScheduleCells()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
  if (key === "v") {
    event.preventDefault();
    rememberScheduleUndoSnapshot();
    if (!await pasteScheduleClipboard()) {
      discardLastScheduleUndoSnapshot();
    }
    return;
  }
}
;

/* ===== renderer-export-availability.js ===== */
/* 班表匯出按鈕所需的資料存在性判斷。
 * 由 renderer.js 拆分；不變更匯出格式或資料內容。
 */

function hasSapLeaveRows() {
  const sapLeaveCodes = new Set(["0036", "0047"]);
  return state.members.some((member) => {
    if (member.payByDay) {
      return false;
    }
    for (let day = 1; day <= daysInMonth(state.year, state.month); day += 1) {
      if (!isMemberActiveOnDate(member, state.year, state.month, day)) {
        continue;
      }
      const leaveId = state.schedule[scheduleKey(member.id, state.year, state.month, day)]?.leave;
      const leave = getItem("leave", leaveId);
      if (leave && sapLeaveCodes.has(leave.code)) {
        return true;
      }
    }
    return false;
  });
}

function hasOvertimeRows() {
  return state.members.some((member) => {
    for (let day = 1; day <= daysInMonth(state.year, state.month); day += 1) {
      if (!isMemberActiveOnDate(member, state.year, state.month, day)) {
        continue;
      }
      if (state.schedule[scheduleKey(member.id, state.year, state.month, day)]?.overtime) {
        return true;
      }
    }
    return false;
  });
}

function hasLeaveRows() {
  const excludedLeaveCodes = new Set(["0036", "0047"]);
  return state.members.some((member) => {
    const department = state.departments.find((item) => item.id === member.deptId);
    if (department?.hiddenFromSchedule) {
      return false;
    }
    for (let day = 1; day <= daysInMonth(state.year, state.month); day += 1) {
      if (!isMemberActiveOnDate(member, state.year, state.month, day)) {
        continue;
      }
      const leave = getItem("leave", state.schedule[scheduleKey(member.id, state.year, state.month, day)]?.leave);
      if (leave && !excludedLeaveCodes.has(leave.code)) {
        return true;
      }
    }
    return false;
  });
}
;

/* ===== renderer-attendance-page.js ===== */
/* 打卡頁資料讀取與打卡控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function formatClockTime(value) {
  if (!value) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function getTodayShiftSummary() {
  const member = currentMember || resolveCurrentMember();
  const dateString = attendanceState.serverDate || getTodayDateString();
  const shift = getItem("shift", getSlot(member?.id || "", dateString)?.shift);
  if (!shift) {
    return "今日未排班";
  }
  return `${shift.name || "班別"}：${shift.startTime || "--:--"} ~ ${shift.endTime || "--:--"}`;
}

function getBrowserPosition() {
  const userAgent = navigator.userAgent || "";
  const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
  const isPhone = Boolean(navigator.userAgentData?.mobile || narrowTouch || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent)));
  if (!isPhone || !navigator.geolocation) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "手機定位權限未開啟，請允許瀏覽器定位後再打卡"
          : error.code === error.TIMEOUT
            ? "手機定位逾時，請到空曠處或重新開啟定位後再打卡"
            : "手機無法取得 GPS 定位，請確認定位服務已開啟";
        resolve({ geolocationError: message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function loadTodayAttendance() {
  if (!isLoggedIn()) {
    return;
  }
  attendanceState = { ...attendanceState, loading: true, error: "" };
  renderAll();
  try {
    const result = await window.schedulerApi.getTodayAttendance();
    attendanceState = {
      loading: false,
      saving: false,
      record: result.record || null,
      serverDate: result.serverDate || getTodayDateString(),
      error: ""
    };
  } catch (error) {
    attendanceState = {
      loading: false,
      saving: false,
      record: null,
      serverDate: getTodayDateString(),
      error: error.message || "讀取打卡狀態失敗"
    };
  }
  renderAll();
}

async function maybePromptOvertimeAfterClockOut() {
  return false;
}

async function submitAttendanceClock(action) {
  if (!isLoggedIn()) {
    openSignInDialog();
    return;
  }
  if (attendanceState.saving) {
    return;
  }
  const confirmed = await confirmAction(action === "clock_in" ? "確定要上班打卡嗎？" : "確定要下班打卡嗎？");
  if (!confirmed) {
    return;
  }
  attendanceState = { ...attendanceState, saving: true, error: "" };
  renderAll();
  try {
    const position = await getBrowserPosition();
    const result = await window.schedulerApi.clockAttendance(action, position);
    attendanceState = {
      loading: false,
      saving: false,
      record: result.record || null,
      serverDate: result.serverDate || getTodayDateString(),
      error: ""
    };
    const overtimeStatus = action === "clock_out" ? await loadTodayAttendanceOvertime(false) : null;
    const promptedOvertime = action === "clock_out" ? await maybePromptOvertimeAfterClockOut(overtimeStatus) : false;
    if (!promptedOvertime) {
      showInfoMessage(action === "clock_in" ? "上班打卡完成" : "下班打卡完成");
    }
  } catch (error) {
    attendanceState = {
      ...attendanceState,
      loading: false,
      saving: false,
      error: error.message || "打卡失敗"
    };
  }
  renderAll();
}
;

/* ===== renderer-meal-page.js ===== */
/* 今日訂餐資料讀取、即時計算與儲存控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

const MEAL_QUANTITY_ERROR = "訂餐數量只能輸入 0 或正整數";
const MEAL_SUBSIDY_ERROR = "公司補助只能輸入正整數";

function isMealQuantityInput(target) {
    return target instanceof HTMLInputElement && Boolean(target.dataset.mealProductId);
  }

function isCompanySubsidyInput(target) {
    return target instanceof HTMLInputElement && target.dataset.mealCompanySubsidy !== undefined;
  }

function rejectInput(input, event, message) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    input.setCustomValidity(message);
    input.reportValidity();
  }

function rejectQuantityInput(input, event) {
    rejectInput(input, event, MEAL_QUANTITY_ERROR);
  }

function validateMealOrderItems(items) {
    const products = mealOrderState.status?.products || [];
    const oldOrders = mealOrderState.status?.orders || [];
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isInteger(item.quantity)) {
        throw new Error("訂餐數量必須是 0 或正整數");
      }
      const product = products.find((row) => row.id === item.productId);
      const oldOrder = oldOrders.find((row) => row.product_id === item.productId);
      if (product?.is_active === false && item.quantity > Number(oldOrder?.quantity || 0)) {
        throw new Error("停用品項只能減少或取消，不可增加數量");
      }
    }
  }

function applyMealInputLimits() {
    const products = mealOrderState.status?.products || [];
    const orders = mealOrderState.status?.orders || [];
    document.querySelectorAll("[data-meal-product-id]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.dataset.lastValidMealQuantity = /^\d+$/.test(input.value) ? input.value : "0";
      input.setCustomValidity("");

      const product = products.find((row) => row.id === input.dataset.mealProductId);
      const oldOrder = orders.find((row) => row.product_id === input.dataset.mealProductId);
      if (product?.is_active === false) {
        input.max = String(Number(oldOrder?.quantity || 0));
        input.title = `停用品項最多保留原訂數量 ${Number(oldOrder?.quantity || 0)}`;
      }
    });
  }

async function loadTodayMealOrder() {
  if (!isLoggedIn()) {
    return;
  }
  const loadSequence = ++mealOrderLoadSequence;
  mealOrderState = { ...mealOrderState, loading: true, error: "" };
  renderAll();
  try {
    const status = await window.schedulerApi.getTodayMealOrder();
    if (loadSequence !== mealOrderLoadSequence) return;
    mealOrderState = { loading: false, status, error: "" };
  } catch (error) {
    if (loadSequence !== mealOrderLoadSequence) return;
    mealOrderState = { loading: false, status: null, error: error.message || "讀取訂餐狀態失敗" };
  }
  renderAll();
}

function readMealOrderItems() {
  return Array.from(document.querySelectorAll("[data-meal-product-id]")).map((input) => {
    const productId = input.dataset.mealProductId || "";
    const noteInput = document.querySelector(`[data-meal-note-product-id="${CSS.escape(productId)}"]`);
    return {
      productId,
      quantity: Number(input.value || 0),
      note: noteInput?.value || ""
    };
  });
}

function getMealOrderLiveSummary() {
  return Array.from(document.querySelectorAll("[data-meal-product-id]")).reduce((summary, input) => {
    const quantity = Math.max(0, Math.floor(Number(input.value || 0) || 0));
    const price = Number(input.dataset.mealProductPrice || 0) || 0;
    summary.quantity += quantity;
    summary.amount += quantity * price;
    return summary;
  }, { quantity: 0, amount: 0 });
}

function updateMealOrderLiveSummary() {
  const summaryElement = document.querySelector("[data-meal-live-summary]");
  if (!summaryElement) return;
  const summary = getMealOrderLiveSummary();
  summaryElement.textContent = `目前合計 ${summary.quantity} 份，$${summary.amount.toFixed(0)}`;
}

async function saveTodayMealOrder() {
    if (mealOrderState.loading) return;
    const items = readMealOrderItems();
    try {
      validateMealOrderItems(items);
    } catch (error) {
      mealOrderState = { ...mealOrderState, error: error.message || "訂餐資料錯誤" };
      renderAll();
      return;
    }

    const hadOrder = (mealOrderState.status?.orders || []).length > 0;
    const cancelling = hadOrder && !items.some((item) => item.quantity > 0);
    if (cancelling) {
      const confirmed = await confirmAction("所有品項都是 0，確定要取消今日整張訂單嗎？");
      if (!confirmed) return;
    }

    // 儲存期間重新渲染時沿用本次輸入，避免成功提示出現前欄位跳回舊值。
    mealOrderState = { ...mealOrderState, loading: true, error: "", pendingItems: items };
    renderAll();
    try {
      const status = await window.schedulerApi.saveTodayMealOrder({ items });
      mealOrderState = { loading: false, status, error: "", pendingItems: null };
      showInfoMessage(cancelling ? "今日訂餐已取消" : "訂餐已儲存");
    } catch (error) {
      mealOrderState = { ...mealOrderState, loading: false, error: error.message || "儲存訂餐失敗" };
    }
    renderAll();
  }
;

/* ===== renderer-records-page.js ===== */
/* 記錄頁、管理報表及分頁資料讀取控制。
 * 所有記錄功能使用正式 API 與單一狀態初始化來源。
 */

function ensureRecordsState() {
    const today = getTodayDateString();
    recordsState.personalFilters = recordsState.personalFilters || {
      fromDate: addDaysToDateString(today, -49),
      toDate: today
    };
    recordsState.personalPage = Number(recordsState.personalPage || 1);
    recordsState.personalTotal = Number(recordsState.personalTotal || 0);
    recordsState.personalPageSize = Number(recordsState.personalPageSize || 50);
    recordsState.mealPage = Number(recordsState.mealPage || 1);
    recordsState.mealReportView = recordsState.mealReportView || "detail";
    return recordsState;
  }

function ensureOvertimeReviewState() {
    const current = recordsState.overtimeReview || {};
    const filters = current.filters || {};
    recordsState.overtimeReview = {
      loading: Boolean(current.loading),
      requests: current.requests || [],
      members: current.members || [],
      total: Number(current.total || 0),
      page: Number(current.page || 1),
      pageSize: Number(current.pageSize || 20),
      filters: {
        status: filters.status || "pending",
        fromDate: filters.fromDate || addDaysToDateString(getTodayDateString(), -30),
        toDate: filters.toDate || getTodayDateString(),
        memberId: filters.memberId || ""
      },
      error: current.error || ""
    };
    return recordsState.overtimeReview;
  }

async function loadRecordsPage() {
    if (!isLoggedIn()) return;
    ensureRecordsState();
    recordsState = { ...recordsState, loading: true, error: "" };
    renderAll();
    try {
      const result = await window.schedulerApi.getPersonalRecords({
        ...recordsState.personalFilters,
        page: recordsState.personalPage
      });
      recordsState = {
        ...recordsState,
        loading: false,
        personal: result.records || [],
        personalTotal: Number(result.total || 0),
        personalPage: Number(result.page || 1),
        personalPageSize: Number(result.pageSize || 50),
        error: ""
      };
      if (isAdmin()) await Promise.all([loadOvertimeReview(false), loadAttendanceAdmin(false)]);
    } catch (error) {
      recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取記錄失敗" };
    }
    renderAll();
  }

async function loadMealReport(shouldRender = true) {
    if (!isManager()) return;
    ensureRecordsState();
    recordsState = { ...recordsState, mealStats: { ...(recordsState.mealStats || {}), loading: true, error: "" } };
    if (shouldRender) renderAll();
    try {
      const result = await window.schedulerApi.getMealReport({
        ...recordsState.mealFilters,
        page: recordsState.mealPage
      });
      recordsState = { ...recordsState, mealStats: result, mealPage: Number(result.page || 1) };
    } catch (error) {
      recordsState = { ...recordsState, mealStats: { error: error.message || "讀取訂餐統計失敗" } };
    }
    if (shouldRender) renderAll();
  }

async function loadOvertimeReview(shouldRender = true) {
    if (!isAdmin()) return;
    const review = ensureOvertimeReviewState();
    recordsState = {
      ...recordsState,
      overtimeReview: { ...review, loading: true, error: "" }
    };
    if (shouldRender) renderAll();
    try {
      const result = await window.schedulerApi.getOvertimeReviewList({
        ...recordsState.overtimeReview.filters,
        page: recordsState.overtimeReview.page
      });
      recordsState = {
        ...recordsState,
        overtimeReview: {
          ...recordsState.overtimeReview,
          loading: false,
          requests: result.requests || [],
          members: result.members || [],
          total: Number(result.total || 0),
          page: Number(result.page || 1),
          pageSize: Number(result.pageSize || 20),
          error: ""
        }
      };
    } catch (error) {
      recordsState = {
        ...recordsState,
        overtimeReview: {
          ...recordsState.overtimeReview,
          loading: false,
          requests: [],
          error: error.message || "讀取加班審核失敗"
        }
      };
    }
    if (shouldRender) renderAll();
  }

async function loadAttendanceAdmin(shouldRender = true) {
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
  }

async function loadMealAdminSettings(shouldRender = true) {
  if (!isManager()) return;
  recordsState = {
    ...recordsState,
    mealAdmin: { ...recordsState.mealAdmin, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getMealAdminSettings();
    recordsState = {
      ...recordsState,
      mealAdmin: { loading: false, products: result.products || [], settings: result.settings || { daily_cutoff_time: "10:30" }, error: "" }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      mealAdmin: { ...recordsState.mealAdmin, loading: false, error: error.message || "讀取訂餐設定失敗" }
    };
  }
  if (shouldRender) renderAll();
}
;

/* ===== renderer-records-events.js ===== */
/* 記錄頁篩選、分頁、批次審核與個人操作事件。 */

const recordsReloadTimers = new Map();

function scheduleRecordsReload(key, callback) {
  const previous = recordsReloadTimers.get(key);
  if (previous) clearTimeout(previous);
  recordsReloadTimers.set(key, setTimeout(() => {
    recordsReloadTimers.delete(key);
    if (typeof callback === "function") void callback();
  }, 0));
}

function bindRecordsEvents() {
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target.dataset.personalRecordFilter !== undefined) {
      ensureRecordsState().personalFilters[target.dataset.personalRecordFilter] = target.value;
      recordsState.personalPage = 1;
      scheduleRecordsReload("personal", loadRecordsPage);
      return;
    }
    if (target.dataset.mealReportFilter !== undefined) {
      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";
      recordsState.mealPage = 1;
      scheduleRecordsReload("meal", loadMealReport);
      return;
    }
    if (target.dataset.mealReportView !== undefined) {
      recordsState.mealReportView = target.value || "detail";
      renderAll();
      return;
    }
    if (target.dataset.overtimeReviewFilter !== undefined) {
      ensureOvertimeReviewState().filters[target.dataset.overtimeReviewFilter] = target.value || "";
      recordsState.overtimeReview.page = 1;
      scheduleRecordsReload("overtime", loadOvertimeReview);
      return;
    }
    if (target.dataset.attendanceFilter !== undefined) {
      const field = target.dataset.attendanceFilter;
      if (field === "issueType") {
        const showAll = target.value === "__all__";
        recordsState.attendanceAdmin.filters.abnormalOnly = !showAll;
        recordsState.attendanceAdmin.filters.issueType = showAll ? "" : target.value || "";
      } else {
        recordsState.attendanceAdmin.filters[field] = target.value || "";
      }
      recordsState.attendanceAdmin.page = 1;
      scheduleRecordsReload("attendance", loadAttendanceAdmin);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.overtimeReviewCheckAll !== undefined) {
      document.querySelectorAll("[data-overtime-review-check]").forEach((input) => { input.checked = target.checked; });
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.personalRecordPage) {
      const page = Number(target.dataset.personalRecordPage || 1);
      if (page > 0) { recordsState.personalPage = page; void loadRecordsPage(); }
      return;
    }
    if (target.dataset.mealReportPage) {
      const page = Number(target.dataset.mealReportPage || 1);
      if (page > 0) { recordsState.mealPage = page; void loadMealReport(); }
      return;
    }
    if (target.dataset.overtimeReviewPage) {
      const page = Number(target.dataset.overtimeReviewPage || 1);
      if (page > 0) { ensureOvertimeReviewState().page = page; void loadOvertimeReview(); }
      return;
    }
    if (target.dataset.attendanceAdminPage) {
      const page = Number(target.dataset.attendanceAdminPage || 1);
      if (page > 0) { recordsState.attendanceAdmin.page = page; void loadAttendanceAdmin(); }
      return;
    }
    if (target.dataset.exportApprovedOvertime !== undefined) { void exportApprovedOvertimeReview(); return; }
    if (target.dataset.overtimeReviewBatch) { void batchReviewOvertime(target.dataset.overtimeReviewBatch); return; }
    if (target.dataset.adminOvertimeCreate) { void createAdminOvertimeForEmployee(target.dataset.adminOvertimeCreate); return; }
    if (target.dataset.deleteRecordOvertime) { void deleteRecordOvertime(target.dataset.deleteRecordOvertime); return; }
    if (target.dataset.cancelRecordMeal) { void cancelMealFromRecords(); }
  });
}
;

/* ===== renderer-runtime-helpers.js ===== */
/* 執行狀態、單位、人員、班別與目錄查詢共用工具。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function setSaveStatus(message, saving = false) {
  latestSaveStatus = message;
  isSaving = saving;
}

function getDepartmentName(deptId) {
  return state.departments.find((department) => department.id === deptId)?.name || "未指定單位";
}

function getPositionName(positionId) {
  return state.positions.find((position) => position.id === positionId)?.name || "未指定職位";
}

function getSalaryTypeLabel(member) {
  return member?.payByDay ? "日薪" : "月薪";
}

function normalizeRestWeekday(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 6 ? numericValue : 0;
}

function getRestWeekdayLabel(value) {
  return REST_WEEKDAY_OPTIONS.find((option) => option.value === normalizeRestWeekday(value))?.label || "週日";
}

function getDepartmentSummary(deptId) {
  return getDepartmentName(deptId);
}

function getMemberScheduleShiftIds(member) {
  const validShiftIds = new Set(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => shift.id));
  return (Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [])
    .map((shiftId) => String(shiftId || ""))
    .filter((shiftId, index, list) => validShiftIds.has(shiftId) && list.indexOf(shiftId) === index);
}

function getMemberHomeDeptId(member) {
  return member?.deptId || "";
}

function getMemberScheduleShiftNames(member) {
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);
  return names.length ? names.join("、") : "未指定";
}

function renderMemberScheduleShiftPills(member) {
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);
  if (!names.length) {
    return "-";
  }
  return names.map((name) => `<span class="member-shift-pill">${escapeHtml(name)}</span>`).join("");
}

function getMemberShiftPriority(member, shiftId) {
  const index = getMemberScheduleShiftIds(member).indexOf(shiftId);
  return index === -1 ? Infinity : index;
}

function memberCanScheduleShift(member, shiftId) {
  return Number.isFinite(getMemberShiftPriority(member, shiftId));
}

function getMembersForScheduleShift(shiftId) {
  return state.members
    .filter((member) => isMemberCurrentlyActive(member) && memberCanScheduleShift(member, shiftId))
    .sort((a, b) => getMemberShiftPriority(a, shiftId) - getMemberShiftPriority(b, shiftId) || a.name.localeCompare(b.name));
}

function shiftAllowsDepartment(shift, deptId) {
  return Boolean(shift?.applicableDeptId && shift.applicableDeptId === deptId);
}

function getItemList(category) {
  if (category === "shift") return state.shifts;
  if (category === "leave") return state.leaves;
  return state.overtime;
}

function getItem(category, id) {
  return getItemList(category).find((item) => item.id === id);
}

function getItemTextColor(item, fallback = "#000000") {
  if (!item) {
    return autoLeaveTextColor(fallback);
  }
  if (item.textColor) {
    return item.textColor;
  }
  return autoLeaveTextColor(item.color || fallback);
}

function getLeaveLabel(leave) {
  if (!leave) {
    return "";
  }
  return leave.code ? `${leave.code} ${leave.name}` : leave.name;
}
;

/* ===== renderer-records-actions.js ===== */
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
;

/* ===== renderer-app-shell.js ===== */
/* 記錄頁、主視圖切換與全畫面渲染協調。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function renderRecordsPage() {
  const recordsCard = document.getElementById("recordsCard");
  if (!recordsCard) {
    return;
  }
  if (!isLoggedIn()) {
    recordsCard.innerHTML = "";
    return;
  }
  const activeSection = recordsState.activeTab === "overtime"
      ? renderOvertimeReviewSection()
      : recordsState.activeTab === "attendance"
        ? renderAttendanceAdminSection()
        : renderPersonalRecordsSection();
  recordsCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">記錄</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${renderRecordsTabs()}
    ${recordsState.error ? `<div class="auth-error clock-error">${escapeHtml(recordsState.error)}</div>` : ""}
    ${activeSection}
    ${recordsState.loading ? '<p class="clock-loading">讀取中，請稍候...</p>' : ""}
  `;
}

function syncAppView() {
  const loggedIn = isLoggedIn();
  const homeCard = document.getElementById("homeCard");
  const clockCard = document.getElementById("clockCard");
  const mealCard = document.getElementById("mealCard");
  const recordsCard = document.getElementById("recordsCard");
  const scheduleCard = document.getElementById("scheduleCard");
  const toolbarCard = document.querySelector(".toolbar-card");
  const showSchedule = loggedIn && appView === "schedule";
  const showToolbar = showSchedule && isManager();
  if (homeCard) {
    homeCard.hidden = !loggedIn || appView !== "home";
  }
  if (clockCard) {
    clockCard.hidden = !loggedIn || appView !== "clock";
  }
  if (mealCard) {
    mealCard.hidden = !loggedIn || appView !== "meal";
  }
  if (recordsCard) {
    recordsCard.hidden = !loggedIn || appView !== "records";
  }
  if (scheduleCard) {
    scheduleCard.hidden = !showSchedule;
  }
  if (toolbarCard) {
    toolbarCard.hidden = !showToolbar;
  }
  document.body.classList.toggle("is-authenticated", loggedIn);
  document.body.classList.toggle("is-home-view", loggedIn && appView === "home");
  document.body.classList.toggle("is-clock-view", loggedIn && appView === "clock");
  document.body.classList.toggle("is-meal-view", loggedIn && appView === "meal");
  document.body.classList.toggle("is-records-view", loggedIn && appView === "records");
  document.body.classList.toggle("is-schedule-view", showSchedule);
}

function renderAll() {
  renderHeader();
  renderToolbar();
  renderHomeDashboard();
  renderClockPage();
  renderMealPage();
  renderRecordsPage();
  renderTable();
  syncAppView();
  renderAuthGate();
}
;

/* ===== renderer-persistence.js ===== */
/* 班表狀態整理、延遲儲存與強制儲存。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function ensureScheduleSlot(memberId, day) {
  const key = getScheduleKeyForDateString(memberId, normalizeScheduleDateInput(day));
  if (!key) {
    return null;
  }
  if (!state.schedule[key]) {
    state.schedule[key] = { shift: null, leave: null, overtime: null };
  }
  return state.schedule[key];
}

function pruneEmptySchedule() {
  Object.keys(state.schedule).forEach((key) => {
    const slot = state.schedule[key];
    if (!slot || (!slot.shift && !slot.leave && !slot.overtime)) {
      delete state.schedule[key];
    }
  });
}

function buildPersistedState() {
  const nextState = {
    ...state,
    schedule: {}
  };
  Object.entries(state.schedule || {}).forEach(([key, slot]) => {
    if (!slot) {
      return;
    }
    const nextSlot = {
      shift: slot.shift || null,
      leave: slot.leave || null,
      overtime: slot.overtime || null
    };
    if (nextSlot.leave && slot.leaveMeta) {
      nextSlot.leaveMeta = {
        ...slot.leaveMeta
      };
    }
    if (nextSlot.overtime && slot.overtimeMeta) {
      nextSlot.overtimeMeta = {
        ...slot.overtimeMeta
      };
    }
    if (nextSlot.shift || nextSlot.leave || nextSlot.overtime) {
      nextState.schedule[key] = nextSlot;
    }
  });
  return nextState;
}

function queueSave() {
  if (!canEditSchedule()) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void forceSave();
}

async function forceSave() {
  if (!canEditSchedule()) {
    return false;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await window.schedulerApi.saveState(buildPersistedState());
    return true;
  } catch (error) {
    setSaveStatus(`儲存失敗：${error.message}`);
    return false;
  }
}
;

/* ===== renderer-schedule-selection-actions.js ===== */
/* 班表工具列選取與套用到儲存格的操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function clearLegacyLeaveFromSlot(slot) {
  if (!slot) {
    return;
  }
  slot.leave = null;
  slot.leaveMeta = null;
}

function clearLegacyOvertimeFromSlot(slot) {
  if (!slot) {
    return;
  }
  slot.overtime = null;
  slot.overtimeMeta = null;
}

async function applySelectionToCell(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  if (!canEditSchedule()) {
    return;
  }
  const member = state.members.find((item) => item.id === memberId);
  if (!member || !isMemberActiveOnDateString(member, dateString)) {
    return;
  }
  if (!state.selected.type) {
    return;
  }
  const slot = ensureScheduleSlot(memberId, dateString);
  if (!slot) {
    return;
  }
  const previousSchedule = deepClone(state.schedule || {});
  const { type, id } = state.selected;
  if (type === "leave") {
    const leave = getItem("leave", id);
    if (!leave) {
      return;
    }
    try {
      if (slot.leave === id) {
        clearLegacyLeaveFromSlot(slot);
        await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
        return;
      } else if (shouldPromptLeaveDetail(leave, null)) {
        openLeaveAssignmentModal(memberId, dateString, id);
        return;
      } else {
        slot.leave = id;
        slot.leaveMeta = {
          allDay: defaultLeaveIsAllDay(leave),
          startTime: "",
          endTime: "",
          reason: ""
        };
      }
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定請假失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "shift") {
    const nextShiftId = slot.shift === id ? null : id;
    slot.shift = nextShiftId;
    try {
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定班別失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "overtime") {
    const nextOvertimeId = slot.overtime === id ? null : id;
    try {
      if (nextOvertimeId) {
        const overtime = getItem("overtime", nextOvertimeId) || state.overtime[0];
        slot.overtime = nextOvertimeId;
        slot.overtimeMeta = {
          startTime: slot.overtimeMeta?.startTime || overtime?.startTime || "",
          endTime: slot.overtimeMeta?.endTime || overtime?.endTime || "",
          useRest1: slot.overtimeMeta?.useRest1 ?? Boolean(overtime?.useRest1),
          rest1StartTime: slot.overtimeMeta?.rest1StartTime || overtime?.rest1StartTime || "",
          rest1EndTime: slot.overtimeMeta?.rest1EndTime || overtime?.rest1EndTime || "",
          useRest2: slot.overtimeMeta?.useRest2 ?? Boolean(overtime?.useRest2),
          rest2StartTime: slot.overtimeMeta?.rest2StartTime || overtime?.rest2StartTime || "",
          rest2EndTime: slot.overtimeMeta?.rest2EndTime || overtime?.rest2EndTime || "",
          reason: slot.overtimeMeta?.reason || ""
        };
      } else {
        clearLegacyOvertimeFromSlot(slot);
      }
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定加班失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "cancel-shift") {
    slot.shift = null;
    try {
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除班別失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-leave") {
    try {
      clearLegacyLeaveFromSlot(slot);
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除請假失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-overtime") {
    try {
      clearLegacyOvertimeFromSlot(slot);
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除加班失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
}

function selectChip(type, id) {
  if (!canEditSchedule()) {
    return;
  }
  clearScheduleRangeSelection();
  if (state.selected.type === type && state.selected.id === id) {
    clearSelectedChip();
    return;
  } else {
    state.selected = { type, id };
  }
  renderToolbar();
  renderTable();
}

function removeAssignmentsByItem(category, id) {
  Object.values(state.schedule).forEach((slot) => {
    if (slot[category] === id) {
      slot[category] = null;
      if (category === "leave") {
        slot.leaveMeta = null;
      }
    }
  });
  pruneEmptySchedule();
}
;

/* ===== renderer-schedule-assignment-modals.js ===== */
/* 通用實體視窗、請假與加班指派表單。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function openEntityListModal(config) {
  const headerButtons = config.headerButtons || "";
  const headerActionBlock = headerButtons
    ? `<div class="modal-header-actions">${headerButtons}</div>`
    : '<div class="modal-header-actions"></div>';
  const closeButton = `
    <div class="modal-header-close">
      <button class="settings-icon-btn modal-close-btn" type="button" data-close-button="true" aria-label="關閉" title="關閉">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12"></path>
          <path d="M18 6l-12 12"></path>
        </svg>
      </button>
    </div>
  `;
  const showFooter = !config.hideFooterClose || config.footerButtons;
  setModal(`
    <div class="modal-overlay" data-close-modal="true">
      <div class="${config.modalClass || "modal modal-wide"}">
        <div class="modal-header">
          <h3>${escapeHtml(config.title)}</h3>
          <div class="modal-header-tools">
            ${headerActionBlock}
            ${closeButton}
          </div>
        </div>
        <div class="modal-body">
          ${config.description ? `<p class="modal-description">${escapeHtml(config.description)}</p>` : ""}
          ${config.body}
        </div>
        ${showFooter ? `
          <div class="modal-footer">
            ${config.hideFooterClose ? "" : '<button class="btn-cancel" type="button" data-close-button="true">關閉</button>'}
            ${config.footerButtons || ""}
          </div>
        ` : ""}
      </div>
    </div>
  `);
}

function syncLeaveAssignmentModalUi() {
  const allDay = document.getElementById("leaveAssignmentAllDay")?.checked;
  const reasonEnabled = document.getElementById("leaveAssignmentReasonEnabled")?.checked;
  const timeSection = document.getElementById("leaveAssignmentTimeSection");
  const reasonSection = document.getElementById("leaveAssignmentReasonSection");
  const reasonInput = document.getElementById("leaveAssignmentReason");

  if (timeSection) {
    timeSection.style.display = allDay ? "none" : "";
  }
  setTimeInputDisabled("leaveAssignmentStartTime", Boolean(allDay));
  setTimeInputDisabled("leaveAssignmentEndTime", Boolean(allDay));
  if (reasonSection) {
    reasonSection.style.display = reasonEnabled ? "" : "none";
  }
  if (reasonInput) {
    if (reasonEnabled) {
      reasonInput.disabled = false;
      reasonInput.removeAttribute("disabled");
      reasonInput.readOnly = false;
      reasonInput.style.pointerEvents = "auto";
    } else {
      reasonInput.disabled = true;
      reasonInput.setAttribute("disabled", "disabled");
      reasonInput.style.pointerEvents = "none";
    }
  }
}

function syncOvertimeFormUi() {
  const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked);
  const rest1Fields = document.getElementById("overtimeRest1Fields");
  const rest2Fields = document.getElementById("overtimeRest2Fields");
  const rest2Toggle = document.getElementById("overtimeUseRest2");
  const rest1Inputs = ["overtimeRest1StartTime", "overtimeRest1EndTime"];
  const rest2Inputs = ["overtimeRest2StartTime", "overtimeRest2EndTime"];

  if (rest1Fields) {
    rest1Fields.style.display = useRest1 ? "" : "none";
  }
  rest1Inputs.forEach((id) => setTimeInputDisabled(id, !useRest1));

  if (!useRest1) {
    if (rest2Toggle) {
      rest2Toggle.checked = false;
      rest2Toggle.disabled = true;
    }
    if (rest2Fields) {
      rest2Fields.style.display = "none";
    }
    rest2Inputs.forEach((id) => setTimeInputDisabled(id, true));
    return;
  }

  if (rest2Toggle) {
    rest2Toggle.disabled = false;
  }
  if (rest2Fields) {
    rest2Fields.style.display = useRest2 ? "" : "none";
  }
  rest2Inputs.forEach((id) => setTimeInputDisabled(id, !useRest2));
}

function openLeaveAssignmentModal(memberId, day, leaveId) {
  const dateString = normalizeScheduleDateInput(day);
  const member = state.members.find((item) => item.id === memberId);
  const leave = getItem("leave", leaveId);
  if (!member || !leave) {
    return;
  }

  const slot = getSlot(memberId, dateString);
  const existingMeta = slot?.leave === leaveId ? slot.leaveMeta || null : null;
  const defaultAllDay = existingMeta?.allDay ?? defaultLeaveIsAllDay(leave);
  const reasonEnabled = existingMeta?.reasonEnabled ?? leave.requiresReason;
  const startTime = existingMeta?.startTime || "";
  const endTime = existingMeta?.endTime || "";
  const reason = existingMeta?.reason || "";

  modalContext = {
    category: "leave-assignment",
    memberId,
    day: dateString,
    leaveId
  };
  openEntityListModal({
    title: "休假明細",
    modalClass: "modal modal-form-compact",
    headerButtons: `<button class="btn-primary" type="button" data-save-leave-assignment="true">儲存</button>`,
    hideFooterClose: true,
    body: `
      <div class="form-row">
        <label>假別</label>
        <div class="readonly-pill">${escapeHtml(member.name)} · ${escapeHtml(formatDateTextFromIso(dateString))} · ${escapeHtml(getLeaveLabel(leave))}</div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="leaveAssignmentAllDay" type="checkbox" ${defaultAllDay ? "checked" : ""}>
          整天
        </label>
      </div>
      <div class="form-grid" id="leaveAssignmentTimeSection" style="${defaultAllDay ? "display:none;" : ""}">
        <div class="form-row">
          <label for="leaveAssignmentStartTime">開始時間</label>
          ${timeInputMarkup("leaveAssignmentStartTime", startTime, defaultAllDay)}
        </div>
        <div class="form-row">
          <label for="leaveAssignmentEndTime">結束時間</label>
          ${timeInputMarkup("leaveAssignmentEndTime", endTime, defaultAllDay)}
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="leaveAssignmentReasonEnabled" type="checkbox" ${reasonEnabled ? "checked" : ""}>
          原因
        </label>
      </div>
      <div class="form-row" id="leaveAssignmentReasonSection" style="${reasonEnabled ? "" : "display:none;"}">
        <label for="leaveAssignmentReason">原因內容</label>
        <input id="leaveAssignmentReason" type="text" maxlength="60" value="${escapeHtml(reason)}" ${reasonEnabled ? "" : "disabled"} placeholder="請輸入原因">
      </div>
    `
  });
  syncLeaveAssignmentModalUi();
}

async function saveLeaveAssignmentFromModal() {
  const { memberId, day, leaveId } = modalContext;
  const allDay = document.getElementById("leaveAssignmentAllDay")?.checked !== false;
  const reasonEnabled = Boolean(document.getElementById("leaveAssignmentReasonEnabled")?.checked);
  const startTime = readTimeInputValue("leaveAssignmentStartTime");
  const endTime = readTimeInputValue("leaveAssignmentEndTime");
  if (!allDay && !isValidTimeRange(startTime, endTime)) {
    reportValidationError("開始時間必須早於結束時間");
    return;
  }

  try {
    const dateString = normalizeScheduleDateInput(day);
    const slot = ensureScheduleSlot(memberId, dateString);
    const leave = getItem("leave", leaveId);
    if (!slot || !leave) {
      throw new Error("找不到班表格子或假別");
    }
    const previousSchedule = deepClone(state.schedule || {});
    slot.leave = leaveId;
    slot.leaveMeta = {
      leaveCode: leave.code || "",
      displayName: leave.name,
      displayColor: leave.color || "",
      displayTextColor: getItemTextColor(leave, leave.color),
      allDay,
      startTime: allDay ? "" : startTime,
      endTime: allDay ? "" : endTime,
      reasonEnabled,
      reason: reasonEnabled ? (document.getElementById("leaveAssignmentReason")?.value.trim() || "") : ""
    };
    closeModal();
    await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
  } catch (error) {
    reportValidationError(`儲存休假失敗：${formatSchedulerError(error, "儲存失敗")}`);
  }
}

function openOvertimeAssignmentModal(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  const member = state.members.find((item) => item.id === memberId);
  const slot = getSlot(memberId, dateString);
  const overtimeMeta = slot?.overtimeMeta || null;
  if (!member || !slot?.overtime) {
    return;
  }
  modalContext = {
    category: "overtime-assignment",
    memberId,
    day: dateString
  };
  openEntityListModal({
    title: "修改加班",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label>人員</label>
        <div class="readonly-pill">${escapeHtml(member.name)} · ${escapeHtml(formatDateTextFromIso(dateString))}</div>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="scheduleOvertimeStartTime">加班開始</label>
          ${timeInputMarkup("scheduleOvertimeStartTime", overtimeMeta?.startTime || "")}
        </div>
        <div class="form-row">
          <label for="scheduleOvertimeEndTime">加班結束</label>
          ${timeInputMarkup("scheduleOvertimeEndTime", overtimeMeta?.endTime || "")}
        </div>
      </div>
      <div class="form-section">
        <div class="form-row checkbox-row">
          <label class="overtime-use-label">
            <input id="scheduleOvertimeUseRest1" type="checkbox" ${overtimeMeta?.useRest1 ? "checked" : ""}>
            使用休息1
          </label>
        </div>
        <div class="form-grid" id="scheduleOvertimeRest1Fields" style="${overtimeMeta?.useRest1 ? "" : "display:none;"}">
          <div class="form-row">
            <label for="scheduleOvertimeRest1StartTime">休息1開始</label>
            ${timeInputMarkup("scheduleOvertimeRest1StartTime", overtimeMeta?.rest1StartTime || "", !overtimeMeta?.useRest1)}
          </div>
          <div class="form-row">
            <label for="scheduleOvertimeRest1EndTime">休息1結束</label>
            ${timeInputMarkup("scheduleOvertimeRest1EndTime", overtimeMeta?.rest1EndTime || "", !overtimeMeta?.useRest1)}
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-row checkbox-row">
          <label class="overtime-use-label">
            <input id="scheduleOvertimeUseRest2" type="checkbox" ${overtimeMeta?.useRest1 && overtimeMeta?.useRest2 ? "checked" : ""} ${overtimeMeta?.useRest1 ? "" : "disabled"}>
            使用休息2
          </label>
        </div>
        <div class="form-grid" id="scheduleOvertimeRest2Fields" style="${overtimeMeta?.useRest1 && overtimeMeta?.useRest2 ? "" : "display:none;"}">
          <div class="form-row">
            <label for="scheduleOvertimeRest2StartTime">休息2開始</label>
            ${timeInputMarkup("scheduleOvertimeRest2StartTime", overtimeMeta?.rest2StartTime || "", !(overtimeMeta?.useRest1 && overtimeMeta?.useRest2))}
          </div>
          <div class="form-row">
            <label for="scheduleOvertimeRest2EndTime">休息2結束</label>
            ${timeInputMarkup("scheduleOvertimeRest2EndTime", overtimeMeta?.rest2EndTime || "", !(overtimeMeta?.useRest1 && overtimeMeta?.useRest2))}
          </div>
        </div>
      </div>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-save-overtime-assignment="true">儲存</button>'
  });
  syncScheduleOvertimeFormUi();
}

async function saveOvertimeAssignmentFromModal() {
  const { memberId, day } = modalContext;
  const startTime = readTimeInputValue("scheduleOvertimeStartTime");
  const endTime = readTimeInputValue("scheduleOvertimeEndTime");
  const useRest1 = Boolean(document.getElementById("scheduleOvertimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("scheduleOvertimeUseRest2")?.checked) && useRest1;
  const rest1StartTime = readTimeInputValue("scheduleOvertimeRest1StartTime");
  const rest1EndTime = readTimeInputValue("scheduleOvertimeRest1EndTime");
  const rest2StartTime = readTimeInputValue("scheduleOvertimeRest2StartTime");
  const rest2EndTime = readTimeInputValue("scheduleOvertimeRest2EndTime");
  if (!memberId || !day) {
    reportValidationError("請確認加班資料");
    return;
  }
  if (!isValidTimeRange(startTime, endTime)) {
    reportValidationError("加班開始時間必須早於加班結束時間");
    return;
  }
  if (useRest1 && !isValidTimeRange(rest1StartTime, rest1EndTime)) {
    reportValidationError("休息1開始時間必須早於結束時間");
    return;
  }
  if (useRest2 && !isValidTimeRange(rest2StartTime, rest2EndTime)) {
    reportValidationError("休息2開始時間必須早於結束時間");
    return;
  }
  try {
    const dateString = normalizeScheduleDateInput(day);
    const slot = getSlot(memberId, dateString);
    const overtime = getItem("overtime", slot?.overtime) || state.overtime[0];
    if (!slot || !overtime) {
      throw new Error("找不到班表格子或加班類型");
    }
    const previousSchedule = deepClone(state.schedule || {});
    slot.overtime = overtime.id;
    slot.overtimeMeta = {
      displayName: overtime.name || "加班",
      displayColor: overtime.color || "#D85A30",
      displayTextColor: getItemTextColor(overtime, overtime.color || "#D85A30"),
      startTime,
      endTime,
      useRest1,
      rest1StartTime: useRest1 ? rest1StartTime : "",
      rest1EndTime: useRest1 ? rest1EndTime : "",
      useRest2,
      rest2StartTime: useRest2 ? rest2StartTime : "",
      rest2EndTime: useRest2 ? rest2EndTime : "",
      reason: slot.overtimeMeta?.reason || ""
    };
    closeModal();
    await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
  } catch (error) {
    reportValidationError(`儲存加班失敗：${formatSchedulerError(error, "儲存失敗")}`);
  }
}

function syncScheduleOvertimeFormUi() {
  const useRest1 = Boolean(document.getElementById("scheduleOvertimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("scheduleOvertimeUseRest2")?.checked) && useRest1;
  const rest1Fields = document.getElementById("scheduleOvertimeRest1Fields");
  const rest2Fields = document.getElementById("scheduleOvertimeRest2Fields");
  const rest2Toggle = document.getElementById("scheduleOvertimeUseRest2");

  if (rest1Fields) {
    rest1Fields.style.display = useRest1 ? "" : "none";
  }
  setTimeInputDisabled("scheduleOvertimeRest1StartTime", !useRest1);
  setTimeInputDisabled("scheduleOvertimeRest1EndTime", !useRest1);

  if (rest2Toggle) {
    rest2Toggle.disabled = !useRest1;
    if (!useRest1) {
      rest2Toggle.checked = false;
    }
  }
  if (rest2Fields) {
    rest2Fields.style.display = useRest2 ? "" : "none";
  }
  setTimeInputDisabled("scheduleOvertimeRest2StartTime", !useRest2);
  setTimeInputDisabled("scheduleOvertimeRest2EndTime", !useRest2);
}
;

/* ===== renderer-schedule-compliance-settings.js ===== */
/* 班表目錄同步、月週設定與例休檢查畫面。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

async function syncScheduleCatalogs() {
  if (!isManager()) {
    return;
  }
  await window.schedulerApi.syncCatalogs(state);
}

function formatMonthText(year, month) {
  return `${year} 年 ${month + 1} 月`;
}

function formatWeekStartLabel(value) {
  return WEEK_START_OPTIONS.find((option) => option.value === value)?.label || "星期日";
}

function getConfiguredMonthStartDay() {
  const value = Number(state.rules?.monthStartDay);
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : 1;
}

function formatDateTextFromIso(dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return dateString || "";
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekRangeText(startDate, endDate) {
  return `${formatDateTextFromIso(startDate)} - ${formatDateTextFromIso(endDate)}`;
}

function getScheduleSlotByDateString(memberId, dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return null;
  }
  return state.schedule[scheduleKey(memberId, date.getFullYear(), date.getMonth(), date.getDate())] || null;
}

function getVisibleScheduleWeeks() {
  const visibleDates = getVisibleDates();
  const weeks = [];
  for (let index = 0; index < visibleDates.length; index += 7) {
    const dates = visibleDates.slice(index, index + 7);
    if (dates.length) {
      weeks.push({
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        dates
      });
    }
  }
  return weeks;
}

function buildRestComplianceCalendars(weeks) {
  const checker = window.restCompliance;
  if (!checker) {
    return [];
  }
  const dateRange = [...new Set(weeks.flatMap((week) => week.dates))];
  const visibleStartDate = dateRange[0] || getTodayDateString();
  const visibleEndDate = dateRange[dateRange.length - 1] || visibleStartDate;
  const slidingDateRange = enumerateDateRange(
    addDaysToDateString(visibleStartDate, -7),
    visibleEndDate
  );

  return state.members.map((member) => {
    const buildDay = (dateString) => {
      const slot = getScheduleSlotByDateString(member.id, dateString);
      const leave = getItem("leave", slot?.leave);
      return {
        date: dateString,
        active: isMemberActiveOnDateString(member, dateString),
        leaveCode: leave?.code || "",
        hasShift: Boolean(slot?.shift),
        hasOvertime: Boolean(slot?.overtime)
      };
    };
    const days = dateRange.map(buildDay);
    return {
      memberId: member.id,
      memberName: member.name,
      memberCode: member.code || "",
      hireDate: member.hireDate || "",
      leaveDate: member.leaveDate || "",
      days,
      slidingDays: slidingDateRange.map(buildDay)
    };
  }).filter((member) => member.days.some((day) => day.active));
}

function openWeekStartSettingModal() {
  if (!promptManagerAccess("設定週期規則前請先登入主管帳號")) {
    return;
  }
  openEntityListModal({
    title: "週期設定",
    modalClass: "modal modal-wide",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="eightWeekStartSetting">八週起算日</label>
          <input id="eightWeekStartSetting" type="date" value="${escapeHtml(getConfiguredEightWeekAnchorDate())}">
        </div>
        <div class="form-row">
          <label for="weekStartSetting">每週起算日</label>
          <select id="weekStartSetting">${WEEK_START_OPTIONS.map((option) => (
            `<option value="${option.value}" ${option.value === getConfiguredWeekStart() ? "selected" : ""}>${option.label}</option>`
          )).join("")}</select>
        </div>
        <div class="form-row">
          <label for="monthStartSetting">每月起算日</label>
          <select id="monthStartSetting">${Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            return `<option value="${day}" ${day === getConfiguredMonthStartDay() ? "selected" : ""}>${day} 日</option>`;
          }).join("")}</select>
        </div>
      </div>
      <div class="result-item">
        <div class="result-title">說明</div>
        <div class="result-detail">班表預設顯示今天所在的八週週期；週期由八週起算日往前後每 56 天推算。</div>
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-week-start="true">儲存設定</button>',
    hideFooterClose: true
  });
}

async function saveWeekStartSettingFromModal() {
  const weekValue = Number(document.getElementById("weekStartSetting")?.value || 0);
  const monthValue = Number(document.getElementById("monthStartSetting")?.value || 1);
  const eightWeekStartDate = document.getElementById("eightWeekStartSetting")?.value || getTodayDateString();
  state.rules.weekStart = Number.isInteger(weekValue) && weekValue >= 0 && weekValue <= 6 ? weekValue : 0;
  state.rules.monthStartDay = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 31 ? monthValue : 1;
  state.rules.eightWeekStartDate = toDateObject(eightWeekStartDate) ? eightWeekStartDate : getTodayDateString();
  state.scheduleStartDate = getEightWeekCycleStartForDate(getTodayDateString());
  syncVisibleDatePartsFromStart();
  closeModal();
  renderAll();
  await forceSave();
}

function openRestComplianceModal() {
  if (!promptManagerAccess("執行例休檢查前請先登入主管帳號")) {
    return;
  }
  const checker = window.restCompliance;
  if (!checker) {
    showInfoMessage("例休檢查模組尚未載入");
    return;
  }

  const complianceWeeks = getVisibleScheduleWeeks();
  const complianceStartDate = complianceWeeks[0]?.startDate || getTodayDateString();
  const complianceEndDate = complianceWeeks[complianceWeeks.length - 1]?.endDate || complianceStartDate;
  const result = checker.checkRestCompliance({
    year: state.year,
    month: state.month,
    weeks: complianceWeeks,
    weekStart: getConfiguredWeekStart(),
    maxConsecutiveWorkDays: Math.max(1, Number(state.rules?.maxConsecutiveWorkDays) || 6),
    reportStartDate: complianceStartDate,
    reportEndDate: complianceEndDate,
    memberCalendars: buildRestComplianceCalendars(complianceWeeks)
  });
  const issueCount = result.issues.length;
  const errorCount = result.issues.filter((issue) => issue.severity === "error").length;
  const warningCount = result.issues.filter((issue) => issue.severity === "warning").length;
  const groupedIssues = result.issues.reduce((groups, issue) => {
    const key = issue.memberId || `${issue.memberCode || ""}-${issue.memberName || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        memberId: issue.memberId,
        memberName: issue.memberName,
        memberCode: issue.memberCode || "",
        issues: []
      });
    }
    groups.get(key).issues.push(issue);
    return groups;
  }, new Map());
  const summaryCards = `
    <div class="compliance-summary-grid">
      <div class="result-item">
        <div class="result-title">檢查範圍</div>
        <div class="result-detail">${escapeHtml(formatWeekRangeText(complianceStartDate, complianceEndDate))}</div>
      </div>
      <div class="result-item ${issueCount ? "warning" : "success"}">
        <div class="result-title">檢查結果</div>
        <div class="result-detail">${issueCount ? `${errorCount} 筆缺漏，${warningCount} 筆待確認` : "目前未發現缺少例假"}</div>
      </div>
    </div>
  `;
  const notes = `
    <div class="result-item">
      <div class="result-title">檢查說明</div>
      <div class="result-detail compliance-check-note">
        <div>目前檢查畫面顯示的 8 週，每 7 天為一週。</div>
        <div>到職日或離職日落在該週時，每週例假／休息日檢查會略過，改檢查「未在職日＋例假＋休息日」是否至少 2 天。</div>
        <div>這版只檢查系統內已標記的「例假 0036」；空白未排班不自動視為例假。</div>
      </div>
    </div>
  `;
  const issuesMarkup = issueCount
    ? `
      <div class="compliance-check-list">
        ${Array.from(groupedIssues.values()).map((group) => `
          <div class="result-item ${group.issues.some((issue) => issue.severity === "error") ? "error" : "warning"} compliance-member-group">
            <div class="compliance-member-head">
              <div class="result-title compliance-member-name">${escapeHtml(group.memberName || group.memberId)}</div>
              <div class="result-detail compliance-member-summary">
                <span>缺漏：${group.issues.filter((issue) => issue.severity === "error").length} 筆</span>
                <span>待確認：${group.issues.filter((issue) => issue.severity === "warning").length} 筆</span>
              </div>
            </div>
            <div class="result-detail">
              ${group.issues.map((issue) => `
                <div>${issue.type === "regular_holiday_work" && issue.date
                  ? `${escapeHtml(formatDateTextFromIso(issue.date))}｜${escapeHtml(issue.message)}`
                  : `${escapeHtml(formatWeekRangeText(issue.weekStart, issue.weekEnd))}｜${escapeHtml(issue.message)}`
                }${issue.streakStartDate ? `｜連續區間：${escapeHtml(formatDateTextFromIso(issue.streakStartDate))} - ${escapeHtml(formatDateTextFromIso(issue.date || issue.streakStartDate))}` : ""}</div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `
    : `
      <div class="result-item success">
        <div class="result-title">檢查完成</div>
        <div class="result-detail">目前依系統標記，顯示的 8 週未發現例假缺漏。</div>
      </div>
    `;

  openEntityListModal({
    title: "例休檢查",
    modalClass: "modal modal-wide compliance-check-modal",
    body: `${summaryCards}${notes}${issuesMarkup}`,
    hideFooterClose: true
  });
}
;

/* ===== renderer-auth-actions.js ===== */
/* 登入與登出操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

async function handleSignIn() {
  const loginAccount = document.getElementById("loginAccount")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  if (!loginAccount || !password) {
    authErrorMessage = "請輸入工號與密碼";
    renderAuthGate();
    return;
  }
  try {
    authErrorMessage = "";
    await window.schedulerApi.signIn(loginAccount, password);
    closeSignInDialog();
    await loadApp();
  } catch (error) {
    authErrorMessage = error.message || "登入失敗";
    renderAuthGate();
  }
}

async function handleSignOut() {
  await window.schedulerApi.signOut();
  authErrorMessage = "";
  authPromptMessage = "";
  authModalOpen = false;
  currentSession = null;
  currentProfile = null;
  resetLoadedUserRuntimeState();
  closeModal();
  closeCoreActionsMenu();
  await loadApp();
}
;

/* ===== renderer-export-actions.js ===== */
/* 班表期間切換與 SAP、加班、假別匯出操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

async function changeScheduleWindowWeeks(weeks) {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
  await ensureVisibleScheduleLoaded();
  renderAll();
  await forceSave();
}

async function exportSapCsv() {
  if (!hasSapLeaveRows()) {
    showInfoMessage("目前沒有可匯出的休例假資料");
    return;
  }
  try {
    const result = await window.schedulerApi.exportSapCsv({
      state,
      year: state.year,
      month: state.month
    });
    if (result.empty) {
      showInfoMessage("目前沒有可匯出的休例假資料");
      return;
    }
    if (result.canceled) {
      return;
    }
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function exportOvertime() {
  if (!hasOvertimeRows()) {
    showInfoMessage("目前沒有可匯出的加班資料");
    return;
  }
  try {
    const result = await window.schedulerApi.exportOvertime({
      state,
      year: state.year,
      month: state.month
    });
    if (result.empty) {
      showInfoMessage("目前沒有可匯出的加班資料");
      return;
    }
    if (result.canceled) {
      return;
    }
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}

async function exportLeave() {
  if (!hasLeaveRows()) {
    showInfoMessage("目前沒有可匯出的請假資料");
    return;
  }
  try {
    const result = await window.schedulerApi.exportLeave({
      state,
      year: state.year,
      month: state.month
    });
    if (result.empty) {
      showInfoMessage("目前沒有可匯出的請假資料");
      return;
    }
    if (result.canceled) {
      return;
    }
  } catch (error) {
    setSaveStatus(`匯出失敗：${error.message}`);
  }
}
;

/* ===== renderer-period-exports.js ===== */
(function installPeriodExports() {
  const exporter = window.schedulerBrowserExporter;
  const api = window.schedulerApi;
  const originalExporters = exporter ? {
    getSapLeaveExportRows: exporter.getSapLeaveExportRows,
    getOvertimeExportRows: exporter.getOvertimeExportRows,
    getLeaveExportRows: exporter.getLeaveExportRows
  } : null;

    function parseIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }


  function dateAtMonthStartDay(year, month, startDay) {
    return new Date(year, month, Math.min(startDay, daysInMonth(year, month)));
  }

  function getPeriodStartForDate(date, startDay) {
    const thisMonthStart = dateAtMonthStartDay(date.getFullYear(), date.getMonth(), startDay);
    return date >= thisMonthStart
      ? thisMonthStart
      : dateAtMonthStartDay(date.getFullYear(), date.getMonth() - 1, startDay);
  }

  function getPreviousPeriodDefaults() {
    if (typeof getVisibleDateRange === "function") {
      const visible = getVisibleDateRange();
      if (parseIsoDate(visible?.startDate) && parseIsoDate(visible?.endDate)) {
        return { startDay: 1, startDate: visible.startDate, endDate: visible.endDate };
      }
    }
    const today = parseIsoDate(typeof getTodayDateString === "function" ? getTodayDateString() : "") || new Date();
    const rawStartDay = Number(typeof getConfiguredMonthStartDay === "function"
      ? getConfiguredMonthStartDay()
      : state?.rules?.monthStartDay || 1);
    const startDay = Number.isInteger(rawStartDay) && rawStartDay >= 1 && rawStartDay <= 31 ? rawStartDay : 1;
    const currentPeriodStart = getPeriodStartForDate(today, startDay);
    const previousEnd = addDays(currentPeriodStart, -1);
    const previousStart = getPeriodStartForDate(previousEnd, startDay);
    return {
      startDay,
      startDate: formatIsoDate(previousStart),
      endDate: formatIsoDate(previousEnd)
    };
  }

  function compactDate(isoDate) {
    return String(isoDate || "").replaceAll("-", "");
  }

  function enumerateMonths(startDate, endDate) {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end || start > end) return [];
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  function aggregateRows(payload, original, dateColumnIndex) {
    if (Array.isArray(payload?.approvedOvertimeRows) && typeof original === "function") {
      return original(payload);
    }
    if (Array.isArray(payload?.exportRows) && typeof original === "function") {
      return original(payload);
    }
    if (!payload?.startDate || !payload?.endDate || typeof original !== "function") {
      return typeof original === "function" ? original(payload) : [];
    }
    const start = compactDate(payload.startDate);
    const end = compactDate(payload.endDate);
    return enumerateMonths(payload.startDate, payload.endDate).flatMap(({ year, month }) => (
      original({ ...payload, startDate: "", endDate: "", year, month })
        .filter((row) => {
          const value = String(row?.[dateColumnIndex] || "");
          return value >= start && value <= end;
        })
    ));
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function styleWorksheet(sheet, widths) {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
    sheet.columns = widths.map((width) => ({ width }));
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD8D2C7" } },
          left: { style: "thin", color: { argb: "FFD8D2C7" } },
          bottom: { style: "thin", color: { argb: "FFD8D2C7" } },
          right: { style: "thin", color: { argb: "FFD8D2C7" } }
        };
        cell.alignment = cell.alignment || { horizontal: "center", vertical: "middle", wrapText: true };
      });
    });
  }

  function installRangeExporters() {
    if (!exporter || !api || !originalExporters) return;

    exporter.getSapLeaveExportRows = (payload) => aggregateRows(payload, originalExporters.getSapLeaveExportRows, 2);
    exporter.getOvertimeExportRows = (payload) => aggregateRows(payload, originalExporters.getOvertimeExportRows, 1);
    exporter.getLeaveExportRows = (payload) => aggregateRows(payload, originalExporters.getLeaveExportRows, 1);
    exporter.buildSapLeaveCsvContent = (payload) => {
      const rows = exporter.getSapLeaveExportRows(payload);
      const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
      return rows.length ? `\uFEFF${csv}\r\n` : "\uFEFF";
    };
    exporter.createOvertimeWorkbook = async (payload) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("匯出加班");
      const headers = ["員工編號", "加班日期", "加班時間(起)", "加班時間(迄)", "前一日", "加班補貼類型", "休息1(起)", "休息1(迄)", "支薪1", "休息2(起)", "休息2(迄)", "支薪2"];
      sheet.addRow(headers);
      exporter.getOvertimeExportRows(payload).forEach((row) => sheet.addRow(row));
      styleWorksheet(sheet, headers.map((_, index) => index === 0 ? 14 : [4, 5, 8, 11].includes(index) ? 10 : 14));
      return workbook;
    };
    exporter.createLeaveWorkbook = async (payload) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("匯出請假");
      const headers = ["員工編號", "請假日期(起)", "請假日期(迄)", "請假時間(起)", "請假時間(迄)", "假別", "說明"];
      sheet.addRow(headers);
      exporter.getLeaveExportRows(payload).forEach((row) => sheet.addRow(row));
      styleWorksheet(sheet, [14, 14, 14, 14, 14, 12, 28]);
      return workbook;
    };

    function downloadBlob(blob, fileName) {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    function rangeFileName(prefix, payload, extension) {
      return `${prefix}_${compactDate(payload.startDate)}-${compactDate(payload.endDate)}.${extension}`;
    }

    api.exportSapCsv = async (payload) => {
      const rows = exporter.getSapLeaveExportRows(payload);
      if (!rows.length) return { canceled: true, empty: true };
      const blob = new Blob([exporter.buildSapLeaveCsvContent(payload)], { type: "text/csv;charset=utf-8" });
      const fileName = rangeFileName("sap請假", payload, "csv");
      downloadBlob(blob, fileName);
      return { canceled: false, filePath: fileName };
    };
    api.exportOvertime = async (payload) => {
      if (!exporter.getOvertimeExportRows(payload).length) return { canceled: true, empty: true };
      const blob = await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload));
      const fileName = rangeFileName("匯出加班", payload, "xlsx");
      downloadBlob(blob, fileName);
      return { canceled: false, filePath: fileName };
    };
    api.exportLeave = async (payload) => {
      if (!exporter.getLeaveExportRows(payload).length) return { canceled: true, empty: true };
      const blob = await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload));
      const fileName = rangeFileName("匯出請假", payload, "xlsx");
      downloadBlob(blob, fileName);
      return { canceled: false, filePath: fileName };
    };
  }

  async function ensureScheduleRangeLoaded(startDate, endDate) {
    if (!api?.loadScheduleEntries) return;
    const loaded = await api.loadScheduleEntries({ startDate, endDate, members: state.members });
    state.schedule = { ...(state.schedule || {}), ...(loaded?.schedule || {}) };
    state.scheduleLoadedRanges = [
      ...(Array.isArray(state.scheduleLoadedRanges) ? state.scheduleLoadedRanges : []),
      ...(Array.isArray(loaded?.scheduleLoadedRanges) ? loaded.scheduleLoadedRanges : [])
    ];
  }

  function openExportPeriodDialog(type) {
    const defaults = getPreviousPeriodDefaults();
    const labels = {
      sap: { title: "匯出休例假期間", action: "匯出休例假" },
      leave: { title: "匯出請假期間", action: "匯出請假" },
      overtime: { title: "匯出加班期間", action: "匯出加班" }
    };
    const label = labels[type];
    if (!label || typeof openEntityListModal !== "function") return;
    openEntityListModal({
      title: label.title,
      modalClass: "modal modal-member-form",
      body: `<div class="form-grid">
        <div class="form-row"><label for="exportPeriodStart">開始日期</label><input id="exportPeriodStart" type="date" value="${defaults.startDate}"></div>
        <div class="form-row"><label for="exportPeriodEnd">結束日期</label><input id="exportPeriodEnd" type="date" value="${defaults.endDate}"></div>
      </div>`,
      footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-run-period-export="${type}">${label.action}</button>`,
      hideFooterClose: true
    });
  }

  async function runPeriodExport(type) {
    const startDate = document.getElementById("exportPeriodStart")?.value || "";
    const endDate = document.getElementById("exportPeriodEnd")?.value || "";
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end) {
      if (typeof reportValidationError === "function") reportValidationError("請選擇開始日期與結束日期");
      return;
    }
    if (start > end) {
      if (typeof reportValidationError === "function") reportValidationError("開始日期必須早於或等於結束日期");
      return;
    }
    const method = type === "sap" ? "exportSapCsv" : type === "leave" ? "exportLeave" : "exportOvertime";
    const emptyMessage = type === "sap" ? "目前沒有可匯出的休例假資料" : type === "leave" ? "目前沒有可匯出的請假資料" : "目前沒有可匯出的加班資料";
    try {
      if (typeof setSaveStatus === "function") setSaveStatus("正在準備匯出資料...", true);
      const exportRows = typeof api.loadScheduleExportRows === "function"
        ? await api.loadScheduleExportRows(startDate, endDate)
        : (await ensureScheduleRangeLoaded(startDate, endDate), null);
      const result = await api[method]({
        state,
        startDate,
        endDate,
        exportRows,
        year: start.getFullYear(),
        month: start.getMonth()
      });
      if (result?.empty && typeof showInfoMessage === "function") showInfoMessage(emptyMessage);
      if (typeof closeModal === "function") closeModal();
      if (typeof setSaveStatus === "function") setSaveStatus("");
    } catch (error) {
      if (typeof setSaveStatus === "function") setSaveStatus(`匯出失敗：${error.message || error}`);
    }
  }

    installRangeExporters();

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button) return;
    const type = button.id === "exportSapButton" ? "sap" : button.id === "exportLeaveButton" ? "leave" : button.id === "exportOvertimeButton" ? "overtime" : "";
    if (type) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openExportPeriodDialog(type);
      return;
    }
    if (button.dataset.runPeriodExport) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void runPeriodExport(button.dataset.runPeriodExport);
    }
  }, true);
})();
;

/* ===== renderer-events-toolbar.js ===== */
/* 工具列、班表捲動與篩選事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindStaticToolbarEvents() {
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  };

  bindScheduleHistoryControls();
  bindAutoFillScheduleControls();

  bindClick("coreActionsToggle", (event) => {
    event.stopPropagation();
    if (!isLoggedIn()) {
      openSignInDialog();
      return;
    }
    toggleCoreActionsMenu();
  });
  bindClick("toolbarCollapseToggle", (event) => {
    event.stopPropagation();
    toggleToolbarCollapse();
  });
  bindClick("prevPeriodButton", async () => changeScheduleWindowWeeks(-8));
  bindClick("prevWeekButton", async () => changeScheduleWindowWeeks(-1));
  bindClick("nextWeekButton", async () => changeScheduleWindowWeeks(1));
  bindClick("nextPeriodButton", async () => changeScheduleWindowWeeks(8));
  bindClick("tablePrevWeekButton", async () => changeScheduleWindowWeeks(-1));
  bindClick("tableNextWeekButton", async () => changeScheduleWindowWeeks(1));
  bindClick("exportSapButton", () => {
    closeCoreActionsMenu();
    exportSapCsv();
  });
  bindClick("exportOvertimeButton", () => {
    closeCoreActionsMenu();
    exportOvertime();
  });
  bindClick("exportLeaveButton", () => {
    closeCoreActionsMenu();
    exportLeave();
  });
  bindClick("deptSettingsButton", openDepartmentSettings);
  bindClick("shiftSettingsButton", () => openListSettings("shift"));
  bindClick("leaveSettingsButton", () => openListSettings("leave"));
  bindClick("overtimeSettingsButton", () => openListSettings("overtime"));
  bindClick("weekStartSettingsButton", () => {
    closeCoreActionsMenu();
    openWeekStartSettingModal();
  });
  bindClick("autoSchedulePreviewButton", async () => {
    closeCoreActionsMenu();
    await previewAutoSchedule();
  });
  bindClick("autoScheduleApplyButton", async () => {
    closeCoreActionsMenu();
    await applyAutoSchedulePreview();
  });
  bindClick("autoScheduleCancelButton", () => {
    closeCoreActionsMenu();
    cancelAutoSchedulePreview();
  });
  bindClick("restComplianceButton", () => {
    closeCoreActionsMenu();
    openRestComplianceModal();
  });
}

function bindScheduleViewportEvents() {
  const tableWrap = document.getElementById("tableWrap");
  if (tableWrap) {
    tableWrap.addEventListener("scroll", syncStickyHeaderScroll, { passive: true });
  }
  const topScrollbar = document.getElementById("tableTopScrollbar");
  if (topScrollbar) {
    topScrollbar.addEventListener("scroll", scrollScheduleHorizontallyFromTopScrollbar, { passive: true });
  }
  const tableStickyHeader = document.getElementById("tableStickyHeader");
  if (tableStickyHeader) {
    tableStickyHeader.addEventListener("wheel", scrollScheduleHorizontallyFromHeader, { passive: false });
  }
  window.addEventListener("resize", () => {
    syncScheduleColumnWidths();
    syncStickyHeaderLayout();
    syncStickyHeaderScroll();
    if (!toolbarCollapseInitialized) {
      initializeToolbarCollapse();
    }
    syncToolbarCollapseUi();
  });
}

function bindScheduleFilterEvents() {
  const deptFilter = document.getElementById("deptFilter");
  if (deptFilter) {
    deptFilter.addEventListener("change", async (event) => {
      state.deptFilter = event.target.value;
      renderToolbar();
      renderTable();
      await forceSave();
    });
  }
  const tableDeptScopeFilter = document.getElementById("tableDeptScopeFilter");
  if (tableDeptScopeFilter) {
    tableDeptScopeFilter.addEventListener("change", async (event) => {
      state.tableDeptScopeFilter = event.target.value;
      renderToolbar();
      renderTable();
      await forceSave();
    });
  }
  const tableViewSelect = document.getElementById("tableViewSelect");
  if (tableViewSelect) {
    tableViewSelect.addEventListener("change", async (event) => {
      const value = event.target.value;
      state.tableView = value === "shift" ? "shift" : "member";
      state.tableStatsVisible = value === "member-stats";
      clearScheduleRangeSelection();
      renderToolbar();
      renderTable();
      await forceSave();
    });
  }
}
;

/* ===== renderer-events-session.js ===== */
/* 班表選取、鍵盤、返回鍵與 Session 逾時事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindScheduleSessionEvents() {
  document.body.addEventListener("mousedown", beginScheduleHeaderColumnSelection);
  document.body.addEventListener("mouseover", updateScheduleHeaderColumnSelection);
  document.body.addEventListener("mousedown", beginScheduleRangeSelection);
  document.body.addEventListener("mouseover", updateScheduleRangeSelection);
  document.body.addEventListener("mouseup", endScheduleRangeSelection);
  document.body.addEventListener("mouseleave", endScheduleRangeSelection);
  document.addEventListener("keydown", handleScheduleGridKeydown);
  window.addEventListener("popstate", handleAppBackNavigation);
  window.addEventListener("scheduler-session-expired", async () => {
    authErrorMessage = "登入已逾時，請重新登入";
    authPromptMessage = "";
    authModalOpen = true;
    currentSession = null;
    currentProfile = null;
    currentMember = null;
    managerDirectoryLoaded = false;
    managerDirectoryLoading = null;
    attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
    attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
    mealOrderState = { loading: false, status: null, error: "" };
    recordsState = createRecordsState();
    state = createEmptyState();
    appView = "home";
    closeModal();
    closeCoreActionsMenu();
    renderAll();
  });
}
;

/* ===== renderer-events-click.js ===== */
/* 按鈕、儲存格與雙擊的委派事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindDelegatedClickEvents() {
  document.body.addEventListener("click", async (event) => {
    const target = event.target.closest("button, td");
    if (!target) {
      return;
    }
    if (target.dataset.openSignIn) {
      closeCoreActionsMenu();
      openSignInDialog();
      return;
    }
    if (target.dataset.closeAuthGate) {
      closeSignInDialog();
      return;
    }
    if (target.dataset.authSignIn) {
      await handleSignIn();
      return;
    }
    if (target.id === "signOutButton" || target.id === "authGateSignOutButton") {
      closeCoreActionsMenu();
      await handleSignOut();
      return;
    }
    if (target.id === "homeSignOutButton") {
      await handleSignOut();
      return;
    }
    if (target.dataset.homeAction) {
      closeCoreActionsMenu();
      if (target.dataset.homeAction === "home") {
        appView = "home";
        renderAll();
        return;
      }
      if (target.dataset.homeAction === "clock") {
        appView = "clock";
        await loadTodayAttendance();
        return;
      }
      if (target.dataset.homeAction === "schedule") {
        try {
          await ensureManagerDirectoryLoaded();
        } catch (error) {
          showInfoMessage(`讀取班表管理資料失敗：${error.message || error}`);
          return;
        }
        appView = "schedule";
        renderAll();
        return;
      }
      if (target.dataset.homeAction === "meal") {
        appView = "meal";
        mealPageTab = "order";
        await loadTodayMealOrder();
        return;
      }
      if (target.dataset.homeAction === "records") {
        appView = "records";
        await loadRecordsPage();
        return;
      }
      const comingSoon = {
      };
      showInfoMessage(comingSoon[target.dataset.homeAction] || "此功能尚未開放");
      return;
    }
    if (target.dataset.clockAction) {
      await submitAttendanceClock(target.dataset.clockAction);
      return;
    }
    if (target.dataset.submitTodayOvertime) {
      await submitTodayOvertimeRequest();
      return;
    }
    if (target.dataset.deleteTodayOvertime) {
      await deleteTodayOvertimeRequest();
      return;
    }
    if (target.dataset.saveTodayMeal) {
      await saveTodayMealOrder();
      return;
    }
    if (target.dataset.mealTab) {
      mealPageTab = ["settings", "stats"].includes(target.dataset.mealTab) ? target.dataset.mealTab : "order";
      if (mealPageTab === "settings") {
        await loadMealAdminSettings(false);
      } else if (mealPageTab === "stats") {
        await loadMealReport(false);
      } else {
        mealOrderState = { ...mealOrderState, status: null, error: "" };
        await loadTodayMealOrder();
      }
      renderAll();
      return;
    }
    if (target.dataset.recordsTab) {
      recordsState.activeTab = target.dataset.recordsTab;
      renderAll();
      return;
    }
    if (target.dataset.loadMealReport) {
      await loadMealReport();
      return;
    }
    if (target.dataset.exportMealReport) {
      const result = await window.schedulerApi.exportMealReport(recordsState.mealStats);
      if (result.empty) showInfoMessage("目前沒有可匯出的訂餐資料");
      return;
    }
    if (target.dataset.loadOvertimeReview) {
      await loadOvertimeReview();
      return;
    }
    if (target.dataset.openOvertimeReview) {
      openOvertimeReviewModal(target.dataset.openOvertimeReview);
      return;
    }
    if (target.dataset.approveOvertime) {
      await reviewOvertime(target.dataset.approveOvertime, "approved");
      return;
    }
    if (target.dataset.returnOvertime) {
      await reviewOvertime(target.dataset.returnOvertime, "returned");
      return;
    }
    if (target.dataset.saveOvertimeReview) {
      await reviewOvertime(target.dataset.saveOvertimeReview, "pending", true);
      return;
    }
    if (target.dataset.openAdminOvertimeCreate) {
      openAdminOvertimeCreateModal();
      return;
    }
    if (target.dataset.saveAdminOvertimeCreate) {
      await saveAdminOvertimeCreate();
      return;
    }
    if (target.dataset.loadAttendanceAdmin) {
      recordsState.attendanceAdmin.page = 1;
      await loadAttendanceAdmin();
      return;
    }
    if (target.dataset.editAttendance) {
      openAttendanceEditModal(target.dataset.editAttendance);
      return;
    }
    if (target.dataset.saveAttendanceEdit) {
      await saveAttendanceEdit(target.dataset.saveAttendanceEdit);
      return;
    }
    if (target.dataset.viewAttendanceHistory) {
      await openAttendanceHistoryModal(target.dataset.viewAttendanceHistory);
      return;
    }
    if (target.dataset.addMealProduct) {
      recordsState.mealAdmin.products = [...recordsState.mealAdmin.products, { id: "", name: "", price: 0, is_active: true }];
      renderAll();
      return;
    }
    if (target.dataset.deleteMealProduct !== undefined) {
      await deleteMealProduct(target);
      return;
    }
    if (target.dataset.saveMealSettings) {
      await saveMealSettingsFromPage();
      return;
    }
    if (target.id === "coreActionsToggle") {
      return;
    }
    if (target.dataset.closeButton) {
      const returnTo = modalContext.returnTo || null;
      closeModal();
      reopenModalFromContext(returnTo);
      return;
    }
    if (target instanceof HTMLElement && target.dataset.tableMemberId && target.dataset.rowIndex) {
      selectScheduleRowFromMemberCell(target, event.shiftKey);
      return;
    }
    const cellTarget = target instanceof Element ? target.closest(".cell") : null;
    if (cellTarget instanceof HTMLElement) {
      if (scheduleSuppressNextCellClick) {
        scheduleSuppressNextCellClick = false;
        return;
      }
      if (cellTarget.dataset.readonly) {
        return;
      }
      if (cellTarget.classList.contains("inactive-cell")) {
        return;
      }
      const memberId = cellTarget.dataset.memberId;
      const dateString = cellTarget.dataset.date || "";
      if (!state.selected.type) {
        const slot = getSlot(memberId, dateString);
        if (canEditSchedule() && slot?.overtime) {
          openOvertimeAssignmentModal(memberId, dateString);
          return;
        }
      }
      await applySelectionToCell(memberId, dateString);
      return;
    }
    const managerOnlyAction = Boolean(
      target.dataset.openDepartmentSettings ||
      target.dataset.openMemberSettings ||
      target.dataset.deleteCategory ||
      target.dataset.editLeaveAssignment ||
      target.dataset.openAdd ||
      target.dataset.editItem ||
      target.dataset.saveShift ||
      target.dataset.saveNamedItem ||
      target.id === "autoSchedulePreviewButton" ||
      target.id === "autoScheduleApplyButton" ||
      target.id === "autoScheduleCancelButton" ||
      target.dataset.generateAutoSchedule ||
      target.dataset.saveOvertimeAssignment ||
      target.dataset.openAddDepartment ||
      target.dataset.toggleScheduleShifts ||
      target.dataset.editDepartment ||
      target.dataset.saveDepartment ||
      target.dataset.deleteDepartment ||
      target.dataset.openAddMember ||
      target.dataset.exportMembers ||
      target.dataset.importMembers ||
      target.dataset.exportSettings ||
      target.dataset.importSettings ||
      target.dataset.exportDepartments ||
      target.dataset.importDepartments ||
      target.dataset.editMember ||
      target.dataset.saveMember ||
      target.dataset.deleteMember ||
      target.dataset.resetMemberPassword
    );
    if (managerOnlyAction && !isManager()) {
      promptManagerAccess("此功能需先登入主管帳號");
      return;
    }
    if (target.dataset.openDepartmentSettings) {
      await openDepartmentSettings();
      return;
    }
    if (target.dataset.openMemberSettings) {
      await openMemberSettings();
      return;
    }
    if (target.dataset.openChangePassword) {
      closeCoreActionsMenu();
      openChangePasswordModal();
      return;
    }
    if (target.dataset.resetMemberPassword) {
      await resetMemberPasswordFromModal(target.dataset.resetMemberPassword);
      return;
    }
    if (target.dataset.chipType !== undefined) {
      selectChip(target.dataset.chipType, target.dataset.chipId || null);
      return;
    }
    if (target.dataset.openItemColor) {
      target.parentElement?.querySelector(`[data-item-color-input="${target.dataset.openItemColor}"]`)?.click();
      return;
    }
    if (target.dataset.setAutoItemText !== undefined) {
      modalTextColorAuto = true;
      modalTextColor = autoLeaveTextColor(modalColor);
      syncNamedColorUi();
      return;
    }
    if (target.dataset.color) {
      modalColor = target.dataset.color;
      syncNamedColorUi();
      return;
    }

    if (target.dataset.deleteCategory) {
      await deleteListItem(target.dataset.deleteCategory, target.dataset.deleteId);
      return;
    }
    if (target.dataset.editLeaveAssignment) {
      const [memberId, dateString] = target.dataset.editLeaveAssignment.split(":");
      const slot = getSlot(memberId, dateString);
      hideLeaveTooltip();
      if (slot?.leave) {
        openLeaveAssignmentModal(memberId, dateString, slot.leave);
      }
      return;
    }
    if (target.dataset.editOvertimeAssignment) {
      const [memberId, dateString] = target.dataset.editOvertimeAssignment.split(":");
      hideLeaveTooltip();
      openOvertimeAssignmentModal(memberId, dateString);
      return;
    }
    if (target.dataset.generateAutoSchedule) {
      await generateAutoSchedulePreviewFromModal();
      return;
    }
    if (target.dataset.openAdd === "shift") openShiftFormModal("add");
    if (target.dataset.openAdd === "leave") openNamedColorFormModal("leave", "add");
    if (target.dataset.openAdd === "overtime") openNamedColorFormModal("overtime", "add");
    if (target.dataset.editItem === "shift") openShiftFormModal("edit", target.dataset.editId);
    if (target.dataset.editItem === "leave") openNamedColorFormModal("leave", "edit", target.dataset.editId);
    if (target.dataset.editItem === "overtime") openNamedColorFormModal("overtime", "edit", target.dataset.editId);
    if (target.dataset.saveShift) await saveShiftFromModal(target.dataset.saveShift);
    if (target.dataset.saveNamedItem) {
      const [category, mode] = target.dataset.saveNamedItem.split(":");
      await saveNamedColorItem(category, mode);
    }
    if (target.dataset.saveWeekStart) {
      await saveWeekStartSettingFromModal();
    }
    if (target.dataset.saveLeaveAssignment) saveLeaveAssignmentFromModal();
    if (target.dataset.saveOvertimeAssignment) {
      await saveOvertimeAssignmentFromModal();
      return;
    }
    if (target.dataset.saveChangePassword) {
      await saveChangedPassword();
      return;
    }

    if (target.dataset.openAddDepartment) openDepartmentForm("add");
    if (target.dataset.toggleScheduleShifts) {
      const list = document.getElementById("memberScheduleShiftList");
      if (list) {
        list.hidden = !list.hidden;
      }
      return;
    }
    if (target.dataset.editDepartment) openDepartmentForm("edit", target.dataset.editDepartment);
    if (target.dataset.saveDepartment) {
      await saveDepartment(target.dataset.saveDepartment);
      return;
    }
    if (target.dataset.deleteDepartment) {
      await deleteDepartment(target.dataset.deleteDepartment);
      return;
    }

    if (target.dataset.openAddMember) openMemberForm("add");
    if (target.dataset.exportDepartments) {
      await exportDepartmentsFromSettings();
      return;
    }
    if (target.dataset.importDepartments) {
      await importDepartmentsFromSettings();
      return;
    }
    if (target.dataset.exportMembers) {
      await exportMembersFromSettings();
      return;
    }
    if (target.dataset.importMembers) {
      await importMembersFromSettings();
      return;
    }
    if (target.dataset.exportSettings) {
      await exportListSettings(target.dataset.exportSettings);
      return;
    }
    if (target.dataset.importSettings) {
      await importListSettings(target.dataset.importSettings);
      return;
    }
    if (target.dataset.editMember) openMemberForm("edit", target.dataset.editMember);
    if (target.dataset.saveMember) {
      await saveMember(target.dataset.saveMember);
      return;
    }
    if (target.dataset.deleteMember) {
      await deleteMember(target.dataset.deleteMember);
    }
  });

  document.body.addEventListener("dblclick", (event) => {
    const shiftMember = event.target.closest("[data-shift-schedule-member]");
    if (shiftMember) {
      const memberId = shiftMember.dataset.shiftScheduleMember || "";
      if (memberId && canEditSchedule()) {
        openMemberForm("edit", memberId);
      }
      return;
    }
    const target = event.target.closest("[data-table-member-id], [data-table-department-id]");
    if (!target) return;
    if (!canEditSchedule()) return;
    const memberId = target.dataset.tableMemberId;
    if (memberId) {
      openMemberForm("edit", memberId);
      return;
    }
    const deptId = target.dataset.tableDepartmentId;
    if (deptId) {
      openDepartmentForm("edit", deptId);
      return;
    }
  });
}
;

/* ===== renderer-events-form.js ===== */
/* 輸入欄位與選單異動的委派事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindDelegatedFormEvents() {
  document.body.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (target.dataset.memberSettingsFilterField === "name") {
      memberSettingsFilters.name = target.value || "";
      refreshMemberSettingsList();
      return;
    }
    if (isMealQuantityInput(target)) {
      const raw = target.value.trim();
      if (raw !== "" && !/^\d+$/.test(raw)) {
        target.value = target.dataset.lastValidMealQuantity || "0";
        rejectQuantityInput(target, event);
        return;
      }
      target.setCustomValidity("");
      target.dataset.lastValidMealQuantity = raw || "0";
      updateMealOrderLiveSummary();
      return;
    }
    if (isCompanySubsidyInput(target)) {
      const raw = target.value.trim();
      if (raw !== "" && !/^[1-9]\d*$/.test(raw)) {
        target.value = target.dataset.lastValidCompanySubsidy || "55";
        rejectInput(target, event, MEAL_SUBSIDY_ERROR);
        return;
      }
      target.setCustomValidity("");
      if (raw) target.dataset.lastValidCompanySubsidy = raw;
      return;
    }
    if (target.id === "shiftName") {
      syncNamedColorUi();
      return;
    }
    if (target.id === "leaveCatalogName") {
      syncNamedColorUi();
      return;
    }
    if (target.id === "namedItemName") {
      syncNamedColorUi();
      return;
    }
    if (target.dataset.itemColorInput === "bg") {
      modalColor = target.value;
      if (modalTextColorAuto) {
        modalTextColor = autoLeaveTextColor(modalColor);
      }
      syncNamedColorUi();
      return;
    }
    if (target.dataset.itemColorInput === "text") {
      modalTextColor = target.value;
      modalTextColorAuto = false;
      syncNamedColorUi();
    }
  });

  document.body.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.dataset.memberSettingsFilterField) {
      const field = target.dataset.memberSettingsFilterField;
      memberSettingsFilters[field] = target.value || (field === "employment" ? "active" : "all");
      openMemberSettings();
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.toggleOvertimePanel) {
      attendanceOvertimeState = { ...attendanceOvertimeState, expanded: target.checked };
      if (target.checked && !attendanceOvertimeState.status && !attendanceOvertimeState.loading) {
        void loadTodayAttendanceOvertime();
      } else {
        renderAll();
      }
      return;
    }
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const toggleMap = {
      overtimeUseRest1: ["overtimeRest1StartTime", "overtimeRest1EndTime"],
      overtimeUseRest2: ["overtimeRest2StartTime", "overtimeRest2EndTime"]
    };
    if (target.id === "leaveAssignmentAllDay" || target.id === "leaveAssignmentReasonEnabled") {
      syncLeaveAssignmentModalUi();
      return;
    }
    if (target.id === "scheduleOvertimeUseRest1" || target.id === "scheduleOvertimeUseRest2") {
      syncScheduleOvertimeFormUi();
      return;
    }
    if (target.id === "overtimeUseRest1" || target.id === "overtimeUseRest2") {
      syncOvertimeFormUi();
      return;
    }
    if (target.closest("#memberScheduleShiftList")) {
      syncScheduleShiftSelectorRanks();
      syncScheduleShiftSummary();
      return;
    }
    const targets = toggleMap[target.id];
    if (!targets) {
      return;
    }
    targets.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = !target.checked;
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    const input = event.target;
    if (isMealQuantityInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectQuantityInput(input, event);
    }
    if (isCompanySubsidyInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectInput(input, event, MEAL_SUBSIDY_ERROR);
    }
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !String(event.inputType || "").startsWith("insert")) return;
    if (event.inputType === "insertFromPaste") return;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    const nextValue = `${input.value.slice(0, start)}${event.data || ""}${input.value.slice(end)}`;
    if (isMealQuantityInput(input) && !/^\d*$/.test(nextValue)) rejectQuantityInput(input, event);
    if (isCompanySubsidyInput(input) && !/^(?:|[1-9]\d*)$/.test(nextValue)) rejectInput(input, event, MEAL_SUBSIDY_ERROR);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const pasted = event.clipboardData?.getData("text")?.trim() || "";
    if (isMealQuantityInput(input) && !/^\d+$/.test(pasted)) rejectQuantityInput(input, event);
    if (isCompanySubsidyInput(input) && !/^[1-9]\d*$/.test(pasted)) rejectInput(input, event, MEAL_SUBSIDY_ERROR);
  }, true);
}
;

/* ===== renderer-events-tooltip.js ===== */
/* 班表請假與加班提示框事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindScheduleTooltipEvents() {
  document.body.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-hover-schedule-detail]");
    if (!target) {
      return;
    }
    const [memberId, day, category] = target.dataset.hoverScheduleDetail.split(":");
    if (leaveTooltipTimer) {
      clearTimeout(leaveTooltipTimer);
      leaveTooltipTimer = null;
    }
    showScheduleTooltip(memberId, day, category, target.getBoundingClientRect());
  });

  document.body.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-hover-schedule-detail]");
    if (!target) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof HTMLElement && (related.closest("[data-hover-schedule-detail]") || related.closest("#leaveTooltipRoot"))) {
      return;
    }
    scheduleHideLeaveTooltip();
  });
}
;

/* ===== renderer-events-drag.js ===== */
/* 班表、設定、人員與訂餐品項拖曳事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindDragAndDropEvents() {
  document.body.addEventListener("dragstart", (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && canDragScheduleOrder) {
      dragScheduleTableDeptId = tableDepartment.dataset.tableDepartmentId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleTableDeptId);
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && canDragScheduleOrder) {
      dragScheduleTableMemberId = tableMember.dataset.tableMemberId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleTableMemberId);
      return;
    }
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption) {
      dragScheduleShiftId = scheduleShiftOption.dataset.scheduleShiftOption || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragScheduleShiftId);
      return;
    }
    const card = event.target.closest("[data-member-card]");
    if (card) {
      dragMemberId = card.dataset.memberCard || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMemberId);
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow) {
      if (!event.target.closest(".meal-drag-handle")) {
        event.preventDefault();
        return;
      }
      dragMealProductIndex = mealProductRow.dataset.mealProductRow || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragMealProductIndex);
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem) {
      if (!event.target.closest(".settings-order-drag-handle")) {
        event.preventDefault();
        return;
      }
      dragSortItemId = sortItem.dataset.sortItem || "";
      dragSortCategory = sortItem.dataset.sortCategory || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragSortItemId);
      return;
    }
  });

  document.body.addEventListener("dragover", (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markScheduleTableOrderTarget(tableDepartment, event.clientY);
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder && tableMember.dataset.tableMemberId !== dragScheduleTableMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markScheduleTableOrderTarget(tableMember, event.clientY);
      return;
    }
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption && dragScheduleShiftId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewScheduleShiftOption(scheduleShiftOption, event.clientY);
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewDepartmentMember(memberTarget, event.clientY);
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow && dragMealProductIndex) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const draggedElement = document.querySelector(`[data-meal-product-row="${cssEscapeValue(dragMealProductIndex)}"]`);
      if (draggedElement instanceof HTMLElement) {
        draggedElement.classList.add("drag-preview-active");
        moveDragPreviewElement(draggedElement, mealProductRow, event.clientY);
      }
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      previewSortableSettingsItem(sortItem, event.clientY);
      return;
    }
    const dropZone = event.target.closest("[data-drop-department]");
    if (!dropZone || !dragMemberId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  document.body.addEventListener("drop", async (event) => {
    const tableDepartment = event.target.closest("[data-table-department-id]");
    const canDragScheduleOrder = canEditSchedule() && state.tableView !== "shift";
    if (tableDepartment && dragScheduleTableDeptId && canDragScheduleOrder) {
      event.preventDefault();
      await reorderScheduleTableDepartment(dragScheduleTableDeptId, tableDepartment.dataset.tableDepartmentId || "", getScheduleTableOrderInsertAfter(tableDepartment, event.clientY));
      clearDragPreviewState();
      dragScheduleTableDeptId = "";
      return;
    }
    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder) {
      event.preventDefault();
      await reorderScheduleTableMember(dragScheduleTableMemberId, tableMember.dataset.tableMemberId || "", getScheduleTableOrderInsertAfter(tableMember, event.clientY));
      clearDragPreviewState();
      dragScheduleTableMemberId = "";
      return;
    }
    const scheduleShiftOption = event.target.closest("[data-schedule-shift-option]");
    if (scheduleShiftOption && dragScheduleShiftId) {
      event.preventDefault();
      syncScheduleShiftSelectorRanks();
      syncScheduleShiftSummary();
      clearDragPreviewState();
      dragScheduleShiftId = "";
      return;
    }
    const memberTarget = event.target.closest("[data-drop-member]");
    if (memberTarget && dragMemberId) {
      event.preventDefault();
      if (dragPreviewElement?.dataset.memberCard === dragMemberId) {
        commitDepartmentMemberOrderFromDom();
      } else {
        await moveMemberToDepartment(
          dragMemberId,
          memberTarget.dataset.dropDepartment || "",
          memberTarget.dataset.dropMember || ""
        );
      }
      clearDragPreviewState();
      dragMemberId = "";
      return;
    }
    const mealProductRow = event.target.closest("[data-meal-product-row]");
    if (mealProductRow && dragMealProductIndex) {
      event.preventDefault();
      commitMealProductOrderFromDom();
      clearDragPreviewState();
      dragMealProductIndex = "";
      return;
    }
    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem && dragSortItemId && dragSortCategory === (sortItem.dataset.sortCategory || "")) {
      event.preventDefault();
      commitSortedListFromDom(dragSortCategory);
      clearDragPreviewState();
      dragSortItemId = "";
      dragSortCategory = "";
      return;
    }
    const dropZone = event.target.closest("[data-drop-department]");
    if (!dropZone || !dragMemberId) {
      return;
    }
    event.preventDefault();
    await moveMemberToDepartment(dragMemberId, dropZone.dataset.dropDepartment);
    clearDragPreviewState();
    dragMemberId = "";
  });

  document.body.addEventListener("dragend", () => {
    clearDragPreviewState();
    dragMemberId = "";
    dragScheduleShiftId = "";
    dragSortItemId = "";
    dragSortCategory = "";
    dragScheduleTableDeptId = "";
    dragScheduleTableMemberId = "";
    dragMealProductIndex = "";
  });
}
;

/* ===== renderer-drag-scroll-preserve.js ===== */
/* 拖曳排序期間保存視窗與表格捲動位置。 */
let dragScrollSnapshot = null;
let dragScrollRestoreUntil = 0;

const DRAG_SCROLL_SELECTORS = [
  ".department-settings-modal [data-sort-item]",
  ".catalog-settings-modal [data-sort-item]",
  "[data-meal-product-row]",
  "[data-table-member-id]",
  "[data-table-department-id]"
].join(",");

function getDragScrollKey(element, index) {
  if (!(element instanceof HTMLElement)) return `scroll-${index}`;
  const classKey = Array.from(element.classList).filter((name) => /scroll|body|wrap/.test(name)).join(".");
  return classKey ? `.${classKey}` : `scroll-${index}`;
}

function collectDragScrollableElements() {
  const modal = document.querySelector("#modalRoot .modal-overlay");
  const scope = modal || document;
  return Array.from(scope.querySelectorAll(".modal-body, .settings-table-scroll, .member-table-scroll, .department-settings-table-wrap, .settings-table-wrap, .member-table-wrap, .table-wrap"))
    .filter((element) => element instanceof HTMLElement)
    .filter((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
}

function captureDragScrollPosition() {
  dragScrollSnapshot = {
    windowX: window.scrollX,
    windowY: window.scrollY,
    entries: collectDragScrollableElements().map((element, index) => ({
      key: getDragScrollKey(element, index),
      top: element.scrollTop,
      left: element.scrollLeft
    }))
  };
  dragScrollRestoreUntil = Date.now() + 1500;
}

function findDragScrollableElement(key, index) {
  if (key.startsWith(".")) {
    const selector = key.split(".").filter(Boolean).map((part) => `.${CSS.escape(part)}`).join("");
    const found = document.querySelector(`#modalRoot ${selector}, ${selector}`);
    if (found instanceof HTMLElement) return found;
  }
  return collectDragScrollableElements()[index] || null;
}

function restoreDragScrollPosition() {
  if (!dragScrollSnapshot || Date.now() > dragScrollRestoreUntil) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo(dragScrollSnapshot.windowX, dragScrollSnapshot.windowY);
    dragScrollSnapshot.entries.forEach((entry, index) => {
      const element = findDragScrollableElement(entry.key, index);
      if (element) {
        element.scrollTop = entry.top;
        element.scrollLeft = entry.left;
      }
    });
  }));
}

function bindDragScrollPreservation() {
  document.addEventListener("dragstart", (event) => {
    const target = event.target instanceof Element ? event.target.closest(DRAG_SCROLL_SELECTORS) : null;
    if (target) captureDragScrollPosition();
  }, true);
  document.addEventListener("drop", () => {
    if (!dragScrollSnapshot) return;
    dragScrollRestoreUntil = Date.now() + 1500;
    restoreDragScrollPosition();
    setTimeout(restoreDragScrollPosition, 0);
    setTimeout(restoreDragScrollPosition, 80);
    setTimeout(restoreDragScrollPosition, 220);
  }, true);
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) new MutationObserver(restoreDragScrollPosition).observe(modalRoot, { childList: true, subtree: true });
}
;

/* ===== renderer-events.js ===== */
/* 全域事件註冊總控。
 * 由 renderer.js 最終拆分；只協調各責任模組。
 */

function bindCoreMenuDismissEvent() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    const menu = document.getElementById("coreActionsMenu");
    const toggle = document.getElementById("coreActionsToggle");
    if (!menu || !toggle) {
      return;
    }
    if (menu.contains(target) || toggle.contains(target)) {
      return;
    }
    closeCoreActionsMenu();
  });
}

function bindEvents() {
  if (eventsBound) {
    return;
  }
  eventsBound = true;
  bindStaticToolbarEvents();
  bindScheduleViewportEvents();
  bindScheduleFilterEvents();
  bindScheduleSessionEvents();
  bindDelegatedClickEvents();
  bindDelegatedFormEvents();
  bindRecordsEvents();
  bindScheduleTooltipEvents();
  bindDragAndDropEvents();
  bindDragScrollPreservation();
  bindCoreMenuDismissEvent();
}
;

/* ===== renderer.js ===== */
let state = createEmptyState();
let modalColor = COLORS[0].hex;
let modalTextColor = "#ffffff";
let modalTextColorAuto = true;
let modalContext = {};
let saveTimer = null;
let isSaving = false;
let latestSaveStatus = "";
let appInfo = null;
let dragMemberId = "";
let dragScheduleShiftId = "";
let leaveTooltipTimer = null;
let coreActionsOpen = false;
let appView = "home";
const APP_BACK_HISTORY_STATE = { schedulerBackGuard: true };
let departmentSettingsView = "department";
let currentSession = null;
let currentProfile = null;
let currentMember = null;
let managerDirectoryLoaded = false;
let managerDirectoryLoading = null;
let attendanceState = createAttendanceState();
let attendanceOvertimeState = createAttendanceOvertimeState();
let mealOrderState = createMealOrderState();
let mealOrderLoadSequence = 0;
let mealPageTab = "order";
let recordsState = createRecordsState();
let memberSettingsFilters = {
  name: "",
  department: "all",
  role: "all",
  employment: "active",
  salaryType: "all"
};
let authErrorMessage = "";
let authPromptMessage = "";
let authModalOpen = false;
let eventsBound = false;
let dragSortItemId = "";
let dragSortCategory = "";
let dragPreviewElement = null;
let dragScheduleTableDeptId = "";
let dragScheduleTableMemberId = "";
let dragMealProductIndex = "";
let toolbarCollapsed = false;
let toolbarCollapseInitialized = false;
let measureTextContext = null;
let scheduleRangeSelection = null;
let scheduleDragSelecting = false;
let scheduleHeaderDragSelection = null;
let scheduleSuppressNextCellClick = false;
let scheduleClipboard = null;

let scheduleUndoStack = [];
let scheduleRedoStack = [];
let autoSchedulePreview = null;

async function loadApp() {
  managerDirectoryLoaded = false;
  managerDirectoryLoading = null;
  bindEvents();
  pushAppBackHistoryGuard();
  authErrorMessage = "";
  try {
    const authContext = await window.schedulerApi.initializeAuth();
    currentSession = authContext.session;
    currentProfile = authContext.profile;
    if (!currentSession?.user) {
      state = createEmptyState();
      resetLoadedUserRuntimeState();
      appView = "home";
      authModalOpen = true;
      renderAll();
      syncCoreActionsMenu();
      return;
    }
    appInfo = await window.schedulerApi.getAppInfo();
    const payload = await window.schedulerApi.loadState();
    state = normalizeState(payload);
    resetScheduleWindowToToday();
    await ensureVisibleScheduleLoaded();
    currentMember = resolveCurrentMember();
    appView = "home";
  } catch (error) {
    setSaveStatus(`載入失敗：${error.message}`);
    authErrorMessage = error.message || "載入失敗";
    state = createEmptyState();
    currentSession = null;
    currentProfile = null;
    resetLoadedUserRuntimeState();
    renderAll();
    syncCoreActionsMenu();
    return;
  }

  renderAll();
  syncCoreActionsMenu();
  void refreshScheduleCatalogsAfterInitialRender();
}

async function refreshScheduleCatalogsAfterInitialRender() {
  if (!isManager()) {
    return;
  }
  try {
    await syncScheduleCatalogs();
  } catch (error) {
    setSaveStatus(`同步設定失敗：${error.message}`);
  }
}

loadApp();
;
