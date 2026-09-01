const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "src/renderer/app-config.js");
const testPath = path.join(root, "tests/vietnamese-localization.test.js");

let config = fs.readFileSync(configPath, "utf8");

const anchor = '    "封存班表": "Lịch đã lưu trữ",\n';
if (!config.includes(anchor)) throw new Error("missing fixedVi insertion anchor");

const additions = `    "自動排班期間": "Khoảng thời gian xếp ca tự động",\n    "自動補班期間": "Khoảng thời gian bổ sung ca tự động",\n    "產生預覽": "Tạo bản xem trước",\n    "預覽列印": "Xem trước khi in",\n    "條件類型": "Loại điều kiện",\n    "限額": "Giới hạn",\n    "同班限制": "Giới hạn cùng ca",\n    "同休限制": "Giới hạn cùng nghỉ",\n    "目前未生效": "Chưa có hiệu lực",\n    "目前還沒有排班條件": "Hiện chưa có điều kiện xếp ca",\n    "請選擇人員": "Chọn nhân viên",\n    "日期範圍": "Khoảng ngày",\n    "封存時間": "Thời gian lưu trữ",\n    "封存人員": "Người lưu trữ",\n    "人員數": "Số nhân viên",\n    "資料筆數": "Số bản ghi",\n    "封存": "Lưu trữ",\n    "解除封存": "Bỏ lưu trữ",\n    "尚無封存班表": "Chưa có lịch đã lưu trữ",\n    "群組－單位": "Nhóm－Bộ phận",\n    "沒有班表資料": "Không có dữ liệu lịch làm việc",\n    "班表查看": "Xem lịch làm việc",\n    "班表管理": "Quản lý lịch làm việc",\n    "八週起算日": "Ngày bắt đầu chu kỳ 8 tuần",\n    "每週起算日": "Ngày bắt đầu tuần",\n    "每月起算日": "Ngày bắt đầu tháng",\n    "說明": "Giải thích",\n    "星期日": "Chủ nhật",\n    "星期一": "Thứ hai",\n    "星期二": "Thứ ba",\n    "星期三": "Thứ tư",\n    "星期四": "Thứ năm",\n    "星期五": "Thứ sáu",\n    "星期六": "Thứ bảy",\n    "週日": "Chủ nhật",\n    "週一": "Thứ hai",\n    "週二": "Thứ ba",\n    "週三": "Thứ tư",\n    "週四": "Thứ năm",\n    "週五": "Thứ sáu",\n    "週六": "Thứ bảy",\n    "重設密碼為 0000": "Đặt lại mật khẩu thành 0000",\n`;

for (const key of [
  '"自動排班期間"', '"條件類型"', '"日期範圍"', '"八週起算日"', '"星期一"'
]) {
  if (config.includes(`    ${key}:`)) throw new Error(`translation already exists: ${key}`);
}
config = config.replace(anchor, anchor + additions);

const dynamicAnchor = '    const month = text.match(/^(\\d{4})\\s*年\\s*(\\d{1,2})\\s*月$/);\n';
if (!config.includes(dynamicAnchor)) throw new Error("missing dynamic translation anchor");
const dayDynamic = '    const monthDay = text.match(/^(\\d{1,2})\\s*日$/);\n    if (monthDay) return `Ngày ${Number(monthDay[1])}`;\n';
if (!config.includes("const monthDay = text.match")) {
  config = config.replace(dynamicAnchor, dayDynamic + dynamicAnchor);
}
fs.writeFileSync(configPath, config, "utf8");

let tests = fs.readFileSync(testPath, "utf8");
const testTitle = 'function menu tables and action controls have Vietnamese labels';
if (!tests.includes(testTitle)) {
  tests += `\n\ntest("${testTitle}", () => {\n  const source = read("src/renderer/app-config.js");\n  const required = [\n    ["自動排班期間", "Khoảng thời gian xếp ca tự động"],\n    ["自動補班期間", "Khoảng thời gian bổ sung ca tự động"],\n    ["產生預覽", "Tạo bản xem trước"],\n    ["預覽列印", "Xem trước khi in"],\n    ["條件類型", "Loại điều kiện"],\n    ["限額", "Giới hạn"],\n    ["同班限制", "Giới hạn cùng ca"],\n    ["同休限制", "Giới hạn cùng nghỉ"],\n    ["日期範圍", "Khoảng ngày"],\n    ["封存時間", "Thời gian lưu trữ"],\n    ["封存人員", "Người lưu trữ"],\n    ["人員數", "Số nhân viên"],\n    ["資料筆數", "Số bản ghi"],\n    ["封存", "Lưu trữ"],\n    ["解除封存", "Bỏ lưu trữ"],\n    ["群組－單位", "Nhóm－Bộ phận"],\n    ["班表查看", "Xem lịch làm việc"],\n    ["班表管理", "Quản lý lịch làm việc"],\n    ["八週起算日", "Ngày bắt đầu chu kỳ 8 tuần"],\n    ["每週起算日", "Ngày bắt đầu tuần"],\n    ["每月起算日", "Ngày bắt đầu tháng"],\n    ["星期一", "Thứ hai"],\n    ["星期日", "Chủ nhật"]\n  ];\n  required.forEach(([zh, vi]) => assert.ok(source.includes(\`"\${zh}": "\${vi}"\`), \`missing function UI translation: \${zh}\`));\n  assert.ok(source.includes("const monthDay = text.match"));\n});\n`;
}
fs.writeFileSync(testPath, tests, "utf8");
console.log("function UI Vietnamese labels added");
