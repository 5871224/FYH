from pathlib import Path

path = Path("src/renderer/renderer-records-actions.js")
text = path.read_text(encoding="utf-8")
old = 'body: `<div class="form-row"><label>常用備註</label><textarea id="attendanceCommonNotesInput" rows="10" placeholder="每行一個常用備註">${escapeHtml(notes.join("\\n"))}</textarea></div>`,'
new = 'body: `<div class="form-row"><label>每個備註請用換行分隔</label><textarea id="attendanceCommonNotesInput" rows="10" placeholder="每行一個常用備註">${escapeHtml(notes.join("\\n"))}</textarea></div>`,'
count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one match, got {count}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
