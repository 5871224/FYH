from pathlib import Path

root = Path('.')
report = Path('supabase/_cleanup_references.txt')
needles = [
    'V2_DEPLOY.md',
    'V2_SQL_ORDER.md',
    'V2_SQL_ORDER_FINAL.md',
    '024_schedule_entries_rpc.sql',
    '026_meal_admin_settings_rpc.sql',
    '027_v2_security.sql',
    '028_v2_attendance_clock.sql',
    '029_v2_attendance_admin.sql',
    '030_v2_meal_snapshot.sql',
    '031_v2_role_department_protection.sql',
    '032_v2_overtime_batch.sql',
    '033_v2_employee_visibility.sql',
    '034_v2_overtime_reapply.sql',
    '035_v2_last_admin.sql',
    '036_v2_synchronized_member_delete.sql',
    '037_v2_department_attendance_fields.sql',
    '037_v2_meal_subsidy_and_product_delete.sql',
    '038_v2_employee_sort_order.sql',
    '039_remove_legacy_attendance_tables.sql',
    '040_enforce_employee_code_uniqueness.sql',
    '041_transactional_member_account_delete.sql',
    '042_fix_transactional_member_account_delete_order.sql',
    '043_harden_private_data_access.sql',
]

skip_dirs = {'.git', 'node_modules'}
skip_files = {
    'supabase/_cleanup_inventory.txt',
    'supabase/_cleanup_summary.txt',
    'supabase/_cleanup_references.txt',
    'scripts/find_supabase_refs_once.py',
}

out = ['# References to Supabase SQL / MD files', '']
count = 0
for path in sorted(p for p in root.rglob('*') if p.is_file()):
    rel = path.as_posix()
    if rel in skip_files or any(part in skip_dirs for part in path.parts):
        continue
    try:
        text = path.read_text(encoding='utf-8-sig')
    except (UnicodeDecodeError, OSError):
        continue
    for lineno, line in enumerate(text.splitlines(), 1):
        hits = [needle for needle in needles if needle in line]
        if hits:
            out.append(f'{rel}:{lineno}: {line}')
            count += 1

out.insert(2, f'Total references: {count}')
report.write_text('\n'.join(out).rstrip() + '\n', encoding='utf-8')
