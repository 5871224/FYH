from pathlib import Path

path = Path('規格書.txt')
text = path.read_text(encoding='utf-8-sig')
old = '''└─ 第六章　介面樣式統一規格  
   ├─ 6.1 章節目的與適用範圍  
   ├─ 6.2 CSS 檔案分工與載入順序  
   ├─ 6.3 共用設計變數  
   ├─ 6.4 表單控制項  
   ├─ 6.5 按鈕與操作元件  
   ├─ 6.6 表格  
   ├─ 6.7 頁籤、卡片、區塊與彈出視窗  
   ├─ 6.8 響應式與無障礙規格  
   ├─ 6.9 開發與命名規則  
   ├─ 6.10 特殊元件與例外  
   └─ 6.11 驗收標準'''
new = '''└─ 第六章　介面樣式統一規格  
   ├─ 6.1 適用範圍  
   ├─ 6.2 CSS 架構與載入順序  
   ├─ 6.3 共用尺寸與間距  
   ├─ 6.4 配色與狀態  
   ├─ 6.5 表單控制項  
   ├─ 6.6 按鈕與頁籤  
   ├─ 6.7 表格  
   ├─ 6.8 卡片、區塊與彈出視窗  
   ├─ 6.9 手機版頁面配置  
   ├─ 6.10 無障礙與實作規則  
   └─ 6.11 驗收標準'''
if old not in text:
    raise SystemExit('Expected old chapter 6 tree not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8-sig')
Path('scripts/one-shot-update-pages-spec.py').unlink()
