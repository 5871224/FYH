from pathlib import Path

spec_path = Path("規格書.txt")
workflow_path = Path(".github/workflows/finalize-spec-once.yml")
script_path = Path("scripts/finalize_spec_once.py")

spec = spec_path.read_text(encoding="utf-8-sig")

spec = spec.replace(
    "### 自動補班預覽\n",
    "### 3.3.10 自動補班預覽\n",
    1,
)

old_card_block = """1. 電腦與平板版的首頁、打卡、訂餐、紀錄、班表與登入主卡片使用 24px 圓角；寬度不超過 640px 的五個主要頁面依 6.9 移除最外層卡片樣式。
2. 次級內容區塊使用 18px 圓角。
3. 訂餐與紀錄頁的分頁內容標題電腦版為 18px、手機版為 17px，行高 1.3。
4. 手機版主卡片內距為 10px；次級區塊內距為 9px。
4. 一般彈窗使用 24px 圓角，標題、內容與底部操作區使用一致分隔線及間距。
5. 手機版彈窗外距為 4px，最大高度為 `100dvh - 8px`。
6. 內容過高時由彈窗內容區捲動。
7. 編輯打卡視窗電腦版最大寬度約 560px，時間與單位欄位使用兩欄；手機版使用單欄。
8. 彈窗底部取消按鈕位於主要按鈕之前。"""

new_card_block = """1. 電腦與平板版的首頁、打卡、訂餐、紀錄、班表與登入主卡片使用 24px 圓角；寬度不超過 640px 的五個主要頁面依 6.9 移除最外層卡片樣式。
2. 次級內容區塊使用 18px 圓角。
3. 訂餐與紀錄頁的分頁內容標題電腦版為 18px、手機版為 17px，行高 1.3。
4. 除五個主要頁面的手機版最外層卡片外，手機版主卡片內距為 10px；次級區塊內距為 9px。
5. 一般彈窗使用 24px 圓角，標題、內容與底部操作區使用一致分隔線及間距。
6. 手機版彈窗外距為 4px，最大高度為 `100dvh - 8px`。
7. 內容過高時由彈窗內容區捲動。
8. 編輯打卡視窗電腦版最大寬度約 560px，時間與單位欄位使用兩欄；手機版使用單欄。
9. 彈窗底部取消按鈕位於主要按鈕之前。"""

assert old_card_block in spec
spec = spec.replace(old_card_block, new_card_block, 1)

spec = spec.replace(
    "2. 手機版頁面外距為 4px，主卡片內距為 10px，次級區塊內距為 9px。",
    "2. 手機版五個主要頁面的上方與左右安全間距為 8px，內容由上方開始排列，最外層卡片不使用額外內距；其他主卡片內距為 10px，次級區塊內距為 9px。",
    1,
)

assert "### 3.3.10 自動補班預覽" in spec
assert "手機版頁面外距為 4px" not in spec
assert "手機版五個主要頁面的上方與左右安全間距為 8px" in spec

spec_path.write_text(spec.rstrip() + "\n", encoding="utf-8-sig")
workflow_path.unlink()
script_path.unlink()
