from pathlib import Path

path = Path("src/renderer/renderer-schedule-cells.js")
text = path.read_text(encoding="utf-8")
old = '''function isRegularHolidayWorkSlot(slot) {
  return Boolean(slot?.shift && isRegularRestLeaveId(slot.leave));
}
'''
new = '''function isRegularHolidayWorkSlot(slot) {
  if (!slot?.shift || !slot.leave) {
    return false;
  }
  if (typeof isRegularRestLeaveId === "function") {
    return isRegularRestLeaveId(slot.leave);
  }
  return getItem("leave", slot.leave)?.code === "0036";
}
'''
if text.count(old) != 1:
    raise SystemExit(f"expected one holiday-work helper, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
