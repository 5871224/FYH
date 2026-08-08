from pathlib import Path
p = Path('src/renderer/renderer-schedule-selection-actions.js')
t = p.read_text(encoding='utf-8')
old = '''async function applySelectionToCell(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  if (isArchivedDate(dateString) || isDeletedScheduleMember(memberId)) return;

  const dateString = normalizeScheduleDateInput(day);
  if (!canEditSchedule()) {
'''
new = '''async function applySelectionToCell(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  if (isArchivedDate(dateString) || isDeletedScheduleMember(memberId)) return;
  if (!canEditSchedule()) {
'''
if old not in t:
    raise RuntimeError('applySelectionToCell duplicate date declaration not found')
p.write_text(t.replace(old, new, 1), encoding='utf-8')
print('duplicate schedule date declaration removed')
