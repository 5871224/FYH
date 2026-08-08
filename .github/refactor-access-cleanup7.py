from pathlib import Path
import shutil


def remove_function(text, name):
    markers = [f'async function {name}(', f'function {name}(']
    start = next((text.find(marker) for marker in markers if text.find(marker) >= 0), -1)
    if start < 0:
        return text
    brace = text.find('{', start)
    depth = 0
    quote = None
    escape = False
    i = brace
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                while end < len(text) and text[end] in ' \t':
                    end += 1
                if end < len(text) and text[end] == ';': end += 1
                while end < len(text) and text[end] == '\n': end += 1
                return text[:start] + text[end:]
        i += 1
    raise RuntimeError(f'unclosed function: {name}')

r = Path('src/renderer')

# Browser transport has no role-based authorization. It only requires a signed-in session;
# every privileged domain API validates permission + group scope server-side.
p = r / 'web-api.js'
t = p.read_text(encoding='utf-8')
for name in ['hasManagerAccess', 'hasAdminAccess', 'getScheduleDirectoryRows', 'ensureManager', 'getMemberOrder', 'saveMemberOrder']:
    t = remove_function(t, name)
t = t.replace('ensureManager();', 'ensureSignedIn();')
t = t.replace('publicIp: hasAdminAccess(currentProfile?.role) ? row.public_ip || "" : "",', 'publicIp: row.public_ip || "",')
if t.count('mapDepartmentWriteRow(') == 1:
    t = remove_function(t, 'mapDepartmentWriteRow')
old = '''  async function getDepartmentAttendanceSettings() {
    ensureSignedIn();
    const result = await requestFunction("department-attendance-v2", {});
    return Array.isArray(result?.settings) ? result.settings : [];
  }'''
new = '''  async function getDepartmentAttendanceSettings() {
    ensureSignedIn();
    const rows = await callRpc("get_department_attendance_settings_v3", {}) || [];
    return rows.map((row) => ({
      departmentId: row.department_id,
      address: row.address || "",
      latitude: row.latitude,
      longitude: row.longitude,
      attendanceEnabled: Boolean(row.attendance_enabled),
      publicIp: row.public_ip || ""
    }));
  }'''
if old not in t:
    raise RuntimeError('department attendance browser function not found')
t = t.replace(old, new, 1)
t = t.replace('    getMemberOrder,\n', '').replace('    saveMemberOrder,\n', '')
for forbidden in ['get_schedule_directory_v2', 'member-order-v2', 'department-attendance-v2', 'ensureManager', 'hasManagerAccess', 'hasAdminAccess']:
    if forbidden in t:
        raise RuntimeError(f'legacy browser authorization remains: {forbidden}')
p.write_text(t, encoding='utf-8')

# Member ordering is already the explicit reorder_settings_v3("member") operation.
# Department attendance settings are now a permission-aware named RPC.
for dirname in ['supabase/functions/member-order-v2', 'supabase/functions/department-attendance-v2']:
    path = Path(dirname)
    if path.exists(): shutil.rmtree(path)

p = Path('scripts/deploy-edge-functions.ps1')
t = p.read_text(encoding='utf-8')
for name in ['member-order-v2', 'department-attendance-v2']:
    t = t.replace(f'  "{name}",\n', '')
p.write_text(t, encoding='utf-8')

# Self-service clock/order profiles do not carry legacy role data they never use.
for filename, old, new in [
    ('supabase/functions/attendance-clock/index.ts', '.select("id, employee_code, full_name, role, hire_date, leave_date")', '.select("id, employee_code, full_name, hire_date, leave_date")'),
    ('supabase/functions/meal-order/index.ts', '.select("id,employee_code,full_name,role,group_id,access_role_id,home_department_id,hire_date,leave_date,deleted_at")', '.select("id,employee_code,full_name,group_id,access_role_id,home_department_id,hire_date,leave_date,deleted_at")')
]:
    p = Path(filename)
    t = p.read_text(encoding='utf-8')
    if old not in t: raise RuntimeError(f'profile select not found: {filename}')
    p.write_text(t.replace(old, new, 1), encoding='utf-8')

# attendance-ledger is the personal ledger only. Review/edit/history live exclusively in attendance-review-groups.
p = Path('supabase/functions/attendance-ledger/index.ts')
t = p.read_text(encoding='utf-8')
t = t.replace('.select("id,employee_code,full_name,role,hire_date,leave_date")', '.select("id,employee_code,full_name,hire_date,leave_date")', 1)
for name in ['requireAdmin', 'timeToIso', 'reviewList', 'reviewSave', 'parseReviewToken', 'reviewSet', 'history']:
    t = remove_function(t, name)
for line in [
    '      if (body?.action === "review_list") return Response.json(await reviewList(ctx, body, actor));\n',
    '      if (body?.action === "review_save") return Response.json(await reviewSave(ctx, body, actor));\n',
    '      if (body?.action === "review_set") return Response.json(await reviewSet(ctx, body, actor));\n',
    '      if (body?.action === "history") return Response.json(await history(ctx, body, actor));\n'
]:
    t = t.replace(line, '')
# Remove review-only ISSUE_TYPES constant when no longer referenced.
if t.count('ISSUE_TYPES') == 1:
    start = t.index('const ISSUE_TYPES = [')
    end = t.index('];', start) + 2
    while end < len(t) and t[end] == '\n': end += 1
    t = t[:start] + t[end:]
if 'requireAdmin(' in t or 'action === "review_' in t or 'body?.action === "history"' in t:
    raise RuntimeError('duplicate attendance review path remains in attendance-ledger')
p.write_text(t, encoding='utf-8')

print('remaining permission access paths consolidated')
