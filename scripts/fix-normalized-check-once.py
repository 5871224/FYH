from pathlib import Path

path = Path(__file__).resolve().parent / "check-normalized-storage.js"
text = path.read_text(encoding="utf-8")
old = 'assert(webApi.includes(\'restInsert("set_departments"\'), "saveState should write set_departments table");'
new = 'assert(webApi.includes(\'restRpc("save_departments_general_v2"\'), "saveState should write departments through the protected RPC");'
if old not in text and new not in text:
    raise RuntimeError("找不到單位寫入檢查")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
