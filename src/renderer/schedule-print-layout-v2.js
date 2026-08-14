/* 班表列印版面修正：固定 A4 實體尺寸，橫式最多 28 天、直式最多 14 天。
 * 此檔由 app-config.js 動態載入；避免列印預覽因內容撐高而失去 A4 比例。
 */
(function installSchedulePrintLayoutV2() {
  if (typeof document === "undefined") return;

  const STYLE_ID = "schedulePrintLayoutV2Styles";
  const PREVIEW_ID = "schedulePrintPreview";
  let observer = null;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .schedule-print-page[data-orientation="portrait"]{width:210mm!important;height:297mm!important;min-height:0!important;max-height:297mm!important}
      .schedule-print-page[data-orientation="landscape"]{width:297mm!important;height:210mm!important;min-height:0!important;max-height:210mm!important}
      @media print{
        body.schedule-printing .schedule-print-page[data-orientation="portrait"]{width:210mm!important;height:297mm!important;min-height:0!important;max-height:297mm!important}
        body.schedule-printing .schedule-print-page[data-orientation="landscape"]{width:297mm!important;height:210mm!important;min-height:0!important;max-height:210mm!important}
      }
    `;
    document.head.appendChild(style);
  }

  function getDateCells(table) {
    return Array.from(table?.querySelectorAll("thead th") || []).slice(2);
  }

  function mergePair(firstPage, secondPage) {
    const firstTable = firstPage?.querySelector(".schedule-print-table");
    const secondTable = secondPage?.querySelector(".schedule-print-table");
    if (!firstTable || !secondTable) return false;
    const firstDates = getDateCells(firstTable);
    const secondDates = getDateCells(secondTable);
    if (firstDates.length !== 14 || secondDates.length > 14) return false;

    const firstRows = Array.from(firstTable.querySelectorAll("tbody tr"));
    const secondRows = Array.from(secondTable.querySelectorAll("tbody tr"));
    if (firstRows.length !== secondRows.length) return false;

    const firstColgroup = firstTable.querySelector("colgroup");
    const secondCols = Array.from(secondTable.querySelectorAll("colgroup col")).slice(2);
    secondCols.forEach(() => firstColgroup?.appendChild(document.createElement("col")));

    const firstHeadRow = firstTable.querySelector("thead tr");
    secondDates.forEach((cell) => firstHeadRow?.appendChild(cell.cloneNode(true)));

    for (let i = 0; i < firstRows.length; i += 1) {
      const secondCells = Array.from(secondRows[i].children).slice(secondRows[i].children.length - secondDates.length);
      secondCells.forEach((cell) => firstRows[i].appendChild(cell.cloneNode(true)));
    }

    const firstMeta = firstPage.querySelector(".schedule-print-page-header p");
    const secondMeta = secondPage.querySelector(".schedule-print-page-header p");
    if (firstMeta && secondMeta) {
      const firstStart = firstMeta.textContent.split("～")[0]?.trim() || "";
      const secondRange = secondMeta.textContent.split("　")[0] || "";
      const secondEnd = secondRange.split("～")[1]?.trim() || "";
      if (firstStart && secondEnd) firstMeta.dataset.printRange = `${firstStart} ～ ${secondEnd}`;
    }
    return true;
  }

  function normalizePageNumbers(pages) {
    const total = pages.length;
    pages.forEach((page, index) => {
      const meta = page.querySelector(".schedule-print-page-header p");
      if (!meta) return;
      const currentRange = meta.dataset.printRange || meta.textContent.split("　")[0] || "";
      meta.textContent = `${currentRange}　${index + 1}/${total}`;
    });
  }

  function mergeLandscapeDatePages(root) {
    const pages = Array.from(root.querySelectorAll('.schedule-print-page[data-orientation="landscape"]'));
    if (pages.length < 2) return;

    for (let i = 0; i < pages.length - 1;) {
      const first = pages[i];
      const second = pages[i + 1];
      const firstTitle = first.querySelector(".schedule-print-page-header h2")?.textContent || "";
      const secondTitle = second.querySelector(".schedule-print-page-header h2")?.textContent || "";
      const firstRowNames = Array.from(first.querySelectorAll("tbody .person-col")).map((cell) => cell.textContent.trim()).join("|");
      const secondRowNames = Array.from(second.querySelectorAll("tbody .person-col")).map((cell) => cell.textContent.trim()).join("|");
      if (firstTitle === secondTitle && firstRowNames === secondRowNames && mergePair(first, second)) {
        second.remove();
        pages.splice(i + 1, 1);
      } else {
        i += 1;
      }
    }
    normalizePageNumbers(pages.filter((page) => page.isConnected));
  }

  function apply(root) {
    ensureStyles();
    mergeLandscapeDatePages(root);
    const toolbar = root.querySelector(".schedule-print-preview-toolbar>div:last-child");
    if (toolbar && !toolbar.querySelector("[data-print-paper-size]")) {
      const label = document.createElement("span");
      label.dataset.printPaperSize = "true";
      label.textContent = "A4";
      label.style.fontWeight = "800";
      toolbar.prepend(label);
    }
  }

  function watchPreview() {
    const root = document.getElementById(PREVIEW_ID);
    if (!root) return;
    apply(root);
    observer?.disconnect();
    observer = new MutationObserver(() => {
      observer.disconnect();
      apply(root);
      observer.observe(root, { childList: true, subtree: true });
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  ensureStyles();
  const bodyObserver = new MutationObserver(() => watchPreview());
  bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  watchPreview();
})();
