from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text.replace('\r\n','\n').rstrip()+'\n', encoding='utf-8')

for path in [
    'tests/home-meal-availability.test.js',
    'tests/lazy-page-data-loading.test.js',
    'tests/login-fast-home.test.js',
]:
    text = read(path).replace('20260807-page-lazy-data', '20260807-schedule-first-load')
    write(path, text)

path = 'tests/renderer-department-settings.test.js'
text = read(path)
text = text.replace('// 固定補丁整併前使用者實際看到的六欄單位設定畫面。', '// 驗證正式七欄單位設定畫面與管理資料延後載入。')
needle = '    ensureManagerDirectoryLoaded: async () => {},\n    showInfoMessage: () => {},'
replacement = '    ensureManagerDirectoryLoaded: async () => {},\n    isAdmin: () => false,\n    showInfoMessage: () => {},'
if text.count(needle) != 1:
    raise RuntimeError('找不到單位設定測試 context 插入點')
text = text.replace(needle, replacement, 1)
write(path, text)
