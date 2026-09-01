const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content, "utf8");
}

function replaceOnce(relative, before, after, label) {
  let source = read(relative);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${relative}: missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${relative}: duplicate ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
  write(relative, source);
}

replaceOnce(
  "src/renderer/app-config.js",
  '    "匯出": "Xuất dữ liệu",\n',
  '    "匯出": "Xuất dữ liệu",\n    "匯入": "Nhập dữ liệu",\n    "功能": "Chức năng",\n',
  "fixed Vietnamese import/function labels"
);

replaceOnce(
  "tests/vietnamese-localization.test.js",
  '    \'"批次審核": "Duyệt hàng loạt"\'\n',
  '    \'"批次審核": "Duyệt hàng loạt"\',\n    \'"匯入": "Nhập dữ liệu"\',\n    \'"功能": "Chức năng"\'\n',
  "Vietnamese fixed label assertions"
);

console.log("Vietnamese import/function labels added");
