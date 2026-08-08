from pathlib import Path
p = Path('src/renderer/renderer-groups-permissions-archive.js')
t = p.read_text(encoding='utf-8')
t = t.replace('sortOrder: existing?.sortOrder ?? getAllGroups().length);', 'sortOrder: existing?.sortOrder ?? getAllGroups().length });')
t = t.replace('sortOrder: group.sortOrder);', 'sortOrder: group.sortOrder });')
p.write_text(t, encoding='utf-8')
print('group API call syntax cleaned')
