const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/renderer/renderer-i18n.js"), "utf8");
const attachments = fs.readFileSync(path.join(root, "src/renderer/renderer-attachments.js"), "utf8");

function translator(language) {
  const context = {
    window: {},
    localStorage: { getItem: () => language },
    console
  };
  vm.runInNewContext(source, context, { timeout: 2000 });
  return context.window.fyhI18n.translate;
}

test("附件三個入口及彈窗文字完整使用越文詞庫", () => {
  const translate = translator("vi-VN");
  const labels = [
    "附檔", "附檔管理", "上傳附件", "上傳檔案", "查看附件", "查看／下載",
    "附件儲存用量", "剩餘", "開始日期", "結束日期", "整批刪除", "全選本頁",
    "日期", "員工", "檔案", "說明", "大小", "操作", "沒有檔案",
    "上一頁", "下一頁", "載入中...", "說明（選填）", "存檔", "拍照",
    "選擇檔案（可多選）", "也可以將檔案拖曳至此", "尚未選擇檔案",
    "移除", "沒有附件", "返回附檔", "關閉", "提示", "確認"
  ];
  labels.forEach((label) => {
    assert.notEqual(translate(label), label, "missing Vietnamese label: " + label);
    assert.doesNotMatch(translate(label), /[\u3400-\u9fff]/, label);
  });
  const dynamic = [
    "上傳附件｜2026-10-14", "附檔｜2026-10-14",
    "photo.jpg的說明", "正在上傳 1 / 2：photo.jpg",
    "已成功上傳 2 個附件",
    "已成功 1 個，上傳中斷：Lỗi không xác định",
    "已儲存 1 個附件說明；以下 2 個失敗，請重試：a.jpg、b.jpg",
    "確定要刪除 2 個檔案（1.0 MB）嗎？此操作無法復原。",
    "有 1 個刪除失敗：Không có quyền xóa",
    "共 21 筆，第 2 / 3 頁"
  ];
  dynamic.forEach((value) => {
    assert.notEqual(translate(value), value, "missing Vietnamese dynamic translation: " + value);
    assert.doesNotMatch(translate(value), /[\u3400-\u9fff]/, value);
  });
});

test("附件權限、格式、刪除等伺服器錯誤可顯示越文", () => {
  const translate = translator("vi-VN");
  [
    "此帳號目前無法使用附件功能", "沒有該群組的附件權限",
    "該日期已審核，不能修改附件", "附件不存在或已刪除",
    "不支援此檔案類型或檔案超過 10 MB", "上傳日期無效",
    "只能編輯自己的附件", "沒有刪除權限", "附件操作失敗",
    "格式不支援", "每次最多五個檔案", "請先選擇檔案"
  ].forEach((value) => {
    assert.notEqual(translate(value), value, "missing Vietnamese error: " + value);
  });
});

test("中文模式保持原來文字，附件動態訊息使用共用翻譯函式", () => {
  const translate = translator("zh-TW");
  for (const value of ["附檔管理", "說明（選填）", "上傳附件｜2026-10-14"]) {
    assert.equal(translate(value), value);
  }
  assert.match(attachments, /window\.fyhI18n\?\.translate\?\.\(text\)/);
  assert.match(attachments, /window\.fyhI18n\?\.refresh\?\.\(list\)/);
  assert.match(attachments, /attachmentTranslate\("正在上傳 "/);
  assert.match(attachments, /attachmentTranslate\("確定要刪除 "/);
});
