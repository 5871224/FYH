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

  function setWidths(sheet, widths) {
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: widths.length }
    };
  }

  window.schedulerApi.exportMealReport = async function exportV2MealReport(report = {}) {
    const details = Array.isArray(report.exportDetails)
      ? report.exportDetails
      : Array.isArray(report.details)
        ? report.details
        : [];
    if (!details.length) return { canceled: true, empty: true };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet("每日備餐統計");
    summarySheet.addRow(["日期", "單位", "品項", "數量", "金額"]);
    (report.summary || []).forEach((row) => {
      summarySheet.addRow([
        row.date || "",
        row.departmentName || "",
        row.productName || "",
        Number(row.quantity || 0),
        Number(row.amount || 0)
      ]);
    });
    setWidths(summarySheet, [14, 20, 24, 12, 14]);

    const detailSheet = workbook.addWorksheet("員工訂餐明細");
    detailSheet.addRow([
      "日期",
      "單位",
      "員工",
      "品項",
      "數量",
      "單價",
      "小計",
      "品項備註"
    ]);
    details.forEach((row) => {
      const note = [
        row.note || "",
        row.clockDeletedWarning ? "此訂單所依據的上班打卡已被刪除" : ""
      ].filter(Boolean).join("；");
      detailSheet.addRow([
        row.date || "",
        row.departmentName || "",
        row.employeeName || "",
        row.productName || "",
        Number(row.quantity || 0),
        Number(row.unitPrice || 0),
        Number(row.amount || 0),
        note
      ]);
    });
    setWidths(detailSheet, [14, 20, 18, 24, 10, 12, 14, 36]);

    [summarySheet, detailSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const fileName = `訂餐報表_${report.fromDate || ""}_${report.toDate || ""}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  };
})();
