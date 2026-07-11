from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD_NAME = "規格書.txt"
NEW_NAME = "規格書.md"
OLD_PATH = ROOT / OLD_NAME
NEW_PATH = ROOT / NEW_NAME

if not OLD_PATH.exists():
    raise SystemExit(f"找不到 {OLD_NAME}")
if NEW_PATH.exists():
    raise SystemExit(f"{NEW_NAME} 已存在，停止避免覆寫")

# 保留原始內容與編碼，只變更副檔名。
OLD_PATH.rename(NEW_PATH)

skip_dirs = {".git", "node_modules"}
updated = []

for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    if any(part in skip_dirs for part in path.parts):
        continue
    if path == NEW_PATH:
        continue
    try:
        data = path.read_bytes()
        text = data.decode("utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    if OLD_NAME not in text:
        continue
    path.write_text(text.replace(OLD_NAME, NEW_NAME), encoding="utf-8")
    updated.append(path.relative_to(ROOT).as_posix())

remaining = []
for path in ROOT.rglob("*"):
    if not path.is_file() or any(part in skip_dirs for part in path.parts):
        continue
    try:
        if OLD_NAME in path.read_bytes().decode("utf-8"):
            remaining.append(path.relative_to(ROOT).as_posix())
    except (UnicodeDecodeError, OSError):
        pass

if remaining:
    raise SystemExit("仍有舊檔名引用：" + ", ".join(remaining))

print(f"已將 {OLD_NAME} 改名為 {NEW_NAME}")
print("已更新引用：")
for item in updated:
    print(f"- {item}")

# 此檔只用於觸發一次性改名流程，完成後由工作流程刪除。
