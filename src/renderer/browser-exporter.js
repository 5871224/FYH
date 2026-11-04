(function installBrowserExporter() {
  const EXCELJS_SRC = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
  let excelJsPromise = null;

  async function ensureExcelJS() {
    if (window.ExcelJS?.Workbook) return window.ExcelJS;
    if (!excelJsPromise) {
      excelJsPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-fyh-exceljs="true"]');
        const script = existing || document.createElement("script");
        const done = () => {
          if (window.ExcelJS?.Workbook) resolve(window.ExcelJS);
          else reject(new Error("ExcelJS 載入失敗"));
        };
        script.addEventListener("load", done, { once: true });
        script.addEventListener("error", () => {
          excelJsPromise = null;
          reject(new Error("ExcelJS 載入失敗"));
        }, { once: true });
        if (!existing) {
          script.src = EXCELJS_SRC;
          script.async = true;
          script.dataset.fyhExceljs = "true";
          document.head.appendChild(script);
        }
      });
    }
    return excelJsPromise;
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getItemMap(items) {
    return new Map((items || []).map((item) => [item.id, item]));
  }

  function getScheduleKey(memberId, year, month, day) {
    return `${memberId}_${year}_${month}_${day}`;
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
    const ExcelJS = await ensureExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";

    const { state, year, month } = payload;
    const dates = Array.isArray(payload.dates) && payload.dates.length
      ? payload.dates
      : Array.from({ length: daysInMonth(year, month) }, (_, index) => formatIsoDate(year, month, index + 1));
    const shiftView = payload.view === "shift";
    const includeStats = !shiftView && Boolean(payload.tableStatsVisible);
    const fixedColumns = shiftView ? 2 : includeStats ? 3 : 2;
    const lastColumn = fixedColumns + dates.length;
    const sheet = workbook.addWorksheet("班表", {
      views: [{ state: "frozen", xSplit: fixedColumns, ySplit: 2 }]
    });
    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
    sheet.properties.defaultRowHeight = 34;

    const maps = {
      shifts: getItemMap(state.shifts),
      leaves: getItemMap(state.leaves),
      overtime: getItemMap(state.overtime)
    };
    const holidayDates = new Set(payload.holidayDates || []);
    const meetingDates = new Set(payload.meetingDates || []);
    const weekStart = Number(payload.weekStart ?? 0);
    const monthStartDay = Number(payload.monthStartDay ?? 1);
    const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];
    const fontName = "Microsoft JhengHei";
    const inactiveColor = "#D7CBB9";
    const borderColor = { argb: "FFD8D2C7" };
    const cellBorder = () => ({
      top: { style: "thin", color: borderColor },
      bottom: { style: "thin", color: borderColor },
      left: { style: "thin", color: borderColor },
      right: { style: "thin", color: borderColor }
    });
    const paint = (cell, hex) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(hex) } };
    };
    const foreground = (item, background) => {
      if (/^#[\da-f]{6}$/i.test(item?.textColor || "")) return toArgb(item.textColor);
      const color = String(background || "#FFFFFF").replace("#", "");
      const parts = [0, 2, 4].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
      const brightness = (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
      return brightness >= 150 ? "FF222222" : "FFFFFFFF";
    };
    const makeSegments = (slot) => {
      const segments = [];
      const shift = maps.shifts.get(slot?.shift);
      const leave = maps.leaves.get(slot?.leave);
      const overtime = maps.overtime.get(slot?.overtime);
      if (shift) segments.push({ name: shift.name, item: shift, color: shift.color });
      if (leave) segments.push({
        name: slot?.leaveMeta?.displayName || leave.name,
        item: leave,
        color: leave.color,
        // 與班表畫面一致：排班別遇到休息日（0047）時，「休」改用灰字。
        fontArgb: leave.code === "0047" && slot?.shift ? "FF707070" : ""
      });
      if (slot?.overtime) segments.push({
        name: overtime?.name || slot?.overtimeMeta?.displayName || "加班",
        item: overtime,
        color: overtime?.color || "#D85A30"
      });
      return segments;
    };
    const setScheduleCell = (cell, segment, inactive = false) => {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { name: fontName, size: 10 };
      if (inactive) {
        cell.value = "";
        paint(cell, inactiveColor);
      } else if (segment) {
        cell.value = segment.name;
        paint(cell, segment.color);
        cell.font = { name: fontName, size: 10, bold: true, color: { argb: segment.fontArgb || foreground(segment.item, segment.color) } };
      }
    };

    sheet.mergeCells(1, 1, 1, lastColumn);
    const title = sheet.getCell(1, 1);
    title.value = payload.dates?.length ? `${dates[0]} ～ ${dates[dates.length - 1]}` : `${year} 年 ${month + 1} 月`;
    title.font = { name: fontName, bold: true, size: 16 };
    title.alignment = { horizontal: "center", vertical: "middle" };
    paint(title, "#F3EBD8");
    sheet.getRow(1).height = 30;

    const header = sheet.getRow(2);
    header.height = 34;
    const fixedHeaders = shiftView
      ? ["班別", "需求人數"]
      : includeStats ? ["單位", "人員", "統計"] : ["單位", "人員"];
    fixedHeaders.forEach((label, index) => { header.getCell(index + 1).value = label; });
    dates.forEach((dateString, index) => {
      const dayDate = new Date(dateString + "T12:00:00");
      const weekday = dayDate.getDay();
      const cell = header.getCell(fixedColumns + index + 1);
      cell.value = String(dayDate.getDate()) + "\n" + weekLabels[weekday];
      cell.font = {
        name: fontName,
        bold: true,
        size: 10,
        color: { argb: meetingDates.has(dateString) ? "FF7E22CE"
          : holidayDates.has(dateString) ? "FFC2416C"
            : weekday === 0 ? "FFD64545"
              : weekday === 6 ? "FF165DAB" : "FF333333" }
      };
      paint(cell, meetingDates.has(dateString) ? "#F3E8FF" : "#F8F6F0");
    });
    for (let index = 1; index <= fixedColumns; index += 1) paint(header.getCell(index), "#F8F6F0");
    header.eachCell((cell) => {
      cell.font = cell.font || { name: fontName, bold: true, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    let rowIndex = 3;
    if (shiftView) {
      for (const entry of payload.shiftRows || []) {
        const shift = entry.shift;
        const row = sheet.getRow(rowIndex++);
        [shift.name, shift.requiredStaffCount ?? 0].forEach((value, index) => {
          const cell = row.getCell(index + 1);
          cell.value = value;
          cell.alignment = { horizontal: index === 0 ? "left" : "center", vertical: "middle", wrapText: true };
          cell.font = { name: fontName, size: 10, bold: index === 0 };
        });
        dates.forEach((dateString, index) => {
          const info = entry.days?.[index] || {};
          const cell = row.getCell(fixedColumns + index + 1);
          cell.value = (info.names || []).join("\n");
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.font = { name: fontName, size: 10 };
          if (!info.isOperating) paint(cell, inactiveColor);
          else if (info.isShortage) paint(cell, "#FDE5E8");
          else if (info.isSurplus) paint(cell, "#FFF1CC");
        });
        row.height = Math.max(34, Math.min(84, 14 * Math.max(2, ...((entry.days || []).map((info) => (info.names || []).length)))));
      }
    } else {
      for (const { department, members } of payload.groups || []) {
        const groupMembers = members.length ? members : [null];
        const startRow = rowIndex;
        groupMembers.forEach((member) => {
          const dayCells = dates.map((dateString) => {
            if (!member) return { inactive: true, segments: [] };
            const day = new Date(dateString + "T12:00:00");
            if (!isMemberActiveOnDate(member, day.getFullYear(), day.getMonth(), day.getDate())) {
              return { inactive: true, segments: [] };
            }
            const key = getScheduleKey(member.id, day.getFullYear(), day.getMonth(), day.getDate());
            return { inactive: false, segments: makeSegments(state.schedule?.[key]) };
          });

          // Excel 儲存格無法同時擁有不同背景色。僅在該人員有同日多個項目時，
          // 將原本的一列分成 2～3 子列，讓班別、假別與加班保有各自的底色。
          const subrowCount = Math.max(1, ...dayCells.map((dayCell) => dayCell.segments.length));
          const memberStartRow = rowIndex;
          const memberEndRow = memberStartRow + subrowCount - 1;
          const subrowHeight = (includeStats ? 54 : 42) / subrowCount;
          for (let rowNumber = memberStartRow; rowNumber <= memberEndRow; rowNumber += 1) {
            sheet.getRow(rowNumber).height = subrowHeight;
          }
          rowIndex = memberEndRow + 1;

          if (member) {
            if (subrowCount > 1) sheet.mergeCells(memberStartRow, 2, memberEndRow, 2);
            const memberCell = sheet.getCell(memberStartRow, 2);
            memberCell.value = member.name;
            memberCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
            memberCell.font = { name: fontName, size: 10 };
          }
          if (includeStats && member) {
            if (subrowCount > 1) sheet.mergeCells(memberStartRow, 3, memberEndRow, 3);
            const stats = payload.statsByMember?.[member.id] || {};
            const statsCell = sheet.getCell(memberStartRow, 3);
            statsCell.value = [
              "休:" + (stats.rest || 0), "灰休:" + (stats.restWork || 0),
              "例:" + (stats.regular || 0), "未排:" + (stats.unassigned || 0)
            ].join("\n");
            statsCell.font = { name: fontName, size: 9 };
            statsCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          }

          dayCells.forEach(({ inactive, segments }, index) => {
            const column = fixedColumns + index + 1;
            if (inactive || segments.length === 0) {
              if (subrowCount > 1) sheet.mergeCells(memberStartRow, column, memberEndRow, column);
              setScheduleCell(sheet.getCell(memberStartRow, column), null, inactive);
              return;
            }

            segments.forEach((segment, segmentIndex) => {
              const topRow = memberStartRow + segmentIndex;
              // 人員最多拆成三列；只有兩個項目的日期讓最後一項合併剩餘子列。
              const bottomRow = segmentIndex === segments.length - 1 ? memberEndRow : topRow;
              if (bottomRow > topRow) sheet.mergeCells(topRow, column, bottomRow, column);
              setScheduleCell(sheet.getCell(topRow, column), segment);
            });
          });
        });
        const endRow = rowIndex - 1;
        if (endRow > startRow) sheet.mergeCells(startRow, 1, endRow, 1);
        const deptCell = sheet.getCell(startRow, 1);
        deptCell.value = [department.code, department.name].filter(Boolean).join("\n");
        deptCell.font = { name: fontName, size: 10, bold: true };
        deptCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        paint(deptCell, "#F8F6F0");
      }
    }

    if (rowIndex === 3) {
      sheet.getCell(3, 1).value = "目前沒有符合範圍的資料";
      rowIndex += 1;
    }

    [shiftView ? 19 : 20, shiftView ? 12 : 17,
      ...(shiftView ? [12, 12] : includeStats ? [14] : [])]
      .forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    for (let index = 0; index < dates.length; index += 1) {
      sheet.getColumn(fixedColumns + index + 1).width = 10;
    }

    // 先設定共同格線，再疊加週、月分隔線，避免被一般框線覆蓋。
    for (let row = 1; row < rowIndex; row += 1) {
      for (let column = 1; column <= lastColumn; column += 1) {
        const cell = sheet.getCell(row, column);
        cell.border = cellBorder();
      }
    }
    dates.forEach((dateString, index) => {
      const date = new Date(dateString + "T12:00:00");
      const isMonthStart = index !== 0 && date.getDate() === Math.min(monthStartDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
      const isWeekStart = index !== 0 && date.getDay() === weekStart;
      if (!isMonthStart && !isWeekStart) return;
      const border = {
        style: "medium",
        color: { argb: isMonthStart ? "FF337AB7" : "FFB39A75" }
      };
      for (let row = 2; row < rowIndex; row += 1) {
        const cell = sheet.getCell(row, fixedColumns + index + 1);
        cell.border = { ...cell.border, left: border };
      }
    });
    return workbook;
  }

  function addSpecialAttendanceHours(value, hours) {
    const normalized = formatCompactTime(value);
    if (!/^\d{4}$/.test(normalized)) return "";
    const minutes = (Number(normalized.slice(0, 2)) * 60 + Number(normalized.slice(2)) + hours * 60) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}`;
  }

  function formatSpecialAttendancePunch(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value || "";
    const minute = parts.find((part) => part.type === "minute")?.value || "";
    return hour && minute ? `${hour}${minute}` : "";
  }

  function getSpecialAttendanceExportRows(rows, members = []) {
    const memberNames = new Map((members || []).map((member) => [String(member.id), member.full_name || ""]));
    return (Array.isArray(rows) ? rows : []).filter((row) => row?.shift).map((row) => {
      const shiftStart = formatCompactTime(row.shift?.start_time);
      const isRestDay = (row.scheduleSegments || []).some((segment) =>
        segment.category === "leave" && (String(segment.code) === "0047" || segment.name === "休息日")
      );
      return {
        restDay: isRestDay,
        values: [
          memberNames.get(String(row.user_id)) || row.employee_name || "",
          String(row.employee_code || ""),
          String(row.work_date || "").replace(/-/g, ""),
          shiftStart,
          shiftStart, // 依指定格式：結束時間同樣取班別上班時間。
          "0001",
          "1",
          addSpecialAttendanceHours(row.shift?.start_time, 4),
          addSpecialAttendanceHours(row.shift?.start_time, 5),
          "",
          "",
          formatSpecialAttendancePunch(row.clock_in_at),
          formatSpecialAttendancePunch(row.clock_out_at)
        ]
      };
    });
  }

  async function createSpecialAttendanceWorkbook(rows, members = []) {
    const entries = getSpecialAttendanceExportRows(rows, members);
    if (!entries.length) return null;
    await ensureExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("特殊出勤", { views: [{ state: "frozen", ySplit: 1 }] });
    const headers = [
      "姓名", "員工編號", "日期", "開始時間", "結束時間", "出勤類型", "補貼類型",
      "休息1-開始", "休息1-結束", "休息2-開始", "休息2-結束", "上班打卡", "下班打卡"
    ];
    sheet.addRow(headers);
    sheet.columns = headers.map((header, index) => ({ width: index === 0 ? 16 : Math.max(13, header.length * 2 + 3) }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
    // Match the other attendance Excel exports: only import-format columns have a beige header.
    headers.forEach((_, index) => {
      if ([0, 11, 12].includes(index)) return; // 姓名、上班打卡、下班打卡保持無底色。
      sheet.getRow(1).getCell(index + 1).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" }
      };
    });
    entries.forEach(({ values, restDay }) => {
      const excelRow = sheet.addRow(values);
      for (let column = 1; column <= headers.length; column += 1) {
        const cell = excelRow.getCell(column);
        cell.numFmt = "@"; // 工號、日期與 HHNN 均以文字保留前置零。
        if (restDay) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
        }
      }
    });
    applySheetBorder(sheet);
    return workbook;
  }

  async function createOvertimeWorkbook(payload) {
    await ensureExcelJS();
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
    if (payload.attendanceReview) {
      headers.splice(0, 0, "姓名");
      headers.splice(2, 0, "星期", "單位");
      headers.push("加班原因", "正確時間(起)", "正確時間(迄)");
    }
    sheet.addRow(headers);

    const sourceRows = requireExportRows(payload).filter((item) => item.overtime_type_id);
    let previousMember = null;
    getOvertimeExportRows(payload).forEach((row, index) => {
      if (!payload.attendanceReview) {
        sheet.addRow(row);
        return;
      }
      const source = sourceRows[index];
      const memberKey = String(source?.group_id || "") + ":" +
        String(source?.member_id || source?.employee_code || "");
      if (previousMember !== null && memberKey !== previousMember) {
        sheet.addRow([]); // Leave one genuinely empty row between members.
      }
      previousMember = memberKey;
      const match = String(source?.work_date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const weekday = match
        ? "日一二三四五六"[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()]
        : "";
      const excelRow = sheet.addRow([
        source?.employee_name || "",
        row[0], weekday || "", source?.scheduled_department_name || "",
        ...row.slice(1),
        source?.overtime_reason || "",
        formatCompactTime(source?.correct_start_time),
        formatCompactTime(source?.correct_end_time)
      ]);
      // Missing shift is pink; rest-day overtime is bright yellow. Pink takes priority.
      const rowFill = source?.missingScheduledShift
        ? "FFFFE4EC"
        : source?.overtime_type_id === "attendance-rest-day" ? "FFFFFF00" : "";
      if (rowFill) {
        for (let column = 1; column <= headers.length; column += 1) {
          excelRow.getCell(column).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: rowFill }
          };
        }
      }
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    // Preserve the original unfilled headers for the three attendance extras.
    headers.forEach((_, index) => {
      if (payload.attendanceReview && [0, 2, 3].includes(index)) return;
      sheet.getRow(1).getCell(index + 1).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" }
      };
    });
    sheet.columns = headers.map((_, index) => {
      if (payload.attendanceReview) {
        if (index === 0 || index === 3) return { width: 18 };
        if (index === 2) return { width: 10 };
        if (index === 15) return { width: 42 }; // Overtime reason
        if (index === 16 || index === 17) return { width: 18 };
        const originalIndex = index === 1 ? 0 : index - 3;
        return { width: originalIndex === 0 ? 14 : [4, 5, 8, 11].includes(originalIndex) ? 10 : 14 };
      }
      return { width: index === 0 ? 14 : [4, 5, 8, 11].includes(index) ? 10 : 14 };
    });
    applySheetBorder(sheet);
    return workbook;
  }

  async function createLeaveWorkbook(payload) {
    await ensureExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("匯出請假");
    const headers = [
      "員工編號",
      "姓名",
      "請假日期(起)",
      "請假日期(迄)",
      "請假時間(起)",
      "請假時間(迄)",
      "假別",
      "說明"
    ];
    const nameByEmployeeCode = new Map(
      (Array.isArray(payload?.exportRows) ? payload.exportRows : []).map((row) => [
        String(row.employee_code || ""),
        String(row.employee_name || "")
      ])
    );

    sheet.addRow(headers);
    getLeaveExportRows(payload).forEach((row) => {
      const [employeeCode, ...leaveValues] = row;
      sheet.addRow([
        employeeCode,
        nameByEmployeeCode.get(String(employeeCode || "")) || "",
        ...leaveValues
      ]);
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headers.forEach((_, index) => {
      if (index === 1 || index === 7) return;
      sheet.getRow(1).getCell(index + 1).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" }
      };
    });
    sheet.columns = [
      { width: 14 },
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
    await ensureExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("人員資料");
    const headers = ["工號", "姓名", "排班班別", "權限", "到職日", "離職日", "計薪方式", "例假星期", "所屬單位"];
    const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    const departments = payload.state?.departments || [];
    const shifts = payload.state?.shifts || [];
    const roleNameById = new Map((payload.state?.accessRoles || []).map((role) => [role.id, role.name]));

    sheet.addRow(headers);
    (payload.state?.members || []).forEach((member) => {
      const scheduleShiftNames = getShiftNamesForMember(member, shifts);
      sheet.addRow([
        member.code || "",
        member.name || "",
        scheduleShiftNames.join("、"),
        roleNameById.get(member.roleId || "") || "",
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
    await ensureExcelJS();
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
    await ensureExcelJS();
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
    await ensureExcelJS();
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
    await ensureExcelJS();
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
    await ensureExcelJS();
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
        roleName: roleText,
        hireDate,
        leaveDate,
        payByDay: salaryType === "日薪" || salaryType === "按日計薪",
        fixedRestWeekday: fixedRestWeekdayMap.has(fixedRestWeekdayText) ? fixedRestWeekdayMap.get(fixedRestWeekdayText) : 0
      });
    });
    return rows;
  }

  async function parseDepartmentWorkbook(arrayBuffer) {
    await ensureExcelJS();
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
    await ensureExcelJS();
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
    await ensureExcelJS();
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
    await ensureExcelJS();
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
    return [...employees.values()].map((row) => ({
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      lunchAmount: row.amount - row.dates.size * companySubsidy,
      lunchCount: row.dates.size
    })).sort((a, b) => (
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

  async function createMealReportWorkbook(report = {}) {
    const details = Array.isArray(report.exportDetails) ? report.exportDetails : [];
    if (!details.length) return null;
    const rows = buildMealEmployeeRows(report, details);
    if (!rows.length) return null;
    await ensureExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("訂餐統計");
    const reportDate = String(report.toDate || "").replace(/[^0-9]/g, "").slice(0, 8);
    sheet.addRow(["員工姓名", "員工編號", "早餐金額", "午餐金額", "晚餐金額", "早餐份數", "午餐份數", "晚餐份數", "總計", "日期"]);
    rows.forEach((row) => {
      sheet.addRow([row.employeeName, row.employeeCode, "", row.lunchAmount, "", "", row.lunchCount, "", "", reportDate]);
    });
    styleMealExportSheet(sheet);
    return workbook;
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
    ensureExcelJS,
    buildSapLeaveCsvContent,
    getSapLeaveExportRows,
    getOvertimeExportRows,
    getSpecialAttendanceExportRows,
    getLeaveExportRows,
    createScheduleWorkbook,
    createOvertimeWorkbook,
    createSpecialAttendanceWorkbook,
    createLeaveWorkbook,
    createMemberWorkbook,
    createDepartmentWorkbook,
    createShiftWorkbook,
    createLeaveSettingsWorkbook,
    createOvertimeSettingsWorkbook,
    createMealReportWorkbook,
    parseMemberWorkbook,
    parseDepartmentWorkbook,
    parseShiftWorkbook,
    parseLeaveSettingsWorkbook,
    parseOvertimeSettingsWorkbook,
    workbookToBlob
  };
})();
