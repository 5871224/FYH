from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "scripts" / "check-v2-final.js"

old = '''const readme = read("README.md");
assert(readme.includes("查看完整班表"), "規格書未明確標示員工可查看完整班表");
assert(readme.includes("警告併入備註欄"), "規格書未明確標示訂餐統計警告併入備註欄");
assert(readme.includes("本次異動原因為選填"), "規格書未明確標示打卡異動原因為選填");
assert(readme.includes("不顯示員工工號、首次下訂時間及最後修改時間"), "規格書未明確標示訂餐報表隱藏欄位");
assert(readme.includes("主管可刪除員工或主管帳號"), "規格書未明確標示主管刪除權限");
'''

new = '''assert(authoritativeSpec.includes("可查看所有人員完整班表") || authoritativeSpec.includes("可查看完整班表與統計欄"), "正式規格書未明確標示員工可查看完整班表");
assert(authoritativeSpec.includes("警告併入備註"), "正式規格書未明確標示訂餐統計警告併入備註欄");
assert(authoritativeSpec.includes("本次異動原因；此欄選填"), "正式規格書未明確標示打卡異動原因為選填");
assert(authoritativeSpec.includes("不顯示員工工號、第一次下訂時間與最後修改時間"), "正式規格書未明確標示訂餐報表隱藏欄位");
assert(authoritativeSpec.includes("刪除符合條件的員工或主管帳號"), "正式規格書未明確標示主管刪除權限");
'''

text = CHECK.read_text(encoding="utf-8")
if old not in text:
    raise RuntimeError("找不到舊 README 規格驗證區塊")
CHECK.write_text(text.replace(old, new, 1), encoding="utf-8")

for relative in [
    "readme_merge_check.txt",
    "scripts/fix_spec_validation_once.py",
    ".github/workflows/fix-spec-validation-once.yml",
]:
    path = ROOT / relative
    if path.exists():
        path.unlink()
