from pathlib import Path

root = Path(__file__).resolve().parents[1]
script_path = root / "scripts" / "remove-employee-is-active-once.py"
text = script_path.read_text(encoding="utf-8")
old = 'meal_order = extract_last_function(updates, "save_meal_order")'
new = 'meal_order = extract_last_function(schema, "save_meal_order")'
if old not in text:
    raise RuntimeError("找不到訂餐函式來源設定")
script_path.write_text(text.replace(old, new, 1), encoding="utf-8")
error_path = root / "remove-employee-is-active-error.txt"
if error_path.exists():
    error_path.unlink()
print("remove script patched")
