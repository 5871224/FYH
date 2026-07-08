(function installV2MealExport() {
  if (!window.schedulerApi || typeof ExcelJS === "undefined") return;

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function compactDate(value) {
    return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
  }

  function buildEmployeeRows(report, details) {
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

    return [...employees.values()]
      .map((row) => {
        const mealDays = row.dates.size;
        return {
          employeeName: row.employeeName,
          employeeCode: row.employeeCode,
          lunchAmount: row.amount - mealDays * companySubsidy,
          lunchCount: mealDays
        };
      })
      .sort((a, b) => (
        String(a.employeeName).localeCompare(String(b.employeeName), "zh-Hant")
        || String(a.employeeCode).localeCompare(String(b.employeeCode))
      ));
  }

  function styleSheet(sheet) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 10 }
    };
    sheet.columns = [
      { width: 18 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 }
    ];
    sheet.getColumn(2).numFmt = "@";
    sheet.getColumn(10).numFmt = "@";
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
  }

  window.schedulerApi.exportMealReport = async function exportV2MealReport(report = {}) {
    const details = Array.isArray(report.exportDetails)
      ? report.exportDetails
      : Array.isArray(report.details)
        ? report.details
        : [];
    if (!details.length) return { canceled: true, empty: true };

    const rows = buildEmployeeRows(report, details);
    if (!rows.length) return { canceled: true, empty: true };

    const reportDate = compactDate(report.toDate);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("訂餐統計");
    sheet.addRow([
      "員工姓名",
      "員工編號",
      "早餐金額",
      "午餐金額",
      "晚餐金額",
      "早餐份數",
      "午餐份數",
      "晚餐份數",
      "總計",
      "日期"
    ]);
    rows.forEach((row) => {
      sheet.addRow([
        row.employeeName,
        row.employeeCode,
        "",
        row.lunchAmount,
        "",
        "",
        row.lunchCount,
        "",
        "",
        reportDate
      ]);
    });
    styleSheet(sheet);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const fileName = `訂餐統計_${compactDate(report.fromDate)}-${reportDate}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  };
})();
