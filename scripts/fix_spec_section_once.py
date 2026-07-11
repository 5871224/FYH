from pathlib import Path

spec_path = Path("規格書.txt")
workflow_path = Path(".github/workflows/fix-spec-section-once.yml")
script_path = Path("scripts/fix_spec_section_once.py")

spec = spec_path.read_text(encoding="utf-8-sig")

block_start = spec.index("\n### 自動補班預覽\n")
block_end = spec.index("\n## 4.1 頁面目的", block_start)
auto_fill_block = spec[block_start:block_end].strip()
spec = spec[:block_start].rstrip() + "\n\n" + spec[block_end:].lstrip("\n")

chapter_four_marker = "\n---\n\n# 第四章　紀錄頁"
insert_at = spec.index(chapter_four_marker)
spec = (
    spec[:insert_at].rstrip()
    + "\n\n"
    + auto_fill_block
    + "\n\n"
    + spec[insert_at:].lstrip("\n")
)

assert spec.index("### 自動補班預覽") < spec.index("# 第四章　紀錄頁")
assert spec.index("### 自動補班預覽") > spec.index("## 3.3 設定、工具與其他規則")
assert spec.index("## 4.1 頁面目的") > spec.index("# 第四章　紀錄頁")

spec_path.write_text(spec.rstrip() + "\n", encoding="utf-8-sig")
workflow_path.unlink()
script_path.unlink()
