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

  function requireExportRows(payload) {
    if (!Array.isArray(payload?.exportRows)) {
      throw new Error("匯出資料必須由正式 API 提供 exportRows");
    }
    return payload.exportRows;
  }

  function compactIsoDate(value) {
    return String(value || "").replaceAll("-", "");
  }

  function getSapLeaveRowsFromExport(payload) {
    const sapCodeMap = new Map([["0036", "OFF"], ["0047", "REST"], ["休息日", "REST"], ["休假", "REST"], ["例假", "OFF"]]);
    return requireExportRows(payload).flatMap((row) => {
      if (row.pay_by_day || !row.leave_type_id) return [];
      const sapCode = sapCodeMap.get(row.leave_code) || sapCodeMap.get(row.leave_name);
      if (!sapCode) return [];
      const date = compactIsoDate(row.work_date);
      return [[row.employee_name || "", row.employee_code || "", date, date, sapCode]];
    });
  }

  function getOvertimeRowsFromExport(payload) {
    return requireExportRows(payload).flatMap((row) => {
      if (!row.overtime_type_id) return [];
      return [[
        row.employee_code || "",
        compactIsoDate(row.work_date),
        formatCompactTime(row.overtime_start_time),
        formatCompactTime(row.overtime_end_time),
        Number(row.overtime_previous_day || 0),
        Number(row.overtime_subsidy_type || 1),
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_start_time) : "",
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_end_time) : "",
        row.overtime_use_rest_1 ? Number(row.overtime_rest_1_paid || 0) : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_start_time) : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_end_time) : "",
        row.overtime_use_rest_2 ? Number(row.overtime_rest_2_paid || 0) : ""
      ]];
    });
  }

  function getLeaveRowsFromExport(payload) {
    const excludedLeaveCodes = new Set(["0036", "0047"]);
    const hiddenDepartmentIds = new Set((payload.state?.departments || []).filter((department) => department?.hiddenFromSchedule).map((department) => department.id));
    return requireExportRows(payload).flatMap((row) => {
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
    return getSapLeaveRowsFromExport(payload);
  }

  function buildSapLeaveCsvContent(payload) {
    const rows = getSapLeaveExportRows(payload);
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    return rows.length ? `\uFEFF${csv}\r\n` : "\uFEFF";
  }

  function getOvertimeExportRows(payload) {
    return getOvertimeRowsFromExport(payload);
  }

  function getLeaveExportRows(payload) {
    return getLeaveRowsFromExport(payload);
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
    const payload = {
      state: { departments: [] },
      exportRows: [
        {
          employee_code: "SELF_CHECK",
          employee_name: "Self Check",
          home_department_id: null,
          pay_by_day: false,
          work_date: "2026-07-17",
          leave_type_id: "leave-rest",
          leave_code: "0047",
          leave_name: "休息日",
          leave_all_day: true,
          overtime_type_id: "overtime-id",
          overtime_start_time: "18:00:00",
          overtime_end_time: "20:00:00",
          overtime_use_rest_1: false,
          overtime_use_rest_2: false
        },
        {
          employee_code: "SELF_CHECK",
          employee_name: "Self Check",
          home_department_id: null,
          pay_by_day: false,
          work_date: "2026-07-18",
          leave_type_id: "leave-off",
          leave_code: "0036",
          leave_name: "例假",
          leave_all_day: true
        }
      ]
    };
    const csv = buildSapLeaveCsvContent(payload);
    if (!csv.includes("REST") || !csv.includes("OFF")) {
      throw new Error("browser exporter self-check failed");
    }
    if (normalizeImportedDate("2025/01/02") !== "2025-01-02") {
      throw new Error("browser exporter date self-check failed");
    }
    if (getOvertimeExportRows(payload).length !== 1) {
      throw new Error("browser exporter overtime rows self-check failed");
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
