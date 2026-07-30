from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
old_css = '''.seg.regular-holiday-work-seg {
  background: #ffe58f !important;
  color: #4f3d00 !important;
  box-shadow: inset 0 0 0 1px #d8a600;
}

.shift-view-member.regular-holiday-work-member {
  background: #ffe58f;
  color: #4f3d00;
  box-shadow: inset 0 0 0 1px #d8a600;
}
'''
new_css = '''.seg.regular-holiday-work-seg {
  background: #ffe58f !important;
}

.shift-view-member.regular-holiday-work-member {
  background: #ffe58f;
}
'''
if pages.count(old_css) != 1:
    raise SystemExit("pages.css: regular holiday highlight block not found exactly once")
pages = pages.replace(old_css, new_css, 1)
write(pages_path, pages)


test_path = "tests/schedule-ui-update.test.js"
test_text = read(test_path)
old_test = '''  assert.match(css, /\\.seg\\.regular-holiday-work-seg \\{[\\s\\S]*?background: #ffe58f !important;/);
  assert.match(css, /\\.shift-view-member\\.regular-holiday-work-member \\{[\\s\\S]*?background: #ffe58f;/);'''
new_test = '''  assert.match(css, /\\.seg\\.regular-holiday-work-seg \\{\\s*background: #ffe58f !important;\\s*\\}/);
  assert.match(css, /\\.shift-view-member\\.regular-holiday-work-member \\{\\s*background: #ffe58f;\\s*\\}/);'''
if test_text.count(old_test) != 1:
    raise SystemExit("tests/schedule-ui-update.test.js: holiday color assertions not found exactly once")
test_text = test_text.replace(old_test, new_test, 1)
write(test_path, test_text)


spec_path = "規格書.md"
spec = read(spec_path)
old_spec = "24. 例假（代碼 0036）當日同時排有班別時，不顯示額外的黃色「＋」圖示。人員檢視中僅將該日期格內下方的「例假」區塊底色改為黃色，上方班別區塊及整個班表格維持原樣；班別檢視中僅將對應人員名稱的小區塊底色改為黃色，其他人員與格子狀態樣式均維持原樣。"
new_spec = "24. 例假（代碼 0036）當日同時排有班別時，不顯示額外的黃色「＋」圖示。人員檢視中僅將該日期格內下方的「例假」區塊底色改為黃色，上方班別區塊及整個班表格維持原樣；班別檢視中僅將對應人員名稱的小區塊底色改為黃色。上述黃色提示不加額外邊框，也不得覆蓋原本設定的文字顏色；其他人員與格子狀態樣式均維持原樣。"
if spec.count(old_spec) != 1:
    raise SystemExit("規格書.md: regular holiday display rule not found exactly once")
spec = spec.replace(old_spec, new_spec, 1)
write(spec_path, spec)
