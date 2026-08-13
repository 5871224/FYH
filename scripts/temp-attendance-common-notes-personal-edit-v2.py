from pathlib import Path

updater = Path("scripts/temp-attendance-common-notes-personal-edit.py")
text = updater.read_text(encoding="utf-8")
old = '''replace_once(
    "src/renderer/renderer-records-page.js",
    ''' + "'''" + '''    recordsState = {\\n      ...recordsState,\\n      attendanceReview: {\\n        ...recordsState.attendanceReview,\\n        loading: false,\\n''' + "'''" + ''',
    ''' + "'''" + '''    recordsState = {\\n      ...recordsState,\\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\\n      attendanceReview: {\\n        ...recordsState.attendanceReview,\\n        loading: false,\\n''' + "'''" + ''',
)
'''
new = '''replace_once(
    "src/renderer/renderer-records-page.js",
    ''' + "'''" + '''    recordsState = {\\n      ...recordsState,\\n      attendanceReview: {\\n        ...recordsState.attendanceReview,\\n        loading: false,\\n        loaded: true,\\n''' + "'''" + ''',
    ''' + "'''" + '''    recordsState = {\\n      ...recordsState,\\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\\n      attendanceReview: {\\n        ...recordsState.attendanceReview,\\n        loading: false,\\n        loaded: true,\\n''' + "'''" + ''',
)
'''
if text.count(old) != 1:
    raise SystemExit(f"expected one updater block, got {text.count(old)}")
updater.write_text(text.replace(old, new, 1), encoding="utf-8")
exec(compile(updater.read_text(encoding="utf-8"), str(updater), "exec"))
