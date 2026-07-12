const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const specPath = path.join(root, "規格書.md");
let spec = fs.readFileSync(specPath, "utf8");

const heading = "## 單位與人員設定拖曳穩定性";
const section = `

${heading}

- 電腦版單位設定表格固定為七欄：拖曳、單位、所屬人員、開始／結束日期、不顯示、可否打卡、操作；欄位必須配合彈窗可用寬度分配，不得用固定最小寬度造成水平捲軸。
- 手機版因七欄無法合理壓縮，可保留表格內部水平捲動，但不得使整個頁面產生水平捲軸。
- 人員設定列表第一欄固定為拖曳把手；只有把手可以啟動排序，避免點擊列內其他欄位時誤拖曳。
- 人員排序類型固定操作 \`state.members\`，完成後必須回到人員設定頁；不得落入班別、假別或加班目錄。
- 共用設定排序只接受 \`department\`、\`member\`、\`shift\`、\`leave\`、\`overtime\`，未知類型必須停止，不得使用其他目錄作為預設值。
`;

if (!spec.includes(heading)) {
  spec = spec.trimEnd() + section + "\n";
  fs.writeFileSync(specPath, spec, "utf8");
}

console.log("設定頁欄寬與拖曳規格已更新");
