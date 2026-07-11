from pathlib import Path

ROOT = Path('.')
SUPABASE = ROOT / 'supabase'
UPDATES = SUPABASE / '002_current_updates.sql'
README = SUPABASE / 'README.md'

sql_sources = [
    SUPABASE / '024_schedule_entries_rpc.sql',
    SUPABASE / '026_meal_admin_settings_rpc.sql',
    SUPABASE / '027_v2_security.sql',
    SUPABASE / '028_v2_attendance_clock.sql',
    SUPABASE / '029_v2_attendance_admin.sql',
    SUPABASE / '030_v2_meal_snapshot.sql',
    SUPABASE / '031_v2_role_department_protection.sql',
    SUPABASE / '032_v2_overtime_batch.sql',
    SUPABASE / '033_v2_employee_visibility.sql',
    SUPABASE / '034_v2_overtime_reapply.sql',
    SUPABASE / '035_v2_last_admin.sql',
    SUPABASE / '036_v2_synchronized_member_delete.sql',
    SUPABASE / '037_v2_department_attendance_fields.sql',
    SUPABASE / '037_v2_meal_subsidy_and_product_delete.sql',
    SUPABASE / 'migrations/038_v2_employee_sort_order.sql',
    SUPABASE / 'migrations/039_remove_legacy_attendance_tables.sql',
    SUPABASE / 'migrations/040_enforce_employee_code_uniqueness.sql',
    SUPABASE / 'migrations/041_transactional_member_account_delete.sql',
    SUPABASE / 'migrations/042_fix_transactional_member_account_delete_order.sql',
    SUPABASE / '043_harden_private_data_access.sql',
]

missing = [path.as_posix() for path in sql_sources if not path.exists()]
if missing:
    raise SystemExit('Missing SQL source files: ' + ', '.join(missing))

parts = [
    '-- 福圓號 Supabase 現行增量更新',
    '--',
    '-- 執行順序：先執行 001_current_schema.sql，再完整執行本檔。',
    '-- 本檔依原 migration 順序整併；每個區段保留原有交易邊界。',
    '-- SQL Editor 若出現錯誤，請停止並保留完整錯誤訊息，不要跳過區段。',
    '',
]

for index, path in enumerate(sql_sources, 1):
    relative = path.relative_to(SUPABASE).as_posix()
    text = path.read_text(encoding='utf-8-sig').strip()
    parts.extend([
        '',
        '-- ' + '=' * 92,
        f'-- 區段 {index:02d}：原檔 {relative}',
        '-- ' + '=' * 92,
        '',
        text,
        '',
    ])

UPDATES.write_text('\n'.join(parts).rstrip() + '\n', encoding='utf-8')

README.write_text('''# Supabase 資料庫

本資料夾只保留目前正式需要的資料庫 SQL 與 Edge Functions。資料庫從零建立時，SQL 固定依下列順序執行：

1. `001_current_schema.sql`
2. `002_current_updates.sql`

Edge Functions 部署不會自動執行 SQL。兩份 SQL 均成功執行後，再於儲存庫根目錄執行：

```powershell
scripts/deploy-v2-final.ps1
```

SQL Editor 只要出現錯誤就應立即停止，不可跳過後續區段；請保留完整錯誤訊息再修正。

## 檔案用途

### `001_current_schema.sql`

建立系統基準結構，包含：

- 排班設定、人員、單位、班別、假別、加班與國定假日資料表。
- `schedule_entries` 正式班表資料。
- 打卡、打卡異動、加班申請與審核歷程。
- 訂餐商品、設定及訂單。
- 基礎索引、RLS、權限保護與核心 RPC。

### `002_current_updates.sql`

依原本 migration 順序整併所有基準結構後的正式更新，包含：

- 班表批次儲存 RPC。
- 訂餐設定、訂餐快照、公司補助與商品刪除保護。
- 有效任職、角色、最後管理員與敏感單位欄位保護。
- 打卡、管理員補登修改與完整稽核快照。
- 加班批次審核、刪除後重提與歷程索引。
- Auth 帳號與人員資料的交易式同步刪除。
- 人員排序、工號唯一性與舊打卡資料表移除。
- 私密資料存取強化及安全人員／單位名錄 RPC。

各區段保留原始檔名註解與原有交易邊界，方便追查歷史與錯誤位置。

## 目前資料模型

- `schedule_entries` 是班表格唯一正式來源；一格以 `member_id + work_date` 唯一識別。
- 班別、假別與班表加班共用同一列。
- 打卡加班申請與班表加班互相獨立。
- 班表批次寫入使用 `public.save_schedule_entries_bulk(entries jsonb)`。
- 打卡寫入使用 `public.save_attendance_clock(...)`，重複點擊不得覆寫第一次成功時間。
- 訂餐使用交易 RPC，保留第一次訂餐單位快照。
- 固定 IP、原始 GPS、精準度及距離不得透過一般 REST 查詢暴露。
- 人員與單位一般名錄使用安全 RPC，不直接開放私密主表欄位。

## 正式資料表

- `scheduler_settings`
- `set_departments`
- `set_employee`
- `set_shift`
- `set_leave`
- `set_overtime`
- `holidays`
- `schedule_entries`
- `attendance_records`
- `attendance_action_logs`
- `attendance_overtime_requests`
- `overtime_review_logs`
- `meal_products`
- `meal_settings`
- `meal_orders`

## 已淘汰物件

下列舊流程不得恢復：

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `public.get_public_schedule_requests()`
- `clock_locations`
- `attendance_logs`

## 維護規則

1. 不再新增零散的一次性 SQL 或 SQL 套用順序文件。
2. 新增資料庫異動時，將具備冪等性的完整區段附加至 `002_current_updates.sql`，並更新本 README。
3. 若修改基礎資料表或核心 RPC，也要同步檢查 `001_current_schema.sql` 是否需更新，確保全新環境可正常建立。
4. 涉及班表儲存時，同步檢查 `src/renderer/web-api.js` 與 `scripts/check-normalized-storage.js`。
5. 涉及前端時，執行 `npm run web:publish`，保持 `src/renderer/` 與 `docs/` 一致。
6. 部署前至少執行：

```bash
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
npm run v2:check
```
''', encoding='utf-8')

# 更新文字檔中的舊路徑。
def replace_in_file(path: str, replacements: list[tuple[str, str]]) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding='utf-8-sig')
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text == original:
        raise RuntimeError(f'No replacement made in {path}')
    file_path.write_text(text, encoding='utf-8')

replace_in_file('AGENTS.md', [
    ('supabase/024_schedule_entries_rpc.sql', 'supabase/002_current_updates.sql'),
])

for renderer_path in ['src/renderer/renderer.js', 'docs/renderer.js']:
    replace_in_file(renderer_path, [
        ('supabase/001_current_schema.sql 與 024_schedule_entries_rpc.sql',
         'supabase/001_current_schema.sql 與 002_current_updates.sql'),
    ])

replace_in_file('scripts/check-expansion-acceptance.js', [
    ('const mealV2Schema = read("supabase", "030_v2_meal_snapshot.sql");',
     'const databaseUpdates = read("supabase", "002_current_updates.sql");'),
    ('schema.includes("create or replace function public.save_meal_order") || mealV2Schema.includes("create or replace function public.save_meal_order_v2")',
     'schema.includes("create or replace function public.save_meal_order") || databaseUpdates.includes("create or replace function public.save_meal_order_v2")'),
])

replace_in_file('scripts/check-normalized-storage.js', [
    ('const scheduleEntryRpcMigration = fs.readFileSync(path.join(rootDir, "supabase", "024_schedule_entries_rpc.sql"), "utf8");',
     'const databaseUpdates = fs.readFileSync(path.join(rootDir, "supabase", "002_current_updates.sql"), "utf8");'),
    ('scheduleEntryRpcMigration.includes(', 'databaseUpdates.includes('),
])

alignment = ROOT / 'scripts/check-v2-alignment.js'
alignment_text = alignment.read_text(encoding='utf-8')
old_alignment_sql_files = '''  "supabase/027_v2_security.sql",
  "supabase/028_v2_attendance_clock.sql",
  "supabase/029_v2_attendance_admin.sql",
  "supabase/030_v2_meal_snapshot.sql",
  "supabase/031_v2_role_department_protection.sql",
  "supabase/032_v2_overtime_batch.sql",'''
if old_alignment_sql_files not in alignment_text:
    raise RuntimeError('check-v2-alignment SQL list not found')
alignment_text = alignment_text.replace(old_alignment_sql_files, '  "supabase/002_current_updates.sql",')
alignment_text = alignment_text.replace(
    'const security = read("supabase/027_v2_security.sql");',
    'const databaseUpdates = read("supabase/002_current_updates.sql");\nconst security = databaseUpdates;'
)
alignment_text = alignment_text.replace('const clock = read("supabase/028_v2_attendance_clock.sql");', 'const clock = databaseUpdates;')
alignment_text = alignment_text.replace('const attendanceAdmin = read("supabase/029_v2_attendance_admin.sql");', 'const attendanceAdmin = databaseUpdates;')
alignment_text = alignment_text.replace('const overtimeBatch = read("supabase/032_v2_overtime_batch.sql");', 'const overtimeBatch = databaseUpdates;')
alignment.write_text(alignment_text, encoding='utf-8')

final_check = ROOT / 'scripts/check-v2-final.js'
final_text = final_check.read_text(encoding='utf-8')
old_final_sql_files = '''  "supabase/027_v2_security.sql",
  "supabase/028_v2_attendance_clock.sql",
  "supabase/029_v2_attendance_admin.sql",
  "supabase/030_v2_meal_snapshot.sql",
  "supabase/031_v2_role_department_protection.sql",
  "supabase/032_v2_overtime_batch.sql",
  "supabase/033_v2_employee_visibility.sql",
  "supabase/034_v2_overtime_reapply.sql",
  "supabase/035_v2_last_admin.sql",
  "supabase/036_v2_synchronized_member_delete.sql",
  "supabase/037_v2_meal_subsidy_and_product_delete.sql",
  "supabase/043_harden_private_data_access.sql",'''
if old_final_sql_files not in final_text:
    raise RuntimeError('check-v2-final SQL list not found')
final_text = final_text.replace(old_final_sql_files, '  "supabase/002_current_updates.sql",')
final_text = final_text.replace(
    'const security = read("supabase/027_v2_security.sql");',
    'const databaseUpdates = read("supabase/002_current_updates.sql");\nconst security = databaseUpdates;'
)
for old in [
    'const visibility = read("supabase/033_v2_employee_visibility.sql");',
    'const hardenedAccess = read("supabase/043_harden_private_data_access.sql");',
    'const reapply = read("supabase/034_v2_overtime_reapply.sql");',
    'const lastAdmin = read("supabase/035_v2_last_admin.sql");',
    'const synchronizedDelete = read("supabase/036_v2_synchronized_member_delete.sql");',
    'const clockSql = read("supabase/028_v2_attendance_clock.sql");',
    'const adminSql = read("supabase/029_v2_attendance_admin.sql");',
    'const batchSql = read("supabase/032_v2_overtime_batch.sql");',
    'const mealSettingsSql = read("supabase/037_v2_meal_subsidy_and_product_delete.sql");',
]:
    name = old.split(' = ')[0].replace('const ', '')
    final_text = final_text.replace(old, f'const {name} = databaseUpdates;')
final_check.write_text(final_text, encoding='utf-8')

replace_in_file('scripts/deploy-v2-final.ps1', [
    ('Complete supabase/V2_SQL_ORDER_FINAL.md before deployment.',
     'Complete supabase/001_current_schema.sql and supabase/002_current_updates.sql before deployment.'),
])

# 刪除已整併 SQL 與重複說明文件。
for path in sql_sources:
    path.unlink()

for path in [
    SUPABASE / 'V2_DEPLOY.md',
    SUPABASE / 'V2_SQL_ORDER.md',
    SUPABASE / 'V2_SQL_ORDER_FINAL.md',
]:
    path.unlink()

# 清除盤點及一次性作業檔案。
for path in [
    SUPABASE / '_cleanup_summary.txt',
    SUPABASE / '_cleanup_inventory.txt',
    SUPABASE / '_cleanup_references.txt',
    ROOT / 'scripts/inventory_supabase_once.py',
    ROOT / 'scripts/find_supabase_refs_once.py',
    ROOT / '.github/workflows/inventory-supabase-once.yml',
    ROOT / 'scripts/cleanup_supabase_once.py',
    ROOT / '.github/workflows/cleanup-supabase-once.yml',
]:
    if path.exists():
        path.unlink()

migrations_dir = SUPABASE / 'migrations'
if migrations_dir.exists():
    try:
        migrations_dir.rmdir()
    except OSError:
        pass

# 最終基本驗證。
remaining_sql = sorted(path.relative_to(SUPABASE).as_posix() for path in SUPABASE.rglob('*.sql'))
remaining_md = sorted(path.relative_to(SUPABASE).as_posix() for path in SUPABASE.rglob('*.md'))
assert remaining_sql == ['001_current_schema.sql', '002_current_updates.sql'], remaining_sql
assert remaining_md == ['README.md'], remaining_md
assert 'create or replace function public.save_schedule_entries_bulk(entries jsonb)' in UPDATES.read_text(encoding='utf-8')
assert 'create or replace function public.get_employee_directory_v2()' in UPDATES.read_text(encoding='utf-8')
