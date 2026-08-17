const fs = require('node:fs');

const actionsPath = 'src/renderer/renderer-records-actions.js';
let source = fs.readFileSync(actionsPath, 'utf8');

source = source.replace(
  '<table class="attendance-review-print-table">',
  '<table class="records-table attendance-review-table attendance-review-print-table">'
);

const clockStart = source.indexOf('function renderAttendanceReviewPrintClock(row) {');
const tableStart = source.indexOf('function renderAttendanceReviewPrintTable', clockStart);
if (clockStart < 0 || tableStart < 0) throw new Error('找不到列印打卡時間 renderer');
const clockRenderer = `function renderAttendanceReviewPrintClock(row) {
  const clockIn = row.clock_in_at ? formatClockTime(row.clock_in_at) : "-";
  const clockOut = row.clock_out_at ? formatClockTime(row.clock_out_at) : "-";
  const inLocation = attendanceReviewPrintLocation(row.clock_in_location);
  const outLocation = attendanceReviewPrintLocation(row.clock_out_location);
  return \`<div class="attendance-review-print-clock">
    <div class="attendance-punch-line"><span>上班 \${escapeHtml(clockIn)}</span>\${inLocation ? \`<small>\${escapeHtml(inLocation)}</small>\` : ""}</div>
    <div class="attendance-punch-line"><span>下班 \${escapeHtml(clockOut)}</span>\${outLocation ? \`<small>\${escapeHtml(outLocation)}</small>\` : ""}</div>
  </div>\`;
}

`;
source = source.slice(0, clockStart) + clockRenderer + source.slice(tableStart);

const oldStatus = '<td><div class="attendance-review-print-cell attendance-review-print-center">${row.reviewed ? "已審" : "未審"}</div></td>';
const newStatus = '<td class="attendance-review-status-col">${renderReviewStatus(row.reviewed)}</td>';
if (!source.includes(oldStatus)) throw new Error('找不到列印狀態欄');
source = source.replace(oldStatus, newStatus);

const marker = '    /* 列印版沿用簽到審核頁的表格、色彩與狀態視覺，只壓縮尺寸以維持每頁 40 筆。 */';
if (!source.includes(marker)) {
  const needle = '    @media(max-width:760px){.attendance-review-print-toolbar{align-items:flex-start;flex-direction:column}';
  if (!source.includes(needle)) throw new Error('找不到列印 CSS 插入點');
  const override = `    /* 列印版沿用簽到審核頁的表格、色彩與狀態視覺，只壓縮尺寸以維持每頁 40 筆。 */
    .attendance-review-print-page{background:var(--panel);color:var(--text);font-family:"Microsoft JhengHei UI","PingFang TC",sans-serif}
    .attendance-review-print-table{width:100%;min-width:0!important;border-collapse:collapse;table-layout:fixed;color:var(--text);font-size:8px;line-height:1.08;background:transparent}
    .attendance-review-print-table th,.attendance-review-print-table td{height:4.7mm;max-height:4.7mm;padding:.15mm .55mm;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);text-align:center;vertical-align:middle;font-size:8px}
    .attendance-review-print-table th{height:6mm;max-height:6mm;color:var(--muted);font-weight:800;background:rgba(248,243,231,.72);white-space:nowrap}
    .attendance-review-print-table .attendance-review-print-cell{max-height:4.05mm;line-height:1.08}
    .attendance-review-print-table .attendance-review-print-cell small{color:var(--muted);font-size:6.5px}
    .attendance-review-print-table .attendance-review-print-clock{display:flex;flex-direction:column;justify-content:center;gap:0;max-height:4.15mm;overflow:hidden;line-height:1.02}
    .attendance-review-print-table .attendance-punch-line{display:flex;align-items:center;justify-content:center;gap:1mm;min-width:0;white-space:nowrap;font-size:7px;line-height:1.02}
    .attendance-review-print-table .attendance-punch-line small{display:block;max-width:23mm;overflow:hidden;color:var(--muted);font-size:6px;line-height:1.02;text-overflow:ellipsis;white-space:nowrap}
    .attendance-review-print-table .attendance-review-status{min-width:10mm;padding:.15mm 1mm;border-radius:999px;font-size:6.5px;line-height:1.15;font-weight:700}
    .attendance-review-print-table .attendance-review-status.is-unreviewed{background:#fff4d6;color:#8a5a00;border:1px solid #efc66a}
    .attendance-review-print-table .attendance-review-status.is-reviewed{background:#e8f7ef;color:#176b45;border:1px solid #8bc9aa}
    .attendance-review-print-table .attendance-review-status-col{text-align:center}
`;
  source = source.replace(needle, override + needle);
}

fs.writeFileSync(actionsPath, source, 'utf8');

const specPath = '規格書.md';
let spec = fs.readFileSync(specPath, 'utf8');
const oldRule = '每頁重複表頭，每個完整列印頁固定 40 筆，最後一頁依剩餘筆數顯示。';
const newRule = '每頁重複表頭，每個完整列印頁固定 40 筆，最後一頁依剩餘筆數顯示；版面應盡量沿用簽到審核頁的表格比例、文字對齊、班表圖示、表格線條與審核狀態樣式，只為滿足每頁至少 40 筆而縮小列高、間距與字級。';
if (!spec.includes(oldRule)) throw new Error('找不到規格書列印規則');
spec = spec.replace(oldRule, newRule);
fs.writeFileSync(specPath, spec, 'utf8');

const testPath = 'tests/attendance-review-print.test.js';
let test = fs.readFileSync(testPath, 'utf8');
const testAnchor = '  assert.match(actions, /@page\\{size:A4 landscape;margin:0\\}/);\n';
const testExtra = [
  '  assert.match(actions, /records-table attendance-review-table attendance-review-print-table/);',
  '  assert.match(actions, /renderReviewStatus\\(row\\.reviewed\\)/);',
  '  assert.match(actions, /列印版沿用簽到審核頁的表格、色彩與狀態視覺/);',
  '  assert.match(actions, /border-bottom:1px solid var\\(--line\\)/);',
  ''
].join('\n');
if (!test.includes('records-table attendance-review-table attendance-review-print-table')) {
  if (!test.includes(testAnchor)) throw new Error('找不到列印測試插入點');
  test = test.replace(testAnchor, testAnchor + testExtra);
  fs.writeFileSync(testPath, test, 'utf8');
}
